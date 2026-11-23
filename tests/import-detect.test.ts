import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decode, encode, importConfig, describeConfigImport} from '../src/codec';
import {convertLegacy} from '../src/converter';
import {aliasCrosshairs, describeDetected, detectImport} from '../src/import-detect';
import {defaults, studioStart, cfg} from '../src/model';
import {downloadConfig} from '../src/config-export';

const code = encode({...studioStart, cl_crosshair_gap: -2});
const legacyCode = 'CSGO-O4Jsi-V36wY-rTMGK-9w7qF-jQ8WB';
const kind = (text: string) => detectImport(text).kind;

test('finds a code or link inside surrounding text', () => {
  assert.deepEqual(detectImport(code), {kind: 'code', text: code});
  assert.deepEqual(detectImport(`"${code}"`), {kind: 'code', text: code});
  assert.deepEqual(detectImport(`my crosshair: ${code} gl`), {kind: 'code', text: code});
  assert.deepEqual(detectImport(`\`${legacyCode}\``), {kind: 'code', text: legacyCode});
  assert.deepEqual(detectImport(`${code.slice(0, 20)}\n${code.slice(20)}`), {kind: 'code', text: code});
  assert.deepEqual(detectImport(`delli.cc/?code=${code}`), {kind: 'link', text: `https://delli.cc/?code=${code}`});
  assert.deepEqual(detectImport(`try https://delli.cc/${code}.`), {kind: 'link', text: `https://delli.cc/${code}`});
  assert.deepEqual(detectImport(`http://localhost:4180/?code=${code}`), {kind: 'link', text: `http://localhost:4180/?code=${code}`});
});

test('asks for one crosshair when the text holds several', () => {
  const other = encode({...studioStart, cl_crosshair_gap: 3});
  assert.throws(() => detectImport(`${code} or ${other}`), /2 different crosshair codes/);
  assert.equal(kind(`${code} and ${code}`), 'code', 'the same code twice is one crosshair');
});

test('keeps a damaged code for the decoder to explain', () => {
  assert.deepEqual(detectImport(code.slice(0, -3)), {kind: 'code', text: code.slice(0, -3)});
  assert.equal(kind('hello world'), 'unknown');
  assert.equal(kind('bind "mouse1" "+attack"'), 'unknown');
});

test('a current-only cvar makes the text current settings, even with hidden old leftovers', () => {
  assert.equal(kind('cl_crosshair_gap "-2"\ncl_crosshairsize "3.9"\ncl_crosshairthickness "0.6"'), 'config');
  assert.equal(kind('cl_crosshairsize 2; cl_crosshairthickness 1; cl_crosshairgap -3'), 'legacy');
  assert.equal(kind('cl_crosshairstyle 4; cl_crosshairdot 0'), 'config', 'shared names stay current, as before');
  assert.equal(kind(downloadConfig(studioStart, 'x')), 'config', 'a code in a comment does not hide the settings');
  assert.equal(kind(JSON.stringify({version: 1, entries: []})), 'backup');
  assert.equal(kind('{"version":1'), 'unknown');
});

const vcfg = `"config"
{
\t"convars"
\t{
\t\t"cl_crosshair_gap"\t\t"-2"
\t\t"cl_crosshair_length"\t\t"5"
\t\t"cl_crosshairsize"\t\t"3.9"
\t\t"cl_crosshairthickness"\t\t"0.6"
\t\t"sensitivity"\t\t"1.2"
\t}
}`;
test('imports a current CS2 .vcfg file and ignores its hidden old values', () => {
  assert.equal(kind(vcfg), 'config');
  const result = importConfig(vcfg, studioStart);
  assert.equal(result.settings.cl_crosshair_gap, -2);
  assert.equal(result.settings.cl_crosshair_length, 5);
  assert.equal(result.applied, 2);
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.leftovers, ['cl_crosshairsize', 'cl_crosshairthickness']);
  assert.match(describeConfigImport(result).text,
    /^Imported 2 crosshair settings from the config\. Skipped 1 other line .* Ignored hidden old values .*cl_crosshairsize, cl_crosshairthickness\.$/);
});

