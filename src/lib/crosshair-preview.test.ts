import { describe, expect, it } from 'vitest';
import { decodeCrosshairShareCode } from '@/lib/cs2-sharecode';
import { getCrosshairPreviewMetrics, getPreviewResolutionScale, isPreviewResolution } from '@/lib/crosshair-preview';

const BASE = decodeCrosshairShareCode('CSGO-wAD3c-ykt5L-zvZ98-vBisR-6sWPA');

describe('crosshair preview metrics', () => {
  it('keeps arm length stable when only thickness changes', () => {
    const thin = getCrosshairPreviewMetrics({ ...BASE, length: 2, thickness: 0.5 });
    const thick = getCrosshairPreviewMetrics({ ...BASE, length: 2, thickness: 6 });

    expect(thin.length).toBe(thick.length);
    expect(thick.thickness).toBeGreaterThan(thin.thickness);
  });

  it('does not draw an outline when its configured thickness is zero', () => {
    expect(getCrosshairPreviewMetrics({ ...BASE, outlineEnabled: true, outline: 0 }).outlineThickness).toBe(0);
    expect(getCrosshairPreviewMetrics({ ...BASE, outlineEnabled: true, outline: 1 }).outlineThickness).toBeGreaterThan(0);
  });

  it('responds monotonically to length and gap controls', () => {
    const short = getCrosshairPreviewMetrics({ ...BASE, length: 1 });
    const long = getCrosshairPreviewMetrics({ ...BASE, length: 5 });
    const tight = getCrosshairPreviewMetrics({ ...BASE, gap: -10 });
    const wide = getCrosshairPreviewMetrics({ ...BASE, gap: 10 });

    expect(long.length).toBeGreaterThan(short.length);
    expect(wide.edgeGap).toBeGreaterThan(tight.edgeGap);
  });

  it('matches the measured 1080p compact geometry', () => {
    const metrics = getCrosshairPreviewMetrics({ ...BASE, length: 2, thickness: 1, gap: -2 });
    expect(metrics).toMatchObject({ length: 4, thickness: 2, edgeGap: 3, autoScale: 1 });
  });

  it('scales manual resolutions and inspection zoom independently', () => {
    expect(getPreviewResolutionScale('1280x960-stretched', 700)).toBe(0.9);
    expect(getPreviewResolutionScale('1920x1080', 700)).toBe(1);
    expect(getPreviewResolutionScale('2560x1440', 700)).toBe(1.3);
    expect(getPreviewResolutionScale('auto', 900)).toBe(1);
    expect(getPreviewResolutionScale('auto', 1440)).toBe(1.3);

    const exact = getCrosshairPreviewMetrics({ ...BASE, length: 2, thickness: 1, gap: -2 }, 1, 1);
    const inspected = getCrosshairPreviewMetrics({ ...BASE, length: 2, thickness: 1, gap: -2 }, 1, 4);
    expect(inspected.length).toBe(exact.length * 4);
    expect(inspected.thickness).toBe(exact.thickness * 4);
    expect(inspected.edgeGap).toBe(exact.edgeGap * 4);
  });

  it('rejects obsolete stored resolution values', () => {
    expect(isPreviewResolution('1920x1080')).toBe(true);
    expect(isPreviewResolution('cobalt')).toBe(false);
  });
});
