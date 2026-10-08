import { test, expect } from '@playwright/test';
import { defaults } from '../src/model';

for (const dpr of [1, 2]) test(`1440p display mapping and page centering at DPR ${dpr}`, async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 2560 / dpr, height: 1300 / dpr },
    screen: { width: 2560 / dpr, height: 1440 / dpr }, deviceScaleFactor: dpr,
  });
  const page = await context.newPage();
  await page.route('**/entrance.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  try {
    const settings = { ...defaults, cl_crosshairstyle: 6, cl_crosshair_thickness: 3, cl_crosshair_drawoutline: 0 };
    await page.goto('/?settings=' + encodeURIComponent(JSON.stringify(settings)));
    const canvas = page.locator('.map-preview canvas');
    await expect.poll(() => canvas.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return Math.abs(rect.left + rect.width / 2 - document.documentElement.getBoundingClientRect().width / 2);
    })).toBeLessThanOrEqual(1);
    await expect.poll(async () => Number(await canvas.getAttribute('data-scale'))).toBeCloseTo(1440 / 1080 / dpr, 5);
    const code = await page.getByLabel('Current CS2 share code').inputValue();
    const pixels = () => canvas.evaluate(element => {
      const c = element as HTMLCanvasElement;
      const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let left = c.width, right = -1, top = c.height, bottom = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (data[(y * c.width + x) * 4 + 3]) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      return { width: right - left + 1, height: bottom - top + 1, dx: (left + right + 1) / 2 - c.width / 2, dy: (top + bottom + 1) / 2 - c.height / 2 };
    });
    expect(await pixels()).toMatchObject({ width: 4, height: 4 });
    expect(Math.abs((await pixels()).dx)).toBeLessThanOrEqual(1);
    expect(Math.abs((await pixels()).dy)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: '2x preview zoom' }).click();
    await expect.poll(async () => (await pixels()).width).toBe(8);
    await expect(page.getByLabel('Current CS2 share code')).toHaveValue(code);
    await page.getByRole('button', { name: '1x preview zoom' }).click();
    const displayHeight = page.getByLabel('Display height in physical pixels');
    await displayHeight.fill('');
    await expect(displayHeight).toHaveValue('');
    await expect.poll(async () => (await pixels()).width).toBe(4);
    await displayHeight.pressSequentially('2160');
    await expect(displayHeight).toHaveValue('2160');
    await displayHeight.press('Enter');
    await expect.poll(async () => (await pixels()).width).toBe(6);
    await displayHeight.fill('12');
    await displayHeight.press('Tab');
    await expect(displayHeight).toHaveValue('2160');
    await displayHeight.fill('2160.5');
    await displayHeight.press('Enter');
    await expect(displayHeight).toHaveValue('2160');
    await expect(page.getByLabel('Current CS2 share code')).toHaveValue(code);
    await page.getByRole('button', { name: 'Fullscreen game-size preview' }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className)).toBe('map-preview');
    await expect.poll(() => canvas.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return Math.max(Math.abs(rect.left + rect.width / 2 - innerWidth / 2), Math.abs(rect.top + rect.height / 2 - innerHeight / 2));
    })).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Exit fullscreen preview' }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  } finally { await context.close(); }
});
