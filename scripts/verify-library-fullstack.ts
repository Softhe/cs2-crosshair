
import {createApp} from '../server/app.ts';
import {chromium,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
mkdirSync('test-results',{recursive:true});
const origin='http://127.0.0.1:4191';
// This integration uses the real HTTP/session/database API and a simulated Steam verifier.
// It does not claim authentication of a real Steam account.
const server=createApp({origin,databasePath:':memory:',fetch:async()=>new Response('is_valid:true\n',{status:200})});
await new Promise<void>(resolve=>server.listen(4191,'127.0.0.1',resolve));
const browser=await chromium.launch();
try{
  async function account(id:string){const context=await browser.newContext();const redirect=await context.request.get(origin+'/api/auth/steam',{maxRedirects:0});const target=new URL(redirect.headers().location!);const callback=new URL(target.searchParams.get('openid.return_to')!);const identity='https://steamcommunity.com/openid/id/'+id;for(const [key,value] of Object.entries({ns:'http://specs.openid.net/auth/2.0',mode:'id_res',op_endpoint:'https://steamcommunity.com/openid/login',claimed_id:identity,identity,return_to:callback.href,response_nonce:new Date().toISOString().slice(0,19)+'Z'+randomUUID(),assoc_handle:'fixture',signed:'op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',sig:'fixture'}))callback.searchParams.set('openid.'+key,value);const response=await context.request.get(callback.href,{maxRedirects:0});expect(response.status()).toBe(302);return context;}
  async function library(context:any){const session=await context.request.get(origin+'/api/session').then((r:any)=>r.json());return context.request.get(origin+'/api/library',{headers:{'X-CSRF-Token':session.csrfToken}}).then((r:any)=>r.json());}
  const a=await account('76561198000000001'),b=await account('76561198000000001'),other=await account('76561198000000002');
  const p=await a.newPage();await p.goto(origin,{waitUntil:'networkidle'});await p.waitForFunction(()=>!document.getElementById('root')!.inert);await p.getByRole('textbox',{name:'Crosshair name',exact:true}).fill('Match cyan');await p.getByRole('button',{name:'Save to favorites',exact:true}).click();await p.getByRole('button',{name:'Library',exact:true}).click();await expect(p.getByLabel('Library sync status')).toHaveText('Synced');
  const q=await b.newPage();await q.goto(origin,{waitUntil:'networkidle'});await q.waitForFunction(()=>!document.getElementById('root')!.inert);await q.getByRole('button',{name:'Library',exact:true}).click();await expect(q.getByRole('button',{name:'Preview Match cyan',exact:true})).toBeVisible();
  await q.getByRole('button',{name:'Load',exact:true}).click();const length=q.getByRole('spinbutton',{name:'Length',exact:true});await length.fill('12');await length.blur();await q.getByRole('button',{name:'Update saved crosshair'}).click();await q.getByRole('button',{name:'Library',exact:true}).click();await expect(q.getByLabel('Library sync status')).toHaveText('Synced');await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(p.getByLabel('Selected crosshair code')).toHaveValue(await q.getByLabel('Selected crosshair code').inputValue());
  expect((await library(other)).entries).toHaveLength(0);
  await q.route('**/api/library',route=>route.abort());await q.getByRole('button',{name:'Load',exact:true}).click();await q.getByRole('spinbutton',{name:'Length',exact:true}).fill('16');await q.getByRole('spinbutton',{name:'Length',exact:true}).blur();await q.getByRole('textbox',{name:'Crosshair name',exact:true}).fill('Offline variant');await q.getByRole('button',{name:'Save as new'}).click();await q.getByRole('button',{name:'Library',exact:true}).click();await expect(q.getByLabel('Library sync status')).toContainText('waiting to sync');await expect(q.getByRole('button',{name:'Preview Offline variant'})).toBeVisible();await q.unroute('**/api/library');await q.getByRole('button',{name:'Retry sync'}).click();await expect(q.getByLabel('Library sync status')).toHaveText('Synced');expect((await library(b)).entries).toHaveLength(2);
  await q.screenshot({path:'test-results/library-fullstack.png',fullPage:true});console.log('Real HTTP backend integration PASS: two browser contexts share favorites, updates refresh, other account isolated, offline queue retries. Steam verifier was simulated.');
}finally{await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
