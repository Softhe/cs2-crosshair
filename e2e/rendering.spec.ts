import { test, expect } from '@playwright/test';
import { defaults } from '../src/model';
for (const dpr of [1,1.25,1.5,2]) test(`rectangular raster coverage at DPR ${dpr}`,async({browser})=>{
    const context=await browser.newContext({viewport:{width:1001,height:900},deviceScaleFactor:dpr});
    const page=await context.newPage();
    try {
        for (const thickness of [1,2,3]) {
            await load(page,{cl_crosshairstyle:6,cl_crosshair_thickness:thickness,cl_crosshair_drawoutline:0});
            for (const zoom of [1,2,4,8]) {
                await page.getByRole('button',{name:`${zoom}x preview zoom`}).click();
                await expect.poll(async()=>Number(await page.locator('.map-preview canvas').getAttribute('data-scale'))).toBe(zoom);
                const pixels=await stats(page),side=Math.max(1,Math.round(thickness*zoom*dpr));
                expect(pixels.count).toBe(side*side);expect(pixels.max).toBe(255);
            }
        }
    } finally {await context.close();}
});
test('starting motion begins at rest regardless of the document timestamp',async({page})=>{
    await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);(window as any).__time=100000;window.requestAnimationFrame=callback=>raf(()=>callback((window as any).__time));});
    await load(page,{});await page.getByRole('button',{name:'Start Dynamic Preview'}).click();
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    await expect(page.locator('.map-preview canvas')).toHaveAttribute('data-clipped','false');
    await page.evaluate(()=>{(window as any).__time+=550*Math.PI;});
    await expect(page.locator('.map-preview canvas')).toHaveAttribute('data-clipped','true');
    await page.getByRole('button',{name:'Stop Dynamic Preview'}).click();
    await expect(page.locator('.map-preview canvas')).toHaveAttribute('data-clipped','false');
});
test('estimated resolution uses reference height without changing exports',async({page})=>{
    for(const reference of [1080,2160]){
        await load(page,{cl_crosshairstyle:6,cl_crosshair_thickness:3,cl_crosshair_drawoutline:0,cl_crosshair_screen_height:reference});
        const code=await page.getByLabel('Current CS2 share code').inputValue();
        await page.getByLabel('Preview scale',{exact:true}).selectOption('1440');
        await expect.poll(async()=>Number(await page.locator('.map-preview canvas').getAttribute('data-scale'))).toBe(1440/reference);
        expect((await stats(page)).count).toBe(reference===1080?16:4);
        await expect(page.getByLabel('Current CS2 share code')).toHaveValue(code);
        await expect(page.getByText('Estimated target-resolution size; game-pixel calibration is pending.',{exact:true})).toBeVisible();
    }
});
async function load(page: import('@playwright/test').Page, settings: Record<string, number>) {
    await page.goto('/?settings=' + encodeURIComponent(JSON.stringify({ ...defaults, ...settings })));
    await expect(page.locator('.map-preview canvas')).toHaveAttribute('data-scale', /./);
}
async function stats(page: import('@playwright/test').Page) {
    return page.locator('.map-preview canvas').evaluate(element => {
        const c = element as HTMLCanvasElement, data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let count = 0, max = 0;
        const alphas: number[] = [];
        for (let i = 3; i < data.length; i += 4)
            if (data[i]) {
                count++;
                max = Math.max(max, data[i]);
                alphas.push(data[i]);
            }
        return { count, max, alphas, width: c.width, height: c.height, dpr: devicePixelRatio, cssWidth: c.clientWidth };
    });
}
test('opaque one-pixel dots are sharp and overlapping arms retain opacity', async ({ page }) => {
    await load(page, { cl_crosshairstyle: 6, cl_crosshair_thickness: 1, cl_crosshair_drawoutline: 0 });
    expect(await stats(page)).toMatchObject({ count: 1, max: 255 });
    for (const gap of [0, -4]) {
        await load(page, { cl_crosshairstyle: 4, cl_crosshair_thickness: 2, cl_crosshair_length: 8, cl_crosshair_gap: gap, cl_crosshair_drawoutline: 0, cl_crosshaircolor_a: 128 });
        expect((await stats(page)).max).toBe(128);
    }
});
test('opaque outline preserves transparent foreground interiors', async ({ page }) => {
    await load(page, { cl_crosshairstyle: 6, cl_crosshair_thickness: 4, cl_crosshair_drawoutline: 1, cl_crosshaircolor_a: 128 });
    const result = await stats(page);
    expect(result.max).toBe(255);
    expect(result.alphas.filter(a => a === 128)).toHaveLength(16);
});
test('static backing canvas follows DPR without a settings edit', async ({ page, context }) => {
    await load(page, { cl_crosshairstyle: 6 });
    const before = await stats(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 2, mobile: false });
    await expect.poll(async () => { const s = await stats(page); return s.width === Math.round(s.cssWidth * 2) && s.dpr === 2; }).toBe(true);
    expect(before.dpr).toBe(1);
});
test('inspection warns about clipping and fit includes peak geometry', async ({ page }) => {
    await load(page, {});
    await page.getByLabel('Inspection phase', { exact: true }).fill('1');
    await expect(page.locator('.map-preview canvas')).toHaveAttribute('data-clipped', 'true');
    await expect(page.getByText('Crosshair exceeds preview bounds.', { exact: false })).toBeVisible();
    const code = await page.getByLabel('Current CS2 share code').inputValue();
    await page.getByLabel('Fit crosshair in preview').check();
    await expect(page.locator('.map-preview canvas')).toHaveAttribute('data-clipped', 'false');
    await expect(page.getByLabel('Current CS2 share code')).toHaveValue(code);
});
test('static dynamic mode stops drawing and reduced motion supports manual phase', async ({ page }) => {
    await load(page, { cl_crosshairstyle: 4 });
    await page.evaluate(() => { const original = CanvasRenderingContext2D.prototype.clearRect; (window as any).__clears = 0; CanvasRenderingContext2D.prototype.clearRect = function (...args) { if (this.canvas.closest('.map-preview'))
        (window as any).__clears++; return original.apply(this, args); }; });
    await page.getByRole('button', { name: 'Start Dynamic Preview' }).click();
    await page.waitForTimeout(100);
    const count = await page.evaluate(() => (window as any).__clears);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => (window as any).__clears)).toBe(count);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await load(page, {});
    await page.getByRole('button', { name: 'Start Dynamic Preview' }).click();
    await expect(page.locator('.map-preview canvas')).toHaveAttribute('data-clipped', 'false');
    await page.getByLabel('Inspection phase', { exact: true }).fill('1');
    await expect(page.locator('.map-preview canvas')).toHaveAttribute('data-clipped', 'true');
});
test('canvas context failure provides an export-safe fallback', async ({ page }) => {
    await page.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (...args: any[]) { if (args[0] === '2d')
        return null; return (original as any).apply(this, args); } as any; });
    await page.goto('/');
    await expect(page.getByText('Canvas rendering is unavailable. Settings can still be exported.').first()).toBeVisible();
    await expect(page.getByLabel('Current CS2 share code')).toHaveValue(/^CS/);
});
