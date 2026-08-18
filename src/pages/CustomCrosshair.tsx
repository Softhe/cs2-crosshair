import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
	ClipboardCopy,
	Crosshair as CrosshairIcon,
	Download,
	Palette,
	RotateCcw,
	Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AutoexecShortcut } from '@/components/studio/AutoexecShortcut';
import { CustomizeControls, type BooleanCrosshairKey, type NumberCrosshairKey } from '@/components/studio/CustomizeControls';
import { ImportControls, type StudioPreset } from '@/components/studio/ImportControls';
import { MobileQuickActions } from '@/components/studio/MobileQuickActions';
import { StudioPreviewPanel } from '@/components/studio/StudioPreviewPanel';
import { FirstRunGuide } from '@/components/studio/FirstRunGuide';
import { useToast } from '@/hooks/use-toast';
import { useMediaQuery } from '@/hooks/use-media-query';
import { PALETTE_OPTIONS, useStudioPreferences } from '@/hooks/use-studio-preferences';
import { copyToClipboard } from '@/lib/clipboard';
import {
	crosshairToConVars,
	decodeCrosshairShareCode,
	encodeCrosshair,
	type Crosshair
} from '@/lib/cs2-sharecode';
import { clampCrosshair } from '@/lib/crosshair-preview';
import { clearCustomCrosshair, loadCustomCrosshair, saveCustomCrosshair } from '@/lib/custom-crosshair-storage';
import { createAliasCommand, createConfigFileName } from '@/lib/crosshair-config';
import { generateConfig, generateConsoleCommand, validateShareCode } from '@/lib/crosshair-output';
import { getCurrentShareUrl, getShareCodeFromUrl, getShareCodeUrlPath } from '@/lib/share-url';
import { addToHistory, type CrosshairHistoryActivity } from '@/lib/storage';
import { hexToRgb, rgbToHex } from '@/lib/color';
import { trackStudioEvent, type StudioEventName } from '@/lib/observability';

const DEFAULT_CROSSHAIR: Crosshair = {
	length: 2,
	red: 0,
	green: 255,
	blue: 255,
	gap: -2,
	alphaEnabled: true,
	alpha: 255,
	outlineEnabled: false,
	outline: 1,
	color: 4,
	thickness: 1,
	centerDotEnabled: false,
	splitDistance: 7,
	fixedCrosshairGap: 3,
	innerSplitAlpha: 1,
	outerSplitAlpha: 0.5,
	splitSizeRatio: 0.3,
	tStyleEnabled: false,
	deployedWeaponGapEnabled: false,
	style: 4
};

const CrosshairHistory = lazy(() => import('@/components/CrosshairHistory').then(({ CrosshairHistory: Component }) => ({ default: Component })));

const DOT_CROSSHAIR_CODE = 'CSGO-zDZH2-jXXvr-yFaQu-OjXPS-G8sdA';
const PRESETS: StudioPreset[] = [
	{ name: 'Small static', description: 'Compact cyan crosshair with a slight negative gap.', crosshair: DEFAULT_CROSSHAIR },
	{
		name: 'Dot', description: 'Outlined cyan dot with a tight gap and full alpha.',
		crosshair: decodeCrosshairShareCode(DOT_CROSSHAIR_CODE)
	},
	{
		name: 'High visibility', description: 'Larger yellow arms for busy backgrounds.',
		crosshair: { ...DEFAULT_CROSSHAIR, length: 3.5, gap: -1, thickness: 1.5, outlineEnabled: true, outline: 1, color: 2 }
	},
	{
		name: 'Classic green', description: 'Traditional green static style with center dot.',
		crosshair: { ...DEFAULT_CROSSHAIR, length: 2.5, gap: -3, thickness: 1, centerDotEnabled: true, color: 1 }
	}
];

const getInitialCrosshair = (pathname: string, search: string): Crosshair => {
	const urlCode = getShareCodeFromUrl({ pathname, search });
	if (validateShareCode(urlCode).valid) return decodeCrosshairShareCode(urlCode);
	return loadCustomCrosshair(DEFAULT_CROSSHAIR);
};

