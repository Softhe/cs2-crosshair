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

test('a config with values a share code cannot carry is fitted and the changes are listed', async ({page}) => {
  await page.goto('/');
  await page.getByLabel('Crosshair config file', {exact:true}).setInputFiles({name:'game.cfg', mimeType:'text/plain',
    buffer:Buffer.from('cl_crosshairstyle "4"\ncl_crosshair_gap "-15"\ncl_crosshair_thickness "1.5"\ncl_crosshair_length "3"')});
  await expect(page.getByRole('spinbutton', {name:'Gap', exact:true})).toHaveValue('-10');
  await expect(page.getByRole('spinbutton', {name:'Thickness', exact:true})).toHaveValue('2');
  await expect(page.getByRole('spinbutton', {name:'Length', exact:true})).toHaveValue('3');
  await expect(page.getByText(/Adjusted to supported values: cl_crosshair_gap -15 → -10; cl_crosshair_thickness 1.5 → 2\./)).toBeVisible();
  await expect(page.getByText('Applied crosshair', {exact:true})).toBeVisible();
});

test('thickness 0 explains why the preview is empty', async ({page}) => {
  await page.goto('/');
  const thickness = page.getByRole('spinbutton', {name:'Thickness', exact:true});
  await expect(page.locator('#cl_crosshair_thickness-hint')).toHaveCount(0);
  await thickness.fill('0');
  await thickness.blur();
  await expect(thickness).toHaveAttribute('aria-describedby', 'cl_crosshair_thickness-hint');
  await expect(page.locator('#cl_crosshair_thickness-hint')).toHaveText(/draws nothing/);
  await thickness.fill('1');
  await thickness.blur();
  await expect(page.locator('#cl_crosshair_thickness-hint')).toHaveCount(0);
});

test('invalid uploads preserve the applied crosshair and show an error', async ({page}) => {
  await page.goto('/');
  const field = page.getByLabel('Crosshair code or config', {exact:true});
  const previous = await field.getAttribute('data-current-code');
  await page.getByLabel('Crosshair config file', {exact:true}).setInputFiles({name:'invalid.cfg', mimeType:'text/plain', buffer:Buffer.from('not a crosshair')});
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(field).toHaveAttribute('data-current-code', previous!);
});



test('a current CS2 .vcfg with hidden old values imports as current settings', async ({page}) => {
  await page.goto('/');
  const vcfg = '"config"\n{\n\t"convars"\n\t{\n\t\t"cl_crosshairstyle"\t\t"4"\n\t\t"cl_crosshair_gap"\t\t"-2"\n\t\t"cl_crosshair_length"\t\t"5"\n\t\t"cl_crosshairsize"\t\t"3.9"\n\t\t"bind_f1"\t\t"1"\n\t}\n}';
  await page.getByLabel('Crosshair config file', {exact:true}).setInputFiles({name:'cs2_user_convars_0_slot0.vcfg', mimeType:'text/plain', buffer:Buffer.from(vcfg)});
  await expect(page.getByRole('spinbutton', {name:'Gap', exact:true})).toHaveValue('-2');
  await expect(page.getByRole('spinbutton', {name:'Length', exact:true})).toHaveValue('5');
  await expect(page.getByText(/Imported 3 crosshair settings from the config\..*Ignored hidden old values .*cl_crosshairsize/)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a library backup chosen as a config is merged into the library', async ({page}) => {
  await page.goto('/');
  const entry = {id:'backup-1', name:'From backup', favorite:true, settings:{cl_crosshairstyle:4}, updatedAt:1};
  await page.getByLabel('Crosshair config file', {exact:true}).setInputFiles({name:'delli-crosshair-library.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify({version:1, entries:[entry]}))});
  await expect(page.getByText(/Backup merged/)).toBeVisible();
  await page.getByRole('button', {name:'Library', exact:true}).click();
  await expect(page.getByRole('button', {name:'Preview From backup', exact:true})).toBeVisible();
});

test('a backup that cannot be restored keeps the pasted text and explains why', async ({page}) => {
  await page.goto('/');
  const field = page.getByLabel('Crosshair code or config', {exact:true});
  const text = JSON.stringify({version:2, entries:[]});
  await field.evaluate((element, text) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', text);
    element.dispatchEvent(new ClipboardEvent('paste', {bubbles:true, cancelable:true, clipboardData}));
  }, text);
  await expect(page.getByRole('alert')).toContainText('Unsupported backup version');
  await expect(field).toHaveValue(text);
});

test('dropping a config file on the panel imports it', async ({page}) => {
  await page.goto('/');
  const panel = page.getByRole('region', {name:'Import, share and export', exact:true});
  const data = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['cl_crosshairstyle 4\ncl_crosshair_gap "-3"\ncl_crosshair_length "7"'], 'drop.cfg', {type:'text/plain'}));
    return transfer;
  });
  await panel.dispatchEvent('dragover', {dataTransfer:data});
  await expect(panel.locator('.drop-hint')).toBeVisible();
  await panel.dispatchEvent('drop', {dataTransfer:data});
  await expect(panel.locator('.drop-hint')).toHaveCount(0);
  await expect(page.getByRole('spinbutton', {name:'Gap', exact:true})).toHaveValue('-3');
  await expect(page.getByRole('spinbutton', {name:'Length', exact:true})).toHaveValue('7');
});

test('dropping link text on the panel imports the crosshair', async ({page}) => {
  await page.goto('/');
  const panel = page.getByRole('region', {name:'Import, share and export', exact:true});
  const field = page.getByLabel('Crosshair code or config', {exact:true});
  const data = await page.evaluateHandle((text) => {
    const transfer = new DataTransfer();
    transfer.setData('text/plain', text);
    return transfer;
  }, `delli.cc/?code=${current}`);
  await panel.dispatchEvent('drop', {dataTransfer:data});
  await expect(field).toHaveAttribute('data-current-code', current);
});

test('an old config shows its conversion notes under the import box', async ({page}) => {
  await page.goto('/');
  const field = page.getByLabel('Crosshair code or config', {exact:true});
  await field.evaluate((element, text) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', text);
    element.dispatchEvent(new ClipboardEvent('paste', {bubbles:true, cancelable:true, clipboardData}));
  }, config);
  const notes = page.locator('.conversion-notes');
  await expect(notes).toHaveAttribute('open', '');
  await expect(notes.locator('li').first()).toBeVisible();
  await notes.getByRole('button', {name:'Dismiss notes', exact:true}).click();
  await expect(notes).toHaveCount(0);
});

test('a multi-line config draft gets a taller box', async ({page}) => {
  await page.goto('/');
  const field = page.getByLabel('Crosshair code or config', {exact:true});
  const before = (await field.boundingBox())!.height;
  await field.fill('cl_crosshair_gap 2\ncl_crosshair_length 4\ncl_crosshairdot 1');
  await expect(field).toHaveClass(/is-multiline/);
  expect((await field.boundingBox())!.height).toBeGreaterThan(before * 2);
  await page.getByRole('button', {name:'Import crosshair', exact:true}).click();
  await expect(field).not.toHaveClass(/is-multiline/);
});
