import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.ts';
import {defaults} from '../src/model.ts';

test('Steam verification, private favorites, conflict, CSRF, validation and logout',async()=>{
  let accepted=true,verificationCalls=0;
  const server=createApp({databasePath:':memory:',fetch:async()=>{verificationCalls++;return new Response(`is_valid:${accepted}\n`);} });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address() as {port:number};const base=`http://127.0.0.1:${address.port}`;
  const request=(path:string,init:RequestInit={})=>fetch(base+path,{...init,redirect:'manual'});
  async function login(steamId:string,change?:(params:URLSearchParams)=>void){
    const start=await request('/api/auth/steam');const redirect=new URL(start.headers.get('location')!);const returnTo=redirect.searchParams.get('openid.return_to')!;const callback=new URL(returnTo);const params=callback.searchParams;
    const identity=`https://steamcommunity.com/openid/id/${steamId}`;
    for(const [key,value] of Object.entries({ns:'http://specs.openid.net/auth/2.0',mode:'id_res',op_endpoint:'https://steamcommunity.com/openid/login',identity,claimed_id:identity,return_to:returnTo,response_nonce:new Date().toISOString().replace(/\.\d{3}Z$/,'Z')+Math.random(),assoc_handle:'test',signed:'op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',sig:'test'}))params.set('openid.'+key,value);
    change?.(params);
    const response=await request(callback.pathname+callback.search,{headers:{Cookie:start.headers.getSetCookie()[0]!.split(';')[0]!}});
    return {response,cookie:response.headers.getSetCookie().find(value=>value.startsWith('delli_session='))?.split(';')[0]??''};
  }
  try{
    assert.deepEqual(await (await request('/api/session')).json(),{user:null});assert.equal((await request('/api/library')).status,401);
    const browserFailure=await request('/api/auth/steam/callback',{headers:{Accept:'text/html'}});assert.equal(browserFailure.status,302);assert.equal(browserFailure.headers.get('location'),'/?view=library&steam=failed');
    assert.equal((await login('76561198000000001',p=>p.set('openid.op_endpoint','https://attacker.invalid'))).response.status,400);assert.equal(verificationCalls,0);
    assert.equal((await login('76561198000000001',p=>p.set('openid.signed','identity'))).response.status,400);
    assert.equal((await login('76561198000000001',p=>p.set('openid.return_to','https://attacker.invalid'))).response.status,400);
    assert.equal((await login('76561198000000001',p=>p.set('openid.response_nonce','2000-01-01T00:00:00Zold'))).response.status,400);
    assert.equal((await login('76561198000000001',p=>p.set('state','wrong'))).response.status,400);
    const repeatedNonce=new Date().toISOString().replace(/\.\d{3}Z$/,'Z')+'replay';
    assert.equal((await login('76561198000000003',p=>p.set('openid.response_nonce',repeatedNonce))).response.status,302);
    assert.equal((await login('76561198000000003',p=>p.set('openid.response_nonce',repeatedNonce))).response.status,400);
    accepted=false;assert.equal((await login('76561198000000001')).response.status,400);accepted=true;
    const a=await login('76561198000000001'),b=await login('76561198000000002');assert.equal(a.response.status,302);assert.equal(a.response.headers.get('location'),'/?view=library');assert.ok(a.cookie);
    const session=await (await request('/api/session',{headers:{Cookie:a.cookie}})).json();assert.equal(session.user.steamId,'76561198000000001');
    const headers={Cookie:a.cookie,Origin:'http://127.0.0.1:4181','X-CSRF-Token':session.csrfToken,'Content-Type':'application/json'};
    const entry={id:'stable-id',name:'Green',settings:defaults,alias:'private_local_alias',favorite:true,date:new Date().toISOString()};
    const put=(revision:number,entries:unknown[])=>request('/api/library',{method:'PUT',headers,body:JSON.stringify({revision,entries})});
    assert.equal((await request('/api/library',{method:'PUT',headers:{...headers,Origin:'https://attacker.invalid'},body:'{}'})).status,403);
    assert.equal((await request('/api/library',{method:'PUT',headers:{...headers,'X-CSRF-Token':'wrong'},body:'{}'})).status,403);
    const saved=await (await put(0,[entry])).json();assert.equal(saved.revision,1);assert.equal(saved.entries[0].id,entry.id);assert.deepEqual(Object.keys(saved.entries[0]).sort(),['id','name','settings']);
    const bSession=await (await request('/api/session',{headers:{Cookie:b.cookie}})).json();
    assert.deepEqual(await (await request('/api/library',{headers:{Cookie:b.cookie,'X-CSRF-Token':session.csrfToken}})).json(),{revision:0,entries:[]});
    assert.deepEqual(await (await request('/api/library',{headers:{Cookie:b.cookie}})).json(),{revision:0,entries:[]});
    assert.deepEqual(await (await request('/api/library',{headers:{Cookie:b.cookie,'X-CSRF-Token':bSession.csrfToken}})).json(),{revision:0,entries:[]});
    const conflict=await put(0,[]);assert.equal(conflict.status,409);assert.deepEqual(await conflict.json(),saved);
    assert.equal((await put(1,[{...entry,name:'x'.repeat(81)}])).status,400);assert.equal((await put(1,[{...entry,settings:{cl_crosshair_length:999}}])).status,400);
    assert.equal((await put(1,[entry,entry])).status,400);assert.equal((await put(1,[{...entry,favorite:false}])).status,400);
    assert.equal((await put(1,Array.from({length:51},(_,i)=>({...entry,id:'id'+i})))).status,400);
    assert.equal((await request('/api/auth/logout',{method:'POST',headers})).status,200);assert.deepEqual(await (await request('/api/session',{headers:{Cookie:a.cookie}})).json(),{user:null});assert.equal((await request('/api/library',{headers:{Cookie:a.cookie}})).status,401);
    const again=await login('76561198000000001');
    const againSession=await (await request('/api/session',{headers:{Cookie:again.cookie}})).json();
    assert.deepEqual(await (await request('/api/library',{headers:{Cookie:again.cookie,'X-CSRF-Token':againSession.csrfToken}})).json(),saved);
    const minimal=await request('/api/library',{method:'PUT',headers:{...headers,Cookie:again.cookie,'X-CSRF-Token':againSession.csrfToken},body:JSON.stringify({revision:1,entries:[{id:'minimal-id',name:'Minimal',settings:defaults}]})});assert.equal(minimal.status,200);
  }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
