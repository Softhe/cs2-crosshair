import {test,expect,type Page} from '@playwright/test';
const steamId='76561198000000001';
test.beforeEach(async({page})=>{await page.route('**/entrance.js*',r=>r.fulfill({contentType:'text/javascript',body:''}));});
async function accountApi(page:Page,signedIn=false){
 const state={signedIn,failLogout:false};
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(path==='/api/session')return route.fulfill({json:state.signedIn?{user:{steamId},csrfToken:'test-csrf'}:{user:null}});
  if(path==='/api/library')return route.fulfill({json:{revision:0,entries:[]}});
  if(path==='/api/auth/logout'){expect(request.method()).toBe('POST');expect(request.headers()['x-csrf-token']).toBe('test-csrf');if(state.failLogout)return route.fulfill({status:503,json:{error:'Unavailable'}});state.signedIn=false;return route.fulfill({json:{user:null}});}
  if(path==='/api/auth/steam')return route.fulfill({contentType:'text/html',body:'<h1>Steam sign-in handoff</h1>'});
  return route.fulfill({status:404,json:{error:'Not found'}});
 });return state;
}

test('Steam sign-in has the same prominent header placement in editor and library',async({page})=>{
 await accountApi(page);await page.goto('/?layout=combined');
 const header=page.getByRole('banner'),signIn=header.getByRole('link',{name:'Sign in with Steam',exact:true});
 await expect(signIn).toBeVisible();await expect(signIn).toHaveAttribute('href','/api/auth/steam?returnTo=%2F');const editorRect=await signIn.boundingBox();
 await page.getByRole('button',{name:'Library',exact:true}).click();await expect(signIn).toBeVisible();expect(await signIn.boundingBox()).toEqual(editorRect);await expect(signIn).toHaveAttribute('href','/api/auth/steam?returnTo=%2F%3Fview%3Dlibrary');
 await expect(page.getByRole('link',{name:'Sign in with Steam',exact:true})).toHaveCount(1);
 await page.getByRole('button',{name:'Crosshair / Scopes',exact:true}).click();await signIn.click();await expect(page).toHaveURL(/\/api\/auth\/steam\?returnTo=%2F$/);await expect(page.getByRole('heading',{name:'Steam sign-in handoff'})).toBeVisible();
});

test('signed-in header opens account actions and handles failed then successful sign-out',async({page})=>{
 const state=await accountApi(page,true);await page.goto('/?layout=combined');const trigger=page.getByRole('button',{name:'Steam account',exact:true});
 await expect(trigger).not.toContainText('Synced');await trigger.click();await expect(page.getByRole('region',{name:'Steam account details'})).toContainText('Synced');await trigger.press('Escape');await expect(page.getByRole('link',{name:'Sign in with Steam',exact:true})).toHaveCount(0);
 await trigger.click();await expect(page.getByRole('region',{name:'Steam account details'})).toContainText(steamId);await trigger.press('Escape');await expect(trigger).toBeFocused();await expect(trigger).toHaveAttribute('aria-expanded','false');
 await trigger.click();await page.getByRole('button',{name:'Open your library',exact:true}).click();await expect(page.getByRole('main',{name:'Crosshair library'})).toBeVisible();await expect(trigger).toHaveAttribute('aria-expanded','false');
 await trigger.click();state.failLogout=true;await page.getByRole('button',{name:'Sign out of Steam',exact:true}).click();await expect(page.getByRole('region',{name:'Steam account details'}).getByRole('alert')).toContainText('Could not sign out');await expect(trigger).toBeVisible();
 state.failLogout=false;await page.getByRole('button',{name:'Sign out of Steam',exact:true}).click();await expect(page.getByRole('banner').getByRole('link',{name:'Sign in with Steam',exact:true})).toBeVisible();await expect(trigger).toHaveCount(0);
});

test('unavailable sign-in explains the problem and retries without losing the draft',async({page})=>{
 let available=false;await page.route('**/api/session',route=>route.fulfill(available?{json:{user:null}}:{status:503,json:{error:'Offline'}}));
 await page.goto('/?layout=combined');const field=page.getByRole('spinbutton',{name:'Length',exact:true});await field.fill('14');await field.press('Tab');
 const unavailable=page.getByRole('button',{name:'Steam unavailable',exact:true});await expect(unavailable).toBeVisible();await unavailable.click();await expect(page.getByRole('region',{name:'Steam sign-in availability'})).toContainText('keep editing and saving');
 available=true;await page.getByRole('button',{name:'Retry connection',exact:true}).click();await expect(page.getByRole('banner').getByRole('link',{name:'Sign in with Steam',exact:true})).toBeVisible();await expect(field).toHaveValue('14');
});

test('session checking does not flash an active sign-in link',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 await page.route('**/api/session',async route=>{await gate;await route.fulfill({json:{user:null}});});await page.goto('/?layout=combined');
 await expect(page.getByRole('button',{name:'Checking Steam…',exact:true})).toBeDisabled();await expect(page.getByRole('link',{name:'Sign in with Steam',exact:true})).toHaveCount(0);
 release();await expect(page.getByRole('link',{name:'Sign in with Steam',exact:true})).toBeVisible();
});

test('header account controls remain usable at narrow widths',async({page},info)=>{
 test.skip(info.project.name!=='mobile');await accountApi(page,true);await page.goto('/?layout=combined');
 for(const width of [320,360,390,540,820]){
  await page.setViewportSize({width,height:844});const trigger=page.getByRole('button',{name:'Steam account',exact:true}),rect=await trigger.boundingBox();expect(rect!.height).toBeGreaterThanOrEqual(44);expect(rect!.x).toBeGreaterThanOrEqual(0);expect(rect!.x+rect!.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await trigger.click();const panel=await page.getByRole('region',{name:'Steam account details'}).boundingBox();expect(panel!.x).toBeGreaterThanOrEqual(0);expect(panel!.x+panel!.width).toBeLessThanOrEqual(width);await trigger.press('Escape');
 }
});

test('full Steam sign-in label fits on small screens',async({page})=>{
 await accountApi(page);await page.goto('/?layout=combined');
 const signIn=page.getByRole('link',{name:'Sign in with Steam',exact:true});
 for(const width of [320,360,390,540,820]){
  await page.setViewportSize({width,height:844});await expect(signIn).toBeVisible();
  await expect(signIn.getByText('with Steam',{exact:true})).toBeVisible();
  const rect=await signIn.boundingBox();expect(rect!.x).toBeGreaterThanOrEqual(0);expect(rect!.x+rect!.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
