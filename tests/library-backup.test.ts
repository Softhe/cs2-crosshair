import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupFile, mergeBackup, parseBackup } from '../src/library-backup';
import { defaults } from '../src/model';
import type { Saved } from '../src/storage';

const entry = (id: string, favorite: boolean, gap: number, name = id): Saved => ({
  id, name, alias: '', favorite, date: '2026-11-01T00:00:00.000Z', settings: { ...defaults, cl_crosshair_gap: gap },
});

test('a backup round trips through the file format', () => {
  const library = [entry('a', true, 1), entry('b', false, 2)];
  assert.deepEqual(parseBackup(backupFile(library)), library);
});

test('parseBackup rejects other versions and oversized libraries', () => {
  assert.throws(() => parseBackup(JSON.stringify({ version: 2, entries: [] })), /Unsupported backup version/);
  const tooMany = Array.from({ length: 51 }, (_, i) => entry(`f${i}`, true, i % 100));
  assert.throws(() => parseBackup(JSON.stringify({ version: 1, entries: tooMany })), /exceeds library limits/);
  assert.throws(() => parseBackup('not json'));
});

test('mergeBackup keeps existing entries, skips duplicates and renames clashing ids', () => {
  const library = [entry('a', true, 1, 'Mine')];
  const merged = mergeBackup(library, [entry('x', true, 1, 'Theirs'), entry('a', true, 5, 'Clash'), entry('r', false, 1)]);
  assert.deepEqual(merged.map((item) => item.name), ['Mine', 'Clash', 'r'], 'same settings as a favorite is skipped; history is separate');
  assert.equal(merged[0]!.id, 'a');
  assert.notEqual(merged[1]!.id, 'a', 'a clashing id gets a fresh one');
  assert.equal(new Set(merged.map((item) => item.id)).size, merged.length);
});
