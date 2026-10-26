import {test, expect} from '@playwright/test';

const legacy = 'CSGO-xrtNo-O5jwh-YRB3C-upokE-j698F';
const current = 'CSxkMfFVRUG6fRehdb2CvLNuajHopsuAQ5O38aVLPTTPHj';
const config = 'cl_crosshairstyle 4; cl_crosshairsize 2; cl_crosshairthickness 0.5; cl_crosshairgap -2';

test.beforeEach(async ({page}) => {
  await page.route('**/entrance.js*', route => route.fulfill({contentType:'text/javascript', body:''}));
  await page.route('**/api/session', route => route.fulfill({json:{user:null, available:false}}));
});

for (const [name, text] of [['current code', current], ['legacy code', legacy], ['share link', `https://delli.cc/?code=${current}`], ['legacy config', config]] as const) {
  test(`pasting ${name} applies it immediately`, async ({page}) => {
    await page.goto('/');
    const field = page.getByLabel('Crosshair code or config', {exact:true});
    const previous = await field.getAttribute('data-current-code');
    await field.evaluate((element, text) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', text);
      element.dispatchEvent(new ClipboardEvent('paste', {bubbles:true, cancelable:true, clipboardData}));
    }, text);
    await expect(field).not.toHaveAttribute('data-current-code', previous!);
    await expect(page.getByText('Applied crosshair', {exact:true})).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

test('choosing a legacy config imports immediately and allows choosing the same file again', async ({page}) => {
  await page.goto('/');
  const input = page.getByLabel('Crosshair config file', {exact:true});
  for (let attempt = 0; attempt < 2; attempt++) {
    await input.setInputFiles({name:'old-crosshair.cfg', mimeType:'text/plain', buffer:Buffer.from(config)});
    await expect(page.getByRole('spinbutton', {name:'Length', exact:true})).toHaveValue('4');
    await expect(page.getByRole('spinbutton', {name:'Thickness', exact:true})).toHaveValue('1');
    await expect(page.getByRole('spinbutton', {name:'Gap', exact:true})).toHaveValue('3');
    await expect(page.getByText('Applied crosshair', {exact:true})).toBeVisible();
    if (attempt === 0) {
      await page.getByRole('spinbutton', {name:'Length', exact:true}).fill('8');
      await page.getByRole('spinbutton', {name:'Length', exact:true}).blur();
    }
  }
});

test('invalid uploads preserve the applied crosshair and show an error', async ({page}) => {
  await page.goto('/');
  const field = page.getByLabel('Crosshair code or config', {exact:true});
  const previous = await field.getAttribute('data-current-code');
  await page.getByLabel('Crosshair config file', {exact:true}).setInputFiles({name:'invalid.cfg', mimeType:'text/plain', buffer:Buffer.from('not a crosshair')});
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(field).toHaveAttribute('data-current-code', previous!);
});


