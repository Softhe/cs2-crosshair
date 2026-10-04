import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../src/model';
import { motionEligible, previewGeometry, renderingSettings } from '../src/preview-geometry';
import { fitScale } from '../src/preview-renderer';
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
