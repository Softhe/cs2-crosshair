import test from 'node:test';
import assert from 'node:assert/strict';
import { previewResolution, previewScale, raiseToViewport, screenSize } from '../src/display';

test('preview resolution defaults to explicit 1080p and preserves validated choices', () => {
  for (const value of [null, {}, { targetHeight: '1440' }, { targetHeight: 12 }, { targetHeight: 1080.5 }]) {
    assert.equal(previewResolution(value).targetHeight, 1080);
  }
  assert.deepEqual(previewResolution({ targetHeight: -2, customHeight: 1200 }), { targetHeight: -2, customHeight: 1200 });
  assert.deepEqual(previewResolution({ targetHeight: 1200 }), { targetHeight: -2, customHeight: 1200 });
  assert.deepEqual(previewResolution({ targetHeight: 1440, customHeight: 99999 }), { targetHeight: 1440, customHeight: 1440 });
  assert.equal(previewResolution({ targetHeight: -1 }).targetHeight, -1);
  assert.equal(previewResolution({ targetHeight: 0 }).targetHeight, 0);
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
