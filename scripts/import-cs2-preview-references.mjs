import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const sourceArgument = process.argv.slice(2).find((argument) => argument !== '--');
const sourceDir = resolve(sourceArgument || 'artifacts/preview-calibration/source');
const outputDir = resolve('artifacts/preview-calibration');
const manifest = JSON.parse(await readFile(resolve('docs/preview-reference-matrix.json'), 'utf8'));
const expected = new Map();

for (const resolution of manifest.resolutions) {
	for (const scenario of manifest.scenarios) {
		expected.set(`${resolution.width}x${resolution.height}x${scenario.id}`.toLowerCase(), {
			resolution,
			scenario,
			stem: `${scenario.id}-${resolution.id}`,
		});
	}
}

const files = await import('node:fs/promises').then(({ readdir }) => readdir(sourceDir));
const matches = new Map();
for (const file of files) {
	const match = /^(1280x960|1920x1080|2560x1440)x(compact|dot|outlined|classic|partial-alpha)\.png$/i.exec(file);
	if (match) matches.set(`${match[1]}x${match[2]}`.toLowerCase(), resolve(sourceDir, file));
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

for (const [key, entry] of expected) {
	const source = matches.get(key);
	if (!source) throw new Error(`Missing calibration screenshot: ${key}.png`);
	const png = await readFile(source);
	if (png.subarray(1, 4).toString() !== 'PNG') throw new Error(`${basename(source)} is not a PNG`);
	const width = png.readUInt32BE(16);
	const height = png.readUInt32BE(20);
	if (width !== entry.resolution.width || height !== entry.resolution.height) {
		throw new Error(`${basename(source)} is ${width}x${height}; expected ${entry.resolution.width}x${entry.resolution.height}`);
	}

	const fullPath = resolve(outputDir, `${entry.stem}-cs2-full.png`);
	await copyFile(source, fullPath);
	await page.setViewportSize({ width, height });
	await page.setContent('<style>html,body{margin:0;background:#000}img{display:block}</style><img>');
	await page.locator('img').evaluate((image, src) => { image.src = src; }, `data:image/png;base64,${png.toString('base64')}`);
	await page.locator('img').evaluate((image) => image.decode());
	await page.screenshot({
		path: resolve(outputDir, `${entry.stem}-cs2.png`),
		clip: { x: Math.floor(width / 2) - 48, y: Math.floor(height / 2) - 48, width: 96, height: 96 },
	});
}

await browser.close();
console.log(`Imported and center-cropped ${expected.size} CS2 references from ${sourceDir}`);
