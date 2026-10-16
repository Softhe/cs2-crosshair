import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, HEIGHT_MAX } from '../src/model';
import { validateLibrary } from '../src/storage';

test('legacy height above supported max migrates to HEIGHT_MAX instead of dropping the entry', () => {
  const entry = {
    id: 'legacy-height',
    name: 'Legacy height',
    alias: '',
    favorite: true,
    date: '2026-10-15',
    settings: { ...defaults, cl_crosshair_screen_height: 24000 },
  };
  const migrated = validateLibrary([entry]);
  assert.equal(migrated.length, 1);
  assert.equal(migrated[0]!.id, 'legacy-height');
  assert.equal(migrated[0]!.name, 'Legacy height');
  assert.equal(migrated[0]!.favorite, true);
  assert.equal(migrated[0]!.settings.cl_crosshair_screen_height, HEIGHT_MAX);
  assert.equal(migrated[0]!.settings.cl_crosshair_screen_height, 16384);
});

test('entries invalid for reasons other than height are still rejected', () => {
  assert.throws(() =>
    validateLibrary([
      {
        id: 'bad',
        name: 'Bad',
        alias: '',
        favorite: false,
        date: '2026-10-15',
        settings: { ...defaults, cl_crosshair_screen_height: 24000, cl_crosshair_thickness: 999 },
      },
    ]),
  );
});
