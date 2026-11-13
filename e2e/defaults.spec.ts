import {test,expect} from '@playwright/test';

test('removed section stays absent and recoil starts off, survives a reload and resets off',async({page})=>{
  await page.goto('/');
  await page.locator('#entrance').waitFor({state:'hidden'});
  await expect(page.getByRole('heading',{name:'Crosshair Settings',exact:true})).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'Crosshair sections'})).toHaveCount(0);
  await expect(page.getByLabel('Friendly Fire Reticle Warning',{exact:true})).toHaveCount(0);
  await expect(page.locator('.settings-section')).toHaveCount(3);
  const recoil=page.getByLabel('Follow Recoil',{exact:true});
  await expect(recoil).toHaveValue('0');
  await recoil.selectOption('1');
  await page.getByLabel('Gap',{exact:true}).fill('-4');
  await page.getByLabel('Gap',{exact:true}).press('Enter');
  await expect(page.getByLabel('Gap',{exact:true})).toHaveValue('-4');
  await page.reload();
  await page.locator('#entrance').waitFor({state:'hidden'});
  await expect(recoil).toHaveValue('1');
  await expect(page.getByLabel('Gap',{exact:true})).toHaveValue('-4');
  await recoil.selectOption('1');
  await page.getByRole('button',{name:'Reset crosshair',exact:true}).click();
  await expect(recoil).toHaveValue('0');
});

test('first visit and reset start from Static Cross, and Ctrl+Z undoes a setting change',async({page})=>{
  await page.route('**/entrance.js*',route=>route.fulfill({contentType:'text/javascript',body:''}));
  await page.goto('/');
  const style=page.getByLabel('Style',{exact:true}),length=page.getByLabel('Length',{exact:true});
  await expect(style).toHaveValue('4');
  await length.fill('20');
  await length.press('Enter');
  await expect(length).toHaveValue('20');
  // Inside a text field the browser's own undo applies; from the style control the crosshair is undone.
  await style.focus();
  await page.keyboard.press('Control+z');
  await expect(length).toHaveValue('8');
  await style.selectOption('7');
  await page.getByRole('button',{name:'Reset crosshair',exact:true}).click();
  await expect(style).toHaveValue('4');
});
