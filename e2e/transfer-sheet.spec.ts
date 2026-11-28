import {test,expect} from '@playwright/test';
import {openTransfer} from './transfer-helper';

test.beforeEach(async({page},info)=>{
 test.skip(info.project.name!=='mobile','The transfer panel is a sheet only in the single-column layout.');
 await page.route('**/entrance.js*',route=>route.fulfill({contentType:'text/javascript',body:''}));
 await page.route('**/api/session',route=>route.fulfill({json:{user:null,available:false}}));
});

test('leaving the editor with the sheet open, by browser Back, leaves the header usable',async({page})=>{
 await page.goto('/?view=library');
 await page.getByRole('button',{name:'Crosshair / Scopes',exact:true}).click();
 await openTransfer(page);
 await expect(page.locator('.header')).toHaveAttribute('inert','');
 await page.goBack();
 await expect(page.getByRole('main',{name:'Crosshair library',exact:true})).toBeVisible();
 await expect(page.locator('.header')).not.toHaveAttribute('inert');
 await expect(page.locator('.site-footer')).not.toHaveAttribute('inert');
 await page.getByRole('button',{name:'Guide',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
});

test('choosing one alias keeps the sheet open while the other choices remain',async({page})=>{
 await page.goto('/');
 await openTransfer(page);
 await page.getByLabel('Crosshair code or config',{exact:true}).evaluate((element,text)=>{
  const clipboardData=new DataTransfer();clipboardData.setData('text/plain',text);
  element.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData}));
 },'alias a "cl_crosshair_gap 1; cl_crosshair_length 2"\nalias b "cl_crosshair_gap -3; cl_crosshair_length 9"');
 await page.getByRole('button',{name:/^Load b/}).click();
 await expect(page.getByRole('dialog',{name:'Import, share and export',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/^Load a/}).click();
 await expect(page.getByRole('dialog',{name:'Import, share and export',exact:true})).toBeVisible();
 await expect(page.getByRole('spinbutton',{name:'Gap',exact:true})).toHaveValue('1');
});

test('Tab and Shift+Tab stay inside the open sheet',async({page})=>{
 await page.goto('/');
 await openTransfer(page);
 const close=page.getByRole('button',{name:'Close import, share and export',exact:true});
 await expect(close).toBeFocused();
 const inside=()=>page.evaluate(()=>document.getElementById('transfer-panel')!.contains(document.activeElement));
 for(let i=0;i<30;i++){await page.keyboard.press('Tab');expect(await inside(),`Tab ${i+1}`).toBe(true);}
 await close.focus();
 await page.keyboard.press('Shift+Tab');
 expect(await inside()).toBe(true);
 await expect(close).not.toBeFocused();
 await page.keyboard.press('Tab');
 await expect(close).toBeFocused();
});
