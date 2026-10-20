import type { Page } from '@playwright/test';
export async function openPreviewOptions(page: Page) {
  const options = page.locator('.preview-options');
  if ((await options.getAttribute('open')) === null) await page.getByLabel('Preview options', {exact:true}).click();
}
