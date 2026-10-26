import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.ts';
import {defaults} from '../src/model.ts';
import {createSqliteStore} from '../server/sqlite-store.ts';

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

test('PUT /api/library rate limit returns 429 with Retry-After after 120 syncs per owner',async()=>{
  let clock=Date.now();
  const now=()=>clock;
  const {request,close}=await startServer({now,fetch:async()=>new Response('is_valid:true\n')});
  try{
    const a=await login(request,'76561198000000012');
    assert.equal(a.response.status,302);
    const session=await (await request('/api/session',{headers:{Cookie:a.cookie}})).json();
    const headers={Cookie:a.cookie,Origin:'http://127.0.0.1:4181','X-CSRF-Token':session.csrfToken,'Content-Type':'application/json'};
    const put=(revision:number)=>request('/api/library',{method:'PUT',headers,body:JSON.stringify({revision,entries:[{id:'rate-id',name:'Rate',settings:defaults}]})});
    // Owner bucket is 120/hour. Spread syncs over a few minutes of one hourly window to stay under the 60/minute IP bucket.
    const hour=Math.floor(clock/3600000)*3600000;
    clock=hour+1000;
    for(let revision=0;revision<120;revision++){
      if(revision&&revision%50===0)clock+=61000;
      const response=await put(revision);
      assert.equal(response.status,200,{revision} as unknown as string);
      await response.json();
    }
    const limited=await put(120);
    assert.equal(limited.status,429);
    assert.equal(Number(limited.headers.get('retry-after')),Math.ceil((hour+3600000-clock)/1000));
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

test('sign-in limits are shared across instances and ignore spoofed forwarding headers',async()=>{
  const t0=Date.now(),now=()=>t0,shared=createSqliteStore(':memory:'),store={...shared,close(){}};
  // Two handlers on one store stand in for two serverless instances.
  const a=await startServer({now,store}),b=await startServer({now,store});
  try{
    for(let i=0;i<60;i++){
      const response=await (i%2?a:b).request('/api/auth/steam',{headers:{'X-Forwarded-For':`203.0.113.${i}`}});
      assert.equal(response.status,302);
    }
    assert.equal((await a.request('/api/auth/steam',{headers:{'X-Forwarded-For':'198.51.100.1'}})).status,429);
  }finally{await a.close();await b.close();shared.close();}
});

test('trusted proxies key sign-in limits on the forwarded client address',async()=>{
  const t0=Date.now();
  const {request,close}=await startServer({now:()=>t0,trustProxy:true});
  try{
    for(let i=0;i<60;i++)assert.equal((await request('/api/auth/steam',{headers:{'X-Forwarded-For':'203.0.113.7, 10.0.0.1'}})).status,302);
    assert.equal((await request('/api/auth/steam',{headers:{'X-Forwarded-For':'203.0.113.7'}})).status,429);
    assert.equal((await request('/api/auth/steam',{headers:{'X-Forwarded-For':'203.0.113.8'}})).status,302);
  }finally{await close();}
});

test('a failing rate-limit store does not lock users out',async()=>{
  const store=createSqliteStore(':memory:');
  store.hit=async()=>{throw Error('database unavailable');};
  const {request,close}=await startServer({store});
  try{assert.equal((await request('/api/auth/steam')).status,302);}finally{await close();}
});
