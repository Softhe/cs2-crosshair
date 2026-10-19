import {test,expect} from '@playwright/test';
import {defaults} from '../src/model';

const entry=(id:string,name:string,favorite=true)=>({id,name,alias:'',settings:{...defaults},favorite,date:'2026-10-16T00:00:00.000Z'});
test.beforeEach(async({page})=>{
  await page.route('**/entrance.js*',route=>route.fulfill({contentType:'text/javascript',body:''}));
  await page.addInitScript(entries=>localStorage.setItem('delli.v3.library',JSON.stringify(entries)),[entry('alpha','Alpha'),entry('beta','Beta'),entry('recent','Imported',false)]);
  await page.goto('/');await page.getByRole('button',{name:'Library',exact:true}).click();
});

test('undo restores the deleted entry and preserves edits to other crosshairs',async({page})=>{
  await page.getByRole('button',{name:'Remove Alpha',exact:true}).click();
  await expect(page.getByRole('button',{name:'Preview Alpha',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Rename Beta',exact:true}).click();
  await page.getByLabel('Rename crosshair').fill('Beta edited');await page.getByLabel('Rename crosshair').press('Enter');
  await page.getByRole('button',{name:'Undo removal of Alpha',exact:true}).click();
  await expect(page.getByRole('button',{name:'Preview Alpha',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Preview Beta edited',exact:true})).toBeVisible();
  const library=await page.evaluate(()=>JSON.parse(localStorage.getItem('delli.v3.library')!));
  expect(library.map((item:{name:string})=>item.name)).toEqual(expect.arrayContaining(['Alpha','Beta edited','Imported']));
  await expect(page.getByRole('region',{name:'Recently removed crosshairs'})).toHaveCount(0);
});

test('empty search clears filters and displays favorite and history badges',async({page})=>{
  await page.getByLabel('Search crosshairs').fill('does not exist');
  await expect(page.getByRole('heading',{name:'No matching crosshairs.'})).toBeVisible();
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await expect(page.getByLabel('Search crosshairs')).toHaveValue('');
  await expect(page.getByLabel('Library filter')).toHaveValue('all');
  await expect(page.locator('.library-badge.favorite')).toHaveCount(2);
  await expect(page.locator('.library-badge.history')).toHaveText('Recent history');
});
test('failed persistence keeps the entry and does not offer a false undo',async({page})=>{
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota reached','QuotaExceededError');};});
  await page.getByRole('button',{name:'Remove Alpha',exact:true}).click();
  await expect(page.getByRole('button',{name:'Preview Alpha',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Undo removal of Alpha',exact:true})).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Removal could not be saved');
});
