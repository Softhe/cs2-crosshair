import {test,expect} from '@playwright/test';
const original='CSxkMfFVRUG6fRehdb2CvLNuajHopsuAQ5O38aVLPTTPHj';
test.beforeEach(async({page})=>{await page.route('**/entrance.js*',r=>r.fulfill({contentType:'text/javascript',body:''}));await page.route('**/api/session',r=>r.fulfill({json:{user:null,available:false}}));});

test('default editor has one field and all transfer actions in one panel',async({page})=>{
 await page.goto('/');const panel=page.getByRole('region',{name:'Import, share and export',exact:true});
 await expect(panel).toBeVisible();await expect(page.locator('.export-card')).toHaveCount(0);await expect(panel.getByRole('textbox')).toHaveCount(1);
 for(const name of ['Import crosshair','Copy crosshair code','Copy link','Download .cfg'])await expect(panel.getByRole('button',{name,exact:true})).toBeVisible();
 await page.goto('/?layout=combined');await expect(panel).toBeVisible();await expect(page.locator('.export-card')).toHaveCount(0);
});

test('pending input never changes copied or downloaded settings until applied',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await page.goto('/');
 const panel=page.getByRole('region',{name:'Import, share and export',exact:true}),field=panel.getByLabel('Crosshair code or config',{exact:true}),applied=await field.inputValue();
 await field.fill('CSinvalid');await expect(panel.getByText('Unapplied import',{exact:true})).toBeVisible();
 await panel.getByRole('button',{name:'Copy crosshair code',exact:true}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(applied);
 await panel.getByRole('button',{name:'Copy link',exact:true}).click();expect(new URL(await page.evaluate(()=>navigator.clipboard.readText())).searchParams.get('code')).toBe(applied);
 const download=page.waitForEvent('download');await panel.getByRole('button',{name:'Download .cfg',exact:true}).click();const stream=await(await download).createReadStream();let content='';for await(const chunk of stream!)content+=chunk;expect(content).toContain(applied);
 await panel.getByRole('button',{name:'Import crosshair',exact:true}).click();await expect(panel.getByRole('alert')).toBeVisible();await expect(field).toHaveAttribute('data-current-code',applied);
 await panel.getByRole('button',{name:'Discard import',exact:true}).click();await expect(field).toHaveValue(applied);await expect(panel.getByRole('alert')).toHaveCount(0);
 await field.fill(original);await panel.getByRole('button',{name:'Import crosshair',exact:true}).click();await expect(field).toHaveAttribute('data-current-code',original);
});

test('combined advanced actions and responsive layout remain usable',async({page})=>{
 await page.goto('/');const panel=page.getByRole('region',{name:'Import, share and export',exact:true});
 await panel.locator('.export-advanced>summary').click();await panel.getByRole('textbox',{name:/Alias name/i}).fill('team_green');
 const download=page.waitForEvent('download');await panel.getByRole('button',{name:'Download .cfg',exact:true}).click();expect((await download).suggestedFilename()).toBe('crosshair_team_green.cfg');
 await panel.locator('.export-advanced>summary').click();await panel.locator('.import-options>summary').click();await expect(panel.getByRole('button',{name:'Paste clipboard',exact:true})).toBeVisible();
 await panel.locator('.config-import>summary').click();await expect(panel.getByRole('button',{name:'Choose .cfg file',exact:true})).toBeVisible();
 await panel.locator('.import-options>summary').click();
 for(const width of [320,390,820,1462,2464]){await page.setViewportSize({width,height:1184});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`).toBe(true);}
});

