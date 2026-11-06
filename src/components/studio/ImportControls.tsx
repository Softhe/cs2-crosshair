import { AlertCircle, Check, ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CrosshairShape } from '@/components/CrosshairShape';
import { parseShareCode } from '@/lib/crosshair-output';
import type { Crosshair } from '@/lib/cs2-sharecode';
import { getCrosshairPreviewMetrics } from '@/lib/crosshair-preview';

// Largest inspection zoom whose outer edge (arms + outline) still fits inside
// the thumbnail, so bigger presets are scaled down rather than clipped.
const THUMBNAIL_HALF_EXTENT = 18;
const getThumbnailZoom = (crosshair: Crosshair) => [4, 3, 2].find((zoom) => {
	const { length, thickness, edgeGap, outlineThickness } = getCrosshairPreviewMetrics(crosshair, 1, zoom);
	return Math.max(thickness / 2, edgeGap + length) + outlineThickness <= THUMBNAIL_HALF_EXTENT;
}) ?? 1;

export interface StudioPreset {
	name: string;
	description: string;
	crosshair: Crosshair;
}

interface ImportControlsProps {
	code: string;
	error: string;
	presets: StudioPreset[];
	onCodeChange: (value: string) => void;
	onPaste: () => void;
	onLoad: () => void;
	onPreset: (crosshair: Crosshair) => void;
}

export const ImportControls = ({ code, error, presets, onCodeChange, onPaste, onLoad, onPreset }: ImportControlsProps) => (
	<section data-testid="import-controls" className="space-y-4 p-5 md:p-6">
		<div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">1</span><div><h3 className="text-base font-semibold text-foreground">Import</h3><p className="text-sm text-muted-foreground">Paste a share code or start from a preset.</p></div></div>
		<div className="flex flex-col gap-2 sm:flex-row">
			<div className="relative min-w-0 flex-1">
				<Input aria-label="CS2 crosshair share code" aria-invalid={Boolean(error)} aria-describedby={error ? 'import-code-error' : undefined} value={code} onChange={(event) => onCodeChange(event.target.value)} spellCheck={false} autoCapitalize="none" autoCorrect="off" autoComplete="off" className="h-12 border-white/10 bg-background/70 pr-11 font-mono text-sm" />
				{!error && parseShareCode(code).valid && <Check className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-success" />}
			</div>
			<Button onClick={onPaste} variant="secondary" className="h-12 shrink-0 border border-white/10 bg-white/[0.05]"><ClipboardPaste className="h-4 w-4" /> Paste</Button>
			<Button onClick={onLoad} className="h-12 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">Load crosshair</Button>
		</div>
		{error && <div id="import-code-error" role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
		<div className="space-y-2">
			<span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Presets</span>
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
				{presets.map((preset) => (
					<button key={preset.name} type="button" onClick={() => onPreset(preset.crosshair)} title={preset.description} className="group flex flex-col overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] text-left transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
						<span aria-hidden="true" className="relative block h-14 w-full overflow-hidden border-b border-white/10 bg-[linear-gradient(135deg,#bca27d,#74614c_65%,#39322b)] transition-[filter] group-hover:brightness-110">
							<CrosshairShape crosshair={preset.crosshair} zoom={getThumbnailZoom(preset.crosshair)} />
						</span>
						<span className="px-2.5 py-2 text-xs font-medium text-foreground sm:text-sm">{preset.name}</span>
					</button>
				))}
			</div>
		</div>
	</section>
);
