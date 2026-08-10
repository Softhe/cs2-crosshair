import { Card } from '@/components/ui/card';
import { CrosshairShape } from '@/components/CrosshairShape';
import { getCrosshairPreviewColor, type Crosshair } from '@/lib/cs2-sharecode';
import { PREVIEW_RESOLUTION_OPTIONS, type PreviewResolution, type PreviewZoom } from '@/lib/crosshair-preview';
import { usePreviewPreferences } from '@/hooks/use-preview-preferences';

interface CustomCrosshairPreviewProps {
	crosshair: Crosshair;
	className?: string;
	embedded?: boolean;
}

export const CustomCrosshairPreview = ({ crosshair, className = '', embedded = false }: CustomCrosshairPreviewProps) => {
	const color = getCrosshairPreviewColor(crosshair);
	const activeColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
	const {
		resolution, setResolution, zoom, setZoom, resolutionScale, effectiveResolution, zoomMultiplier,
	} = usePreviewPreferences();

	return (
		<Card className={`overflow-hidden p-0 ${embedded ? 'rounded-none border-0 bg-transparent shadow-none' : 'border-white/10 bg-card/75 shadow-2xl shadow-black/25 backdrop-blur-xl'} ${className}`}>
			<div className={`flex gap-3 border-b border-white/10 bg-white/[0.03] ${embedded ? 'flex-row items-center justify-between px-3 py-2' : 'flex-col px-5 py-3 sm:flex-row sm:items-end sm:justify-between'}`}>
				<div>
					<h2 className="text-base font-semibold text-foreground">Live preview</h2>
					<p className="text-xs text-muted-foreground">{effectiveResolution} · {zoom === 'exact' ? 'Exact scale' : '4× inspection'}</p>
				</div>
				<div className={`flex items-end gap-2 ${embedded ? 'flex-nowrap' : 'flex-wrap'}`}>
					<label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
						<span className={embedded ? 'sr-only' : ''}>Preview resolution</span>
						<select
							aria-label="Preview resolution"
							value={resolution}
							onChange={(event) => setResolution(event.target.value as PreviewResolution)}
							className="h-9 rounded-md border border-white/10 bg-background/80 px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							{PREVIEW_RESOLUTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
						</select>
					</label>
					<div className="grid gap-1 text-[11px] font-medium text-muted-foreground">
						<span className={embedded ? 'sr-only' : ''}>Preview zoom</span>
						<div className="flex rounded-md border border-white/10 bg-background/60 p-0.5" role="group" aria-label="Preview zoom">
							{(['exact', '4x'] as PreviewZoom[]).map((value) => (
								<button key={value} type="button" aria-pressed={zoom === value} onClick={() => setZoom(value)} className={`h-8 rounded px-2 text-xs font-semibold ${zoom === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
									{value === 'exact' ? 'Exact' : '4× inspect'}
								</button>
							))}
						</div>
					</div>
					<div className={`${embedded ? 'h-6 w-6' : 'h-8 w-8'} shrink-0 rounded-full border border-white/20`} style={{ backgroundColor: activeColor }} role="img" aria-label={`Selected color ${activeColor}`} />
				</div>
			</div>
			<div className="p-4">
				<div data-testid="crosshair-stage" className={`relative flex items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(135deg,#d7b886,#8b7355_62%,#3d352c)] ${embedded ? 'aspect-[16/10] xl:aspect-[16/8.5] xl:max-h-[330px]' : 'aspect-[16/10]'}`} role="img" aria-label="Custom crosshair preview">
					<div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_26%,rgba(255,255,255,.26),transparent_15rem),linear-gradient(180deg,rgba(255,255,255,.1),rgba(0,0,0,.18))]" />
					<div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.45) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
					<div className="relative h-full w-full">
						<CrosshairShape crosshair={crosshair} resolutionScale={resolutionScale} zoom={zoomMultiplier} />
					</div>
				</div>
			</div>
		</Card>
	);
};
