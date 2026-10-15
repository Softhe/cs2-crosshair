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
  await expect(signIn).toHaveAttribute('href','/api/auth/steam');
  await expect(page.getByLabel(/API key/i)).toHaveCount(0);
});

test('mock API: native code paste applies immediately and invalid paste preserves settings',async({page})=>{
  await mockApi(page);await page.goto('/');
  const field=page.getByLabel('Crosshair code or config',{exact:true});
  await field.evaluate((node,code)=>{const event=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{getData:()=>code}});node.dispatchEvent(event);},nativeCode);
  await expect(page.getByLabel('Current CS2 share code')).toHaveValue(nativeCode);
  await expect(page.getByRole('spinbutton',{name:'Length',exact:true})).toHaveValue('12');
  await field.evaluate(node=>{const event=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{getData:()=> 'CSinvalid'}});node.dispatchEvent(event);});
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Current CS2 share code')).toHaveValue(nativeCode);
  await expect(page.getByRole('spinbutton',{name:'Length',exact:true})).toHaveValue('12');
});

test('mock API: delayed clipboard reads do not overwrite text typed afterward',async({page})=>{
  await mockApi(page);await page.goto('/');
  const field=page.getByLabel('Crosshair code or config',{exact:true});const before=await page.getByLabel('Current CS2 share code').inputValue();
  await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'readText',{configurable:true,value:()=>new Promise<string>(resolve=>Reflect.set(window,'resolveTestClipboard',resolve))}));
  await page.getByRole('button',{name:'Paste clipboard',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof Reflect.get(window,'resolveTestClipboard'))).toBe('function');
  await field.fill('My pending config draft');
  await page.evaluate(code=>Reflect.get(window,'resolveTestClipboard')(code),nativeCode);
  await expect(field).toHaveValue('My pending config draft');
  await expect(page.getByLabel('Current CS2 share code')).toHaveValue(before);
});

test('mock API: Library selection is read-only and copying a favorite does not load it',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  const entry=favorite('guest-one','Player one',12);await seedGuests(page,[entry]);await mockApi(page);await page.goto('/');
  const applied=await page.getByLabel('Current CS2 share code').inputValue();
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
  await expect(page.getByLabel('Current CS2 share code')).toHaveValue(applied);
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
  await page.getByRole('button',{name:'Update saved crosshair',exact:true}).click();
  await length.fill('12');await length.blur();await page.getByLabel('Crosshair name',{exact:true}).fill('Separate copy');
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
  await page.getByLabel('Crosshair name',{exact:true}).fill('Pending favorite');
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
  await page.getByLabel('Crosshair name',{exact:true}).fill('First offline save');
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
  await page.goto('/');await page.getByLabel('Crosshair name',{exact:true}).fill('Unsaved favorite');
  await page.getByRole('button',{name:'Save to favorites',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('could not be saved');
  await page.getByRole('button',{name:'Library',exact:true}).click();
  await expect(page.getByRole('button',{name:'Preview Unsaved favorite'})).toHaveCount(0);
});
