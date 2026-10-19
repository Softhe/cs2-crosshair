import {test,expect} from '@playwright/test';
import {defaults} from '../src/model';

const steamId='76561198000000001';
test.beforeEach(async({page})=>{await page.route('**/entrance.js*',route=>route.fulfill({contentType:'text/javascript',body:''}));});

test('a stalled session times out and retry preserves the editor draft',async({page})=>{
 let stalled=true;
 await page.route('**/api/session',route=>stalled?undefined:route.fulfill({json:{user:null}}));
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Checking Steam…',exact:true})).toBeDisabled();
 const length=page.getByRole('spinbutton',{name:'Length',exact:true});await length.fill('14');await length.blur();
 const unavailable=page.getByRole('button',{name:'Steam unavailable',exact:true});await expect(unavailable).toBeVisible({timeout:16000});
 stalled=false;await unavailable.click();await page.getByRole('button',{name:'Retry connection',exact:true}).click();
 await expect(page.getByRole('link',{name:'Sign in with Steam',exact:true})).toBeVisible();await expect(length).toHaveValue('14');
});

test('unresolved write conflicts explicitly identify saved changes waiting to sync',async({page})=>{
 const entry={id:'pending',name:'Pending favorite',settings:defaults};
 await page.addInitScript(({steamId,entry})=>localStorage.setItem('delli.v3.steam-library.'+steamId,JSON.stringify({base:{revision:0,entries:[]},entries:[entry],history:[]})),{steamId,entry});
 let writes=0;
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/session')return route.fulfill({json:{user:{steamId},csrfToken:'test-csrf'}});
  if(path==='/api/library'){
   if(route.request().method()==='PUT'){writes++;return route.fulfill({status:409,json:{revision:0,entries:[]}});}
   return route.fulfill({json:{revision:0,entries:[]}});
  }
  return route.fulfill({status:404});
 });
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Steam account',exact:true})).toContainText('Saved changes waiting to sync');expect(writes).toBe(3);
 for(const width of [320,360,390]){
  await page.setViewportSize({width,height:844});
  const account=await page.getByRole('button',{name:'Steam account',exact:true}).boundingBox();
  const brand=await page.locator('.brand').boundingBox();
  expect(account!.x).toBeGreaterThanOrEqual(brand!.x+brand!.width);
  expect(account!.x+account!.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect(await page.locator('.brand').evaluate(el=>[...el.children].every(child=>child.getBoundingClientRect().right<=el.getBoundingClientRect().right+1))).toBe(true);
 }
 expect(await page.evaluate(steamId=>JSON.parse(localStorage.getItem('delli.v3.steam-library.'+steamId)!).entries.length,steamId)).toBe(1);
});

test('session expiry returns to guest controls while retaining the account queue',async({page})=>{
 let signedIn=true;
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/session')return route.fulfill({json:signedIn?{user:{steamId},csrfToken:'test-csrf'}:{user:null}});
  if(path==='/api/library')return route.fulfill({json:{revision:0,entries:[]}});
  return route.fulfill({status:404});
 });
 await page.goto('/');await expect(page.getByRole('button',{name:'Steam account',exact:true})).toContainText('Synced');
 signedIn=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByRole('link',{name:'Sign in with Steam',exact:true})).toBeVisible();
 expect(await page.evaluate(steamId=>localStorage.getItem('delli.v3.steam-library.'+steamId),steamId)).not.toBeNull();
});
