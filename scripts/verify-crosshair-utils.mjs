import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Script } from 'node:vm';
import ts from 'typescript';

const moduleCache = new Map();

const loadTsModule = (path) => {
  const absolutePath = resolve(path);
  const cached = moduleCache.get(absolutePath);
  if (cached) {
    return cached.exports;
  }

  const source = readFileSync(absolutePath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };
  moduleCache.set(absolutePath, module);
  const localRequire = (spec) => {
    if (!spec.startsWith('.')) {
      throw new Error(`verify-crosshair-utils only supports relative imports (received ${spec})`);
    }
    return loadTsModule(resolve(dirname(absolutePath), `${spec}.ts`));
  };
  new Script(outputText, { filename: absolutePath }).runInNewContext({
    exports: module.exports,
    module,
    require: localRequire,
    URLSearchParams,
  });
  return module.exports;
};

const stableJson = (value) => JSON.stringify(value, Object.keys(value).sort());

const shareUrl = loadTsModule('src/lib/share-url.ts');
const config = loadTsModule('src/lib/crosshair-config.ts');
const cs2 = loadTsModule('src/lib/cs2-sharecode.ts');
const preview = loadTsModule('src/lib/crosshair-preview.ts');

assert.equal(
  shareUrl.getShareCodeFromUrl({ pathname: '/CSGO-wAD3c-ykt5L-zvZ98-vBisR-6sWPA', search: '' }),
  'CSGO-wAD3c-ykt5L-zvZ98-vBisR-6sWPA'
);
assert.equal(
  shareUrl.getShareCodeFromUrl({ pathname: '/', search: '?code=CSGO-wAD3c-ykt5L-zvZ98-vBisR-6sWPA' }),
  'CSGO-wAD3c-ykt5L-zvZ98-vBisR-6sWPA'
);
assert.equal(
  shareUrl.getShareCodeUrlPath(' CSGO-wAD3c-ykt5L-zvZ98-vBisR-6sWPA '),
  '/?code=CSGO-wAD3c-ykt5L-zvZ98-vBisR-6sWPA'
);

assert.equal(config.createConfigFileName('og small'), 'crosshair_og_small.cfg');
assert.equal(config.createConfigFileName('', 12345), 'crosshair_12345.cfg');
assert.match(config.createConfigFileName(), /^crosshair_\d{5}\.cfg$/);
assert.equal(config.getSafeAliasCommandName('og small'), 'og_small');
assert.equal(config.getSafeAliasCommandName(''), 'mycrosshair');
assert.equal(config.createAliasCommand('og small', 'crosshair_og_small.cfg'), 'alias "og_small" "exec crosshair_og_small.cfg"');
assert.equal(JSON.stringify(cs2.getCrosshairPreviewColor({ color: 5, red: 255, green: 255, blue: 255 })), JSON.stringify({ r: 255, g: 255, b: 255 }));
assert.equal(JSON.stringify(cs2.getCrosshairPreviewColor({ color: 4, red: 255, green: 255, blue: 255 })), JSON.stringify({ r: 0, g: 255, b: 255 }));
assert.equal(JSON.stringify(cs2.getCrosshairPreviewColor({ color: 2, red: 255, green: 255, blue: 255 })), JSON.stringify({ r: 255, g: 255, b: 0 }));

const sampleCrosshair = cs2.decodeCrosshairShareCode('CSGO-wAD3c-ykt5L-zvZ98-vBisR-6sWPA');
const roundTripCrosshair = cs2.decodeCrosshairShareCode(cs2.encodeCrosshair(sampleCrosshair));
assert.equal(stableJson(roundTripCrosshair), stableJson(sampleCrosshair));

const customCrosshair = {
  length: 2.5,
  red: 12,
  green: 240,
  blue: 120,
  gap: -3,
  alphaEnabled: true,
  alpha: 220,
  outlineEnabled: true,
  outline: 1,
  color: 5,
  thickness: 1.5,
  centerDotEnabled: true,
  splitDistance: 7,
  fixedCrosshairGap: 3,
  innerSplitAlpha: 1,
  outerSplitAlpha: 0.5,
  splitSizeRatio: 0.3,
  tStyleEnabled: false,
  deployedWeaponGapEnabled: false,
  style: 4,
};
assert.equal(stableJson(cs2.decodeCrosshairShareCode(cs2.encodeCrosshair(customCrosshair))), stableJson(customCrosshair));

const clamped = preview.clampCrosshair({
  ...customCrosshair,
  length: 99,
  gap: -99,
  thickness: 99,
  outline: -4,
  alpha: 999,
  red: -30,
  green: 999,
  blue: Number.NaN,
});
assert.equal(clamped.length, 10);
assert.equal(clamped.gap, -10);
assert.equal(clamped.thickness, 6);
assert.equal(clamped.outline, 0);
assert.equal(clamped.alpha, 255);
assert.equal(clamped.red, 0);
assert.equal(clamped.green, 255);
assert.equal(clamped.blue, 0);

const lowGapMetrics = preview.getCrosshairPreviewMetrics({ ...customCrosshair, gap: -10 });
const highGapMetrics = preview.getCrosshairPreviewMetrics({ ...customCrosshair, gap: 10 });
assert.equal(lowGapMetrics.autoScale, highGapMetrics.autoScale);
assert.ok(lowGapMetrics.edgeGap < highGapMetrics.edgeGap);
assert.equal(preview.getCrosshairPreviewMetrics({ ...customCrosshair, length: 0 }).length, 0);

console.log('crosshair utility checks passed');
