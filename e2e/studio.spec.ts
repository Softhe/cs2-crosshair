import {test,expect} from '@playwright/test';
const original='CSxkMfFVRUG6fRehdb2CvLNuajHopsuAQ5O38aVLPTTPHj';
test('renders all menu sections, changes style, edits and restores draft',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
  await expect(page.getByRole('heading',{name:'Crosshair / Scopes'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Grenade Line-up'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Sniper Sights'})).toHaveCount(0);
  await expect(page.getByLabel('Preview mode').locator('option[value=sniper]')).toHaveCount(0);
  await expect(page.getByRole('textbox',{name:'Alias name'})).toBeVisible();
  await page.getByLabel('Style',{exact:true}).selectOption('2');
  await page.getByRole('spinbutton',{name:'Gap',exact:true}).fill('-4');await page.getByRole('spinbutton',{name:'Gap',exact:true}).blur();
  await expect(page.getByRole('spinbutton',{name:'Gap',exact:true})).toHaveValue('-4');
  await page.reload();await expect(page.getByRole('spinbutton',{name:'Gap',exact:true})).toHaveValue('-4');
  await page.getByLabel('Style',{exact:true}).selectOption('6');await expect(page.getByRole('spinbutton',{name:'Length',exact:true})).toHaveCount(0);
  await expect(page.getByLabel('Center Dot',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Scope dot scale',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
test('clipboard exports code, full links and autoexec shortcuts correctly',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);await page.goto('/');
  await page.getByRole('textbox',{name:'Alias name'}).fill('team_green');
  await page.getByRole('button',{name:'Copy autoexec shortcut',exact:true}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('alias team_green "exec crosshair_team_green.cfg"');
  await page.getByLabel('Friendly Fire Reticle Warning',{exact:true}).selectOption('0');
  await page.getByRole('button',{name:'Copy link',exact:true}).click();const link=await page.evaluate(()=>navigator.clipboard.readText());
  await page.goto(link);await expect(page.getByLabel('Friendly Fire Reticle Warning',{exact:true})).toHaveValue('0');
  await page.getByRole('button',{name:'Copy crosshair code',exact:true}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(await page.getByLabel('Current CS2 share code').inputValue());
  await page.keyboard.press('Control+Enter');expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('cl_crosshairstyle');
});
test('restores a backup and rejects invalid settings',async({page})=>{
  await page.goto('/');await page.getByLabel('Crosshair name',{exact:true}).fill('Backup green');await page.getByRole('button',{name:'Save to favorites',exact:true}).click();await page.getByRole('button',{name:'Open your library'}).click();
  const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Export library'}).click();const download=await promise;
  const path=(await download.path())!;await page.getByRole('button',{name:'Remove Backup green'}).click();
  await page.getByLabel('Library backup file').setInputFiles(path);await expect(page.getByText('Backup green',{exact:true})).toBeVisible();
  await page.getByLabel('Library backup file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,entries:[{name:'Bad',favorite:true,settings:{quit:1}}]}))});
  await expect(page.getByRole('status')).toContainText('Unknown setting');await expect(page.getByText('Backup green',{exact:true})).toBeVisible();
});
test('imports actual game code and rejects a corrupted code without changing state',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Share or Import',exact:true}).click();await page.getByLabel('Crosshair code or config').fill(original);
  await page.getByRole('button',{name:'Import crosshair',exact:true}).click();await expect(page.getByLabel('Current CS2 share code')).toHaveValue(original);
  await page.getByRole('button',{name:'Share or Import',exact:true}).click();await page.getByLabel('Crosshair code or config').fill(original.slice(0,-1)+'A');await page.getByRole('button',{name:'Import crosshair',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('checksum');await expect(page.getByLabel('Current CS2 share code')).toHaveValue(original);await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('downloads a named config and validates alias injection',async({page})=>{
  await page.goto('/');await page.getByRole('textbox',{name:'Alias name'}).fill('team_green');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download .cfg',exact:true}).click();const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('crosshair_team_green.cfg');const stream=await download.createReadStream();let content='';for await(const chunk of stream!)content+=chunk;
  expect(content).toContain('cl_crosshair_length "8"');expect(content).toContain('cl_ironsight_dot_scale "1"');expect(content).toContain('cl_grenadecrosshair_smoke "1"');
  await page.getByRole('textbox',{name:'Alias name'}).fill('bad;quit');await expect(page.getByRole('button',{name:'Copy autoexec shortcut',exact:true})).toBeDisabled();
});
test('library favorite, rename, search, load, remove and backup',async({page})=>{
  await page.goto('/');await page.getByLabel('Crosshair name',{exact:true}).fill('Test green');await page.getByRole('button',{name:'Save to favorites',exact:true}).click();await page.getByRole('button',{name:'Open your library'}).click();
  await expect(page.getByText('Test green',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Rename Test green'}).click();await page.getByLabel('Rename crosshair').fill('Team reticle');await page.getByLabel('Rename crosshair').press('Enter');
  await page.getByLabel('Search crosshairs').fill('Team');await expect(page.getByText('Team reticle',{exact:true})).toBeVisible();
  const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Export library'}).click();const download=await promise;expect(download.suggestedFilename()).toBe('delli-crosshair-library.json');
  await page.getByRole('button',{name:'Load',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button',{name:'Open your library'}).click();await page.getByRole('button',{name:'Remove Team reticle'}).click();await expect(page.getByText('Your collection starts here.')).toBeVisible();
});
test('full links preserve extra settings, compatibility routes and missing routes',async({page})=>{
  await page.goto('/?code='+original);await expect(page.getByLabel('Current CS2 share code')).toHaveValue(original);
  await page.goto('/?crosshair='+original);await expect(page.getByLabel('Current CS2 share code')).toHaveValue(original);
  await page.goto('/'+original);await expect(page.getByLabel('Current CS2 share code')).toHaveValue(original);
  await page.goto('/custom?code='+original+'#keep');await expect(page).toHaveURL('/?code='+original+'#keep');
  await page.goto('/missing');await expect(page.getByRole('heading',{name:'Crosshair not found'})).toBeVisible();
});
test('maps, zoom and accessible dynamic preview work',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Next map'}).click();await expect(page.getByText('Nuke',{exact:true})).toBeVisible();await page.getByRole('button',{name:'4x preview zoom'}).click();
  await expect(page.getByRole('button',{name:'4x preview zoom'})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'Start Dynamic Preview'}).click();await expect(page.getByRole('button',{name:'Stop Dynamic Preview'})).toBeVisible();
  await page.getByLabel('Preview mode',{exact:true}).selectOption('scope');await expect(page.getByRole('img',{name:'Scope dot preview'})).toBeVisible();
});
