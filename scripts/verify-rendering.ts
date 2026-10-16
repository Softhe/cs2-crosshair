import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
import { defaults, type Settings } from '../src/model.ts';
import { previewGeometry, renderingSettings, type Geometry } from '../src/preview-geometry.ts';
import { fitScale } from '../src/preview-renderer.ts';
import type * as RendererModule from '../src/preview-renderer.ts';

const output = 'docs/evidence/rendering-fixes';
// Perf gate: preview renders must stay within one frame budget. Verification fails
// when p95 render time exceeds this threshold.
const p95BudgetMs = 16;
type TimingSummary = { medianMs: number; p95Ms: number; maxMs: number; samples: number };
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors:string[]=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
await page.goto('http://127.0.0.1:4180/');
await page.getByLabel('Inspection phase', { exact: true }).fill('1');
await page.getByLabel('Fit crosshair in preview').check();
await page.locator('.preview-section').screenshot({path:output+'/preview-controls.png'});
await page.screenshot({ path: output + '/desktop-fit.png', fullPage: true });
// Geometry is pure data: compute it statically in Node so the browser only times rendering.
const visual = renderingSettings(defaults);
const nativeGeometries: Geometry[] = Array.from({ length: 40 }, (_, i) => previewGeometry(visual, 'crosshair', i / 39));
const peakBounds = previewGeometry(visual, 'crosshair', 1).bounds;
const cssSize = await page.locator('.map-preview > canvas').evaluate(element => {
    const canvas = element as HTMLCanvasElement;
    return { width: canvas.clientWidth, height: canvas.clientHeight };
});
const fit = fitScale(peakBounds, cssSize.width, cssSize.height, 1);
const results = await page.evaluate(async (input: { native: Geometry[]; scale: number; settings: Settings }) => {
    const rendererModule = (await import('/src/preview-renderer.ts' as string)) as unknown as typeof RendererModule;
    const canvas = document.querySelector('.map-preview canvas') as HTMLCanvasElement;
    const renderer = rendererModule.createPreviewRenderer(canvas, canvas.getContext('2d')!);
    const timings: Record<string, TimingSummary> = {};
    for (const mode of [{ name: 'native', scale: 1 }, { name: 'fit', scale: input.scale }]) {
        const samples: number[] = [];
        for (const g of input.native) {
            const start = performance.now();
            renderer(g, input.settings, 'crosshair', mode.scale);
            samples.push(performance.now() - start);
        }
        samples.sort((a, b) => a - b);
        timings[mode.name] = { medianMs: samples[20]!, p95Ms: samples[38]!, maxMs: samples[39]!, samples: samples.length };
    }
    return { browser: navigator.userAgent, dpr: devicePixelRatio, canvas: [canvas.width, canvas.height], timings };
}, { native: nativeGeometries, scale: fit, settings: defaults });
for (const [mode, summary] of Object.entries(results.timings)) {
    console.log(`${mode}: median ${summary.medianMs.toFixed(3)}ms p95 ${summary.p95Ms.toFixed(3)}ms max ${summary.maxMs.toFixed(3)}ms`);
    assert(summary.p95Ms <= p95BudgetMs, `Preview p95 render budget exceeded in ${mode} mode: ${summary.p95Ms}ms > ${p95BudgetMs}ms`);
}
await page.getByLabel('Inspection phase', { exact: true }).fill('0.99');
await page.getByLabel('Preview mode', { exact: true }).selectOption('scope');
await page.screenshot({ path: output + '/desktop-scope.png', fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.getByLabel('Preview mode', { exact: true }).selectOption('crosshair');
await page.screenshot({ path: output + '/mobile-fit.png', fullPage: true });
await writeFile(output + '/verification.json', JSON.stringify({...results,errors}, null, 2) + '\n');
console.log(JSON.stringify({...results,errors}, null, 2));
await browser.close();