test('reads console echo and find output', () => {
  const echo = '] cl_crosshair_gap = -2 ( def. "4" )\n[Console] cl_crosshair_length = 6\ncl_crosshair_thickness 3 client archive - Thickness';
  const s = importConfig(echo, studioStart).settings;
  assert.equal(s.cl_crosshair_gap, -2);
  assert.equal(s.cl_crosshair_length, 6);
  assert.equal(s.cl_crosshair_thickness, 3);
});

test('bind and alias bodies are never applied', () => {
  const text = 'bind "f1" "cl_crosshair_gap 50; cl_crosshair_length 99"\nalias big "cl_crosshair_thickness 20; cl_crosshairdot 1"\ncl_crosshair_gap 1';
  const result = importConfig(text, studioStart);
  assert.equal(result.settings.cl_crosshair_length, studioStart.cl_crosshair_length);
  assert.equal(result.settings.cl_crosshair_thickness, studioStart.cl_crosshair_thickness);
  assert.equal(result.settings.cl_crosshairdot, studioStart.cl_crosshairdot);
  assert.equal(result.settings.cl_crosshair_gap, 1);
  assert.equal(result.applied, 1);
  assert.equal(result.skipped, 2);
  assert.match(describeConfigImport(result).text, /Skipped 2 other lines/);
});

test('a quoted // is a value, not a comment', () => {
  assert.equal(importConfig('cl_crosshair_gap "3" // was 2\ncl_crosshair_length 4', defaults).settings.cl_crosshair_gap, 3);
  assert.equal(importConfig(cfg({...defaults, cl_crosshair_gap: -7})).settings.cl_crosshair_gap, -7);
});

test('a full old config.cfg over 32 KiB converts from its crosshair lines', () => {
  const binds = Array.from({length: 1500}, (_, i) => `bind "key${i}" "say hello ${i}"`).join('\n');
  const text = `${binds}\ncl_crosshairstyle 4\ncl_crosshairsize 2\ncl_crosshairthickness 0.5\ncl_crosshairgap -2\n`;
  assert.ok(text.length > 32768);
  assert.equal(kind(text), 'legacy');
  const small = convertLegacy('cl_crosshairstyle 4; cl_crosshairsize 2; cl_crosshairthickness 0.5; cl_crosshairgap -2');
  assert.deepEqual(convertLegacy(text).settings, small.settings);
});

test('a link with its query right after the host keeps every setting', () => {
  const settings = encodeURIComponent(JSON.stringify(studioStart));
  assert.deepEqual(detectImport(`https://delli.cc?code=${code}&settings=${settings}`),
    {kind: 'link', text: `https://delli.cc?code=${code}&settings=${settings}`});
  assert.deepEqual(detectImport(`delli.cc?code=${code}`), {kind: 'link', text: `https://delli.cc?code=${code}`});
});

test('a link beside a different code asks for one', () => {
  const other = encode({...studioStart, cl_crosshair_gap: 3});
  assert.throws(() => detectImport(`link https://delli.cc/?code=${code} or just ${other}`), /link and a different code/);
  assert.equal(kind(`https://delli.cc/?code=${code} (${code})`), 'link', 'the same code repeated is one crosshair');
});

test('finds a code a line wrap broke inside surrounding text', () => {
  assert.deepEqual(detectImport(`my crosshair: ${code.slice(0, 25)}\n${code.slice(25)}`), {kind: 'code', text: code});
  assert.deepEqual(detectImport(`"${code.slice(0, 30)}\n  ${code.slice(30)}" gl`), {kind: 'code', text: code});
  assert.deepEqual(detectImport(`old one: ${legacyCode.slice(0, 17)}\n${legacyCode.slice(17)}`), {kind: 'code', text: legacyCode});
});

test('a complete link keeps the conversion notes of its old code', () => {
  const old = decode(legacyCode);
  const link = `https://delli.cc/?code=${legacyCode}&settings=${encodeURIComponent(JSON.stringify(old.settings))}`;
  const parsed = decode(link);
  assert.ok(old.warnings?.length);
  assert.deepEqual(parsed.warnings, old.warnings);
});

test('fixes lowercase prefixes and restores the dashes of an old code', () => {
  assert.deepEqual(detectImport('cs' + code.slice(2)), {kind: 'code', text: code});
  assert.deepEqual(detectImport(`mine: cs${code.slice(2)}`), {kind: 'code', text: code});
  assert.deepEqual(detectImport(legacyCode.replace('CSGO', 'csgo')), {kind: 'code', text: legacyCode});
  assert.deepEqual(detectImport(legacyCode.replaceAll('-', '')), {kind: 'code', text: legacyCode});
  assert.deepEqual(detectImport(`${code.slice(0, 20)} ${code.slice(20)}`), {kind: 'code', text: code});
});

