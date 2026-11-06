import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const artifactDir = resolve('artifacts/preview-calibration');
const manifest = JSON.parse(await readFile(resolve('docs/preview-reference-matrix.json'), 'utf8'));
const browser = await chromium.launch();
const page = await browser.newPage();
const measurements = [];

const measure = async (path, scenario) => {
	const png = await readFile(path);
	return page.evaluate(async ({ src, scenario }) => {
		const image = new Image();
		image.src = src;
		await image.decode();
		const canvas = document.createElement('canvas');
		canvas.width = image.width; canvas.height = image.height;
		const context = canvas.getContext('2d');
		context.drawImage(image, 0, 0);
		const { data, width, height } = context.getImageData(0, 0, image.width, image.height);
		const points = [];
		const margin = 16;
		for (let y = margin; y < height - margin; y += 1) for (let x = margin; x < width - margin; x += 1) {
			const offset = (y * width + x) * 4;
			const [r, g, b] = [data[offset], data[offset + 1], data[offset + 2]];
			const foreground = scenario === 'outlined'
				? r > 135 && g > 125 && b < 80 && (r + g) / 2 - b > 70
				: scenario === 'classic'
					? g > 100 && g - r > 35 && g - b > 25
					: g > 85 && b > 85 && g - r > 28 && b - r > 28;
			if (foreground) points.push({ x, y });
		}
		if (!points.length) return { pixelCount: 0, clipped: false, width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 };
		const xs = points.map(({ x }) => x), ys = points.map(({ y }) => y);
		const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
		const centerX = Math.floor(width / 2), centerY = Math.floor(height / 2);
		return {
			pixelCount: points.length,
			// Foreground touching the scan margin means the shape extends past
			// the measured window, so its geometry is truncated and unreliable.
			clipped: minX === margin || minY === margin || maxX === width - margin - 1 || maxY === height - margin - 1,
			width: maxX - minX + 1,
			height: maxY - minY + 1,
			left: centerX - minX,
			right: maxX - (centerX - 1),
			top: centerY - minY,
			bottom: maxY - (centerY - 1),
		};
	}, { src: `data:image/png;base64,${png.toString('base64')}`, scenario });
};

for (const resolution of manifest.resolutions) {
	for (const scenario of manifest.scenarios) {
		const stem = `${scenario.id}-${resolution.id}`;
		const cs2Path = resolve(artifactDir, `${stem}-cs2.png`);
		const browserPath = resolve(artifactDir, `${stem}-browser.png`);
		if (!(await access(cs2Path).then(() => true).catch(() => false)) || !(await access(browserPath).then(() => true).catch(() => false))) continue;
		const cs2 = await measure(cs2Path, scenario.id);
		const preview = await measure(browserPath, scenario.id);
		const geometryKeys = ['width', 'height', 'left', 'right', 'top', 'bottom'];
		const maxGeometryDelta = Math.max(...geometryKeys.map((key) => Math.abs(cs2[key] - preview[key])));
		// An empty or truncated detection compares 0 to 0 (or edge to edge) and
		// would otherwise pass vacuously; treat it as a failed measurement.
		const problems = [];
		for (const [source, result] of [['cs2', cs2], ['browser', preview]]) {
			if (!result.pixelCount) problems.push(`${source}: no foreground pixels detected`);
			if (result.clipped) problems.push(`${source}: crosshair reaches the scan margin`);
		}
		measurements.push({ scenario: scenario.id, resolution: resolution.id, cs2, browser: preview, maxGeometryDelta, problems, pass: !problems.length && maxGeometryDelta <= 1 });
	}
}

await browser.close();
const complete = measurements.length === manifest.scenarios.length * manifest.resolutions.length;
const calibrated = complete && measurements.every(({ pass }) => pass);
await writeFile(resolve(artifactDir, 'measurements.json'), `${JSON.stringify({ calibrated, tolerance: 1, measurements }, null, 2)}\n`);
const expected = manifest.scenarios.length * manifest.resolutions.length;
console.log(`Calibration geometry: ${measurements.filter(({ pass }) => pass).length}/${measurements.length} pairs within 1px (${expected} expected)`);
for (const { scenario, resolution, problems } of measurements) for (const problem of problems) console.warn(`  ${scenario}-${resolution}: ${problem}`);
if (!complete) console.warn(`  ${expected - measurements.length} pair(s) missing a cs2 or browser capture`);
if (!calibrated) process.exitCode = 1;
