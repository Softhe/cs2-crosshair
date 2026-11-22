import {test, expect, type Page} from '@playwright/test';
import {defaults} from '../src/model';
import {encode} from '../src/codec';

const settings = {...defaults, cl_crosshair_gap: -2, cl_crosshair_length: 3};
const code = encode(settings);

test.beforeEach(async ({page}) => {
  await page.route('**/entrance.js*', route => route.fulfill({contentType: 'text/javascript', body: ''}));
  await page.route('**/api/session', route => route.fulfill({json: {user: null, available: false}}));
});

const field = (page: Page) => page.getByLabel('Crosshair code or config', {exact: true});
const paste = (page: Page, text: string) => field(page).evaluate((element, text) => {
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/plain', text);
  element.dispatchEvent(new ClipboardEvent('paste', {bubbles: true, cancelable: true, clipboardData}));
}, text);
const value = (page: Page, name: string) => page.getByRole('spinbutton', {name, exact: true});

test('a code wrapped in quotes and chat text imports', async ({page}) => {
  await page.goto('/');
  await paste(page, `my crosshair: "${code}".`);
  await expect(field(page)).toHaveAttribute('data-current-code', code);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('crosshairs kept in aliases are offered as choices under the box', async ({page}) => {
  await page.goto('/');
  await paste(page, 'alias a "cl_crosshair_gap 1; cl_crosshair_length 2"\nalias b "cl_crosshair_gap -3; cl_crosshair_length 9"');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('aliases a, b');
  // Nothing from an alias body was applied on its own.
  await expect(value(page, 'Gap')).toHaveValue(String(defaults.cl_crosshair_gap));
  await expect(value(page, 'Length')).toHaveValue(String(defaults.cl_crosshair_length));
  const box = (await field(page).boundingBox())!, error = (await alert.boundingBox())!;
  expect(error.y - (box.y + box.height)).toBeLessThan(40);
  await page.getByRole('button', {name: /^Load b/}).click();
  await expect(value(page, 'Gap')).toHaveValue('-3');
  await expect(value(page, 'Length')).toHaveValue('9');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('from alias b');
});

test('a config with pre-update names imports its current settings and lists the old ones', async ({page}) => {
  await page.goto('/');
  await paste(page, 'cl_crosshaircolor 1\ncl_crosshair_length 2\ncl_crosshair_gap -2');
  await expect(value(page, 'Length')).toHaveValue('2');
  await expect(value(page, 'Gap')).toHaveValue('-2');
  await expect(page.locator('.toast')).toContainText('Ignored hidden old values the current game no longer uses: cl_crosshaircolor');
});

test('an error names the format and stays next to the box with the options open', async ({page}) => {
  await page.goto('/');
  await page.evaluate(() => document.querySelectorAll('.transfer-panel details').forEach(d => (d as HTMLDetailsElement).open = true));
  await field(page).fill('CSabc');
  await expect(page.getByTestId('detected-format')).toHaveText('CS2 share code');
  await page.getByRole('button', {name: 'Import crosshair', exact: true}).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('5 characters instead of 46');
  const box = (await field(page).boundingBox())!, error = (await alert.boundingBox())!;
  expect(error.y - (box.y + box.height)).toBeLessThan(40);
});

test('a typed draft shows the detected format before it is imported', async ({page}) => {
  await page.goto('/');
  await field(page).fill('cl_crosshair_gap -2; cl_crosshair_length 3');
  await expect(page.getByTestId('detected-format')).toHaveText('CS2 config · 2 settings');
  await field(page).fill(`delli.cc/?code=${code}`);
  await expect(page.getByTestId('detected-format')).toHaveText('Crosshair link');
  await page.getByRole('button', {name: 'Import crosshair', exact: true}).click();
  await expect(field(page)).toHaveAttribute('data-current-code', code);
});

test('settings JSON pasted into the box imports', async ({page}) => {
  await page.goto('/');
  await paste(page, JSON.stringify({cl_crosshair_length: 6}));
  await expect(value(page, 'Length')).toHaveValue('6');
  await expect(page.locator('.toast')).toContainText('Settings JSON imported');
});

test('a file dropped on the import panel imports', async ({page}) => {
  await page.goto('/');
  const panel = page.getByRole('region', {name: 'Import, share and export', exact: true});
  const data = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['"config"\n{\n\t"cl_crosshair_gap"\t"-4.000000"\n}'], 'cs2_user_convars_0_slot0.vcfg', {type: 'text/plain'}));
    return transfer;
  });
  await panel.dispatchEvent('dragover', {dataTransfer: data});
  await expect(panel.locator('.drop-hint')).toBeVisible();
  await panel.dispatchEvent('drop', {dataTransfer: data});
  await expect(value(page, 'Gap')).toHaveValue('-4');
  await expect(panel.locator('.drop-hint')).toHaveCount(0);
});

test('an oversized file reports its size and the limit', async ({page}) => {
  await page.goto('/');
  await page.getByLabel('Crosshair config file', {exact: true}).setInputFiles({name: 'huge.cfg', mimeType: 'text/plain', buffer: Buffer.alloc(210000, 'a')});
  await expect(page.getByRole('alert')).toContainText('huge.cfg is too large (210 KB). Crosshair configs can be up to 200 KB.');
});

test('a saved crosshair can be downloaded and shared from the library', async ({page}) => {
  await page.addInitScript(entry => localStorage.setItem('delli.v3.library', JSON.stringify([entry])),
    {id: 'one', name: 'Team green', alias: '', settings, favorite: true, date: '2026-10-16T00:00:00.000Z'});
  await page.goto('/');
  await page.getByRole('button', {name: 'Library', exact: true}).click();
  const selected = page.getByRole('region', {name: 'Selected crosshair'});
  const download = page.waitForEvent('download');
  await selected.getByRole('button', {name: 'Download .cfg', exact: true}).click();
  expect((await download).suggestedFilename()).toBe('crosshair_Team_green.cfg');
});
