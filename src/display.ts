import { useEffect, useState } from 'react';

export function previewScale(zoom: number, targetHeight: number | undefined, referenceHeight: number, dpr: number) {
  const magnification = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return magnification * (targetHeight && Number.isFinite(targetHeight) && targetHeight > 0
    ? targetHeight / Math.max(1, referenceHeight) / Math.max(0.1, dpr || 1) : 1);
}

// Screen dimensions are CSS pixels. This is an estimate, not EDID or game detection.
// Keep the initial physical estimate when browser zoom alone changes DPR.
export function useDisplayEstimate() {
  const sample = () => ({ width: Math.round(screen.width * (devicePixelRatio || 1)), height: Math.round(screen.height * (devicePixelRatio || 1)), dpr: devicePixelRatio || 1 });
  const [display, setDisplay] = useState(sample);
  useEffect(() => {
    let width = screen.width, height = screen.height, resolution: MediaQueryList;
    const update = () => {
      const changedScreen = width !== screen.width || height !== screen.height;
      width = screen.width; height = screen.height;
      setDisplay(previous => changedScreen ? sample() : { ...previous, dpr: devicePixelRatio || 1 });
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
