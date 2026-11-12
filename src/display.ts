import { useEffect, useState } from 'react';

/** Preview scale choice for "the resolution this crosshair was made for": one unit is one pixel. */
export const AS_DESIGNED = -3;
export type PreviewResolution = { targetHeight: number; customHeight: number };
// Game resolutions offered for re-rounding the crosshair at another render height, most common
// competitive choices first. The preview draws game pixels 1:1, so only the height matters here;
// monitor stretch belongs to "Match my in-game size".
export const previewGameHeights: ReadonlyArray<{ height: number; label: string; group: string }> = [
  { height: 960, label: '1280 × 960', group: '4:3' },
  { height: 768, label: '1024 × 768', group: '4:3' },
  { height: 864, label: '1152 × 864', group: '4:3' },
  { height: 1024, label: '1280 × 1024', group: '5:4' },
  { height: 720, label: '1280 × 720', group: '16:9' },
  { height: 1080, label: '1920 × 1080', group: '16:9' },
  { height: 1440, label: '2560 × 1440', group: '16:9' },
  { height: 2160, label: '3840 × 2160', group: '16:9' },
];
const listedHeights = previewGameHeights.map(entry => entry.height);
export const PREVIEW_RESOLUTION_VERSION = 2;
export function previewResolution(value: unknown): PreviewResolution {
  const stored = value && typeof value === 'object' ? value as Partial<PreviewResolution> & { version?: number } : {};
  const validHeight = (height: unknown): height is number => typeof height === 'number' && Number.isInteger(height) && height >= 240 && height <= 8640;
  // Before version 2 the default, 1080p, was saved on every visit, so a stored 1080 without a
  // version is that old default rather than a choice. It moves to the new default.
  const legacyDefault = stored.version === undefined && stored.targetHeight === 1080;
  return {
    targetHeight: legacyDefault ? AS_DESIGNED
      : [AS_DESIGNED, -2, -1, 0, ...listedHeights].includes(stored.targetHeight!) ? stored.targetHeight! : validHeight(stored.targetHeight) ? -2 : AS_DESIGNED,
    customHeight: validHeight(stored.customHeight) ? stored.customHeight : validHeight(stored.targetHeight) ? stored.targetHeight : 1080,
  };
}
/** The game render height the preview rasterizes at; 0 means CSS-pixel inspection. */
export function previewTargetHeight(targetHeight: number, referenceHeight: number, monitorHeight: number, customHeight: number) {
  return targetHeight === AS_DESIGNED ? referenceHeight : targetHeight === -1 ? monitorHeight : targetHeight === -2 ? customHeight : targetHeight;
}

export function previewScale(zoom: number, targetHeight: number | undefined, referenceHeight: number, dpr: number) {
  const magnification = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return magnification * (targetHeight && Number.isFinite(targetHeight) && targetHeight > 0
    ? targetHeight / Math.max(1, referenceHeight) / Math.max(0.1, dpr || 1) : 1);
}

// Screen dimensions are CSS pixels. This is an estimate, not EDID or game detection.
// Keep the initial physical estimate when browser zoom alone changes DPR.
// Some embedded browsers report a screen smaller than the window itself; a display is never
// smaller than the viewport it shows, so the viewport size is a lower bound. The outer window
// size is not: maximized Windows windows overhang every screen edge by their resize border,
// so a 1440-row display reports outerHeight 1456.
export function screenSize(screenWidth: number, screenHeight: number, windowWidth: number, windowHeight: number) {
  return { width: Math.max(screenWidth || 0, windowWidth || 0), height: Math.max(screenHeight || 0, windowHeight || 0) };
}
// Raise a kept estimate to the current viewport in physical pixels. Viewport size times DPR is
// unchanged by browser zoom, so this preserves the zoom protection while tracking window growth.
export function raiseToViewport(previous: { width: number; height: number; dpr: number }, viewportWidth: number, viewportHeight: number, dpr: number) {
  return { width: Math.max(previous.width, Math.round(viewportWidth * dpr)), height: Math.max(previous.height, Math.round(viewportHeight * dpr)), dpr };
}
export function useDisplayEstimate() {
  const sample = () => {
    const size = screenSize(screen.width, screen.height, innerWidth, innerHeight);
    return { width: Math.round(size.width * (devicePixelRatio || 1)), height: Math.round(size.height * (devicePixelRatio || 1)), dpr: devicePixelRatio || 1 };
  };
  const [display, setDisplay] = useState(sample);
  useEffect(() => {
    let width = screen.width, height = screen.height, resolution: MediaQueryList;
    const update = () => {
      const changedScreen = width !== screen.width || height !== screen.height;
      width = screen.width; height = screen.height;
      setDisplay(previous => changedScreen ? sample() : raiseToViewport(previous, innerWidth, innerHeight, devicePixelRatio || 1));
      resolution?.removeEventListener('change', update);
      resolution = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
      resolution.addEventListener('change', update);
    };
    window.addEventListener('resize', update);
    update();
    return () => { window.removeEventListener('resize', update); resolution?.removeEventListener('change', update); };
  }, []);
  return display;
}
