import {test,expect,type Page} from '@playwright/test';
import {defaults} from '../src/model';
import {encode} from '../src/codec';
import type {Saved} from '../src/storage';
import type {CloudEntry} from '../src/library-sync';

const nativeCode=encode({...defaults,cl_crosshair_length:12});
const favorite=(id:string,name:string,length=8):Saved=>({id,name,settings:{...defaults,cl_crosshair_length:length},alias:'',favorite:true,date:'2026-10-15T12:00:00.000Z'});

// These tests mock the account API. They verify browser behavior, not Steam or SQLite.
async function mockApi(page:Page,{signedIn=false,entries=[] as CloudEntry[]}={}){
  const state={signedIn,entries,revision:0,libraryReads:0,writes:[] as {revision:number;entries:CloudEntry[]}[],failWrites:false,failReads:false};
  await page.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    const send=(status:number,body:unknown)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(path==='/api/session')return send(200,state.signedIn?{user:{steamId:'76561198000000001'},csrfToken:'mock-csrf'}:{user:null});
    if(path==='/api/library'&&request.method()==='GET'){state.libraryReads++;if(state.failReads)return route.abort('failed');return send(200,{revision:state.revision,entries:state.entries});}
    if(path==='/api/library'&&request.method()==='PUT'){
      if(state.failWrites)return route.abort('failed');
      const body=request.postDataJSON() as {revision:number;entries:CloudEntry[]};
      expect(request.headers()['x-csrf-token']).toBe('mock-csrf');
      state.writes.push(body);state.entries=body.entries;state.revision++;
      return send(200,{revision:state.revision,entries:state.entries});
    }
    if(path==='/api/auth/logout'){state.signedIn=false;return send(200,{user:null});}
    return send(401,{error:'Mock account is signed out.'});
  });
  return state;
}

async function seedGuests(page:Page,entries:Saved[]){
  await page.addInitScript(entries=>localStorage.setItem('delli.v3.library',JSON.stringify(entries)),entries);
}

test.beforeEach(async({page})=>{
  await page.route('**/entrance.js*',route=>route.fulfill({contentType:'text/javascript',body:''}));
});

test('mock API: a signed-out session offers Steam sign-in without requiring an API key',async({page})=>{
  await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Library',exact:true}).click();
  const signIn=page.getByRole('link',{name:'Sign in with Steam',exact:true});await expect(signIn).toBeVisible();
  await expect(signIn).toHaveAttribute('href','/api/auth/steam?returnTo=%2F%3Fview%3Dlibrary');
  await expect(page.getByLabel(/API key/i)).toHaveCount(0);
});

test('mock API: native code paste applies immediately and invalid paste preserves settings',async({page})=>{
  await mockApi(page);await page.goto('/');
  const field=page.getByLabel('Crosshair code or config',{exact:true});
  await field.evaluate((node,code)=>{const event=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{getData:()=>code}});node.dispatchEvent(event);},nativeCode);
  await expect(page.getByLabel('Crosshair code or config',{exact:true})).toHaveAttribute('data-current-code',nativeCode!);
  await expect(page.getByRole('spinbutton',{name:'Length',exact:true})).toHaveValue('12');
  await field.evaluate(node=>{const event=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{getData:()=> 'CSinvalid'}});node.dispatchEvent(event);});
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Crosshair code or config',{exact:true})).toHaveAttribute('data-current-code',nativeCode!);
  await expect(page.getByRole('spinbutton',{name:'Length',exact:true})).toHaveValue('12');
});

test('mock API: delayed clipboard reads do not overwrite text typed afterward',async({page})=>{
  await mockApi(page);await page.goto('/');
  const field=page.getByLabel('Crosshair code or config',{exact:true});const before=await page.getByLabel('Crosshair code or config',{exact:true}).getAttribute('data-current-code');
  await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'readText',{configurable:true,value:()=>new Promise<string>(resolve=>Reflect.set(window,'resolveTestClipboard',resolve))}));
  if(await page.locator('.import-options').getAttribute('open')===null)await page.locator('.import-options > summary').click();await page.getByRole('button',{name:'Paste clipboard',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof Reflect.get(window,'resolveTestClipboard'))).toBe('function');
  await field.fill('My pending config draft');
  await page.evaluate(code=>Reflect.get(window,'resolveTestClipboard')(code),nativeCode);
  await expect(field).toHaveValue('My pending config draft');
  await expect(page.getByLabel('Crosshair code or config',{exact:true})).toHaveAttribute('data-current-code',before!);
});

