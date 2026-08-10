import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.env.PREVIEW_BASE_URL || 'http://127.0.0.1:4175';
const outputPath = resolve('artifacts/preview-calibration/synthetic-playtest.json');
const calibration = JSON.parse(await readFile(resolve('artifacts/preview-calibration/measurements.json'), 'utf8'));
const profiles = [
	{ id: 'A1', viewport: { width: 1440, height: 900 }, resolution: '1920x1080' },
	{ id: 'A2', viewport: { width: 2560, height: 1440 }, resolution: '2560x1440' },
	{ id: 'A3', viewport: { width: 1280, height: 960 }, resolution: '1280x960-stretched' },
	{ id: 'A4', viewport: { width: 390, height: 844 }, resolution: '1920x1080' },
	{ id: 'A5', viewport: { width: 412, height: 915 }, resolution: '1280x960-stretched' },
];
const sourceCode = 'CSGO-RBZih-6Hynp-ieuGe-tTkVz-9PqNO';
const browser = await chromium.launch();
const results = [];

for (const profile of profiles) {
	const context = await browser.newContext({ viewport: profile.viewport, acceptDownloads: true });
	const page = await context.newPage();
	const errors = [];
	page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error) => errors.push(error.message));
	const startedAt = Date.now();
	let editedCode = '';
	let downloadValid = false;
	let persistence = false;
	try {
		await page.goto(baseUrl);
		const input = page.getByRole('textbox', { name: 'CS2 crosshair share code', exact: true });
		await input.fill(sourceCode);
		await page.getByRole('button', { name: 'Load crosshair', exact: true }).click();
		await page.getByRole('slider', { name: 'Length', exact: true }).press('ArrowRight');
		editedCode = await input.inputValue();
		if (profile.viewport.width >= 768) await page.getByLabel('Preview resolution').selectOption(profile.resolution);
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Download CFG', exact: true }).click();
		const download = await downloadPromise;
		const downloadedText = await readFile(await download.path(), 'utf8');
		downloadValid = download.suggestedFilename().endsWith('.cfg')
			&& downloadedText.includes(`Generated from ${editedCode}`)
			&& downloadedText.includes('exec crosshair_');
		await page.reload();
		persistence = await input.inputValue() === editedCode;
	} catch (error) {
		errors.push(error instanceof Error ? error.message : String(error));
	}
	results.push({
		id: profile.id,
		display: `${profile.viewport.width}x${profile.viewport.height}`,
		previewResolution: profile.resolution,
		completedUnaided: Boolean(editedCode && editedCode !== sourceCode && downloadValid),
		persistence,
		downloadValid,
		durationMs: Date.now() - startedAt,
		errors,
	});
	await context.close();
}

await browser.close();
const evidence = {
	version: 1,
	method: 'automated-isolated-browser-profiles',
	generatedAt: new Date().toISOString(),
	limitations: ['Does not measure human preference or comprehension.', 'CFG validity is verified structurally; CS2 execution is represented by the 15 real-game calibration captures.'],
	previewCalibrationPassed: calibration.calibrated === true,
	results,
};
await mkdir(resolve('artifacts/preview-calibration'), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
const passed = calibration.calibrated === true && results.every((result) => result.completedUnaided && result.persistence && result.downloadValid && result.errors.length === 0);
console.log(`Synthetic playtest: ${results.filter((result) => result.completedUnaided).length}/${results.length} workflows complete; ${passed ? 'PASS' : 'FAIL'}`);
if (!passed) process.exitCode = 1;
