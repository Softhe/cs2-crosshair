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


test('fit reports an incomplete native raster instead of claiming a complete view', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One bounded-allocation regression is sufficient.');
  await fixture(page, { cl_crosshair_length: 255, cl_crosshair_screen_height: 240 });
  await openPreviewOptions(page);
  await page.getByRole('button', { name: 'Inspect preview', exact: true }).click();
  await page.getByLabel('Preview scale', { exact: true }).selectOption('-2');
  await page.getByLabel('Game render height in physical pixels').fill('8192');
  await page.getByLabel('Game render height in physical pixels').press('Enter');
  await page.getByLabel('Fit crosshair in preview').check();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.locator('.map-preview > canvas')).toHaveAttribute('data-source-clipped', 'true');
  await expect(page.locator('.map-preview > canvas')).toHaveAttribute('data-clipped', 'true');
  await expect(page.getByText('This crosshair is too large to preview completely. Choose a lower game render height.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fit preview', exact: true })).toHaveCount(0);
});
