import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { defaults } from '../src/model';

// Lossless CS2 window captures have a 1920x1080 client area at (1,31).
// These older captures have driver sharpening enabled; compare occupancy only.
const fixtures = [
  { file: 'baseline-original.png', thickness: 1, gap: 2, reference: 1080 },
  { file: 'thickness-2.png', thickness: 2, gap: 2, reference: 1080 },
  { file: 'thickness-3.png', thickness: 3, gap: 2, reference: 1080 },
  { file: 'thickness-2-gap-4.png', thickness: 2, gap: 4, reference: 1080 },
  { file: 'reference-810.png', thickness: 1, gap: 2, reference: 810 },
];

for (const fixture of fixtures) test(`static cross matches captured game occupancy: ${fixture.file}`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  try {
    const { data, info } = await sharp(`docs/evidence/crosshair-calibration/${fixture.file}`).raw().toBuffer({ resolveWithObject: true });
    const expected: string[] = [];
    for (let dy = -24; dy < 24; dy++) {
      let row = '';
      for (let dx = -24; dx < 24; dx++) {
        const i = ((571 + dy) * info.width + 961 + dx) * info.channels;
        row += data[i + 1]! - data[i]! > 40 && data[i + 2]! - data[i]! > 20 ? '#' : '.';
      }
      expected.push(row);
    }
    const page = await context.newPage();
    await page.route('**/entrance.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.goto('/?settings=' + encodeURIComponent(JSON.stringify({ ...defaults,
      cl_crosshairstyle: 4, cl_crosshair_thickness: fixture.thickness,
      cl_crosshair_length: 2, cl_crosshair_gap: fixture.gap,
      cl_crosshairdot: 1, cl_crosshair_drawoutline: 0, cl_crosshair_recoil: 0,
      cl_crosshair_screen_height: fixture.reference,
    })));
    const canvas = page.locator('.map-preview > canvas');
    await canvas.evaluate(element => {
      const canvas = element as HTMLCanvasElement;
      canvas.style.width = '1920px';
      canvas.style.height = '1080px';
    });
    await expect.poll(() => canvas.evaluate(element => [
      (element as HTMLCanvasElement).width, (element as HTMLCanvasElement).height,
    ])).toEqual([1920, 1080]);
    const actual = await canvas.evaluate(element => {
      const canvas = element as HTMLCanvasElement;
      const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      return Array.from({ length: 48 }, (_, y) => Array.from({ length: 48 }, (_, x) =>
        data[((540 + y - 24) * canvas.width + 960 + x - 24) * 4 + 3] ? '#' : '.',
      ).join(''));
    });
    expect(actual).toEqual(expected);
  } finally { await context.close(); }
});

// NVIDIA profile sharpening was disabled before capturing these 96x96 crops.
// Their client-center coordinate (48,48) maps to native canvas (960,540).
for (const fixture of [
  {file: 'driver-off-green.png', color: [0, 255, 168]},
  {file: 'driver-off-muted.png', color: [40, 80, 120]},
]) test(`native RGB composite matches driver-unprocessed game: ${fixture.file}`, async ({browser}) => {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, deviceScaleFactor: 1});
  try {
    const directory = 'docs/evidence/crosshair-calibration/';
    const background = await sharp(directory + 'driver-off-background.png').removeAlpha().raw().toBuffer();
    const {data: expected, info} = await sharp(directory + fixture.file).removeAlpha().raw().toBuffer({resolveWithObject: true});
    expect([info.width, info.height, info.channels]).toEqual([96, 96, 3]);
    const page = await context.newPage();
    await page.route('**/entrance.js*', route => route.fulfill({contentType: 'text/javascript', body: ''}));
    await page.goto('/?settings=' + encodeURIComponent(JSON.stringify({...defaults,
      cl_crosshairstyle: 4, cl_crosshair_thickness: 1, cl_crosshair_length: 2,
      cl_crosshair_gap: 2, cl_crosshairdot: 1, cl_crosshair_drawoutline: 0,
      cl_crosshair_recoil: 0, cl_crosshair_screen_height: 1080,
      cl_crosshaircolor_r: fixture.color[0], cl_crosshaircolor_g: fixture.color[1],
      cl_crosshaircolor_b: fixture.color[2], cl_crosshaircolor_a: 255,
    })));
    const canvas = page.locator('.map-preview > canvas');
    await canvas.evaluate(element => {
      element.style.width = '1920px';
      element.style.height = '1080px';
    });
    await expect.poll(() => canvas.evaluate(element => [(element as HTMLCanvasElement).width, (element as HTMLCanvasElement).height])).toEqual([1920, 1080]);
    const rgba = await canvas.evaluate(element => Array.from((element as HTMLCanvasElement).getContext('2d')!
      .getImageData(960 - 48, 540 - 48, 96, 96).data));
    let maximumError = 0;
    for (let pixel = 0; pixel < 96 * 96; pixel++) {
      const alpha = rgba[pixel * 4 + 3]! / 255;
      for (let channel = 0; channel < 3; channel++) {
        const index = pixel * 3 + channel;
        const composited = Math.round(rgba[pixel * 4 + channel]! * alpha + background[index]! * (1 - alpha));
        maximumError = Math.max(maximumError, Math.abs(composited - expected[index]!));
      }
    }
    // One level accommodates the two observed capture-rounding channel values.
    expect(maximumError).toBeLessThanOrEqual(1);
  } finally { await context.close(); }
});
