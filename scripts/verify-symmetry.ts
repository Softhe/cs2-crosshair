import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { defaults } from '../src/model';

const label = process.argv[2] || 'after';
const directory = 'docs/evidence/raster-symmetry';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, screen: { width: 2560, height: 1440 } });
await page.goto('https://pc-2.tailbbfe55.ts.net:8443/?settings=' + encodeURIComponent(JSON.stringify({ ...defaults, cl_crosshairstyle: 4, cl_crosshair_thickness: 2, cl_crosshair_gap: -9 })));
await page.locator('#entrance').waitFor({ state: 'hidden' });
const result = await page.locator('.detail-preview canvas').evaluate(element => {
  const canvas = element as HTMLCanvasElement;
  const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width, right = -1, top = canvas.height, bottom = -1;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (data[(y * canvas.width + x) * 4 + 3]) {
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  let mismatches = 0;
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) for (let c = 0; c < 4; c++) {
    const value = data[(y * canvas.width + x) * 4 + c];
    if (Math.abs(value - data[(y * canvas.width + left + right - x) * 4 + c]) > 1) mismatches++;
    if (Math.abs(value - data[((top + bottom - y) * canvas.width + x) * 4 + c]) > 1) mismatches++;
  }
  return { bounds: [left, top, right, bottom], mismatches, image: canvas.toDataURL('image/png') };
});
const image = Buffer.from(result.image.split(',')[1], 'base64');
const [left, top, right, bottom] = result.bounds;
if (right < left || bottom < top) throw new Error('The crosshair canvas is empty.');
await sharp(image).extract({ left: left - 3, top: top - 3, width: right - left + 7, height: bottom - top + 7 }).flatten({ background: '#192131' }).resize({ width: (right - left + 7) * 8, kernel: 'nearest' }).png().toFile(`${directory}/${label}.png`);
await writeFile(`${directory}/${label}.json`, JSON.stringify({ bounds: result.bounds, mismatches: result.mismatches }, null, 2));
console.log({ bounds: result.bounds, mismatches: result.mismatches });
await browser.close();
