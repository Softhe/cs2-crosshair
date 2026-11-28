import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.route('**/entrance.js*',route=>route.fulfill({contentType:'text/javascript',body:''}));
 await page.route('**/api/session',route=>route.fulfill({json:{user:null,available:true}}));
 await page.addInitScript(()=>localStorage.setItem('delli.v3.library',JSON.stringify([{id:'one',name:'Team green',alias:'',favorite:true,date:'2026-11-01T00:00:00.000Z',settings:{cl_crosshairstyle:4,cl_crosshair_length:9}}])));
});

test('signed out, the library offers Steam sign-in that returns to the library',async({page})=>{
 await page.goto('/?view=library');
 const sync=page.getByRole('region',{name:'Steam library sync',exact:true});
 const link=sync.getByRole('link',{name:'Sign in with Steam to sync your library',exact:true});
 await expect(link).toBeVisible();
 expect(new URL((await link.getAttribute('href'))!,page.url()).searchParams.get('returnTo')).toBe('/?view=library');
});

test('library actions use one name each: Edit opens the editor, Copy code copies',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.goto('/?view=library');
 await expect(page.getByRole('button',{name:'Load',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Preview Team green',exact:true}).click();
 const selected=page.getByRole('region',{name:'Selected crosshair',exact:true});
 await expect(selected.getByText('CS2 share code',{exact:true})).toBeVisible();
 await selected.getByRole('button',{name:'Copy code',exact:true}).click();
 expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(await selected.getByLabel('Selected crosshair code').inputValue());
 await page.getByRole('button',{name:'Edit Team green',exact:true}).click();
 await expect(page.getByRole('main',{name:'Crosshair editor',exact:true})).toBeVisible();
 await expect(page.getByRole('spinbutton',{name:'Length',exact:true})).toHaveValue('9');
});
