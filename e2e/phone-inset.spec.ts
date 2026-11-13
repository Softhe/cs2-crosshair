import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/entrance.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.route('**/api/session', route => route.fulfill({ json: { user: null, available: false } }));
});

test('the 4x inset sits under the map on phones and over it on wider screens', async ({ page }, info) => {
  await page.goto('/');
  const expand = page.getByRole('button', { name: 'Expand preview' });
  if (await expand.isVisible()) await expand.click();
  const map = (await page.locator('.map-preview').boundingBox())!;
  const inset = (await page.locator('.map-preview > .detail-preview').boundingBox())!;
  const arrow = (await page.getByRole('button', { name: 'Previous map' }).boundingBox())!;
  const below = inset.y >= map.y + map.height - 1;
  if (info.project.name === 'mobile') {
    expect(below).toBe(true);
    expect(inset.width).toBeGreaterThan(map.width - 4);
    await expect(page.locator('.detail-explainer')).toBeVisible();
    // Nothing that follows the preview may be covered by the row.
    const next = (await page.locator('.preview-section').boundingBox())!;
    expect(next.y + next.height).toBeGreaterThanOrEqual(inset.y + inset.height - 1);
    expect((await page.locator('.preview-options > summary').innerText()).trim()).toBe('Options');
  } else {
    expect(below).toBe(false);
    await expect(page.locator('.detail-explainer')).toBeHidden();
  }
  expect(inset.y >= arrow.y + arrow.height || inset.x >= arrow.x + arrow.width).toBe(true);
});
