import {test,expect} from '@playwright/test';
test('preview tools collapse while zoom remains visible at every viewport',async({page})=>{
 await page.route('**/api/session',route=>route.fulfill({json:{user:null}}));
 await page.goto('/');
 for(const width of [320,390,820,1440]){
  await page.setViewportSize({width,height:1000});
  for(const n of [1,2,4,8])await expect(page.getByRole('button',{name:`${n}x preview zoom`,exact:true})).toBeVisible();
  await expect(page.locator('.preview-caption')).toBeHidden();
  await page.getByLabel('Preview options',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Inspect preview',exact:true})).toHaveCount(0);
  await expect(page.locator('.preview-options .preview-caption')).toBeVisible();
  const panel=await page.locator('.preview-options-panel').boundingBox();
  const action=await page.getByRole('button',{name:'Start dynamic preview',exact:true}).boundingBox();
  expect(action!.width).toBeGreaterThan(200);
  expect(action!.x).toBeGreaterThanOrEqual(panel!.x);
  expect(action!.x+action!.width).toBeLessThanOrEqual(panel!.x+panel!.width);
  // Fullscreen is a single click from the toolbar, not inside the options panel.
  await expect(page.locator('.preview-toolbar>.fullscreen-button')).toBeVisible();
  await expect(page.locator('.preview-options-panel .fullscreen-button')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.preview-caption').click();
  await expect(page.locator('.preview-caption')).toBeVisible();
  // The map arrows hide while the options are open, so the outside click lands on the toolbar.
  await page.getByRole('button',{name:'1x preview zoom',exact:true}).click();
  await expect(page.locator('.preview-caption')).toBeHidden();
  await page.getByLabel('Preview options',{exact:true}).click();
  // Move focus outside without a pointer event to exercise document-level Escape.
  await page.getByRole('button',{name:'2x preview zoom',exact:true}).focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('.preview-caption')).toBeHidden();
  await expect(page.getByLabel('Preview options',{exact:true})).toBeFocused();
  await page.getByLabel('Preview options',{exact:true}).click();
  await page.getByLabel('Preview options',{exact:true}).press('Escape');
  await expect(page.locator('.preview-caption')).toBeHidden();
 }
});
