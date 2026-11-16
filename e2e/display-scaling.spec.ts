import {openPreviewOptions} from './preview-options-helper';
import { test, expect } from '@playwright/test';
import { defaults } from '../src/model';

for (const dpr of [1, 1.25, 1.5, 2]) test(`as-designed mapping on a 1440p display and page centering at DPR ${dpr}`, async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: Math.round(2560 / dpr), height: Math.round(1300 / dpr) },
    screen: { width: Math.round(2560 / dpr), height: Math.round(1440 / dpr) }, deviceScaleFactor: dpr,
  });
  const page = await context.newPage();
  await page.route('**/entrance.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  try {
    const settings = { ...defaults, cl_crosshairstyle: 6, cl_crosshair_thickness: 3, cl_crosshair_drawoutline: 0 };
    await page.goto('/?settings=' + encodeURIComponent(JSON.stringify(settings)));
    const canvas = page.locator('.map-preview > canvas');
    await expect.poll(() => canvas.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return Math.abs(rect.left + rect.width / 2 - element.parentElement!.getBoundingClientRect().left - element.parentElement!.getBoundingClientRect().width / 2);
    })).toBeLessThanOrEqual(1);
    await expect.poll(async () => Number(await canvas.getAttribute('data-scale'))).toBeCloseTo(1 / dpr, 5);
    const code = await page.getByLabel('Crosshair code or config').getAttribute('data-current-code').then(value=>value!);
    const pixels = () => canvas.evaluate(element => {
      const c = element as HTMLCanvasElement;
      const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let left = c.width, right = -1, top = c.height, bottom = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (data[(y * c.width + x) * 4 + 3]) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      return { width: right - left + 1, height: bottom - top + 1, dx: (left + right + 1) / 2 - c.width / 2, dy: (top + bottom + 1) / 2 - c.height / 2 };
    });
    expect(await pixels()).toMatchObject({ width: 3, height: 3 });
    expect(Math.abs((await pixels()).dx)).toBeLessThanOrEqual(1);
    expect(Math.abs((await pixels()).dy)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: '2x preview zoom' }).click();
    await expect.poll(async () => (await pixels()).width).toBe(6);
    await expect(page.getByLabel('Crosshair code or config')).toHaveAttribute('data-current-code',code);
    await page.getByRole('button', { name: '1x preview zoom' }).click();
    // Matching the game renders at the monitor's own 1440 rows: 3 units become 4 pixels, unstretched.
    await openPreviewOptions(page);
    await page.getByLabel('Match my in-game size').check();
    await expect.poll(async () => (await pixels()).width).toBe(4);
    await page.getByLabel('Match my in-game size').uncheck();
    await expect.poll(async () => (await pixels()).width).toBe(3);
    await expect(page.getByLabel('Crosshair code or config')).toHaveAttribute('data-current-code',code);
    await page.getByRole('button', { name: 'Fullscreen game-size preview' }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className), { timeout: 10000 }).toBe('map-preview');
    await expect.poll(() => canvas.evaluate(element => element.getBoundingClientRect().width), { timeout: 10000 }).toBeGreaterThan(0);
    await expect.poll(() => canvas.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return Math.max(Math.abs(rect.left + rect.width / 2 - innerWidth / 2), Math.abs(rect.top + rect.height / 2 - innerHeight / 2));
    }), { timeout: 10000 }).toBeLessThanOrEqual(1);
    const controls = page.locator('.fullscreen-controls');
    await controls.getByRole('button', { name: '2x preview zoom', exact: true }).click();
    await expect(controls.getByRole('button', { name: '2x preview zoom', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className)).toBe('map-preview');
    const exit = await page.getByRole('button', { name: 'Exit fullscreen preview' }).boundingBox();
    const viewport = page.viewportSize()!;
    expect(exit!.y).toBeLessThan(viewport.height / 4);
    expect(exit!.x + exit!.width).toBeGreaterThan(viewport.width * 3 / 4);
    await controls.getByRole('button', { name: '1x preview zoom', exact: true }).click();
    await page.getByRole('button', { name: 'Exit fullscreen preview' }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement), { timeout: 10000 }).toBeNull();
  } finally { await context.close(); }
});

test('preview is as designed: one pixel per unit at the crosshair reference height', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 2560, height: 1300 }, screen: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.route('**/api/session', route => route.fulfill({ json: { user: null } }));
  await page.route('**/entrance.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  // A resolution saved by the removed inspection dialog no longer applies.
  await page.addInitScript(() => localStorage.setItem('delli.v3.preview-resolution', JSON.stringify({ targetHeight: 1440, customHeight: 1440, version: 2 })));
  try {
    const settings = { ...defaults, cl_crosshairstyle: 4, cl_crosshair_thickness: 1, cl_crosshair_length: 4, cl_crosshair_gap: 2, cl_crosshairdot: 1, cl_crosshair_drawoutline: 0, cl_crosshair_screen_height: 960 };
    await page.goto('/?settings=' + encodeURIComponent(JSON.stringify(settings)));
    const canvas = page.locator('.map-preview > canvas');
    // 960-reference code on a 1440 monitor: neither rescaled to the monitor nor to 1080p.
    await expect.poll(() => canvas.getAttribute('data-scale')).toBe('1');
    await expect.poll(() => canvas.getAttribute('data-stretch')).toBe('1,1');
    await expect(page.locator('.preview-target')).toContainText('960p');
    await openPreviewOptions(page);
    await expect(page.getByRole('button', { name: 'Inspect preview', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Preview scale', { exact: true })).toHaveCount(0);
  } finally { await context.close(); }
});
