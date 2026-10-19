import {test,expect} from '@playwright/test';

// Simulated same-origin handoff: these tests do not contact Steam or authenticate an account.
for(const outcome of ['success','cancelled'] as const)test(`Steam ${outcome} returns to the starting view and preserves the working draft`,async({page})=>{
 let signedIn=false;
 await page.route('**/entrance.js*',route=>route.fulfill({contentType:'text/javascript',body:''}));
 await page.route('**/api/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/session')return route.fulfill({json:signedIn?{user:{steamId:'76561198000000001'},csrfToken:'auth-navigation-csrf'}:{user:null}});
  if(url.pathname==='/api/library')return route.fulfill({json:{revision:0,entries:[]}});
  if(url.pathname==='/api/auth/steam'){
   const destination=url.searchParams.get('returnTo');
   expect(destination).toBe(outcome==='success'?'/':'/?view=library');
   signedIn=outcome==='success';
   const returning=new URL(destination!,url.origin);
   if(!signedIn)returning.searchParams.set('steam','failed');
   // WebKit cannot fulfill intercepted requests with redirects; use a real document navigation.
   // Server tests separately verify the production HTTP redirect and callback validation.
   const encodedDestination=encodeURIComponent(returning.pathname+returning.search);
   return route.fulfill({contentType:'text/html',body:`<!doctype html><title>Simulated Steam handoff</title><script>location.replace(decodeURIComponent("${encodedDestination}"))</script>`});
  }
  return route.fulfill({status:404,json:{error:'Unexpected mocked auth request'}});
 });
 await page.goto('/');
 const length=page.getByRole('spinbutton',{name:'Length',exact:true});
 await length.fill('14');await length.blur();
 await page.locator('.export-advanced > summary').click();
 await page.getByRole('textbox',{name:'Alias name'}).fill('returning_player');
 const applied=await page.getByLabel('Crosshair code or config',{exact:true}).getAttribute('data-current-code');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('delli.v3.draft')!).cl_crosshair_length)).toBe(14);
 if(outcome==='cancelled')await page.getByRole('button',{name:'Library',exact:true}).click();
 await page.getByRole('link',{name:'Sign in with Steam',exact:true}).click();
 if(outcome==='success'){
  await expect(page.getByRole('main',{name:'Crosshair editor',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Steam account',exact:true})).toBeVisible();
 }else{
  await expect(page.getByRole('main',{name:'Crosshair library',exact:true})).toBeVisible();
  await expect(page.locator('.toast')).toContainText('Steam sign-in was not completed');
  await expect(page.getByRole('link',{name:'Sign in with Steam',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Crosshair / Scopes',exact:true}).click();
 }
 await expect(length).toHaveValue('14');
 await expect(page.getByLabel('Crosshair code or config',{exact:true})).toHaveAttribute('data-current-code',applied!);
 await page.locator('.export-advanced > summary').click();
 await expect(page.getByRole('textbox',{name:'Alias name'})).toHaveValue('returning_player');
});

