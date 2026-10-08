import { test, expect } from '@playwright/test';
import { defaults } from '../src/model';

for (const dpr of [1, 1.25, 2]) test(`rectangular crosshairs keep mirrored pixels at DPR ${dpr}`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dpr });
  const page = await context.newPage();
  await page.route('**/entrance.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  try {
    await page.goto('/?settings=' + encodeURIComponent(JSON.stringify({ ...defaults, cl_crosshairstyle: 4, cl_crosshair_recoil: 0, cl_crosshair_drawoutline: 1 })));
    await page.getByLabel('Preview scale', { exact: true }).selectOption('1440');
    for (const thickness of [1, 2, 3]) for (const gap of [-9, 0, 5]) for (const zoom of [1, 4]) {
      await page.getByLabel('Thickness', { exact: true }).fill(String(thickness));
      await page.getByLabel('Thickness', { exact: true }).press('Enter');
      await page.getByLabel('Gap', { exact: true }).fill(String(gap));
      await page.getByLabel('Gap', { exact: true }).press('Enter');
      await page.getByRole('button', { name: `${zoom}x preview zoom` }).click();
      await expect.poll(() => page.locator('.map-preview canvas').evaluate(element => {
        const canvas = element as HTMLCanvasElement;
        const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
        let left = canvas.width, right = -1, top = canvas.height, bottom = -1;
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (data[(y * canvas.width + x) * 4 + 3]) {
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
        if (right < left || bottom < top) return -1;
        let mismatch = 0;
        for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) for (let c = 0; c < 4; c++) {
          const value = data[(y * canvas.width + x) * 4 + c];
          if (Math.abs(value - data[(y * canvas.width + left + right - x) * 4 + c]) > 1) mismatch++;
          if (Math.abs(value - data[((top + bottom - y) * canvas.width + x) * 4 + c]) > 1) mismatch++;
        }
        return mismatch;
      }), { message: `thickness ${thickness}, gap ${gap}, zoom ${zoom}` }).toBe(0);
    }
  } finally { await context.close(); }
});
