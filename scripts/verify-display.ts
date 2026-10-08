import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { defaults } from '../src/model';

const directory = 'docs/evidence/display-scaling';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const settings = { ...defaults, cl_crosshairstyle: 4, cl_crosshair_thickness: 2, cl_crosshair_length: 8, cl_crosshair_gap: -9, cl_crosshair_drawoutline: 1 };
const url = 'https://pc-2.tailbbfe55.ts.net:8443/?settings=' + encodeURIComponent(JSON.stringify(settings));
const context = await browser.newContext({ viewport: { width: 2560, height: 1440 }, screen: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto(url);
await page.locator('#entrance').waitFor({ state: 'hidden' });
const measure = () => page.locator('.map-preview canvas').evaluate(element => {
  const canvas = element as HTMLCanvasElement;
  const rect = canvas.getBoundingClientRect();
  const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width, right = -1, top = canvas.height, bottom = -1;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (data[(y * canvas.width + x) * 4 + 3]) {
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return { canvas: rect.toJSON(), backing: [canvas.width, canvas.height], bounds: [left, top, right, bottom],
    crosshairSize: [right - left + 1, bottom - top + 1], scale: Number(canvas.dataset.scale),
    centerOffset: [(left + right + 1) / 2 - canvas.width / 2, (top + bottom + 1) / 2 - canvas.height / 2] };
});
const inline = await measure();
await page.screenshot({ path: `${directory}/desktop-1440p.png` });
await page.getByRole('button', { name: 'Fullscreen game-size preview' }).click();
await page.waitForFunction(() => document.fullscreenElement && document.querySelector('.map-preview canvas')?.getAttribute('width') === String(innerWidth));
const fullscreen = await measure();
await page.screenshot({ path: `${directory}/fullscreen-1440p.png` });
await page.getByRole('button', { name: 'Exit fullscreen preview' }).click();
await context.close();
const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const mobile = await mobileContext.newPage();
await mobile.goto(url);
await mobile.locator('#entrance').waitFor({ state: 'hidden' });
await mobile.screenshot({ path: `${directory}/mobile.png`, fullPage: true });
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth);
await writeFile(`${directory}/verification.json`, JSON.stringify({ display: [2560, 1440], dpr: 1, settings, inline, fullscreen, mobileOverflow: overflow, errors }, null, 2));
console.log(JSON.stringify({ inline, fullscreen, mobileOverflow: overflow, errors }, null, 2));
await browser.close();
