import {openPreviewOptions} from './preview-options-helper';
import {test,expect} from '@playwright/test';
test('preview options are three plain controls and the detail inset stays visible',async({page})=>{
  await page.route('**/api/session',route=>route.fulfill({json:{user:null}}));
  await page.route('**/entrance.js*',route=>route.fulfill({contentType:'text/javascript',body:''}));
  await page.goto('/');if(await page.getByRole('button',{name:'Expand preview',exact:true}).isVisible())await page.getByRole('button',{name:'Expand preview',exact:true}).click();
  await expect(page.locator('.map-preview > .detail-preview')).toBeVisible();
  await openPreviewOptions(page);
  const panel=page.locator('.preview-options-panel');
  await expect(panel.getByLabel('Match my in-game size')).toBeVisible();
  await expect(panel.getByLabel('Preview mode',{exact:true})).toBeVisible();
  await expect(panel.getByRole('button',{name:'Start Dynamic Preview'})).toBeVisible();
  // The inspection dialog and its resolution, fit, phase and split controls are gone.
  await expect(panel.getByRole('button')).toHaveCount(1);
  await expect(panel.getByRole('slider')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(panel.locator('.preview-caption')).toContainText('as designed');
  await expect(page.locator('.detail-preview')).toBeVisible();
});
