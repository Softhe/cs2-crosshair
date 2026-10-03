import {test,expect} from '@playwright/test';

test('recoil and friendly warning start off and reset off',async({page})=>{
  await page.goto('/');
  const recoil=page.getByLabel('Follow Recoil',{exact:true});
  const warning=page.getByLabel('Friendly Fire Reticle Warning',{exact:true});
  await expect(recoil).toHaveValue('0');
  await expect(warning).toHaveValue('0');
  await recoil.selectOption('1');
  await warning.selectOption('1');
  await page.getByLabel('Gap',{exact:true}).fill('-4');
  await page.getByLabel('Gap',{exact:true}).press('Enter');
  await page.reload();
  await expect(recoil).toHaveValue('0');
  await expect(warning).toHaveValue('0');
  await expect(page.getByLabel('Gap',{exact:true})).toHaveValue('-4');
  await recoil.selectOption('1');
  await warning.selectOption('1');
  await page.getByRole('button',{name:'Reset',exact:true}).click();
  await expect(recoil).toHaveValue('0');
  await expect(warning).toHaveValue('0');
});
