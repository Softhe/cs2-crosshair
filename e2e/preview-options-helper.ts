import type { Page } from '@playwright/test';
export async function openPreviewOptions(page: Page) {
  const options = page.locator('.preview-options');
  if ((await options.getAttribute('open')) === null) await page.getByLabel('Preview options', {exact:true}).click();
}
/**
 * Renders the preview at a CS2 resolution, one screen pixel per game pixel, by reporting a monitor of
 * that size and turning on Match my in-game size. Call before navigating. The size must be at least
 * the viewport in physical pixels: a monitor is never smaller than the window it shows, so the app
 * would raise its estimate and stretch each game pixel by a fraction.
 */
export async function playAt(page: Page, width: number, height: number) {
  await page.addInitScript(([w, h]) => {
    Object.defineProperty(screen, 'width', { get: () => w! / devicePixelRatio });
    Object.defineProperty(screen, 'height', { get: () => h! / devicePixelRatio });
    localStorage.setItem('delli.v3.game-view', JSON.stringify({ enabled: true, width: w, height: h, stretched: false }));
  }, [width, height]);
}
