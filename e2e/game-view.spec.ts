import { test, expect } from '@playwright/test';
import { defaults } from '../src/model';

test('match my in-game size renders at the CS2 resolution and stretches it like the game', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 2560, height: 1300 }, screen: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.route('**/entrance.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.route('**/api/session', route => route.fulfill({ json: { user: null } }));
  try {
    const settings = { ...defaults, cl_crosshairstyle: 6, cl_crosshair_thickness: 3, cl_crosshair_drawoutline: 0, cl_crosshair_screen_height: 1080 };
    await page.goto('/?settings=' + encodeURIComponent(JSON.stringify(settings)));
    const canvas = page.locator('.map-preview > canvas');
    // Opaque-enough pixels only, so filtered edges of a fractional stretch do not count as ink.
    const pixels = () => canvas.evaluate(element => {
      const c = element as HTMLCanvasElement, data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let left = c.width, right = -1, top = c.height, bottom = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (data[(y * c.width + x) * 4 + 3]! >= 128) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      return { width: right - left + 1, height: bottom - top + 1 };
    });
    await expect.poll(pixels).toMatchObject({ width: 3, height: 3 });
    await page.getByLabel('Preview options', { exact: true }).click();
    await page.getByLabel('Match my in-game size').check();
    const resolution = page.getByLabel('CS2 resolution');
    // Starts from the monitor rather than assuming a resolution, and like CS2 lists only modes that fit it.
    await expect(resolution).toHaveValue('2560x1440');
    await expect(resolution.locator('option[value="3840x2160"]')).toHaveCount(0);
    await expect(resolution.locator('option[value="640x480"]')).toHaveCount(1);
    await expect.poll(pixels).toMatchObject({ width: 4, height: 4 });
    await resolution.selectOption('1280x720');
    // 720 rows: the 3-unit dot is 2 game pixels, doubled on both axes.
    await expect.poll(pixels).toMatchObject({ width: 4, height: 4 });
    await resolution.selectOption('1280x960');
    // 960 rows: 3 game pixels, 2× wide and 1.5× tall when stretched to 16:9.
    await expect.poll(pixels).toMatchObject({ width: 6 });
    expect((await pixels()).height).toBeGreaterThanOrEqual(4);
    expect((await pixels()).height).toBeLessThanOrEqual(5);
    await page.getByLabel('Stretched to fill the monitor').uncheck();
    await expect.poll(async () => (await pixels()).width).toBeLessThanOrEqual(5);
    await page.getByLabel('CS2 resolution').selectOption('custom');
    await page.getByLabel('CS2 width').fill('1440');
    await page.getByLabel('CS2 height').fill('1080');
    await page.getByLabel('CS2 height').press('Enter');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('delli.v3.game-view')!))).toMatchObject({ enabled: true, width: 1440, height: 1080, stretched: false });
    await page.reload();
    await expect(page.locator('.preview-target')).toContainText('1440×1080');
  } finally { await context.close(); }
});

test('the game view loads from the Steam account and saves changes back', async ({ page }) => {
  const puts: unknown[] = [];
  let stored: unknown = { gameView: { enabled: true, width: 1280, height: 1024, stretched: true } };
  await page.route('**/entrance.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === '/api/session') return route.fulfill({ json: { user: { steamId: '76561198000000001' }, csrfToken: 'csrf' } });
    if (path === '/api/library') return route.fulfill({ json: { revision: 0, entries: [] } });
    if (path === '/api/preferences' && request.method() === 'GET') return route.fulfill({ json: { preferences: stored } });
    if (path === '/api/preferences' && request.method() === 'PUT') {
      expect(request.headers()['x-csrf-token']).toBe('csrf');
      stored = request.postDataJSON().preferences; puts.push(stored);
      return route.fulfill({ json: { preferences: stored } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto('/');
  await expect(page.locator('.preview-target')).toContainText('1280×1024');
  await page.getByLabel('Preview options', { exact: true }).click();
  await expect(page.getByLabel('CS2 resolution')).toHaveValue('1280x1024');
  await expect(page.getByText('Synced to your Steam account.')).toBeVisible();
  expect(puts).toHaveLength(0);
  await page.getByLabel('Stretched to fill the monitor').uncheck();
  await expect.poll(() => puts.length).toBe(1);
  expect(puts[0]).toEqual({ gameView: { enabled: true, width: 1280, height: 1024, stretched: false } });
  await expect(page.getByText('Synced to your Steam account.')).toBeVisible();
});
