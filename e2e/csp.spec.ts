import { test, expect, type Page } from '@playwright/test';
import { openPreviewOptions } from './preview-options-helper';

// vite preview enforces the policy production sends in report-only mode (see vite.config.ts).
// Any violation here would be a report in production and a breakage once the policy is enforced.
async function watchViolations(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = ((window as unknown as { __csp: string[] }).__csp = []);
    document.addEventListener('securitypolicyviolation', event =>
      seen.push(`${event.effectiveDirective} blocked ${event.blockedURI || 'inline'} (${event.sourceFile}:${event.lineNumber})`));
  });
  const console: string[] = [];
  page.on('console', message => { if (/Content Security Policy/i.test(message.text())) console.push(message.text()); });
  return async () => [...await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp), ...console];
}

test('the main screens run under the content security policy without violations', async ({ page }) => {
  await page.route('**/api/session', route => route.fulfill({ json: { user: null, available: true } }));
  const violations = await watchViolations(page);
  const response = await page.goto('/?intro=preview', { waitUntil: 'domcontentloaded' });
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");

  // Intro video, fonts, map backgrounds, the noise texture and the preview canvas.
  await expect(page.locator('#entrance')).toBeHidden({ timeout: 10000 });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('link', { name: 'Sign in with Steam' }).first()).toBeVisible();

  await page.getByRole('combobox', { name: 'Style', exact: true }).selectOption({ label: 'Dynamic Cross' });
  await openPreviewOptions(page);
  await page.getByRole('button', { name: 'Start Dynamic Preview' }).click();
  await page.getByRole('button', { name: 'Stop Dynamic Preview' }).click();
  await page.getByRole('button', { name: 'Inspect preview' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .cfg' }).click();
  await download;

  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.goto('/?view=library', { waitUntil: 'domcontentloaded' });
  await page.locator('.header').waitFor();

  expect(await violations()).toEqual([]);
});
