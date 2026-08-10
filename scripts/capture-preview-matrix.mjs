import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.env.PREVIEW_BASE_URL || 'http://127.0.0.1:4175';
const outputDir = resolve('artifacts/preview-calibration');
const manifest = JSON.parse(await readFile(resolve('docs/preview-reference-matrix.json'), 'utf8'));
const scenarios = manifest.scenarios.map(({ id, preset, shareCode }) => ({ id, button: preset, shareCode }));
const resolutions = manifest.resolutions;

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });

for (const resolution of resolutions) {
  await page.setViewportSize({ width: resolution.width, height: resolution.height });
  for (const scenario of scenarios) {
    await page.goto(scenario.shareCode ? `${baseUrl}/?code=${scenario.shareCode}` : baseUrl);
    if (scenario.button) await page.getByRole('button', { name: scenario.button, exact: true }).click();
    await page.getByLabel('Preview resolution').selectOption(resolution.id);
    await page.getByRole('button', { name: 'Exact', exact: true }).click();
    const stage = page.getByTestId('crosshair-stage');
    const box = await stage.boundingBox();
    if (!box || box.width < 96 || box.height < 96) throw new Error(`Preview stage is too small for ${scenario.id}-${resolution.id}`);
    await page.screenshot({
      path: resolve(outputDir, `${scenario.id}-${resolution.id}-browser.png`),
      clip: {
        x: Math.floor(box.x + box.width / 2) - 48,
        y: Math.floor(box.y + box.height / 2) - 48,
        width: 96,
        height: 96,
      },
    });
  }
}

await browser.close();
console.log(`captured ${scenarios.length * resolutions.length} browser preview references in ${outputDir}`);
