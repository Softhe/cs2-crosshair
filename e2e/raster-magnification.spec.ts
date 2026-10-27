import { test, expect, type Page } from '@playwright/test';
import { defaults } from '../src/model';
import { openPreviewOptions } from './preview-options-helper';

async function fixture(page: Page, extra: Record<string, number> = {}) {
  await page.route('**/entrance.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.goto('/?settings=' + encodeURIComponent(JSON.stringify({ ...defaults, cl_crosshairstyle: 4,
    cl_crosshair_thickness: 1, cl_crosshair_length: 2, cl_crosshair_gap: 2,
    cl_crosshairdot: 1, cl_crosshair_drawoutline: 0, cl_crosshair_recoil: 0, ...extra })));
  if (await page.getByRole('button', { name: 'Expand preview', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Expand preview', exact: true }).click();
  await openPreviewOptions(page);
  await page.getByRole('button', { name: 'Inspect preview', exact: true }).click();
  await page.getByLabel('Preview scale', { exact: true }).selectOption('1080');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.locator('.detail-preview canvas')).toHaveAttribute('data-frame', /[1-9]/);
}

async function rasterComparison(page: Page, magnification: number) {
  return page.evaluate((factor) => {
    const main = document.querySelector<HTMLCanvasElement>('.map-preview > canvas')!;
    const detail = document.querySelector<HTMLCanvasElement>('.detail-preview canvas')!;
    function crop(canvas: HTMLCanvasElement) {
      const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      let l = canvas.width, t = canvas.height, r = 0, b = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (data[(y * canvas.width + x) * 4 + 3]) {
        l = Math.min(l, x); t = Math.min(t, y); r = Math.max(r, x + 1); b = Math.max(b, y + 1);
      }
      return { data, l, t, width: r - l, height: b - t, stride: canvas.width };
    }
    const a = crop(main), b = crop(detail);
    let mismatches = 0;
    if (b.width !== a.width * factor || b.height !== a.height * factor) return { mismatches: -1, mainFrame: main.dataset.frame, detailFrame: detail.dataset.frame };
    for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) for (let c = 0; c < 4; c++) {
      const expected = a.data[((a.t + Math.floor(y / factor)) * a.stride + a.l + Math.floor(x / factor)) * 4 + c]!;
      const actual = b.data[((b.t + y) * b.stride + b.l + x) * 4 + c]!;
      if (actual !== expected) mismatches++;
    }
    return { mismatches, mainFrame: main.dataset.frame, detailFrame: detail.dataset.frame };
  }, magnification);
}

for (const dpr of [1, 1.25, 1.5, 2]) test(`detail magnifies the native raster exactly at DPR ${dpr}`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dpr });
  try {
    const page = await context.newPage();
    for (const settings of [{}, { cl_crosshair_thickness: 2, cl_crosshaircolor_a: 128, cl_crosshair_drawoutline: 1 }] as Record<string, number>[]) {
      await fixture(page, settings);
      await expect.poll(async () => (await rasterComparison(page, 4)).mismatches).toBe(0);
      for (const zoom of [2, 4, 8]) {
        await page.getByRole('button', { name: `${zoom}x preview zoom` }).click();
        await expect(page.locator('.map-preview > canvas')).toHaveAttribute('data-magnification', String(zoom));
        await expect.poll(async () => (await rasterComparison(page, 4 / zoom)).mismatches).toBe(0);
      }
    }
  } finally { await context.close(); }
});

test('dynamic preview and detail share every rendered frame', async ({ page }) => {
  await fixture(page, { cl_crosshairstyle: 2, cl_crosshair_dynamic_spread_limit: 4 });
  await openPreviewOptions(page);
  await page.getByRole('button', { name: 'Start Dynamic Preview' }).click();
  const first = await page.locator('.map-preview > canvas').getAttribute('data-frame');
  await expect.poll(() => page.locator('.map-preview > canvas').getAttribute('data-frame')).not.toBe(first);
  for (let i = 0; i < 5; i++) {
    const result = await rasterComparison(page, 4);
    expect(result.mainFrame).toBe(result.detailFrame);
    expect(result.mismatches).toBe(0);
  }
});

test('large detail stays at four times magnification and reports cropping', async ({ page }) => {
  await fixture(page, { cl_crosshair_length: 50, cl_crosshair_gap: 8 });
  await expect(page.locator('.detail-preview canvas')).toHaveAttribute('data-magnification', '4');
  await expect(page.locator('.detail-preview canvas')).toHaveAttribute('data-clipped', 'true');
  await expect(page.locator('.detail-preview > span')).toContainText('cropped');
});


