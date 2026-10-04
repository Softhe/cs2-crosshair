import { chromium } from 'playwright';
import { defaults } from '../src/model';
import { mkdir, writeFile } from 'node:fs/promises';

// Read-only browser probes for the rendering review. Run against the local Vite server.
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.addInitScript(() => {
  const state = { clears: 0, arcs: [] as number[], phaseTime: null as number | null };
  (window as any).__previewAudit = state;
  const clear = CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.clearRect = function (...args) {
    if (this.canvas.closest('.map-preview')) { state.clears++; state.arcs = []; }
    return clear.apply(this, args);
  };
  const arc = CanvasRenderingContext2D.prototype.arc;
  CanvasRenderingContext2D.prototype.arc = function (...args) {
    state.arcs.push(args[2]);
    return arc.apply(this, args);
  };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => raf(time => callback(state.phaseTime ?? time));
});
async function load(values: Record<string, number>) {
  await page.goto('http://127.0.0.1:4180/?settings=' + encodeURIComponent(JSON.stringify({ ...defaults, ...values })));
  await page.locator('.map-preview canvas').waitFor();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function pixels() {
  return page.locator('.map-preview canvas').evaluate(element => {
    const c = element as HTMLCanvasElement;
    const bytes = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let count = 0, maxAlpha = 0, partial = 0;
    let left = c.width, right = -1, top = c.height, bottom = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const alpha = bytes[(y * c.width + x) * 4 + 3];
      if (!alpha) continue;
      count++; maxAlpha = Math.max(maxAlpha, alpha); if (alpha < 255) partial++;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    return { cssWidth: c.clientWidth, cssHeight: c.clientHeight, width: c.width, height: c.height,
      dpr: window.devicePixelRatio, count, maxAlpha, partial, bounds: count ? [left, top, right, bottom] : null };
  });
}
const results: Record<string, unknown> = {};
const cross = { cl_crosshairstyle: 4, cl_crosshair_thickness: 2, cl_crosshair_gap: 0, cl_crosshair_length: 8 };
await load({ ...cross, cl_crosshaircolor_a: 128, cl_crosshair_drawoutline: 0 });
results.transparentNoOutline = await pixels();
await load({ ...cross, cl_crosshaircolor_a: 128, cl_crosshair_drawoutline: 1 });
results.transparentOpaqueOutline = await pixels();
await load({ ...cross, cl_crosshaircolor_a: 128, cl_crosshair_drawoutline: 0, cl_crosshair_gap: -4 });
results.transparentNegativeGap = await pixels();
await load({ cl_crosshairstyle: 6, cl_crosshair_thickness: 1, cl_crosshair_drawoutline: 0 });
results.oddDot = await pixels();
await load({ ...cross, cl_crosshair_screen_height: 1080 });
results.reference1080 = await pixels();
await load({ ...cross, cl_crosshair_screen_height: 2160 });
results.reference2160 = await pixels();
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 2, mobile: false });
await page.waitForTimeout(150);
results.staticAfterDprChange = await pixels();
await page.getByRole('button', { name: '2x preview zoom' }).click();
await page.waitForTimeout(80);
results.afterSettingsRedraw = await pixels();
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await load({ cl_crosshairstyle: 7 });
await page.getByLabel('Inspection phase', { exact: true }).fill('1');
await page.waitForTimeout(80);
results.defaultDynamicPeak = await pixels();
await load({ cl_crosshairstyle: 1, cl_crosshair_dynamic_spread_limit: 64, cl_crosshair_drawoutline: 0 });
await page.getByLabel('Inspection phase', { exact: true }).fill('1');
await page.waitForTimeout(80);
results.dynamicCirclePeak = await page.evaluate(() => (window as any).__previewAudit.arcs);
await load({ cl_crosshairstyle: 3, cl_crosshair_drawoutline: 0, cl_crosshair_gap: -10 });
results.circleNegative10 = await pixels();
await load({ cl_crosshairstyle: 3, cl_crosshair_drawoutline: 0, cl_crosshair_gap: 0 });
results.circleGap0 = await pixels();
await load({ cl_crosshairstyle: 4, cl_crosshair_recoil: 0 });
await page.getByRole('button', { name: 'Start Dynamic Preview' }).click();
await page.evaluate(() => { (window as any).__previewAudit.clears = 0; });
await page.waitForTimeout(250);
results.staticStyleAnimatedClears250ms = await page.evaluate(() => (window as any).__previewAudit.clears);
await page.getByLabel('Preview mode', { exact: true }).selectOption('scope');
await page.evaluate(() => { (window as any).__previewAudit.clears = 0; });
await page.waitForTimeout(250);
results.scopeAnimatedClears250ms = await page.evaluate(() => (window as any).__previewAudit.clears);
await load({ cl_ironsight_dot_scale: .1 });
await page.getByLabel('Preview mode', { exact: true }).selectOption('scope');
await page.waitForTimeout(80);
results.scopeScale01Radius = await page.evaluate(() => (window as any).__previewAudit.arcs);
await load({ cl_ironsight_dot_scale: .3 });
await page.getByLabel('Preview mode', { exact: true }).selectOption('scope');
await page.waitForTimeout(80);
results.scopeScale03Radius = await page.evaluate(() => (window as any).__previewAudit.arcs);
await mkdir('docs/evidence/rendering-fixes', { recursive: true });
await writeFile('docs/evidence/rendering-fixes/probes.json', JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
await browser.close();
