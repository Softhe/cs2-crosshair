import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { defaults } from '../src/model';

// Lossless CS2 window captures have a 1920x1080 client area at (1,31).
// Compare occupancy only. Color/alpha calibration is a separate measurement.
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
