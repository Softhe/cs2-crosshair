import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultGameView, gameView, gameViewStretch, validatePreferences } from '../src/preferences';

test('game view defaults to off and repairs stored values', () => {
  for (const value of [null, {}, { width: '1280' }, { width: 1280, height: 12 }]) assert.deepEqual(gameView(value), defaultGameView);
  assert.deepEqual(gameView({ enabled: true, width: 1440, height: 1080, stretched: false }), { enabled: true, width: 1440, height: 1080, stretched: false });
});

test('preferences sent to the server are rejected rather than repaired', () => {
  const view = { enabled: true, width: 1280, height: 960, stretched: true };
  assert.deepEqual(validatePreferences({ gameView: view }), { gameView: view });
  for (const bad of [null, {}, { gameView: { ...view, width: 100 } }, { gameView: { ...view, stretched: 1 } }, { gameView: { ...view, enabled: undefined } }])
    assert.throws(() => validatePreferences(bad));
});

test('a stretched 4:3 game on a 16:9 monitor has wide pixels; black bars keep them square', () => {
  const view = { enabled: true, width: 1280, height: 960, stretched: true };
  assert.deepEqual(gameViewStretch(view, { width: 2560, height: 1440 }), [2, 1.5]);
  assert.deepEqual(gameViewStretch({ ...view, stretched: false }, { width: 2560, height: 1440 }), [1.5, 1.5]);
  assert.deepEqual(gameViewStretch({ ...view, width: 2560, height: 1440 }, { width: 2560, height: 1440 }), [1, 1]);
  assert.deepEqual(gameViewStretch(view, { width: 0, height: 0 }), [1, 1]);
});
