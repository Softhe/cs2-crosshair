import { lazy, Suspense } from 'react';
import { Check, Pipette, Wand2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import type { Crosshair } from '@/lib/cs2-sharecode';

const HexColorPicker = lazy(() => import('react-colorful').then(({ HexColorPicker: Component }) => ({ default: Component })));

const COLOR_OPTIONS = [
	{ label: 'Red', value: 0, swatch: 'rgb(255, 0, 0)' },
	{ label: 'Green', value: 1, swatch: 'rgb(0, 255, 0)' },
	{ label: 'Yellow', value: 2, swatch: 'rgb(255, 255, 0)' },
	{ label: 'Blue', value: 3, swatch: 'rgb(0, 0, 255)' },
	{ label: 'Cyan', value: 4, swatch: 'rgb(0, 255, 255)' }
];

export type NumberCrosshairKey = { [K in keyof Crosshair]: Crosshair[K] extends number ? K : never }[keyof Crosshair];
export type BooleanCrosshairKey = { [K in keyof Crosshair]: Crosshair[K] extends boolean ? K : never }[keyof Crosshair];

interface SettingSliderProps {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	disabled?: boolean;
	onChange: (value: number) => void;
}

const SettingSlider = ({ label, value, min, max, step, disabled, onChange }: SettingSliderProps) => (
	<div data-setting-slider={label} className={disabled ? 'space-y-2 opacity-45' : 'space-y-2'}>
		<div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-foreground">{label}</span><span className="rounded border border-white/10 bg-background/70 px-2 py-1 font-mono text-xs text-muted-foreground">{value.toFixed(step < 1 ? 1 : 0)}</span></div>
		<Slider thumbLabel={label} value={[value]} min={min} max={max} step={step} disabled={disabled} onValueChange={([next]) => onChange(next)} />
	</div>
);

const SettingToggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) => (
	<label className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${checked ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-white/10 bg-background/45 text-muted-foreground hover:bg-white/[0.05]'}`}><span>{label}</span><Checkbox checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} /></label>
);

interface CustomizeControlsProps {
	crosshair: Crosshair;
	customHexColor: string;
	customColorOpen: boolean;
	onCustomColorOpenChange: (open: boolean) => void;
	onCustomColorChange: (hex: string) => void;
	onNumberChange: (key: NumberCrosshairKey, value: number) => void;
	onBooleanChange: (key: BooleanCrosshairKey, value: boolean) => void;
}

export const CustomizeControls = ({ crosshair, customHexColor, customColorOpen, onCustomColorOpenChange, onCustomColorChange, onNumberChange, onBooleanChange }: CustomizeControlsProps) => (
	<section data-testid="customize-controls" className="space-y-6 p-5 md:p-6">
		<div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">2</span><div><h3 className="text-base font-semibold text-foreground">Customize</h3><p className="text-sm text-muted-foreground">Every change updates the preview and output instantly.</p></div></div><Wand2 className="mt-1 h-5 w-5 shrink-0 text-primary" /></div>
		<div className="grid gap-6 lg:grid-cols-2">
			<div data-testid="slider-stack" className="space-y-5">
				<h4 className="text-sm font-semibold text-foreground">Shape</h4>
				<SettingSlider label="Length" value={crosshair.length} min={0} max={10} step={0.5} onChange={(value) => onNumberChange('length', value)} />
				<SettingSlider label="Thickness" value={crosshair.thickness} min={0.5} max={6} step={0.5} onChange={(value) => onNumberChange('thickness', value)} />
				<SettingSlider label="Gap" value={crosshair.gap} min={-10} max={10} step={0.5} onChange={(value) => onNumberChange('gap', value)} />
				<SettingSlider label="Outline thickness" value={crosshair.outline} min={0} max={3} step={0.5} disabled={!crosshair.outlineEnabled} onChange={(value) => onNumberChange('outline', value)} />
				<SettingSlider label="Alpha" value={crosshair.alpha} min={0} max={255} step={1} disabled={!crosshair.alphaEnabled} onChange={(value) => onNumberChange('alpha', value)} />
			</div>
			<div className="space-y-5">
				<div className="space-y-3"><h4 className="text-sm font-semibold text-foreground">Color</h4><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{COLOR_OPTIONS.map((option) => <button key={option.value} type="button" aria-pressed={crosshair.color === option.value} onClick={() => onNumberChange('color', option.value)} className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${crosshair.color === option.value ? 'border-primary bg-primary/15 text-foreground' : 'border-white/10 bg-background/45 text-muted-foreground hover:bg-white/[0.06]'}`}><span className="h-4 w-4 shrink-0 rounded-full border border-white/25" style={{ background: option.swatch }} />{option.label}{crosshair.color === option.value && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}</button>)}<Popover open={customColorOpen} onOpenChange={onCustomColorOpenChange}><PopoverTrigger asChild><button type="button" aria-pressed={crosshair.color === 5} onClick={() => onNumberChange('color', 5)} className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${crosshair.color === 5 ? 'border-primary bg-primary/15 text-foreground' : 'border-white/10 bg-background/45 text-muted-foreground hover:bg-white/[0.06]'}`}><span className="h-4 w-4 shrink-0 rounded-full border border-white/25" style={{ backgroundColor: customHexColor }} />Custom{crosshair.color === 5 ? <Check className="ml-auto h-3.5 w-3.5 text-primary" /> : <Pipette className="ml-auto h-3.5 w-3.5" />}</button></PopoverTrigger><PopoverContent align="end" className="w-72 border-white/10 bg-popover/95 p-4 shadow-2xl backdrop-blur-xl"><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-foreground">Choose custom color</h3><p className="text-xs text-muted-foreground">Drag across the palette to fine-tune it.</p></div><span className="h-8 w-8 rounded-md border border-white/20" style={{ backgroundColor: customHexColor }} /></div><Suspense fallback={<div className="h-44 w-full animate-pulse rounded-lg bg-white/[0.05]" aria-label="Loading color picker" />}><HexColorPicker color={customHexColor} onChange={onCustomColorChange} className="!h-44 !w-full" /></Suspense><div className="mt-3 flex items-center justify-between rounded-md border border-white/10 bg-background/60 px-3 py-2"><span className="text-xs text-muted-foreground">Hex</span><code className="text-xs font-medium uppercase text-foreground">{customHexColor}</code></div></PopoverContent></Popover></div></div>
				<div className="space-y-3"><h4 className="text-sm font-semibold text-foreground">Visibility</h4><div className="grid gap-2 sm:grid-cols-2"><SettingToggle label="Center dot" checked={crosshair.centerDotEnabled} onChange={(value) => onBooleanChange('centerDotEnabled', value)} /><SettingToggle label="Outline" checked={crosshair.outlineEnabled} onChange={(value) => onBooleanChange('outlineEnabled', value)} /><SettingToggle label="Use alpha" checked={crosshair.alphaEnabled} onChange={(value) => onBooleanChange('alphaEnabled', value)} /><SettingToggle label="T style" checked={crosshair.tStyleEnabled} onChange={(value) => onBooleanChange('tStyleEnabled', value)} /></div></div>
			</div>
		</div>
	</section>
);
