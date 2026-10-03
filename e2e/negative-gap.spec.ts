import {test,expect} from '@playwright/test';

test('every style with a gap accepts negative input and slider values',async({page})=>{
  await page.goto('/');
  for(const style of [0,2,3,4,5,7,8,9]){
    await page.getByLabel('Style',{exact:true}).selectOption(String(style));
    const input=page.getByLabel('Gap',{exact:true}),slider=page.getByLabel('Gap slider',{exact:true});
    await expect(input).toHaveAttribute('min','-10');
    await expect(slider).toHaveAttribute('min','-10');
    await input.fill('-4');await input.press('Enter');
    await expect(input).toHaveValue('-4');await expect(slider).toHaveValue('-4');
    await slider.fill('-8');await expect(input).toHaveValue('-8');
    await page.reload();await expect(input).toHaveValue('-8');await expect(slider).toHaveValue('-8');
  }
});
