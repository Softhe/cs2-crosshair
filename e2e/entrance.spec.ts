import { test, expect } from '@playwright/test';

test('page sections keep their layout when the intro restores scrolling', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('.header').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const measure = () => page.locator('.header,.menu-nav,.page-heading,.workspace,.preview-section,.sidebar').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { element: element.className, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }));
  await expect(page.locator('#entrance')).toBeVisible();
  const during = await measure();
  await expect(page.locator('#entrance')).toBeHidden();
  expect(await measure()).toEqual(during);
});

test('intro crossfades into the editor before playback ends', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const entrance = document.querySelector('#entrance') as HTMLElement;
    const root = document.querySelector('#root') as HTMLElement;
    const opacity = Number(getComputedStyle(root).opacity);
    return entrance.classList.contains('entrance-leaving') && opacity > 0 && opacity < 1;
  });
  await expect(page.locator('#entrance')).toBeHidden();
  await expect(page.locator('#root')).toHaveCSS('opacity', '1');
  await expect(page.locator('#root')).not.toHaveAttribute('inert');
});

for (const path of ['/', '/?intro=preview']) test(`two-second intro plays on every refresh at original speed: ${path}`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => sessionStorage.setItem('delli-entrance-seen', '1'));
  for (let visit = 0; visit < 2; visit++) {
    if (visit) await page.reload({ waitUntil: 'domcontentloaded' });
    else await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#entrance')).toBeVisible();
    await expect(page.locator('#entrance button')).toHaveCount(0);
    await expect.poll(() => page.locator('#entrance video').evaluate(element => {
      const video = element as HTMLVideoElement;
      return video.videoWidth === 1920 && !video.paused && video.currentTime > 0;
    })).toBe(true);
    const playback = await page.locator('#entrance video').evaluate(element => {
      const video = element as HTMLVideoElement;
      return { rate: video.playbackRate, loop: video.loop, duration: video.duration };
    });
    expect(playback.rate).toBe(1);
    expect(playback.loop).toBe(false);
    expect(playback.duration).toBeCloseTo(2, 1);
    await expect(page.locator('#entrance')).toBeHidden({ timeout: 3500 });
    await expect(page.locator('#root')).not.toHaveAttribute('inert');
  }
});

test('stalled video cannot block the editor', async ({ page }) => {
  await page.route('**/operation_loading.webm', async route => {
    await new Promise(resolve => setTimeout(resolve, 4000));
    await route.abort();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#entrance')).toBeHidden({ timeout: 3500 });
  await expect(page.locator('#root')).not.toHaveAttribute('inert');
});

test('failed video releases the editor', async ({ page }) => {
  await page.route('**/operation_loading.webm', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#entrance')).toBeHidden();
  await expect(page.locator('#root')).not.toHaveAttribute('inert');
});
