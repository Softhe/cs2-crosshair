import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downloadConfig } from '../src/config-export.ts';
import { commandsArray, defaults } from '../src/model.ts';

test('config export names files after the alias and defaults safely', () => {
  const named = downloadConfig(defaults, 'team_green');
  assert.ok(named.includes('// alias team_green "exec crosshair_team_green.cfg"'));
  assert.ok(named.includes('// Add the alias line to autoexec.cfg without //, then type team_green in the console to load this file.'));
  const fallback = downloadConfig(defaults, '');
  assert.ok(fallback.includes('// alias my_crosshair "exec crosshair.cfg"'));
  assert.ok(!fallback.includes('crosshair_.cfg'));
});

test('config export embeds the share code and one command per line', () => {
  const content = downloadConfig(defaults, 'my_crosshair');
  const lines = content.split('\n');
  assert.equal(lines[0], '// delli.cc Crosshair Studio');
  assert.ok(lines[1]!.startsWith('// Crosshair code: CS'));
  assert.ok(content.includes(commandsArray(defaults).join('\n')));
  assert.ok(!content.includes('; '));
});

test('config export rejects unsafe alias names', () => {
  for (const name of ['../bad', 'bad;quit', 'bad space', 'quit']) {
    assert.throws(() => downloadConfig(defaults, name));
  }
});
