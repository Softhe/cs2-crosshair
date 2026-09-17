import { clampCrosshair, type Crosshair } from './cs2-sharecode';

export interface CrosshairPreviewMetrics {
	length: number;
	thickness: number;
	edgeGap: number;
	outlineThickness: number;
	autoScale: number;
}

export type PreviewResolution = 'auto' | '1280x960-stretched' | '1920x1080' | '2560x1440';
export type PreviewZoom = 'exact' | '4x';

export { clampCrosshair, clampCrosshairNumber } from './cs2-sharecode';

export const PREVIEW_RESOLUTION_OPTIONS: ReadonlyArray<{ value: PreviewResolution; label: string; height?: number }> = [
	{ value: 'auto', label: 'Auto — browser viewport' },
	{ value: '1280x960-stretched', label: '1280×960 stretched', height: 960 },
	{ value: '1920x1080', label: '1920×1080', height: 1080 },
	{ value: '2560x1440', label: '2560×1440', height: 1440 },
];

export const isPreviewResolution = (value: string | null): value is PreviewResolution =>
	PREVIEW_RESOLUTION_OPTIONS.some((option) => option.value === value);

export const isPreviewZoom = (value: string | null): value is PreviewZoom => value === 'exact' || value === '4x';

export const getPreviewResolutionScale = (resolution: PreviewResolution, viewportHeight: number): number => {
	// 1280x960 stretched renders CS2 UI slightly smaller; 0.9 is an eyeballed
	// approximation, not a measured value. See docs/PREVIEW_CALIBRATION.md
	// before tuning: changes here require regenerated captures + matrix note.
	if (resolution === '1280x960-stretched') return 0.9;
	const selectedHeight = PREVIEW_RESOLUTION_OPTIONS.find((option) => option.value === resolution)?.height;
	const effectiveHeight = selectedHeight ?? viewportHeight;
	if (effectiveHeight <= 1080) return 1;
	if (effectiveHeight === 1440) return 1.3;
	return effectiveHeight / 1080;
};

export const getCrosshairPreviewMetrics = (crosshair: Crosshair, resolutionScale = 1, zoom = 1): CrosshairPreviewMetrics => {
	const safeCrosshair = clampCrosshair(crosshair);
	const renderScale = Math.max(0.5, resolutionScale) * Math.max(1, zoom);
	// Length uses ceil so sub-unit CS2 sizes still paint at least one raster
	// step; the x2 factor maps CS2 units to CSS pixels at 1080p (see the
	// "measured 1080p compact geometry" test). Thickness keeps its fractional
	// value instead, so 0.5 steps stay visible.
	const length = Math.max(0, Math.round(Math.ceil(safeCrosshair.length) * 2 * renderScale));
	const thickness = Math.max(1, Math.round(safeCrosshair.thickness * 2 * renderScale));
	// Integer gaps sit half a pixel off the raster grid versus fractional
	// ones; the +5/+4.5 offset recenters them. Calibrated eyeball values, not
	// measured CS2 pixels -- see docs/PREVIEW_CALIBRATION.md.
	const gapRasterOffset = Number.isInteger(safeCrosshair.gap) ? 5 : 4.5;
	const rawEdgeGap = Math.round((safeCrosshair.gap + gapRasterOffset) * renderScale);
	// Never let arms overlap past each other when the gap is very negative.
	const edgeGap = Math.max(rawEdgeGap, -Math.max(0, length - thickness));
	const outlineThickness = safeCrosshair.outlineEnabled && safeCrosshair.outline > 0
		? Math.max(1, Math.round(safeCrosshair.outline * renderScale))
		: 0;

	return {
		length,
		thickness,
		edgeGap,
		outlineThickness,
		autoScale: renderScale
	};
};
