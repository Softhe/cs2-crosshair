import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer,type IncomingMessage} from 'node:http';
import {createHash} from 'node:crypto';
import {createNeonStore,migrateDatabase,schema,type Query} from '../server/neon-store.ts';
import {createSqliteStore} from '../server/sqlite-store.ts';
import {createHandler} from '../server/app.ts';

test('Neon queries parameterize identities, use shared atomic replay records and revision comparisons',async()=>{
  const calls:{text:string;params:unknown[]}[]=[];let rows:Record<string,unknown>[]=[];
  const query:Query=async(text,params=[])=>{calls.push({text,params});return rows;};
  const store=await createNeonStore('unused-test-url',query);
  const hostile="owner'; DELETE FROM sessions; --";
  await store.addState(hostile,123);assert.equal(calls.at(-1)!.params[0],hostile);assert.ok(!calls.at(-1)!.text.includes(hostile));
  rows=[{id:'state'}];assert.equal(await store.consumeState('state',100),true);assert.match(calls.at(-1)!.text,/DELETE FROM states.*expires>\$2 RETURNING id/);
  rows=[];assert.equal(await store.consumeState('state',100),false);
  assert.equal(await store.addNonce('nonce',200),false);assert.match(calls.at(-1)!.text,/ON CONFLICT\(nonce\) DO NOTHING RETURNING nonce/);
  rows=[{nonce:'nonce'}];assert.equal(await store.addNonce('nonce',200),true);
  rows=[{id:'hashed-id',owner:'steam-id',csrf:'token',expires:'12345'}];assert.equal((await store.session('hashed-id',100))?.expires,12345);
  assert.deepEqual(calls.at(-1)!.params,['hashed-id',100]);
  rows=[];assert.deepEqual(await store.latest(hostile),{revision:0,entries:[]});
  rows=[{revision:'1',entries:[{id:'stable'}]}];assert.deepEqual(await store.save(hostile,0,[{id:'stable'}]),{revision:1,entries:[{id:'stable'}]});assert.match(calls.at(-1)!.text,/ON CONFLICT\(owner\) DO NOTHING RETURNING/);
  assert.deepEqual(calls.at(-1)!.params,[hostile,'[{"id":"stable"}]']);
  rows=[];assert.equal(await store.save(hostile,1,[]),null);assert.match(calls.at(-1)!.text,/WHERE owner=\$1 AND revision=\$2 RETURNING/);assert.deepEqual(calls.at(-1)!.params,[hostile,1,'[]']);
  await store.cleanup(1000);assert.deepEqual(calls.at(-1)!.params,[1000]);
  await migrateDatabase('unused-test-url',query);assert.deepEqual(calls.slice(-schema.length).map(c=>c.text),schema);assert.ok(schema.some(s=>s.includes('JSONB')));assert.ok(schema.some(s=>s.includes('expires BIGINT')));
});

test('SQLite adapter persists account data and atomic revisions across independent connections',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'crosshair-store-')),file=join(dir,'library.sqlite');
  const a=createSqliteStore(file),b=createSqliteStore(file);
  try{
    await a.addState('hashed-state',1000);assert.equal(await b.consumeState('hashed-state',1),true);assert.equal(await a.consumeState('hashed-state',1),false);
    assert.equal(await a.addNonce('nonce',1000),true);assert.equal(await b.addNonce('nonce',1000),false);
    await a.addSession({id:'hashed-token',owner:'account-a',csrf:'csrf',expires:1000});assert.equal((await b.session('hashed-token',1))?.owner,'account-a');
    const results=await Promise.all([a.save('account-a',0,[{id:'a'}]),b.save('account-a',0,[{id:'b'}])]);assert.equal(results.filter(Boolean).length,1);
    assert.equal((await b.latest('account-a')).revision,1);assert.deepEqual(await a.latest('account-b'),{revision:0,entries:[]});
    const updates=await Promise.all([a.save('account-a',1,[{id:'updated-a'}]),b.save('account-a',1,[{id:'updated-b'}])]);assert.equal(updates.filter(Boolean).length,1);assert.equal((await a.latest('account-a')).revision,2);
    await b.deleteSession('hashed-token');assert.equal(await a.session('hashed-token',1),undefined);
  }finally{a.close();b.close();rmSync(dir,{recursive:true,force:true});}
});

test('production refuses ephemeral fallback and requires an explicit HTTPS origin',()=>{
  const previous={NODE_ENV:process.env.NODE_ENV,DATABASE_URL:process.env.DATABASE_URL,PUBLIC_ORIGIN:process.env.PUBLIC_ORIGIN};
  try{process.env.NODE_ENV='production';delete process.env.DATABASE_URL;delete process.env.PUBLIC_ORIGIN;
    assert.throws(()=>createHandler(),/DATABASE_URL/);
    assert.throws(()=>createHandler({databaseUrl:'unused-test-url'}),/explicit HTTPS/);
    assert.throws(()=>createHandler({databaseUrl:'unused-test-url',origin:'http://example.com'}),/explicit HTTPS/);
    assert.equal(typeof createHandler({databaseUrl:'unused-test-url',origin:'https://example.com'}),'function');
  }finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test('Node handler accepts Vercel parsed JSON and redacts database failures',async()=>{
  const store=createSqliteStore(':memory:');const id='opaque-session',csrf='test-csrf';
  let t=Date.now();
  await store.addSession({id:createHash('sha256').update(id).digest('hex'),owner:'account-a',csrf,expires:t+3600000});
  const handler=createHandler({store,now:()=>t});
  const server=createServer((req,res)=>{if(req.method==='PUT')(req as IncomingMessage&{body:unknown}).body={revision:0,entries:[]};void handler(req,res);});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  try{
    const response=await fetch(base+'/api/library',{method:'PUT',headers:{Cookie:`delli_session=${id}`,Origin:'http://127.0.0.1:4181','X-CSRF-Token':csrf,'Content-Type':'application/json'}});assert.equal(response.status,200);assert.deepEqual(await response.json(),{revision:1,entries:[]});
    t+=6*60*1000;
    store.cleanup=async()=>{throw Error('postgres://sensitive-user:secret-password@private-host/database');};
    const failure=await fetch(base+'/api/session');assert.equal(failure.status,400);assert.ok(!(await failure.text()).includes('secret-password'));
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await handler.close();}
});