const CustomCrosshair = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const initialUrlCode = getShareCodeFromUrl(location);
	const [crosshair, setCrosshair] = useState<Crosshair>(() => getInitialCrosshair(location.pathname, location.search));
	const [importCode, setImportCode] = useState(() => initialUrlCode || encodeCrosshair(getInitialCrosshair(location.pathname, location.search)));
	const [importError, setImportError] = useState(() => initialUrlCode && !validateShareCode(initialUrlCode).valid ? validateShareCode(initialUrlCode).error || '' : '');
	const [aliasName, setAliasName] = useState('');
	const [customColorOpen, setCustomColorOpen] = useState(false);
	const { palette, setPalette, showGuide, dismissGuide } = useStudioPreferences();
	const [historyKey, setHistoryKey] = useState(0);
	const desktopStudioLayout = useMediaQuery('(min-width: 1280px)');
	const narrowStudioLayout = useMediaQuery('(max-width: 767px)');
	const ultrawideStudioLayout = useMediaQuery('(min-width: 1600px)');
	const suppressedDraftCode = useRef<string | null>(null);
	const pendingUrlCode = useRef<string | undefined>(undefined);
	const lastExternalHistoryCode = useRef<string | null>(null);
	const { toast } = useToast();

	const shareCode = useMemo(() => encodeCrosshair(crosshair), [crosshair]);
	const convars = useMemo(() => crosshairToConVars(crosshair), [crosshair]);
	const customHexColor = rgbToHex(crosshair.red, crosshair.green, crosshair.blue);
	const trimmedAliasName = aliasName.trim();
	const [defaultFileName] = useState(() => createConfigFileName());
	const previewFileName = useMemo(() => trimmedAliasName ? createConfigFileName(trimmedAliasName) : defaultFileName, [defaultFileName, trimmedAliasName]);
	const previewAliasCommand = useMemo(() => createAliasCommand(trimmedAliasName || undefined, previewFileName), [trimmedAliasName, previewFileName]);

	const recordCrosshairHistory = useCallback((nextCrosshair: Crosshair, activity: CrosshairHistoryActivity, nextAliasName?: string) => {
		const normalized = clampCrosshair(nextCrosshair);
		addToHistory({
			shareCode: encodeCrosshair(normalized),
			aliasName: nextAliasName?.trim() || undefined,
			activity,
			settings: {
				style: normalized.style,
				length: normalized.length,
				thickness: normalized.thickness,
				gap: normalized.gap,
				outline: normalized.outline,
				outlineEnabled: normalized.outlineEnabled,
				centerDotEnabled: normalized.centerDotEnabled,
				color: normalized.color,
				alpha: normalized.alpha,
				alphaEnabled: normalized.alphaEnabled
			}
		});
		setHistoryKey((current) => current + 1);
	}, []);

	useEffect(() => { trackStudioEvent('studio_loaded'); }, []);

	useEffect(() => {
		if (suppressedDraftCode.current === shareCode) {
			suppressedDraftCode.current = null;
			clearCustomCrosshair();
			return;
		}
		saveCustomCrosshair(crosshair);
	}, [crosshair, shareCode]);

	useEffect(() => {
		const urlCode = getShareCodeFromUrl({ pathname: location.pathname, search: location.search });
		if (pendingUrlCode.current !== undefined) {
			if (urlCode === pendingUrlCode.current) {
				pendingUrlCode.current = undefined;
			}
			return;
		}
		if (!urlCode) {
			// URL navigation is external state; mirror it into the editor after the location changes.
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setImportCode(shareCode);
			setImportError('');
			return;
		}
		const validation = validateShareCode(urlCode);
		if (!validation.valid) {
			trackStudioEvent('import_failed');
			setImportCode(urlCode);
			setImportError(validation.error || 'Enter a valid CS2 crosshair share code.');
			return;
		}
		const decoded = decodeCrosshairShareCode(urlCode);
		if (lastExternalHistoryCode.current !== urlCode) {
			lastExternalHistoryCode.current = urlCode;
			recordCrosshairHistory(decoded, 'imported');
		}
		if (urlCode === shareCode) {
			setImportCode(urlCode);
			setImportError('');
			return;
		}
		setCrosshair(decoded);
		setImportCode(urlCode);
		setImportError('');
	}, [location.pathname, location.search, recordCrosshairHistory, shareCode]);

	const applyCrosshair = useCallback((nextCrosshair: Crosshair) => {
		const next = clampCrosshair(nextCrosshair);
		const nextCode = encodeCrosshair(next);
		setCrosshair(next);
		setImportCode(nextCode);
		setImportError('');
		pendingUrlCode.current = getShareCodeFromUrl(location) === nextCode ? undefined : nextCode;
		navigate(getShareCodeUrlPath(nextCode), { replace: true });
	}, [location, navigate]);

	const updateNumber = (key: NumberCrosshairKey, value: number) => applyCrosshair({ ...crosshair, [key]: value });
	const updateBoolean = (key: BooleanCrosshairKey, value: boolean) => applyCrosshair({ ...crosshair, [key]: value });
	const updateCustomColor = (hex: string) => {
		const rgb = hexToRgb(hex);
		if (rgb) applyCrosshair({ ...crosshair, color: 5, ...rgb });
	};

	const addCurrentToHistory = useCallback(() => recordCrosshairHistory(crosshair, 'exported', trimmedAliasName), [crosshair, recordCrosshairHistory, trimmedAliasName]);

	const handleImport = useCallback(() => {
		const validation = validateShareCode(importCode);
		if (!validation.valid) {
			trackStudioEvent('import_failed');
			setImportError(validation.error || 'Enter a valid CS2 crosshair share code.');
			toast({ title: 'Import failed', description: validation.error, variant: 'destructive' });
			return;
		}
		const decoded = decodeCrosshairShareCode(importCode.trim());
		lastExternalHistoryCode.current = encodeCrosshair(decoded);
		applyCrosshair(decoded);
		recordCrosshairHistory(decoded, 'imported');
		trackStudioEvent('import_succeeded');
		toast({ title: 'Crosshair loaded', description: 'The editor and preview now use this share code.' });
	}, [applyCrosshair, importCode, recordCrosshairHistory, toast]);

	const handlePaste = async () => {
		let clipboardValue = '';
		try {
			if (!navigator.clipboard?.readText) throw new Error('Clipboard reading is not available in this browser.');
			clipboardValue = (await navigator.clipboard.readText()).trim();
			const validation = validateShareCode(clipboardValue);
			if (!validation.valid) throw new Error(validation.error);
			setImportCode(clipboardValue);
			const decoded = decodeCrosshairShareCode(clipboardValue);
			lastExternalHistoryCode.current = encodeCrosshair(decoded);
			applyCrosshair(decoded);
			recordCrosshairHistory(decoded, 'imported');
			trackStudioEvent('import_succeeded');
			toast({ title: 'Crosshair pasted', description: 'Ready to tune.' });
		} catch (error) {
			trackStudioEvent('import_failed');
			const description = clipboardValue
				? (error instanceof Error ? error.message : 'Enter a valid CS2 crosshair share code.')
				: 'Clipboard blocked. Paste with Ctrl+V.';
			if (clipboardValue) setImportCode(clipboardValue);
			setImportError(description);
		}
	};

	const handleReset = () => {
		const defaultCode = encodeCrosshair(DEFAULT_CROSSHAIR);
		clearCustomCrosshair();
		suppressedDraftCode.current = shareCode === defaultCode ? null : defaultCode;
		setCrosshair({ ...DEFAULT_CROSSHAIR });
		setImportCode(defaultCode);
		setImportError('');
		setAliasName('');
		setCustomColorOpen(false);
		pendingUrlCode.current = getShareCodeFromUrl(location) ? '' : undefined;
		navigate('/', { replace: true });
	};

	const handleCopy = async (value: string, title: string, track = false, eventName?: StudioEventName) => {
		try {
			await copyToClipboard(value);
			if (track) addCurrentToHistory();
			if (eventName) trackStudioEvent(eventName);
			toast({ title, description: 'Copied to clipboard.' });
		} catch {
			toast({ title: 'Copy failed', description: 'Unable to write to clipboard.', variant: 'destructive' });
		}
	};

	const handleDownload = () => {
		const fileName = previewFileName;
		const blob = new Blob([generateConfig(shareCode, fileName, trimmedAliasName || undefined)], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = fileName;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(url);
		addCurrentToHistory();
		trackStudioEvent('download_cfg');
		toast({ title: 'CFG downloaded', description: `${fileName} is ready for your CS2 config folder.` });
	};

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
				event.preventDefault();
				void handleCopy(generateConsoleCommand(shareCode), 'Console command copied', true, 'copy_command');
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	});

	const handleHistorySelect = (code: string, alias?: string) => {
		applyCrosshair(decodeCrosshairShareCode(code));
		setAliasName(alias || '');
		trackStudioEvent('history_loaded');
		toast({ title: 'Crosshair loaded', description: 'Loaded from your saved crosshairs.' });
	};

	return (
		<div className="mx-auto flex w-full max-w-7xl flex-col gap-2 pb-20 md:gap-4 md:pb-0 min-[1600px]:max-w-[1680px]">
			<header>
				<Link to="/" aria-label="CS2 Crosshair Studio home" className="group block w-fit max-w-full space-y-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background md:space-y-2">
					<div className="hidden items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary sm:inline-flex">
						<CrosshairIcon className="h-3.5 w-3.5" /> One workspace
					</div>
					<h1 className="text-3xl font-semibold leading-tight tracking-normal text-foreground transition-colors group-hover:text-primary sm:text-4xl md:text-5xl">CS2 Crosshair Studio</h1>
					<p className="max-w-2xl text-sm leading-snug text-muted-foreground sm:text-base sm:leading-relaxed md:text-lg xl:leading-normal">Paste a crosshair, tune it, then download a ready-to-use CFG.</p>
				</Link>
			</header>
			{showGuide && <FirstRunGuide onDismiss={dismissGuide} />}

			<Card data-testid="control-center" className="overflow-hidden border-white/10 bg-card/75 p-0 shadow-2xl shadow-black/25 backdrop-blur-xl">
					<div className="flex flex-col gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-3 sm:gap-4 sm:px-5 sm:py-4 md:px-6 lg:flex-row lg:items-center lg:justify-between">
						<div><h2 className="text-base font-semibold text-foreground sm:text-lg">Studio workspace</h2><p className="hidden text-sm text-muted-foreground sm:block">Every editor tool, preview, and export action in one compact surface.</p></div>
						<div className="flex items-end gap-2 sm:gap-3">
							<fieldset className="min-w-0" aria-label="Visual palette">
								<legend className="sr-only sm:not-sr-only sm:mb-1.5 sm:flex sm:items-center sm:gap-1.5 sm:text-[11px] sm:font-semibold sm:uppercase sm:tracking-[0.14em] sm:text-muted-foreground"><Palette className="h-3.5 w-3.5" />Palette</legend>
								<div className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-background/45 p-1">
									{PALETTE_OPTIONS.map((option) => <button key={option.value} type="button" aria-pressed={palette === option.value} title={option.description} onClick={() => { setPalette(option.value); trackStudioEvent('palette_changed'); }} className={`flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-semibold transition-all sm:gap-2 sm:px-2.5 sm:text-xs ${palette === option.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground'}`}><span className="hidden -space-x-1 sm:flex" aria-hidden="true"><span className="h-3 w-3 rounded-full border border-background" style={{ backgroundColor: option.colors[0] }} /><span className="h-3 w-3 rounded-full border border-background" style={{ backgroundColor: option.colors[1] }} /></span>{option.name}</button>)}
								</div>
							</fieldset>
							<Button onClick={handleReset} variant="outline" aria-label="Reset" className="h-10 shrink-0 border-white/10 bg-white/[0.04] px-3 sm:px-4"><RotateCcw className="h-4 w-4" /><span className="hidden sm:inline">Reset</span></Button>
						</div>
					</div>

					<div data-testid="editor-layout" className="studio-editor-layout grid items-start xl:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)]">
						<div data-testid="editor-left-stack" className="divide-y divide-white/10 xl:self-start xl:border-r xl:border-white/10">
						<ImportControls code={importCode} error={importError} presets={PRESETS} onCodeChange={(value) => { setImportCode(value); setImportError(''); }} onPaste={handlePaste} onLoad={handleImport} onPreset={(next) => { trackStudioEvent('preset_selected'); applyCrosshair(next); }} />

						<CustomizeControls crosshair={crosshair} customHexColor={customHexColor} customColorOpen={customColorOpen} onCustomColorOpenChange={setCustomColorOpen} onCustomColorChange={updateCustomColor} onNumberChange={updateNumber} onBooleanChange={updateBoolean} />
						{desktopStudioLayout && !ultrawideStudioLayout ? <div className="p-4 md:p-5"><Suspense fallback={<div className="h-32 animate-pulse rounded-lg border border-white/10 bg-card/30" role="status" aria-label="Loading saved crosshairs" />}><CrosshairHistory key={historyKey} onSelectCrosshair={handleHistorySelect} /></Suspense></div> : null}
						</div>

						<div data-testid="editor-right-stack" className="divide-y divide-white/10 border-t border-white/10 xl:self-start xl:border-t-0">
							<StudioPreviewPanel crosshair={crosshair} compact={narrowStudioLayout} />
						<section data-testid="export-controls" className="space-y-4 p-5 md:p-6">
							<div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">3</span><div><h3 className="text-base font-semibold text-foreground">Save & switch</h3><p className="text-sm text-muted-foreground">Download the CFG and keep an alias ready for your next match.</p></div></div><span className="shrink-0 rounded-full border border-success/25 bg-success/10 px-2 py-1 text-xs text-success">CS2 ready</span></div>
							<code className="block break-all rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-foreground">{shareCode}</code>
							<div className="grid gap-2 sm:grid-cols-2"><Button onClick={() => handleCopy(generateConsoleCommand(shareCode), 'Console command copied', true, 'copy_command')} className="bg-primary text-primary-foreground hover:bg-primary/90"><ClipboardCopy className="h-4 w-4" />Copy command</Button><Button onClick={handleDownload} variant="outline" className="border-accent/40 bg-accent/10 text-foreground hover:bg-accent/15"><Download className="h-4 w-4" />Download CFG</Button><Button onClick={() => handleCopy(shareCode, 'Share code copied', true, 'copy_code')} variant="secondary" className="border border-white/10 bg-white/[0.05]"><ClipboardCopy className="h-4 w-4" />Copy code</Button><Button onClick={() => handleCopy(getCurrentShareUrl(shareCode), 'Share link copied', true, 'share_link')} variant="secondary" className="border border-white/10 bg-white/[0.05]"><Share2 className="h-4 w-4" />Share link</Button></div>
							<AutoexecShortcut aliasName={aliasName} onAliasNameChange={setAliasName} fileName={previewFileName} aliasCommand={previewAliasCommand} onCopyAlias={() => handleCopy(previewAliasCommand, 'Alias command copied', true)} />
							<details className="rounded-lg border border-white/10 bg-background/45"><summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">Show generated convars</summary><pre className="max-h-44 overflow-auto border-t border-white/10 p-3 text-xs text-muted-foreground">{convars}</pre></details>
							<p className="text-xs text-muted-foreground">Tip: Ctrl + Enter copies the command.</p>
						</section>
						</div>
						{ultrawideStudioLayout ? (
							<aside data-testid="editor-library-column" className="min-w-0 border-l border-white/10 p-5">
								<Suspense fallback={<div className="h-32 animate-pulse rounded-lg border border-white/10 bg-card/30" role="status" aria-label="Loading saved crosshairs" />}><CrosshairHistory key={historyKey} onSelectCrosshair={handleHistorySelect} /></Suspense>
							</aside>
						) : null}
					</div>
			</Card>

			{!desktopStudioLayout ? <Suspense fallback={<div className="h-32 animate-pulse rounded-lg border border-white/10 bg-card/30" role="status" aria-label="Loading saved crosshairs" />}><CrosshairHistory key={historyKey} onSelectCrosshair={handleHistorySelect} /></Suspense> : null}
			{narrowStudioLayout && <MobileQuickActions onCopy={() => handleCopy(generateConsoleCommand(shareCode), 'Console command copied', true, 'copy_command')} onDownload={handleDownload} />}
		</div>
	);
};

export default CustomCrosshair;
