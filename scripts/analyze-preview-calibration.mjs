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
		for (let y = 16; y < height - 16; y += 1) for (let x = 16; x < width - 16; x += 1) {
			const offset = (y * width + x) * 4;
			const [r, g, b] = [data[offset], data[offset + 1], data[offset + 2]];
			const foreground = scenario === 'outlined'
				? r > 135 && g > 125 && b < 80 && (r + g) / 2 - b > 70
				: scenario === 'classic'
					? g > 100 && g - r > 35 && g - b > 25
					: g > 85 && b > 85 && g - r > 28 && b - r > 28;
			if (foreground) points.push({ x, y });
		}
		if (!points.length) return { pixelCount: 0, width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 };
		const xs = points.map(({ x }) => x), ys = points.map(({ y }) => y);
		const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
		return {
			pixelCount: points.length,
			width: maxX - minX + 1,
			height: maxY - minY + 1,
			left: 48 - minX,
			right: maxX - 47,
			top: 48 - minY,
			bottom: maxY - 47,
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
		measurements.push({ scenario: scenario.id, resolution: resolution.id, cs2, browser: preview, maxGeometryDelta, pass: maxGeometryDelta <= 1 });
	}
}

await browser.close();
const complete = measurements.length === manifest.scenarios.length * manifest.resolutions.length;
const calibrated = complete && measurements.every(({ pass }) => pass);
await writeFile(resolve(artifactDir, 'measurements.json'), `${JSON.stringify({ calibrated, tolerance: 1, measurements }, null, 2)}\n`);
console.log(`Calibration geometry: ${measurements.filter(({ pass }) => pass).length}/${measurements.length} pairs within 1px`);
if (!calibrated) process.exitCode = 1;