test('an incomplete share code reports its length', () => {
  assert.throws(() => decode(detectImport('CSabc').text), /5 characters instead of 46/);
});

test('settings JSON is detected, and invalid JSON says so', () => {
  const json = detectImport(JSON.stringify({cl_crosshair_length: 2}));
  assert.equal(json.kind, 'json');
  assert.equal(describeDetected(json), 'Settings JSON · 1 settings');
  const broken = detectImport('{"cl_crosshair_gap":');
  assert.equal(broken.kind, 'unknown');
  assert.match(broken.kind === 'unknown' ? broken.reason ?? '' : '', /not valid JSON/);
});

test('crosshairs kept in aliases are listed as choices and only applied when chosen', () => {
  const text = 'alias a "cl_crosshair_gap 1; cl_crosshair_length 2"\nalias b "cl_crosshair_gap -3; cl_crosshair_length 9"\nalias jump "+jump"';
  assert.equal(detectImport(text).kind, 'aliases');
  assert.deepEqual(aliasCrosshairs(text).map(a => [a.name, a.count]), [['a', 2], ['b', 2]]);
  const s = importConfig(aliasCrosshairs(text)[1]!.body, studioStart).settings;
  assert.deepEqual([s.cl_crosshair_gap, s.cl_crosshair_length], [-3, 9]);
  const both = detectImport(`cl_crosshair_gap 5\n${text}`);
  assert.equal(both.kind, 'config');
  assert.deepEqual(both.kind === 'config' && both.aliases?.map(a => a.name), ['a', 'b']);
  assert.equal(importConfig(`cl_crosshair_gap 5\n${text}`, studioStart).settings.cl_crosshair_length, studioStart.cl_crosshair_length);
});

test('names the detected format', () => {
  assert.equal(describeDetected(detectImport(code)), 'CS2 share code');
  assert.equal(describeDetected(detectImport(legacyCode)), 'Old CSGO share code');
  assert.equal(describeDetected(detectImport(`delli.cc/?code=${code}`)), 'Crosshair link');
  assert.equal(describeDetected(detectImport('cl_crosshair_gap -2; cl_crosshair_length 3; cl_crosshair_gap 1')), 'CS2 config · 2 settings');
  assert.equal(describeDetected(detectImport('cl_crosshairsize 2; cl_crosshairgap -3')), 'Pre-update config · will be converted');
  assert.equal(describeDetected(detectImport('hello')), 'Not recognized');
});

test('the old-code note names the assumed reference height', () => {
  assert.match(decode(legacyCode, 1440).note ?? '', /assuming it was made for 1440p/);
  assert.match(decode(legacyCode).note ?? '', /assuming it was made for 1080p/);
});

test('detection stays fast on a large file of one long word', () => {
  for (const text of ['a'.repeat(200000), 'a.'.repeat(100000), 'CS' + 'a'.repeat(199998)]) {
    const start = performance.now();
    detectImport(text);
    assert.ok(performance.now() - start < 1000, `${text.slice(0, 4)}… took ${Math.round(performance.now() - start)} ms`);
  }
});

test('an alias body with escaped quotes is read whole', () => {
  const [alias] = aliasCrosshairs('alias a "cl_crosshair_gap \\"-2\\"; cl_crosshair_length 3"');
  assert.equal(alias?.count, 2);
  const s = importConfig(alias!.body, studioStart).settings;
  assert.deepEqual([s.cl_crosshair_gap, s.cl_crosshair_length], [-2, 3]);
});

test('a link with a lowercase or dashless code imports', () => {
  const lower = 'cs' + code.slice(2);
  for (const link of [`delli.cc/?code=${lower}`, `https://delli.cc/${lower}`]) {
    const detected = detectImport(link);
    assert.equal(detected.kind, 'link', link);
    assert.equal(decode(detected.text).settings.cl_crosshair_gap, -2);
  }
  const dashless = 'csgo' + legacyCode.slice(5).replace(/-/g, '');
  assert.equal(decode(`https://delli.cc/?code=${dashless}`).legacy, decode(legacyCode).legacy);
});
