import assert from 'node:assert/strict';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const gzipAsync = promisify(gzip);
const assetDir = resolve('dist/assets');
const files = await readdir(assetDir);
const jsFiles = files.filter((file) => file.endsWith('.js'));
const cssFiles = files.filter((file) => file.endsWith('.css'));

const measure = async (names) => {
  const buffers = await Promise.all(names.map((name) => readFile(resolve(assetDir, name))));
  return {
    raw: buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0),
    gzip: (await Promise.all(buffers.map((buffer) => gzipAsync(buffer)))).reduce((sum, buffer) => sum + buffer.byteLength, 0),
  };
};

const budgets = JSON.parse(await readFile(resolve('scripts/performance-budgets.json'), 'utf8'));
const [js, css] = await Promise.all([measure(jsFiles), measure(cssFiles)]);
const entryFiles = jsFiles.filter((file) => file.startsWith('index-'));
const entry = await measure(entryFiles);

assert.ok(js.raw <= budgets.jsRaw, `JavaScript raw size ${js.raw} exceeds ${budgets.jsRaw}`);
assert.ok(js.gzip <= budgets.jsGzip, `JavaScript gzip size ${js.gzip} exceeds ${budgets.jsGzip}`);
assert.ok(entry.gzip <= budgets.entryGzip, `Entry JavaScript gzip size ${entry.gzip} exceeds ${budgets.entryGzip}`);
assert.ok(css.raw <= budgets.cssRaw, `CSS raw size ${css.raw} exceeds ${budgets.cssRaw}`);
assert.ok(css.gzip <= budgets.cssGzip, `CSS gzip size ${css.gzip} exceeds ${budgets.cssGzip}`);

console.log(`performance budgets passed: JS ${js.raw} raw/${js.gzip} gzip; CSS ${css.raw} raw/${css.gzip} gzip`);
