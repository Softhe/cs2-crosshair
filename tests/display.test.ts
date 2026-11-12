import test from 'node:test';
import assert from 'node:assert/strict';
import { AS_DESIGNED, previewGameHeights, previewResolution, previewScale, previewTargetHeight, raiseToViewport, screenSize } from '../src/display';

test('preview resolution defaults to as designed and preserves validated choices', () => {
  for (const value of [null, {}, { targetHeight: '1440' }, { targetHeight: 12 }, { targetHeight: 1080.5 }]) {
    assert.deepEqual(previewResolution(value), { targetHeight: AS_DESIGNED, customHeight: 1080 });
  }
  assert.deepEqual(previewResolution({ targetHeight: -2, customHeight: 1200 }), { targetHeight: -2, customHeight: 1200 });
  assert.deepEqual(previewResolution({ targetHeight: 1200 }), { targetHeight: -2, customHeight: 1200 });
  assert.deepEqual(previewResolution({ targetHeight: 1440, customHeight: 99999 }), { targetHeight: 1440, customHeight: 1440 });
  assert.equal(previewResolution({ targetHeight: -1 }).targetHeight, -1);
  assert.equal(previewResolution({ targetHeight: 0 }).targetHeight, 0);
  assert.equal(previewResolution({ targetHeight: AS_DESIGNED, version: 2 }).targetHeight, AS_DESIGNED);
  // Every listed resolution survives a round trip through storage.
  for (const { height } of previewGameHeights) assert.equal(previewResolution({ targetHeight: height, version: 2 }).targetHeight, height);
});

test('the old saved 1080p default moves to as designed, a later 1080p choice stays', () => {
  assert.equal(previewResolution({ targetHeight: 1080, customHeight: 1080 }).targetHeight, AS_DESIGNED);
  assert.equal(previewResolution({ targetHeight: 1080, customHeight: 1080, version: 2 }).targetHeight, 1080);
  assert.equal(previewResolution({ targetHeight: 1440, customHeight: 1080 }).targetHeight, 1440);
});

test('as designed rasterizes at the crosshair reference height, one pixel per unit', () => {
  for (const reference of [768, 960, 1080, 1440]) {
    const height = previewTargetHeight(AS_DESIGNED, reference, 1440, 1200);
    assert.equal(height, reference);
    assert.equal(previewScale(1, height, reference, 1), 1);
  }
  assert.equal(previewTargetHeight(-1, 960, 1440, 1200), 1440);
  assert.equal(previewTargetHeight(-2, 960, 1440, 1200), 1200);
  assert.equal(previewTargetHeight(0, 960, 1440, 1200), 0);
  assert.equal(previewTargetHeight(1080, 960, 1440, 1200), 1080);
});

test('game-size mapping keeps physical size across display scaling and browser zoom', () => {
  for (const dpr of [1, 1.25, 1.5, 2]) {
    assert.ok(Math.abs(previewScale(1, 1440, 1080, dpr) * dpr - 4 / 3) < 1e-12);
    assert.ok(Math.abs(previewScale(4, 1440, 1080, dpr) * dpr - 16 / 3) < 1e-12);
  }
  assert.equal(previewScale(1, 1440, 1440, 1), 1);
  assert.equal(previewScale(1, 1440, 2160, 1), 2 / 3);
  assert.equal(previewScale(2, undefined, 1080, 2), 2);
});

test('screen estimate is never smaller than the window showing it', () => {
  assert.deepEqual(screenSize(2560, 1440, 1440, 900), { width: 2560, height: 1440 });
  assert.deepEqual(screenSize(400, 300, 1440, 900), { width: 1440, height: 900 });
  assert.deepEqual(screenSize(0, 0, 390, 844), { width: 390, height: 844 });
});

test('kept estimate grows with the window but ignores browser zoom', () => {
  const kept = { width: 2880, height: 1800, dpr: 2 };
  // Window grows from 900 to 1200 CSS px tall while the reported screen stays unchanged.
  assert.deepEqual(raiseToViewport(kept, 1440, 1200, 2), { width: 2880, height: 2400, dpr: 2 });
  // Zooming to 200% halves the CSS viewport and doubles DPR: physical size, and the estimate, stay put.
  assert.deepEqual(raiseToViewport(kept, 720, 450, 4), { width: 2880, height: 1800, dpr: 4 });
  // A shrinking window never lowers the estimate.
  assert.deepEqual(raiseToViewport(kept, 800, 600, 2), kept);
});