test('mock API: Library selection is read-only and copying a favorite does not load it',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  const entry=favorite('guest-one','Player one',12);await seedGuests(page,[entry]);await mockApi(page);await page.goto('/');
  const applied=await page.getByLabel('Crosshair code or config',{exact:true}).getAttribute('data-current-code');
  await page.getByRole('button',{name:'Library',exact:true}).click();
  const library=page.getByRole('main',{name:'Crosshair library',exact:true});await expect(library).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await library.getByRole('button',{name:'Preview Player one',exact:true}).click();
  const selected=page.getByRole('region',{name:'Selected crosshair',exact:true});await expect(selected).toBeVisible();
  await expect(selected.getByRole('spinbutton')).toHaveCount(0);await expect(selected.getByRole('slider')).toHaveCount(0);
  const savedBefore=await page.evaluate(()=>localStorage.getItem('delli.v3.library'));
  await library.getByRole('button',{name:'Copy Player one',exact:true}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(encode(entry.settings));
  expect(await page.evaluate(()=>localStorage.getItem('delli.v3.library'))).toBe(savedBefore);
  await page.getByRole('button',{name:'Crosshair / Scopes',exact:true}).click();
  await expect(page.getByLabel('Crosshair code or config',{exact:true})).toHaveAttribute('data-current-code',applied!);
});

test('mock API: guest history stays separate from permanent favorites and the navigation count',async({page})=>{
  await seedGuests(page,[{...favorite('history','Imported history'),favorite:false}]);await mockApi(page);await page.goto('/');
  const nav=page.getByRole('button',{name:'Library',exact:true});await expect(nav).toContainText('0');await nav.click();
  await expect(page.getByRole('button',{name:'Preview Imported history',exact:true})).toHaveCount(0);
  await page.getByLabel('Library filter').selectOption('history');
  await expect(page.getByRole('button',{name:'Preview Imported history',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Favorite Imported history',exact:true}).click();await expect(nav).toContainText('1');
  await page.getByLabel('Library filter').selectOption('favorites');
  await expect(page.getByRole('button',{name:'Preview Imported history',exact:true})).toBeVisible();
});

test('mock API: updating a loaded favorite and saving as new preserve distinct records',async({page})=>{
  await seedGuests(page,[favorite('original','Original',8)]);await mockApi(page);await page.goto('/');
  await page.getByRole('button',{name:'Library',exact:true}).click();
  await page.getByRole('button',{name:'Load',exact:true}).click();
  const length=page.getByRole('spinbutton',{name:'Length',exact:true});await length.fill('10');await length.blur();
  if(await page.locator('.save-disclosure').getAttribute('open')===null)await page.locator('.save-disclosure > summary').click();await page.getByRole('button',{name:'Update saved crosshair',exact:true}).click();
  await length.fill('12');await length.blur();if(await page.locator('.save-disclosure').getAttribute('open')===null)await page.locator('.save-disclosure > summary').click();await page.getByLabel('Crosshair name',{exact:true}).fill('Separate copy');
  await page.getByRole('button',{name:'Save as new',exact:true}).click();
  const entries=await page.evaluate(()=>JSON.parse(localStorage.getItem('delli.v3.library')??'[]')) as Saved[];
  expect(entries.filter(item=>item.favorite)).toHaveLength(2);
  expect(entries.find(item=>item.name==='Original')?.settings.cl_crosshair_length).toBe(10);
  expect(entries.find(item=>item.name==='Separate copy')?.settings.cl_crosshair_length).toBe(12);
  expect(new Set(entries.map(item=>item.id)).size).toBe(2);
});

test('mock API: signing in does not silently merge guest favorites',async({page})=>{
  await seedGuests(page,[favorite('guest','Guest favorite')]);
  const api=await mockApi(page,{signedIn:true,entries:[favorite('remote','Remote favorite',12)]});await page.goto('/');
  await page.getByRole('button',{name:'Library',exact:true}).click();
  const merge=page.getByRole('button',{name:"Add this device's saved crosshairs",exact:true});await expect(merge).toBeVisible();
  expect(api.writes).toHaveLength(0);expect(api.entries.map(item=>item.name)).toEqual(['Remote favorite']);
  await merge.click();
  await expect.poll(()=>api.entries.map(item=>item.name).sort()).toEqual(['Guest favorite','Remote favorite']);
  expect(api.writes.length).toBeGreaterThan(0);
  expect(api.entries.every(item=>Object.keys(item).sort().join(',')==='id,name,settings')).toBeTruthy();
});

test('mock API: offline account saves remain pending and retry uploads them',async({page})=>{
  const api=await mockApi(page,{signedIn:true});await page.goto('/');
  await expect.poll(()=>api.libraryReads).toBeGreaterThan(0);api.failWrites=true;
  if(await page.locator('.save-disclosure').getAttribute('open')===null)await page.locator('.save-disclosure > summary').click();await page.getByLabel('Crosshair name',{exact:true}).fill('Pending favorite');
  await page.getByRole('button',{name:'Save to favorites',exact:true}).click();
  await page.getByRole('button',{name:'Library',exact:true}).click();
  await expect(page.getByLabel('Library sync status')).toContainText(/pending|waiting|offline|retry|unable|failed/i);
  expect(api.entries).toHaveLength(0);
  api.failWrites=false;await page.getByRole('button',{name:'Retry sync',exact:true}).click();
  await expect.poll(()=>api.entries.some(item=>item.name==='Pending favorite')).toBeTruthy();
  await expect(page.getByLabel('Library sync status')).not.toContainText(/pending|offline|failed/i);
});


test('mock API: first account save works while its initial library fetch is offline',async({page})=>{
  const api=await mockApi(page,{signedIn:true});api.failReads=true;await page.goto('/');
  await expect.poll(()=>api.libraryReads).toBeGreaterThan(0);
  if(await page.locator('.save-disclosure').getAttribute('open')===null)await page.locator('.save-disclosure > summary').click();await page.getByLabel('Crosshair name',{exact:true}).fill('First offline save');
  await page.getByRole('button',{name:'Save to favorites',exact:true}).click();
  await page.getByRole('button',{name:'Library',exact:true}).click();
  await expect(page.getByRole('button',{name:'Preview First offline save'})).toBeVisible();
  await expect(page.getByLabel('Library sync status')).toContainText('waiting to sync');
  api.failReads=false;await page.getByRole('button',{name:'Retry sync',exact:true}).click();
  await expect(page.getByLabel('Library sync status')).toHaveText('Synced');
  expect(api.entries.map(item=>item.name)).toEqual(['First offline save']);
});

test('mock API: a browser storage failure never reports a successful save',async({page})=>{
  await mockApi(page);await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='delli.v3.library')throw new DOMException('Storage is full','QuotaExceededError');return original.call(this,key,value);};});
  await page.goto('/');if(await page.locator('.save-disclosure').getAttribute('open')===null)await page.locator('.save-disclosure > summary').click();await page.getByLabel('Crosshair name',{exact:true}).fill('Unsaved favorite');
  await page.getByRole('button',{name:'Save to favorites',exact:true}).click();
  await expect(page.locator('.toast')).toContainText('could not be saved');
  await page.getByRole('button',{name:'Library',exact:true}).click();
  await expect(page.getByRole('button',{name:'Preview Unsaved favorite'})).toHaveCount(0);
});

