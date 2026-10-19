import {test,expect} from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.route('**/entrance.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' })); });
const original='CSxkMfFVRUG6fRehdb2CvLNuajHopsuAQ5O38aVLPTTPHj';
test('renders all menu sections, changes style, edits and restores draft',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');if(await page.getByRole('button',{name:'Expand preview',exact:true}).isVisible())await page.getByRole('button',{name:'Expand preview',exact:true}).click();
  await expect(page.getByRole('main',{name:'Crosshair editor',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Grenade Line-up'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Sniper Sights'})).toHaveCount(0);
  await expect(page.getByLabel('Preview mode').locator('option[value=sniper]')).toHaveCount(0);
  await expect(page.locator('.export-advanced')).not.toHaveAttribute('open');await page.locator('.export-advanced > summary').click();await expect(page.getByRole('textbox',{name:'Alias name'})).toBeVisible();
  await page.getByLabel('Style',{exact:true}).selectOption('2');
  await page.getByRole('spinbutton',{name:'Gap',exact:true}).fill('-4');await page.getByRole('spinbutton',{name:'Gap',exact:true}).blur();
  await expect(page.getByRole('spinbutton',{name:'Gap',exact:true})).toHaveValue('-4');
  await page.reload();await expect(page.getByRole('spinbutton',{name:'Gap',exact:true})).toHaveValue('-4');
  await page.getByLabel('Style',{exact:true}).selectOption('6');await expect(page.getByRole('spinbutton',{name:'Length',exact:true})).toHaveCount(0);
  await expect(page.getByLabel('Center Dot',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Scope dot scale',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
test('clipboard exports code, full links and autoexec shortcuts correctly',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);await page.goto('/');if(await page.getByRole('button',{name:'Expand preview',exact:true}).isVisible())await page.getByRole('button',{name:'Expand preview',exact:true}).click();
  await page.locator('.export-advanced > summary').click();await page.getByRole('textbox',{name:'Alias name'}).fill('team_green');
  await page.getByRole('button',{name:'Copy autoexec shortcut',exact:true}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('alias team_green "exec crosshair_team_green.cfg"');
  await page.getByRole('button',{name:'Copy link',exact:true}).click();const link=await page.evaluate(()=>navigator.clipboard.readText());
  await page.goto(link);expect(JSON.parse(new URL(link).searchParams.get('settings')!).cl_crosshair_friendly_warning).toBe(0);
  await page.getByRole('button',{name:'Copy crosshair code',exact:true}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(await page.getByLabel('Crosshair code or config').getAttribute('data-current-code').then(value=>value!));
  await page.keyboard.press('Control+Enter');expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('cl_crosshairstyle');
});
test('restores a backup and rejects invalid settings',async({page})=>{
  await page.goto('/');if(await page.getByRole('button',{name:'Expand preview',exact:true}).isVisible())await page.getByRole('button',{name:'Expand preview',exact:true}).click();if(await page.locator('.save-disclosure').getAttribute('open')===null)await page.locator('.save-disclosure > summary').click();await page.getByLabel('Crosshair name',{exact:true}).fill('Backup green');await page.getByRole('button',{name:'Save to favorites',exact:true}).click();await page.getByRole('button',{name:'Library',exact:true}).click();
  const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Export library'}).click();const download=await promise;
  const path=(await download.path())!;await page.getByRole('button',{name:'Remove Backup green'}).click();
  await page.getByLabel('Library backup file').setInputFiles(path);await expect(page.getByRole('button',{name:'Preview Backup green',exact:true})).toBeVisible();
  await page.getByLabel('Library backup file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,entries:[{name:'Bad',favorite:true,settings:{quit:1}}]}))});
  await expect(page.locator('.toast')).toContainText('Unknown setting');await expect(page.getByRole('button',{name:'Preview Backup green',exact:true})).toBeVisible();
});
test('imports actual game code and rejects a corrupted code without changing state',async({page})=>{
  await page.goto('/');if(await page.getByRole('button',{name:'Expand preview',exact:true}).isVisible())await page.getByRole('button',{name:'Expand preview',exact:true}).click();await page.getByLabel('Crosshair code or config').focus();await page.getByLabel('Crosshair code or config').fill(original);
  await page.getByRole('button',{name:'Import crosshair',exact:true}).click();await expect(page.getByLabel('Crosshair code or config')).toHaveAttribute('data-current-code',original);
  await page.getByLabel('Crosshair code or config').focus();await page.getByLabel('Crosshair code or config').fill(original.slice(0,-1)+'A');await page.getByRole('button',{name:'Import crosshair',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('checksum');await expect(page.getByLabel('Crosshair code or config')).toHaveAttribute('data-current-code',original);await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('downloads a named config and validates alias injection',async({page})=>{
  await page.goto('/');if(await page.getByRole('button',{name:'Expand preview',exact:true}).isVisible())await page.getByRole('button',{name:'Expand preview',exact:true}).click();await page.locator('.export-advanced > summary').click();await page.getByRole('textbox',{name:'Alias name'}).fill('team_green');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download .cfg',exact:true}).click();const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('crosshair_team_green.cfg');const stream=await download.createReadStream();let content='';for await(const chunk of stream!)content+=chunk;
  expect(content).toContain('cl_crosshair_length "8"');expect(content).toContain('cl_ironsight_dot_scale "1"');expect(content).toContain('cl_grenadecrosshair_smoke "1"');
  expect(content).toContain(`// Crosshair code: ${await page.getByLabel('Crosshair code or config').getAttribute('data-current-code').then(value=>value!)}`);
  expect(content).toContain('// alias team_green "exec crosshair_team_green.cfg"');
  expect(content).toContain('// Add the alias line to autoexec.cfg without //');
  await page.getByRole('textbox',{name:'Alias name'}).fill('bad;quit');await expect(page.getByRole('button',{name:'Copy autoexec shortcut',exact:true})).toBeDisabled();
});
test('library favorite, rename, search, load, remove and backup',async({page})=>{
  await page.goto('/');if(await page.getByRole('button',{name:'Expand preview',exact:true}).isVisible())await page.getByRole('button',{name:'Expand preview',exact:true}).click();if(await page.locator('.save-disclosure').getAttribute('open')===null)await page.locator('.save-disclosure > summary').click();await page.getByLabel('Crosshair name',{exact:true}).fill('Test green');await page.getByRole('button',{name:'Save to favorites',exact:true}).click();await page.getByRole('button',{name:'Library',exact:true}).click();
  await expect(page.getByRole('button',{name:'Preview Test green',exact:true})).toBeVisible();await page.getByRole('button',{name:'Rename Test green'}).click();await page.getByLabel('Rename crosshair').fill('Team reticle');await page.getByLabel('Rename crosshair').press('Enter');
  await page.getByLabel('Search crosshairs').fill('Team');await expect(page.getByRole('button',{name:'Preview Team reticle',exact:true})).toBeVisible();
  const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Export library'}).click();const download=await promise;expect(download.suggestedFilename()).toBe('delli-crosshair-library.json');
  await page.getByRole('button',{name:'Load',exact:true}).click();await expect(page.getByRole('main',{name:'Crosshair library',exact:true})).not.toBeVisible();await expect(page.getByLabel('Crosshair name',{exact:true})).toHaveValue('Team reticle');
  await page.getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('button',{name:'Remove Team reticle'}).click();await expect(page.getByText('Your collection starts here.')).toBeVisible();
});
test('full links preserve extra settings, compatibility routes and missing routes',async({page})=>{
  await page.goto('/?code='+original);await expect(page.getByLabel('Crosshair code or config')).toHaveAttribute('data-current-code',original);
  await page.goto('/?crosshair='+original);await expect(page.getByLabel('Crosshair code or config')).toHaveAttribute('data-current-code',original);
  await page.goto('/'+original);await expect(page.getByLabel('Crosshair code or config')).toHaveAttribute('data-current-code',original);
  await page.goto('/custom?code='+original+'#keep');await expect(page).toHaveURL('/?code='+original+'#keep');
  await page.goto('/missing');await expect(page.getByRole('heading',{name:'Crosshair not found'})).toBeVisible();
});
test('maps, zoom and accessible dynamic preview work',async({page})=>{
  await page.goto('/');if(await page.getByRole('button',{name:'Expand preview',exact:true}).isVisible())await page.getByRole('button',{name:'Expand preview',exact:true}).click();await page.getByRole('button',{name:'Next map'}).click();await expect(page.getByText('Nuke',{exact:true})).toBeVisible();await page.getByRole('button',{name:'4x preview zoom'}).click();
  await expect(page.getByRole('button',{name:'4x preview zoom'})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'Start Dynamic Preview'}).click();await expect(page.getByRole('button',{name:'Stop Dynamic Preview'})).toBeVisible();
  await page.getByLabel('Preview mode',{exact:true}).selectOption('scope');await expect(page.getByRole('img',{name:'Scope dot preview'})).toBeVisible();
});

test('save disclosure persists a favorite without overwriting it while editing',async({page},testInfo)=>{
  await page.goto('/');if(await page.getByRole('button',{name:'Expand preview',exact:true}).isVisible())await page.getByRole('button',{name:'Expand preview',exact:true}).click();
  const bar=page.locator('.library-save-bar');
  await expect(page.locator('.save-disclosure')).not.toHaveAttribute('open');await expect(bar.getByRole('button',{name:'Save to favorites',exact:true})).toBeHidden();await page.locator('.save-disclosure > summary').click();
  await expect(page.getByRole('button',{name:'Library',exact:true})).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Library',exact:true})).toBeVisible();
  if(await page.locator('.save-disclosure').getAttribute('open')===null)await page.locator('.save-disclosure > summary').click();await page.getByLabel('Crosshair name',{exact:true}).fill('Match crosshair');
  await bar.getByRole('button',{name:'Save to favorites',exact:true}).click();
  await expect(bar).toContainText('Saved as Match crosshair');
  await page.reload();await page.locator('.save-disclosure > summary').click();await expect(bar).toContainText('Saved as Match crosshair');
  await page.screenshot({path:testInfo.outputPath('library-save.png'),fullPage:false});
  await page.getByLabel('Style',{exact:true}).selectOption('6');
  await expect(bar).not.toContainText('Saved as Match crosshair');
  await page.getByRole('button',{name:'Library',exact:true}).click();
  await expect(page.getByRole('button',{name:'Preview Match crosshair',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Load',exact:true}).click();
  await expect(bar).toContainText('Saved as Match crosshair');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('integrated code field updates live and preserves pending imports',async({page,context},testInfo)=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.goto('/');if(await page.getByRole('button',{name:'Expand preview',exact:true}).isVisible())await page.getByRole('button',{name:'Expand preview',exact:true}).click();
  const field=page.getByLabel('Crosshair code or config',{exact:true});
  const panel=page.locator('.inline-import');
  await expect(panel.getByLabel('Crosshair code or config',{exact:true})).toBeVisible();
  const before=await field.inputValue();
  await expect(field).toHaveValue(await page.getByLabel('Crosshair code or config').getAttribute('data-current-code').then(value=>value!));
  const length=page.getByRole('spinbutton',{name:'Length',exact:true});
  await length.fill('12');await length.blur();
  await expect(field).not.toHaveValue(before);
  const updated=await field.inputValue();
  await expect(field).toHaveValue(await page.getByLabel('Crosshair code or config').getAttribute('data-current-code').then(value=>value!));
  await page.reload();await expect(field).toHaveValue(updated);
  await field.fill(original);
  await page.getByLabel('Style',{exact:true}).selectOption('6');
  await expect(field).toHaveValue(original);
  await page.getByRole('button',{name:'Import crosshair',exact:true}).click();
  await expect(field).toHaveValue(original);
  await expect(page.getByLabel('Crosshair code or config')).toHaveAttribute('data-current-code',original);
  await field.fill('CSinvalid');await page.getByRole('button',{name:'Import crosshair',exact:true}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Crosshair code or config')).toHaveAttribute('data-current-code',original);
  await page.getByRole('button',{name:'Copy crosshair code',exact:true}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(original);
  await expect(field).toHaveValue('CSinvalid');
  await expect(field).toHaveAttribute('data-current-code',original);
  if(await page.locator('.import-options').getAttribute('open')===null)await page.locator('.import-options > summary').click();await page.getByRole('button',{name:'Use current code',exact:true}).click();
  await expect(field).toHaveValue(original);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await field.fill(updated);await page.getByRole('button',{name:'Import crosshair',exact:true}).click();
  await expect(length).toHaveValue('12');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:testInfo.outputPath('integrated-code.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('editor exposes one primary control per action with advanced exports collapsed',async({page},testInfo)=>{
  await page.goto('/');if(await page.getByRole('button',{name:'Expand preview',exact:true}).isVisible())await page.getByRole('button',{name:'Expand preview',exact:true}).click();
  await expect(page.getByLabel('Crosshair code or config',{exact:true})).toHaveCount(1);
  await expect(page.getByLabel('Current CS2 share code')).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Import, share and export',exact:true}).getByRole('textbox')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Guide',exact:true})).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Help and instructions',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Reset crosshair',exact:true})).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Share or Import',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Copy crosshair code',exact:true})).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Copy share code',exact:true})).toHaveCount(0);
  await expect(page.locator('.export-advanced')).not.toHaveAttribute('open');
  await expect(page.getByRole('textbox',{name:'Alias name'})).toBeHidden();
  await page.locator('.export-advanced > summary').click();
  await expect(page.getByRole('textbox',{name:'Alias name'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Copy autoexec shortcut',exact:true})).toBeVisible();
  await page.locator('.console-details > summary').click();
  await expect(page.getByLabel('Generated console commands')).toBeVisible();
  await page.locator('.export-advanced > summary').click();
  if(testInfo.project.name==='mobile'){
    const shortcuts=page.locator('.mobile-actions');
    for(const name of ['Copy code','.cfg','Import'])await expect(shortcuts.getByRole('button',{name,exact:true})).toBeVisible();
    await shortcuts.getByRole('button',{name:'Import',exact:true}).click();
    await expect(page.getByLabel('Crosshair code or config')).toBeFocused();
  }else await expect(page.locator('.mobile-actions')).toBeHidden();
  await page.getByRole('button',{name:'Guide',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.screenshot({path:testInfo.outputPath('consolidated-editor.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('invalid hidden alias opens advanced export for correction',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('delli.v3.alias',JSON.stringify('bad;quit')));
  await page.goto('/');if(await page.getByRole('button',{name:'Expand preview',exact:true}).isVisible())await page.getByRole('button',{name:'Expand preview',exact:true}).click();
  await expect(page.locator('.export-advanced')).not.toHaveAttribute('open');
  await page.getByRole('button',{name:'Download .cfg',exact:true}).click();
  await expect(page.locator('.export-advanced')).toHaveAttribute('open','');
  await expect(page.getByRole('textbox',{name:'Alias name'})).toBeFocused();
  await expect(page.getByRole('textbox',{name:'Alias name'})).toHaveAttribute('aria-invalid','true');
});
