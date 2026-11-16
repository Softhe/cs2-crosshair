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
  await expect(page.locator('#entrance')).toBeHidden({ timeout: 10000 });
  expect(await measure()).toEqual(during);
});

test('reduced motion skips the intro on a first visit', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('.header').waitFor();
  await expect(page.locator('#entrance')).toBeHidden();
  await expect(page.locator('#root')).not.toHaveAttribute('inert');
  expect(await page.locator('#entrance video').evaluate(element => (element as HTMLVideoElement).currentSrc)).toBe('');
});

test('intro crossfades into the editor before playback ends, even when replayed under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?intro=preview', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const entrance = document.querySelector('#entrance') as HTMLElement;
    const root = document.querySelector('#root') as HTMLElement;
    const opacity = Number(getComputedStyle(root).opacity);
    return entrance.classList.contains('entrance-leaving') && opacity > 0 && opacity < 1;
  });
  await expect(page.locator('#entrance')).toBeHidden({ timeout: 10000 });
  await expect(page.locator('#root')).toHaveCSS('opacity', '1');
  await expect(page.locator('#root')).not.toHaveAttribute('inert');
});

async function expectIntro(page: import('@playwright/test').Page) {
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
  expect(playback.rate).toBe(1.25);
  expect(playback.loop).toBe(false);
  expect(playback.duration).toBeCloseTo(2, 1);
  await expect(page.locator('#entrance')).toBeHidden({ timeout: 10000 });
  await expect(page.locator('#root')).not.toHaveAttribute('inert');
}

test('shortened intro plays on the first visit only, not on refresh or return', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expectIntro(page);
  for (const revisit of ['reload', 'navigate']) {
    if (revisit === 'reload') await page.reload({ waitUntil: 'domcontentloaded' });
    else await page.goto('/?view=library', { waitUntil: 'domcontentloaded' });
    await page.locator('.header').waitFor();
    await expect(page.locator('#entrance')).toBeHidden();
    await expect(page.locator('#root')).not.toHaveAttribute('inert');
    expect(await page.locator('#entrance video').evaluate(element => (element as HTMLVideoElement).currentSrc)).toBe('');
  }
});

test('intro can be replayed on demand with ?intro=preview', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('delli.v3.intro-seen', '1'));
  for (let visit = 0; visit < 2; visit++) {
    if (visit) await page.reload({ waitUntil: 'domcontentloaded' });
    else await page.goto('/?intro=preview', { waitUntil: 'domcontentloaded' });
    await expectIntro(page);
  }
});

test('stalled video cannot block the editor', async ({ page }) => {
  await page.route('**/operation_loading.webm', async route => {
    await new Promise(resolve => setTimeout(resolve, 4000));
    await route.abort();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#entrance')).toBeHidden({ timeout: 10000 });
  await expect(page.locator('#root')).not.toHaveAttribute('inert');
});

test('failed video releases the editor', async ({ page }) => {
  await page.route('**/operation_loading.webm', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#entrance')).toBeHidden({ timeout: 10000 });
  await expect(page.locator('#root')).not.toHaveAttribute('inert');
});
