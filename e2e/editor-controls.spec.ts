import {test,expect} from '@playwright/test';
import {closeTransfer,openTransfer} from './transfer-helper';

test.beforeEach(async({page})=>{
 await page.route('**/entrance.js*',route=>route.fulfill({contentType:'text/javascript',body:''}));
 await page.route('**/api/session',route=>route.fulfill({json:{user:null,available:false}}));
});

async function cfgText(page:import('@playwright/test').Page){
 await openTransfer(page);
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Download .cfg',exact:true}).click();
 const stream=await(await download).createReadStream();let content='';for await(const chunk of stream!)content+=chunk;
 await closeTransfer(page);
 return content;
}

test('other CS2 settings are collapsed, editable and carried by configs',async({page})=>{
 await page.goto('/');
 const section=page.locator('.other-settings');
 await expect(section).not.toHaveAttribute('open');
 await expect(page.getByLabel('Sniper Crosshair Thickness',{exact:true})).toBeHidden();
 await section.locator('summary').click();
 await expect(section.getByRole('heading',{name:'Sniper rifles',exact:true})).toBeVisible();
 await page.getByLabel('Show Scoped Sniper Rifle Inaccuracy',{exact:true}).selectOption('0');
 const width=page.getByRole('spinbutton',{name:'Sniper Crosshair Thickness',exact:true});await width.fill('4');await width.press('Enter');
 // A hidden grenade crosshair has no delay to set.
 await expect(page.getByRole('spinbutton',{name:'Smoke grenades delay (seconds)',exact:true})).toBeVisible();
 await page.getByLabel('Smoke grenades',{exact:true}).selectOption('0');
 await expect(page.getByRole('spinbutton',{name:'Smoke grenades delay (seconds)',exact:true})).toHaveCount(0);
 const cfg=await cfgText(page);
 expect(cfg).toContain('cl_sniper_show_inaccuracy "0"');
 expect(cfg).toContain('cl_crosshair_sniper_width "4"');
 expect(cfg).toContain('cl_grenadecrosshair_smoke "0"');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('a typed hex color applies as one change and bad input reverts',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Edit Color and Transparency',exact:true}).click();
 const hex=page.getByRole('textbox',{name:'Crosshair hex color',exact:true});
 await hex.fill('#0af');await hex.press('Enter');
 await expect(hex).toHaveValue('#00AAFF');
 await expect(page.getByRole('spinbutton',{name:'Crosshair red',exact:true})).toHaveValue('0');
 await expect(page.getByRole('spinbutton',{name:'Crosshair green',exact:true})).toHaveValue('170');
 await expect(page.getByRole('spinbutton',{name:'Crosshair blue',exact:true})).toHaveValue('255');
 await hex.fill('not a color');await hex.blur();
 await expect(hex).toHaveValue('#00AAFF');
 // One undo restores the previous color in full.
 await page.getByRole('button',{name:'Undo changes',exact:true}).click();
 await expect(hex).toHaveValue('#00FF00');
});

test('number fields show a decimal point, accept a comma and step with the arrow keys',async({page})=>{
 await page.goto('/');
 const scale=page.getByRole('spinbutton',{name:'Scope dot scale',exact:true});
 await expect(scale).toHaveValue('1.00');
 await scale.fill('0,5');await scale.press('Enter');
 await expect(scale).toHaveValue('0.50');
 await scale.press('ArrowUp');
 await expect(scale).toHaveValue('0.51');
 // An arrow press steps from a typed value that has not been committed yet.
 await scale.fill('0.8');
 await scale.press('ArrowUp');
 await expect(scale).toHaveValue('0.81');
 await scale.fill('nonsense');
 await scale.press('ArrowDown');
 await expect(scale).toHaveValue('0.80');
 const gap=page.getByRole('spinbutton',{name:'Gap',exact:true});
 await gap.press('ArrowDown');
 await expect(gap).toHaveValue('3');
 await expect(gap).toHaveAttribute('aria-valuenow','3');
});

test('save to library from the export row opens the save form with the name field focused',async({page})=>{
 await page.goto('/');
 await openTransfer(page);
 await page.getByRole('button',{name:'Save to library',exact:true}).click();
 await expect(page.locator('.save-disclosure')).toHaveAttribute('open','');
 await expect(page.getByLabel('Crosshair name',{exact:true})).toBeFocused();
 await page.keyboard.type('From the export row');await page.keyboard.press('Enter');
 await expect(page.locator('.library-save-bar')).toContainText('Saved as From the export row');
});
