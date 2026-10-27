import { useEffect, useState } from 'react';

export type PreviewResolution = { targetHeight: number; customHeight: number };
export function previewResolution(value: unknown): PreviewResolution {
  const stored = value && typeof value === 'object' ? value as Partial<PreviewResolution> : {};
  const validHeight = (height: unknown): height is number => typeof height === 'number' && Number.isInteger(height) && height >= 240 && height <= 8640;
  return {
    targetHeight: [-2, -1, 0, 720, 1080, 1440, 2160].includes(stored.targetHeight!) ? stored.targetHeight! : validHeight(stored.targetHeight) ? -2 : 1080,
    customHeight: validHeight(stored.customHeight) ? stored.customHeight : validHeight(stored.targetHeight) ? stored.targetHeight : 1080,
  };
}

export function previewScale(zoom: number, targetHeight: number | undefined, referenceHeight: number, dpr: number) {
  const magnification = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return magnification * (targetHeight && Number.isFinite(targetHeight) && targetHeight > 0
    ? targetHeight / Math.max(1, referenceHeight) / Math.max(0.1, dpr || 1) : 1);
}

// Screen dimensions are CSS pixels. This is an estimate, not EDID or game detection.
// Keep the initial physical estimate when browser zoom alone changes DPR.
// Some embedded browsers report a screen smaller than the window itself; a display is never
// smaller than the window it shows, so the window size is a lower bound.
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
    const size = screenSize(screen.width, screen.height, outerWidth || innerWidth, outerHeight || innerHeight);
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
