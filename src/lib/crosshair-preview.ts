import type { Crosshair } from './cs2-sharecode';

export interface CrosshairPreviewMetrics {
	length: number;
	thickness: number;
	edgeGap: number;
	outlineThickness: number;
	autoScale: number;
}

export type PreviewResolution = 'auto' | '1280x960-stretched' | '1920x1080' | '2560x1440';
export type PreviewZoom = 'exact' | '4x';

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
	if (resolution === '1280x960-stretched') return 0.9;
	const selectedHeight = PREVIEW_RESOLUTION_OPTIONS.find((option) => option.value === resolution)?.height;
	const effectiveHeight = selectedHeight ?? viewportHeight;
	if (effectiveHeight <= 1080) return 1;
	if (effectiveHeight === 1440) return 1.3;
	return effectiveHeight / 1080;
};

export const clampCrosshairNumber = (value: number, min: number, max: number): number => {
	if (!Number.isFinite(value)) {
		return min;
	}

	return Math.min(max, Math.max(min, value));
};

export const clampCrosshair = (crosshair: Crosshair): Crosshair => ({
	...crosshair,
	length: clampCrosshairNumber(crosshair.length, 0, 10),
	gap: clampCrosshairNumber(crosshair.gap, -10, 10),
	thickness: clampCrosshairNumber(crosshair.thickness, 0.5, 6),
	outline: clampCrosshairNumber(crosshair.outline, 0, 3),
	alpha: Math.round(clampCrosshairNumber(crosshair.alpha, 0, 255)),
	red: Math.round(clampCrosshairNumber(crosshair.red, 0, 255)),
	green: Math.round(clampCrosshairNumber(crosshair.green, 0, 255)),
	blue: Math.round(clampCrosshairNumber(crosshair.blue, 0, 255)),
	color: Math.round(clampCrosshairNumber(crosshair.color, 0, 5)),
	style: Math.round(clampCrosshairNumber(crosshair.style, 0, 4)),
	splitDistance: Math.round(clampCrosshairNumber(crosshair.splitDistance, 0, 16)),
	fixedCrosshairGap: clampCrosshairNumber(crosshair.fixedCrosshairGap, -10, 10),
	innerSplitAlpha: clampCrosshairNumber(crosshair.innerSplitAlpha, 0, 1),
	outerSplitAlpha: clampCrosshairNumber(crosshair.outerSplitAlpha, 0, 1),
	splitSizeRatio: clampCrosshairNumber(crosshair.splitSizeRatio, 0, 1),
});

export const getCrosshairPreviewMetrics = (crosshair: Crosshair, resolutionScale = 1, zoom = 1): CrosshairPreviewMetrics => {
	const safeCrosshair = clampCrosshair(crosshair);
	const renderScale = Math.max(0.5, resolutionScale) * Math.max(1, zoom);
	const length = Math.max(0, Math.round(Math.ceil(safeCrosshair.length) * 2 * renderScale));
	const thickness = Math.max(1, Math.round(safeCrosshair.thickness * 2 * renderScale));
	const gapRasterOffset = Number.isInteger(safeCrosshair.gap) ? 5 : 4.5;
	const rawEdgeGap = Math.round((safeCrosshair.gap + gapRasterOffset) * renderScale);
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
