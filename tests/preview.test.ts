import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../src/model';
import { motionEligible, previewGeometry, renderingSettings } from '../src/preview-geometry';
import { composite, createCoverage, fitScale } from '../src/preview-renderer';
test('geometry preserves half-gap steps and symmetric negative gap values', () => {
    const arm = (gap: number) => previewGeometry(renderingSettings({ ...defaults, cl_crosshairstyle: 4, cl_crosshair_gap: gap }), 'crosshair').shapes[1];
    assert.equal((arm(-1) as {
        x: number;
    }).x, -.5);
    assert.equal((arm(1) as {
        x: number;
    }).x, .5);
});
test('scope scale remains responsive below one third and has no recoil', () => {
    const small = previewGeometry(renderingSettings({ ...defaults, cl_ironsight_dot_scale: .1, cl_crosshair_recoil: 1 }), 'scope', 1, 500);
    const larger = previewGeometry(renderingSettings({ ...defaults, cl_ironsight_dot_scale: .3 }), 'scope');
    assert.ok(Math.abs((small.shapes[0] as {
        radius: number;
    }).radius - .15) < 1e-12);
    assert.ok((larger.shapes[0] as {
        radius: number;
    }).radius > .15);
    assert.deepEqual(small.offset, [0, 0]);
});
test('split inspection exercises settings outside the synthetic motion range', () => {
    const s = { ...defaults, cl_crosshairstyle: 2, cl_crosshair_dynamic_splitdist: 127, cl_crosshair_dynamic_maxdist_splitratio: .5, cl_crosshair_dynamic_splitalpha_innermod: 1 };
    assert.equal(previewGeometry(renderingSettings(s), 'crosshair', 1).shapes.length, 4);
    assert.equal(previewGeometry(renderingSettings(s), 'crosshair', 1, 0, true).shapes.length, 8);
});
test('animation eligibility excludes unchanged modes and fit uses full bounds', () => {
    assert.equal(motionEligible({ ...defaults, cl_crosshairstyle: 4 }, 'crosshair'), false);
    assert.equal(motionEligible({ ...defaults, cl_crosshair_recoil: 1 }, 'scope'), false);
    assert.equal(motionEligible(defaults, 'crosshair'), true);
    const geometry = previewGeometry(renderingSettings(defaults), 'crosshair', 1), scale = fitScale(geometry.bounds, 850, 256, 1);
    assert.ok(scale < .5);
    assert.ok(Math.max(Math.abs(geometry.bounds[1]), Math.abs(geometry.bounds[3])) * scale < 128);
});
function raster(settings: Partial<typeof defaults>, scale: number, size = 121) {
    const s = { ...defaults, cl_crosshair_recoil: 0, ...settings };
    const coverage = createCoverage()(previewGeometry(renderingSettings(s), 'crosshair'), s.cl_crosshair_thickness, scale, size, size, 1);
    const data = new Uint8ClampedArray(coverage.width * coverage.height * 4);
    composite(coverage, s, 'crosshair', data);
    return { ...coverage, data, alpha: (x: number, y: number) => data[(y * coverage.width + x) * 4 + 3]! };
}
test('outlines are whole device pixels at fractional display scales', () => {
    for (const style of [4, 8, 6]) {
        const r = raster({ cl_crosshairstyle: style, cl_crosshair_thickness: 2, cl_crosshair_gap: 4, cl_crosshair_drawoutline: 1 }, 1440 / 1080);
        const partial = [...r.data.filter((_, i) => i % 4 === 3)].filter(a => a > 0 && a < 255);
        assert.equal(partial.length, 0, `style ${style} has a fractional outline fringe`);
    }
});
test('curved styles are mirror-symmetric around the raster center', () => {
    for (const [style, gap] of [[3, 6], [3, -6], [9, 4], [7, 4], [1, 0]] as const) for (const scale of [1, 1440 / 1080, 2160 / 1080]) {
        const r = raster({ cl_crosshairstyle: style, cl_crosshair_gap: gap, cl_crosshair_thickness: 2, cl_crosshair_dynamic_spread_limit: 0, cl_crosshair_dynamic_maxdist_splitratio: .5, cl_crosshair_drawoutline: 1 }, scale);
        let left = r.width, right = -1, top = r.height, bottom = -1;
        for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) if (r.alpha(x, y)) {
            left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
        assert.ok(right >= left, `style ${style} drew nothing`);
        let mismatch = 0;
        for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) for (let c = 0; c < 4; c++) {
            const value = r.data[(y * r.width + x) * 4 + c]!;
            if (Math.abs(value - r.data[(y * r.width + left + right - x) * 4 + c]!) > 1) mismatch++;
            if (Math.abs(value - r.data[((top + bottom - y) * r.width + x) * 4 + c]!) > 1) mismatch++;
        }
        assert.equal(mismatch, 0, `style ${style}, gap ${gap}, scale ${scale}`);
    }
});
test('a one-pixel dot stays one opaque pixel and translucent overlaps keep their alpha', () => {
    const dot = raster({ cl_crosshairstyle: 6, cl_crosshair_thickness: 1, cl_crosshair_drawoutline: 0 }, 1);
    assert.deepEqual([...dot.data.filter((_, i) => i % 4 === 3)].filter(Boolean), [255]);
    const cross = raster({ cl_crosshairstyle: 4, cl_crosshair_thickness: 2, cl_crosshair_gap: -4, cl_crosshair_drawoutline: 0, cl_crosshaircolor_a: 128 }, 1);
    assert.equal(Math.max(...cross.data.filter((_, i) => i % 4 === 3)), 128);
});
