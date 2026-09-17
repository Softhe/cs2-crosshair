import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const gzipAsync = promisify(gzip);
const assetDir = resolve('dist/assets');

try {
  var files = await readdir(assetDir);
} catch {
  console.log('bundle report skipped: dist/ not found (run `pnpm build` first)');
  process.exit(0);
}

const budgets = JSON.parse(await readFile(resolve('scripts/performance-budgets.json'), 'utf8'));
const jsFiles = files.filter((file) => file.endsWith('.js'));
const cssFiles = files.filter((file) => file.endsWith('.css'));

const rows = await Promise.all(
  [...jsFiles, ...cssFiles].map(async (name) => {
    const buffer = await readFile(resolve(assetDir, name));
    const gzipSize = (await gzipAsync(buffer)).byteLength;
    return { name, raw: buffer.byteLength, gzip: gzipSize, type: name.endsWith('.js') ? 'js' : 'css' };
  }),
);

rows.sort((a, b) => b.gzip - a.gzip);
const typeTotals = (type) => rows
  .filter((row) => row.type === type)
  .reduce((sum, row) => ({ raw: sum.raw + row.raw, gzip: sum.gzip + row.gzip }), { raw: 0, gzip: 0 });
const js = typeTotals('js');
const css = typeTotals('css');

console.log('Per-chunk bundle sizes (gzip):');
for (const row of rows) {
  console.log(`  ${row.name.padEnd(40)} ${String(row.gzip).padStart(7)} gzip / ${String(row.raw).padStart(7)} raw`);
}
console.log('');
console.log(`JS total  ${js.gzip} gzip / ${js.raw} raw  (budget ${budgets.jsGzip}, headroom ${budgets.jsGzip - js.gzip})`);
console.log(`CSS total ${css.gzip} gzip / ${css.raw} raw  (budget ${budgets.cssGzip}, headroom ${budgets.cssGzip - css.gzip})`);
const entryFiles = jsFiles.filter((file) => file.startsWith('index-'));
const entryGzip = rows.filter((row) => entryFiles.includes(row.name)).reduce((sum, row) => sum + row.gzip, 0);
console.log(`JS entry  ${entryGzip} gzip  (budget ${budgets.entryGzip}, headroom ${budgets.entryGzip - entryGzip})`);
