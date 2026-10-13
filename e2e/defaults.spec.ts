import {test,expect} from '@playwright/test';

test('removed section stays absent and recoil starts and resets off',async({page})=>{
  await page.goto('/');
  await page.locator('#entrance').waitFor({state:'hidden'});
  await expect(page.getByRole('heading',{name:'Crosshair Settings',exact:true})).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'Crosshair sections'})).toHaveCount(0);
  await expect(page.getByLabel('Friendly Fire Reticle Warning',{exact:true})).toHaveCount(0);
  await expect(page.locator('.settings-section')).toHaveCount(1);
  const recoil=page.getByLabel('Follow Recoil',{exact:true});
  await expect(recoil).toHaveValue('0');
  await recoil.selectOption('1');
  await page.getByLabel('Gap',{exact:true}).fill('-4');
  await page.getByLabel('Gap',{exact:true}).press('Enter');
  await expect(page.getByLabel('Gap',{exact:true})).toHaveValue('-4');
  await page.reload();
  await page.locator('#entrance').waitFor({state:'hidden'});
  await expect(recoil).toHaveValue('0');
  await expect(page.getByLabel('Gap',{exact:true})).toHaveValue('-4');
  await recoil.selectOption('1');
  await page.getByRole('button',{name:'Reset crosshair',exact:true}).click();
  await expect(recoil).toHaveValue('0');
});
