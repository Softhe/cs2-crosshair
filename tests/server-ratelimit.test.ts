import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.ts';
import {defaults} from '../src/model.ts';

async function startServer(options:Parameters<typeof createApp>[0]={}){
  const server=createApp({databasePath:':memory:',...options});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address() as {port:number};
  const base=`http://127.0.0.1:${address.port}`;
  const request=(path:string,init:RequestInit={})=>fetch(base+path,{...init,redirect:'manual'});
  const close=()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  return {request,close};
}

async function login(request:(path:string,init?:RequestInit)=>Promise<Response>,steamId:string){
  const start=await request('/api/auth/steam');
  assert.equal(start.status,302);
  const redirect=new URL(start.headers.get('location')!);
  const returnTo=redirect.searchParams.get('openid.return_to')!;
  const callback=new URL(returnTo);
  const params=callback.searchParams;
  const identity=`https://steamcommunity.com/openid/id/${steamId}`;
  for(const [key,value] of Object.entries({ns:'http://specs.openid.net/auth/2.0',mode:'id_res',op_endpoint:'https://steamcommunity.com/openid/login',identity,claimed_id:identity,return_to:returnTo,response_nonce:new Date().toISOString().replace(/\.\d{3}Z$/,'Z')+Math.random(),assoc_handle:'test',signed:'op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',sig:'test'}))params.set('openid.'+key,value);
  const response=await request(callback.pathname+callback.search,{headers:{Cookie:start.headers.getSetCookie()[0]!.split(';')[0]!}});
  const cookie=response.headers.getSetCookie().find(value=>value.startsWith('delli_session='))?.split(';')[0]??'';
  return {response,cookie};
}

test('GET /api/library with session cookie alone returns 200 without CSRF',async()=>{
  const {request,close}=await startServer({fetch:async()=>new Response('is_valid:true\n')});
  try{
    const a=await login(request,'76561198000000011');
    assert.equal(a.response.status,302);
    assert.ok(a.cookie);
    // No X-CSRF-Token, no Origin — safe-method GETs skip the CSRF check.
    const response=await request('/api/library',{headers:{Cookie:a.cookie}});
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{revision:0,entries:[]});
    // Negative control: unsafe PUT without CSRF is still rejected.
    const denied=await request('/api/library',{method:'PUT',headers:{Cookie:a.cookie,'Content-Type':'application/json'},body:'{}'});
    assert.equal(denied.status,403);
  }finally{await close();}
});

test('PUT /api/library rate limit returns 429 after 30 syncs per owner',async()=>{
  const t0=Date.now();
  const now=()=>t0; // frozen clock: all hits land in the same hourly window
  const {request,close}=await startServer({now,fetch:async()=>new Response('is_valid:true\n')});
  try{
    const a=await login(request,'76561198000000012');
    assert.equal(a.response.status,302);
    const session=await (await request('/api/session',{headers:{Cookie:a.cookie}})).json();
    const headers={Cookie:a.cookie,Origin:'http://127.0.0.1:4181','X-CSRF-Token':session.csrfToken,'Content-Type':'application/json'};
    const put=(revision:number)=>request('/api/library',{method:'PUT',headers,body:JSON.stringify({revision,entries:[{id:'rate-id',name:'Rate',settings:defaults}]})});
    // Owner bucket is 30/hour, so the first 30 syncs succeed.
    for(let revision=0;revision<30;revision++){
      const response=await put(revision);
      assert.equal(response.status,200,{revision} as unknown as string);
      await response.json();
    }
    const limited=await put(30);
    assert.equal(limited.status,429);
    assert.match((await limited.json() as {error:string}).error,/Too many sync attempts/);
  }finally{await close();}
});

test('GET /api/auth/steam rate limit returns 429 after 60 sign-ins per minute',async()=>{
  const t0=Date.now();
  const now=()=>t0; // frozen clock: all hits land in the same minute window
  const {request,close}=await startServer({now});
  try{
    for(let i=0;i<60;i++){
      const response=await request('/api/auth/steam');
      assert.equal(response.status,302);
      await response.text().catch(()=>{});
    }
    const limited=await request('/api/auth/steam');
    assert.equal(limited.status,429);
    assert.match((await limited.json() as {error:string}).error,/Too many sign-in attempts/);
  }finally{await close();}
});
