import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encode, decode, importCommands} from '../src/codec';
import {defaults, styles, fieldBounds, cfg, commands, validateSettings, type Settings} from '../src/model';

const sharedKeys = Object.keys(defaults).filter(key =>
  key.startsWith('cl_crosshaircolor_') || key.startsWith('cl_crosshairoutline_') ||
  ['cl_crosshairstyle', 'cl_crosshair_screen_height', 'cl_crosshair_recoil', 'cl_crosshairdot',
    'cl_crosshair_t', 'cl_crosshair_thickness', 'cl_crosshair_drawoutline', 'cl_crosshair_gap',
    'cl_crosshair_length', 'cl_crosshair_dynamic_spread_limit', 'cl_crosshair_dynamic_splitdist',
    'cl_crosshair_dynamic_splitalpha_innermod', 'cl_crosshair_dynamic_splitalpha_outermod',
    'cl_crosshair_dynamic_maxdist_splitratio', 'cl_ironsight_usecrosshaircolor',
    'cl_ironsight_dot_scale'].includes(key));

test('every representable value of each share-code field survives encoding independently', (context) => {
  let cases = 0;
  for (const key of sharedKeys) {
    const field = fieldBounds(key)!;
    const values = field.options ? field.options.map(([value]) => value) :
      key === 'cl_crosshair_screen_height' ? [240, 255, 256, 480, 720, 1080, 1440, 2160, 32767, 32768, 65535] :
      Array.from({length: Math.round((field.max! - field.min!) / (field.step ?? 1)) + 1},
        (_, index) => Number((field.min! + index * (field.step ?? 1)).toFixed(2)));
    for (const value of values) {
      const settings = {...defaults, cl_crosshairstyle: 2, [key]: value};
      assert.deepEqual(decode(encode(settings)).settings, settings, `${key}=${value}`);
      cases++;
    }
  }
  assert.ok(cases > 3000);
  context.diagnostic(`${cases} independent field-value round trips across ${sharedKeys.length} shared fields.`);
});

test('3000 deterministic full-setting combinations preserve all shared fields and complete configs', () => {
  let seed = 0x5c2026;
  const random = (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % max;
  };
  for (let iteration = 0; iteration < 3000; iteration++) {
    const settings: Settings = {...defaults};
    for (const key of Object.keys(settings)) {
      const field = fieldBounds(key)!;
      settings[key] = field.options ? field.options[random(field.options.length)][0] :
        Number((field.min! + random(Math.round((field.max! - field.min!) / (field.step ?? 1)) + 1) * (field.step ?? 1)).toFixed(2));
    }
    settings.cl_crosshairstyle = styles[iteration % styles.length][0];
    const decoded = decode(encode(settings)).settings;
    for (const key of sharedKeys) assert.equal(decoded[key], settings[key], `case ${iteration}: ${key}`);
    assert.deepEqual(importCommands(cfg(settings)), settings, `CFG case ${iteration}`);
    assert.deepEqual(importCommands(commands(settings)), settings, `console case ${iteration}`);
    assert.deepEqual(importCommands(cfg(settings).replaceAll('\n', '\r\n')), settings, `Windows CFG case ${iteration}`);
  }
});

// Independent byte packing lets validation tests exercise a correct checksum with an invalid payload.
function payloadCode(mutate: (bytes: Uint8Array) => void): string {
  const alphabet = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(32);
  bytes[1] = 1; bytes[2] = 56; bytes[3] = 4; bytes[4] = 4;
  bytes[22] = 90;
  mutate(bytes);
  bytes[0] = bytes.slice(1).reduce((sum, value) => sum + value, 0) & 255;
  let packed = 0n;
  for (const byte of bytes) packed = (packed << 8n) | BigInt(byte);
  let code = 'CS';
  for (let digit = 0; digit < 44; digit++) {code += alphabet[Number(packed % 57n)]; packed /= 57n;}
  return code;
}

test('checksummed unsupported versions, reserved bits, and out-of-range packed values are rejected', () => {
  assert.doesNotThrow(() => decode(payloadCode(() => {})));
  for (const mutate of [
    (bytes: Uint8Array) => {bytes[1] = 2;},
    (bytes: Uint8Array) => {bytes[21] |= 32;},
    (bytes: Uint8Array) => {bytes[23] = 1;},
    (bytes: Uint8Array) => {bytes[31] = 1;},
    (bytes: Uint8Array) => {bytes[4] = 10;},
    (bytes: Uint8Array) => {bytes[13] = 33;},
    (bytes: Uint8Array) => {bytes[13] = 192;},
    (bytes: Uint8Array) => {bytes[22] = 191;},
    (bytes: Uint8Array) => {bytes[2] = 239; bytes[3] = 0;},
  ]) assert.throws(() => decode(payloadCode(mutate)));
});

test('invalid field types, steps, option values, and numeric limits fail before encoding', () => {
  for (const key of Object.keys(defaults)) {
    const field = fieldBounds(key)!;
    for (const invalid of [NaN, Infinity, -Infinity, '1', null, true]) {
      assert.throws(() => validateSettings({...defaults, [key]: invalid}), `${key}: ${String(invalid)}`);
    }
    if (field.options) assert.throws(() => encode({...defaults, [key]: 999}));
    else {
      assert.throws(() => encode({...defaults, [key]: field.min! - (field.step ?? 1)}));
      assert.throws(() => encode({...defaults, [key]: field.max! + (field.step ?? 1)}));
      assert.throws(() => encode({...defaults, [key]: field.min! + (field.step ?? 1) / 2}));
    }
  }
});
