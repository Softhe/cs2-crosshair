import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const output = 'docs/evidence/rendering-fixes';
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
const results = await page.evaluate(async () => {
    const geometryModule = await import('/src/preview-geometry.ts' as string);
    const rendererModule = await import('/src/preview-renderer.ts' as string);
    const model = await import('/src/model.ts' as string);
    const canvas = document.querySelector('.map-preview canvas') as HTMLCanvasElement;
    const renderer = rendererModule.createPreviewRenderer(canvas, canvas.getContext('2d')!);
    const timings: Record<string, unknown> = {};
    for (const fit of [false, true]) {
        const samples: number[] = [];
        for (let i = 0; i < 40; i++) {
            const g = geometryModule.previewGeometry(model.defaults, 'crosshair', i / 39);
            const scale = fit ? rendererModule.fitScale(geometryModule.previewGeometry(model.defaults, 'crosshair', 1).bounds, canvas.clientWidth, canvas.clientHeight, 1) : 1;
            const start = performance.now();
            renderer(g, model.defaults, 'crosshair', scale);
            samples.push(performance.now() - start);
        }
        samples.sort((a, b) => a - b);
        timings[fit ? 'fit' : 'native'] = { medianMs: samples[20], p95Ms: samples[38], maxMs: samples[39], samples: 40 };
    }
    return { browser: navigator.userAgent, dpr: devicePixelRatio, canvas: [canvas.width, canvas.height], timings };
});
await page.getByLabel('Inspection phase', { exact: true }).fill('0.99');
await page.getByLabel('Preview mode', { exact: true }).selectOption('scope');
await page.screenshot({ path: output + '/desktop-scope.png', fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.getByLabel('Preview mode', { exact: true }).selectOption('crosshair');
await page.screenshot({ path: output + '/mobile-fit.png', fullPage: true });
await writeFile(output + '/verification.json', JSON.stringify({...results,errors}, null, 2) + '\n');
console.log(JSON.stringify({...results,errors}, null, 2));
await browser.close();