test('oversized native raster reports clipping and fit shows the complete shape', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One bounded-allocation regression is sufficient.');
  await fixture(page, { cl_crosshair_length: 255, cl_crosshair_screen_height: 240 });
  await openPreviewOptions(page);
  await page.getByRole('button', { name: 'Inspect preview', exact: true }).click();
  await page.getByLabel('Preview scale', { exact: true }).selectOption('-2');
  await page.getByLabel('Game render height in physical pixels').fill('8192');
  await page.getByLabel('Game render height in physical pixels').press('Enter');
  const canvas = page.locator('.map-preview > canvas');
  // The native frame exceeds the bounded allocation, so the view is reported incomplete.
  await expect(canvas).toHaveAttribute('data-source-clipped', 'true');
  await expect(canvas).toHaveAttribute('data-clipped', 'true');
  // Below 1x, fit rasterizes directly at the fitted scale instead of shrinking the native frame.
  await page.getByLabel('Fit crosshair in preview').check();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(canvas).toHaveAttribute('data-source-clipped', 'false');
  await expect(canvas).toHaveAttribute('data-clipped', 'false');
  await expect(page.getByText('This crosshair is too large to preview completely. Choose a lower game render height.')).toHaveCount(0);
});

// Fit used to stretch the native frame by a fractional factor, which made opposing arms
// differ in thickness or dropped the crosshair entirely once the factor fell below 1x.
for (const dpr of [1, 1.25, 1.5]) test(`fit keeps arms symmetric and visible at DPR ${dpr}`, async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Device scale is set explicitly.');
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dpr });
  try {
    const page = await context.newPage();
    for (const [settings, zoom] of [[{ cl_crosshair_thickness: 2, cl_crosshair_length: 60 }, 8], [{ cl_crosshair_length: 255, cl_crosshair_gap: 3, cl_crosshair_screen_height: 540 }, 1]] as const) {
      await fixture(page, settings);
      await page.getByRole('button', { name: `${zoom}x preview zoom` }).click();
      await openPreviewOptions(page);
      await page.getByRole('button', { name: 'Inspect preview', exact: true }).click();
      await page.getByLabel('Fit crosshair in preview').check();
      await page.getByRole('button', { name: 'Close dialog' }).click();
      const canvas = page.locator('.map-preview > canvas');
      await expect(canvas).toHaveAttribute('data-clipped', 'false');
      // The inputs must actually need fitting for this test to exercise it.
      expect(Number(await canvas.getAttribute('data-scale'))).toBeLessThan(zoom * 1080 / (settings.cl_crosshair_screen_height ?? 1080) / dpr);
      const magnification = Number(await canvas.getAttribute('data-magnification'));
      expect(Number.isInteger(magnification)).toBe(true);
      const result = await canvas.evaluate(element => {
        const c = element as HTMLCanvasElement, data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let l = c.width, t = c.height, r = 0, b = 0;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (data[(y * c.width + x) * 4 + 3]) {
          l = Math.min(l, x); t = Math.min(t, y); r = Math.max(r, x + 1); b = Math.max(b, y + 1);
        }
        const opaque = (x: number, y: number) => data[(y * c.width + x) * 4 + 3]! > 0;
        let asymmetric = 0, count = 0;
        for (let y = t; y < b; y++) for (let x = l; x < r; x++) {
          if (opaque(x, y)) count++;
          if (opaque(x, y) !== opaque(l + r - 1 - x, y) || opaque(x, y) !== opaque(x, t + b - 1 - y)) asymmetric++;
        }
        const rows = (x: number) => { let n = 0; for (let y = t; y < b; y++) if (opaque(x, y)) n++; return n; };
        const cols = (y: number) => { let n = 0; for (let x = l; x < r; x++) if (opaque(x, y)) n++; return n; };
        // Arm thickness: a column near the left edge versus a row near the top edge.
        return { count, asymmetric, horizontal: rows(l + 1), vertical: cols(t + 1) };
      });
      expect(result.count).toBeGreaterThan(0);
      expect(result.asymmetric).toBe(0);
      expect(result.horizontal).toBe(result.vertical);
      await page.getByRole('button', { name: '1x preview zoom' }).click();
    }
  } finally { await context.close(); }
});
