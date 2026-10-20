import {test,expect} from '@playwright/test';
test('preview tools collapse while zoom remains visible at every viewport',async({page})=>{
 await page.route('**/api/session',route=>route.fulfill({json:{user:null}}));
 await page.goto('/');
 for(const width of [320,390,820,1440]){
  await page.setViewportSize({width,height:1000});
  for(const n of [1,2,4,8])await expect(page.getByRole('button',{name:`${n}x preview zoom`,exact:true})).toBeVisible();
  await expect(page.locator('.preview-caption')).toBeHidden();
  await page.getByLabel('Preview options',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Inspect preview',exact:true})).toBeVisible();
  await expect(page.locator('.preview-options .preview-caption')).toBeVisible();
  const panel=await page.locator('.preview-options-panel').boundingBox();
  for(const name of ['Inspect preview','Fullscreen game-size preview']){
   const action=await page.getByRole('button',{name,exact:true}).boundingBox();
   expect(action!.width).toBeGreaterThan(200);
   expect(action!.x).toBeGreaterThanOrEqual(panel!.x);
   expect(action!.x+action!.width).toBeLessThanOrEqual(panel!.x+panel!.width);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByLabel('Preview options',{exact:true}).press('Escape');
  await expect(page.locator('.preview-caption')).toBeHidden();
 }
});
