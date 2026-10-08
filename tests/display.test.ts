import test from 'node:test';
import assert from 'node:assert/strict';
import { previewScale } from '../src/display';

test('game-size mapping keeps physical size across display scaling and browser zoom', () => {
  for (const dpr of [1, 1.25, 1.5, 2]) {
    assert.ok(Math.abs(previewScale(1, 1440, 1080, dpr) * dpr - 4 / 3) < 1e-12);
    assert.ok(Math.abs(previewScale(4, 1440, 1080, dpr) * dpr - 16 / 3) < 1e-12);
  }
  assert.equal(previewScale(1, 1440, 1440, 1), 1);
  assert.equal(previewScale(1, 1440, 2160, 1), 2 / 3);
  assert.equal(previewScale(2, undefined, 1080, 2), 2);
});
