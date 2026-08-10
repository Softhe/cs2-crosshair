import { useRef, type ChangeEvent, type MouseEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, Star, Trash2, Download, Copy, Share2, Database, Search, Upload, FileDown, FileUp } from 'lucide-react';
import { exportAllData, importAllData, isFavorited } from '@/lib/storage';
import type { CrosshairData } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { copyToClipboard } from '@/lib/clipboard';
import { getCurrentShareUrl } from '@/lib/share-url';
import { useCrosshairLibrary } from '@/hooks/use-crosshair-library';

interface CrosshairHistoryProps {
	onSelectCrosshair: (shareCode: string, aliasName?: string) => void;
}

export const CrosshairHistory = ({ onSelectCrosshair }: CrosshairHistoryProps) => {
	const {
		history, favorites, filteredHistory, filteredFavorites, query, setQuery,
		commitAliasValue, remove, toggle, refresh, resetDraftAliases,
	} = useCrosshairLibrary();
	const backupInputRef = useRef<HTMLInputElement>(null);
	const { toast } = useToast();

	const handleExportBackup = () => {
		const blob = new Blob([exportAllData()], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `cs2-crosshair-backup-${new Date().toISOString().slice(0, 10)}.json`;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(url);
		toast({ title: 'Backup exported', description: 'Your local history and favorites are saved to a JSON file.' });
	};

	const handleImportBackup = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;

		try {
			const result = importAllData(await file.text());
			if (!result.success) throw new Error(result.error || 'Invalid backup file');
			resetDraftAliases();
			refresh();
			toast({ title: 'Backup imported', description: 'Your local history and favorites have been restored.' });
		} catch (error) {
			toast({ title: 'Backup import failed', description: error instanceof Error ? error.message : 'Invalid backup file', variant: 'destructive' });
		}
	};

	const handleDelete = (id: string) => {
		remove(id);
		toast({
			title: "Removed",
			description: "Crosshair removed from history",
		});
	};

	const handleToggleFavorite = (crosshair: CrosshairData) => {
		try {
			const isFav = toggle(crosshair);
			toast({
				title: isFav ? "Added to favorites" : "Removed from favorites",
				description: isFav ? "Crosshair saved to favorites" : "Crosshair removed from favorites",
			});
		} catch (error) {
			toast({
				title: "Error",
				description: error instanceof Error ? error.message : "Failed to update favorites",
				variant: "destructive",
			});
		}
	};

	const handleCopyShareLink = async (shareCode: string) => {
		try {
			await copyToClipboard(getCurrentShareUrl(shareCode));
			toast({
				title: "Share link copied!",
				description: "Anyone opening this link will load this crosshair automatically.",
			});
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to copy share link. Please copy manually.",
				variant: "destructive",
			});
		}
	};
	const handleCopyShareCode = async (shareCode: string) => {
		try {
			await copyToClipboard(shareCode);
			toast({
				title: "Copied!",
				description: "Share code copied to clipboard",
			});
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to copy. Please copy manually.",
				variant: "destructive",
			});
		}
	};

	const formatDate = (timestamp: number) => {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;

		return date.toLocaleDateString();
	};

	const CrosshairItem = ({ item, showDelete = true }: { item: CrosshairData; showDelete?: boolean }) => {
		const isFav = isFavorited(item.shareCode);
		const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
			if ((event.target as HTMLElement).closest('[data-history-actions]')) return;
			onSelectCrosshair(item.shareCode, item.aliasName);
		};

		return (
			<div
				data-testid="history-item"
				data-activity={item.activity}
				onClick={handleCardClick}
				title="Load this crosshair"
				className="group cursor-pointer rounded-lg border border-tactical-blue/20 bg-secondary/30 p-4 transition-all duration-200 hover:border-neon-cyan/30 hover:bg-secondary/50"
			>
				<div className="flex items-start justify-between gap-3">
					<div className="flex-1 min-w-0">
						<div className="mb-2 grid min-w-0 gap-2">
							<Input
								key={`${item.id}:${item.aliasName || ''}`}
								aria-label={`Name ${item.aliasName || 'crosshair'}`}
								defaultValue={item.aliasName ?? ''}
								placeholder="Name this crosshair"
								maxLength={48}
								title={item.aliasName || 'Name this crosshair'}
								className="h-9 w-full min-w-0 border-white/10 bg-background/50 text-sm font-semibold text-neon-cyan"
								onClick={(event) => event.stopPropagation()}
								onBlur={(event) => commitAliasValue(item, event.currentTarget.value)}
								onKeyDown={(event) => {
									if (event.key !== 'Enter') return;
									event.preventDefault();
									commitAliasValue(item, event.currentTarget.value);
								}}
							/>
							<div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground flex items-center gap-1">
								<Clock className="w-3 h-3" />
								{formatDate(item.timestamp)}
							</span>
							{item.activity && <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{item.activity === 'imported' ? <Search className="h-3 w-3" /> : <Upload className="h-3 w-3" />}{item.activity === 'imported' ? 'Loaded' : 'Exported'}</span>}
							</div>
						</div>
						<code className="text-xs text-muted-foreground font-mono block truncate">
							{item.shareCode}
						</code>
						{item.settings && (
							<div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
								<span>Style: {item.settings.style}</span>
								<span>•</span>
								<span>Size: {item.settings.length}</span>
								<span>•</span>
								<span>Gap: {item.settings.gap}</span>
							</div>
						)}
					</div>
					<div data-history-actions="" className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
						<Button
							onClick={() => handleToggleFavorite(item)}
							variant="ghost"
							size="icon"
							className="h-10 w-10"
							title={isFav ? "Remove from favorites" : "Add to favorites"}
							aria-label={`${isFav ? "Remove" : "Add"} ${item.aliasName || "crosshair"} ${isFav ? "from" : "to"} favorites`}
						>
							<Star className={`w-4 h-4 ${isFav ? 'fill-yellow-500 text-yellow-500' : ''}`} />
						</Button>
						<Button
							onClick={() => handleCopyShareCode(item.shareCode)}
							variant="ghost"
							size="icon"
							className="h-10 w-10"
							title="Copy share code"
							aria-label={`Copy share code for ${item.aliasName || "crosshair"}`}
						>
							<Copy className="w-4 h-4" />
						</Button>
						<Button
							onClick={() => handleCopyShareLink(item.shareCode)}
							variant="ghost"
							size="icon"
							className="h-10 w-10 text-primary hover:text-primary"
							title="Copy share link"
							aria-label={`Copy share link for ${item.aliasName || "crosshair"}`}
						>
							<Share2 className="w-4 h-4" />
						</Button>
						<Button
							onClick={() => onSelectCrosshair(item.shareCode, item.aliasName)}
							variant="ghost"
							size="icon"
							className="h-10 w-10"
							title="Load crosshair"
							aria-label={`Load ${item.aliasName || "crosshair"}`}
						>
							<Download className="w-4 h-4" />
						</Button>
						{showDelete && (
							<Button
								onClick={() => handleDelete(item.id)}
								variant="ghost"
								size="icon"
								className="h-10 w-10 text-destructive hover:text-destructive"
								title="Remove from history"
								aria-label={`Remove ${item.aliasName || "crosshair"} from history`}
							>
								<Trash2 className="w-4 h-4" />
							</Button>
						)}
					</div>
				</div>
			</div>
		);
	};

	return (
		<Card data-testid="local-crosshair-library" className="card-gaming p-3 md:p-6">
			<div className="mb-2 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-start sm:justify-between">
				<div className="flex items-start gap-3">
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"><Database className="h-4 w-4" /></span>
					<div><h2 className="text-lg font-semibold text-foreground">Local crosshair library</h2><p className="text-xs text-muted-foreground sm:text-sm">Codes you load or export are saved only in this browser.</p></div>
				</div>
				<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
					<Button type="button" variant="outline" size="sm" onClick={handleExportBackup}><FileDown className="h-4 w-4" />Export backup</Button>
					<Button type="button" variant="outline" size="sm" onClick={() => backupInputRef.current?.click()}><FileUp className="h-4 w-4" />Import backup</Button>
					<input ref={backupInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportBackup} aria-label="Import crosshair backup" />
					<span className="hidden w-fit self-center rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-xs font-medium text-success sm:inline-flex">On this device</span>
				</div>
			</div>
			<div className="mb-2 sm:mb-4">
				<label htmlFor="history-search" className="sr-only">Search saved crosshairs</label>
				<div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="history-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or share code" className="pl-9" /></div>
			</div>
			<Tabs defaultValue="recent" className="w-full">
				<TabsList className="mb-2 grid h-11 w-full grid-cols-2 p-0 sm:mb-4">
					<TabsTrigger value="recent" className="flex h-full items-center gap-2">
						<Clock className="w-4 h-4" />
						Recent ({history.length})
					</TabsTrigger>
					<TabsTrigger value="favorites" className="flex h-full items-center gap-2">
						<Star className="w-4 h-4" />
						Favorites ({favorites.length})
					</TabsTrigger>
				</TabsList>

				<TabsContent value="recent" className="mt-0">
					{history.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
							<p>No recent crosshairs</p>
							<p className="text-sm mt-1">Load a share code or export your current crosshair to save it here.</p>
						</div>
					) : filteredHistory.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground"><Search className="w-10 h-10 mx-auto mb-3 opacity-50" /><p>No matching crosshairs</p><p className="text-sm mt-1">Try a different name or share-code fragment.</p></div>
					) : (
						<div className="max-h-[280px] overflow-y-auto pr-4">
							<div className="space-y-3">
								{filteredHistory.map((item) => (
									<CrosshairItem key={item.id} item={item} />
								))}
							</div>
						</div>
					)}
				</TabsContent>

				<TabsContent value="favorites" className="mt-0">
					{favorites.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
							<p>No favorite crosshairs yet</p>
							<p className="text-sm mt-1">Click the star icon to save your favorites</p>
						</div>
					) : filteredFavorites.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground"><Search className="w-10 h-10 mx-auto mb-3 opacity-50" /><p>No matching favorites</p><p className="text-sm mt-1">Try a different name or share-code fragment.</p></div>
					) : (
						<div className="max-h-[280px] overflow-y-auto pr-4">
							<div className="space-y-3">
								{filteredFavorites.map((item) => (
									<CrosshairItem key={item.id} item={item} showDelete={false} />
								))}
							</div>
						</div>
					)}
				</TabsContent>
			</Tabs>
		</Card>
	);
};