test('manual sync shows progress, prevents duplicate clicks, and confirms completion',async({page})=>{
  await mockApi(page,{signedIn:true});await page.goto('/?view=library');await expect(page.getByLabel('Library sync status')).toHaveText('Synced');
  let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve);
  await page.route('**/api/library',async route=>{if(route.request().method()==='GET'){await held;await route.fulfill({json:{revision:0,entries:[]}});}else await route.fallback();});
  await page.getByRole('button',{name:'Sync now',exact:true}).click();
  await expect(page.getByRole('button',{name:'Syncing…',exact:true})).toBeDisabled();await expect(page.getByLabel('Library sync status')).toHaveText('Syncing your library…');
  release();await expect(page.locator('.toast')).toContainText('Library is up to date.');await expect(page.getByRole('button',{name:'Sync now',exact:true})).toBeEnabled();
});

test('mock API: resetting to current code cancels an outstanding clipboard paste',async({page})=>{
  await mockApi(page);await page.goto('/');
  const field=page.getByLabel('Crosshair code or config',{exact:true});
  const applied=await field.getAttribute('data-current-code');
  await field.fill('Pending config to discard');
  await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'readText',{configurable:true,value:()=>new Promise<string>(resolve=>Reflect.set(window,'resolveResetClipboard',resolve))}));
  await page.locator('.import-options > summary').click();
  await page.getByRole('button',{name:'Paste clipboard',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof Reflect.get(window,'resolveResetClipboard'))).toBe('function');
  await page.getByRole('button',{name:'Use current code',exact:true}).click();
  await expect(field).toHaveValue(applied!);
  await page.evaluate(code=>Reflect.get(window,'resolveResetClipboard')(code),nativeCode);
  await expect(field).toHaveValue(applied!);
  await expect(field).toHaveAttribute('data-current-code',applied!);
  await expect(page.getByRole('spinbutton',{name:'Length',exact:true})).toHaveValue(String(defaults.cl_crosshair_length));
  await expect(page.getByRole('button',{name:'Use current code',exact:true})).toBeDisabled();
});

test('mock API: a sync requested while another is running runs afterwards instead of being dropped',async({page})=>{
  const state=await mockApi(page,{signedIn:true});
  let held=false,release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
  // Hold the first library read so the account's initial sync is still in flight.
  await page.route('**/api/library',async route=>{
    if(route.request().method()==='GET'&&!held){held=true;await gate;}
    await route.fallback();
  });
  await page.goto('/?view=library');
  await expect.poll(()=>held).toBe(true);
  // Another tab saves a favorite to this account's queue while the sync is busy.
  const added:CloudEntry={id:'other-tab',name:'From another tab',settings:{...defaults,cl_crosshair_length:14}};
  await page.evaluate(entry=>{
    const key='delli.v3.steam-library.76561198000000001';
    localStorage.setItem(key,JSON.stringify({base:{revision:0,entries:[]},entries:[entry],history:[]}));
    window.dispatchEvent(new StorageEvent('storage',{key}));
  },added);
  release();
  await expect.poll(()=>state.writes.at(-1)?.entries.map(e=>e.id)).toEqual(['other-tab']);
  await expect(page.getByLabel('Library sync status')).toHaveText('Synced');
});
