import {openPreviewOptions} from './preview-options-helper';
import { test, expect } from '@playwright/test';
import { defaults } from '../src/model';

for (const dpr of [1, 1.25, 1.5, 2]) test(`1080p game mapping on a 1440p display and page centering at DPR ${dpr}`, async ({ browser }) => {
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
    await openPreviewOptions(page);await page.getByRole('button', {name:'Inspect preview',exact:true}).click();
    await expect(page.getByLabel('Preview scale', { exact: true })).toHaveValue('1080');
    await page.getByLabel('Preview scale', { exact: true }).selectOption('-2');
    const displayHeight = page.getByLabel('Game render height in physical pixels');
    await displayHeight.fill('');
    await expect(displayHeight).toHaveValue('');
    await expect.poll(async () => (await pixels()).width).toBe(3);
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
    await expect(page.getByLabel('Crosshair code or config')).toHaveAttribute('data-current-code',code);
    await page.getByRole('button', {name:'Close dialog'}).click();
    await openPreviewOptions(page);await page.getByRole('button', { name: 'Fullscreen game-size preview' }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className), { timeout: 10000 }).toBe('map-preview');
    await expect.poll(() => canvas.evaluate(element => element.getBoundingClientRect().width), { timeout: 10000 }).toBeGreaterThan(0);
    await expect.poll(() => canvas.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return Math.max(Math.abs(rect.left + rect.width / 2 - innerWidth / 2), Math.abs(rect.top + rect.height / 2 - innerHeight / 2));
    }), { timeout: 10000 }).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Exit fullscreen preview' }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement), { timeout: 10000 }).toBeNull();
  } finally { await context.close(); }
});

test('explicit game resolution survives reload and viewport changes without changing the code', async ({ page }) => {
  await page.route('**/entrance.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.goto('/');
  const code = await page.getByLabel('Crosshair code or config').getAttribute('data-current-code');
  await openPreviewOptions(page);
  await page.getByRole('button', { name: 'Inspect preview', exact: true }).click();
  const select = page.getByLabel('Preview scale', { exact: true });
  await expect(select).toHaveValue('1080');
  await select.selectOption('-2');
  const height = page.getByLabel('Game render height in physical pixels');
  await height.fill('1200');
  await height.press('Enter');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('delli.v3.preview-resolution')!))).toEqual({ targetHeight: -2, customHeight: 1200 });
  await page.reload();
  await page.setViewportSize({ width: 1600, height: 1100 });
  await openPreviewOptions(page);
  await page.getByRole('button', { name: 'Inspect preview', exact: true }).click();
  await expect(select).toHaveValue('-2');
  await expect(height).toHaveValue('1200');
  await expect(page.getByLabel('Crosshair code or config')).toHaveAttribute('data-current-code', code!);
  await select.selectOption('-1');
  await expect(page.getByText('Match the resolution selected in CS2', { exact: false })).toBeVisible();
  await expect(height).toHaveCount(0);
});
