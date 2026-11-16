import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {createHandler} from '../server/app.ts';
import {createSqliteStore} from '../server/sqlite-store.ts';
import {createNeonStore,type Query} from '../server/neon-store.ts';

const DAY=86400000,origin='http://127.0.0.1:4181';
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');

async function start(t:{now:number}){
  const store=createSqliteStore(':memory:');
  const handler=createHandler({store,now:()=>t.now});
  const server=createServer(handler);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  const close=async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));await handler.close();};
  return {store,base,close};
}

test('SQLite keeps only the newest sessions per account when a cap is given',async()=>{
  const store=createSqliteStore(':memory:');
  for(let i=0;i<12;i++)await store.addSession({id:'s'+i,owner:'a',csrf:'c',expires:1000+i},10);
  await store.addSession({id:'b',owner:'b',csrf:'c',expires:1},10);
  for(let i=0;i<12;i++)assert.equal(!!(await store.session('s'+i,0)),i>=2,'s'+i);
  assert.ok(await store.session('b',0));
  await store.addSession({id:'uncapped',owner:'a',csrf:'c',expires:5000});
  assert.ok(await store.session('s2',0));
  store.close();
});

test('Neon session queries are parameterized and prune after the insert',async()=>{
  const calls:{text:string;params:unknown[]}[]=[];
  const query:Query=async(text,params=[])=>{calls.push({text,params});return [];};
  const store=await createNeonStore('unused-test-url',query);
  const hostile="owner'; DELETE FROM sessions; --";
  await store.addSession({id:'id',owner:hostile,csrf:'c',expires:9},10);
  assert.match(calls.at(-2)!.text,/^INSERT INTO sessions/);assert.deepEqual(calls.at(-2)!.params,['id',hostile,'c',9]);
  assert.match(calls.at(-1)!.text,/^DELETE FROM sessions WHERE owner=\$1 AND id NOT IN .*LIMIT \$2\)$/);
  assert.deepEqual(calls.at(-1)!.params,[hostile,10]);assert.ok(!calls.at(-1)!.text.includes(hostile));
  const before=calls.length;await store.addSession({id:'id',owner:'o',csrf:'c',expires:9});assert.equal(calls.length,before+1);assert.match(calls.at(-1)!.text,/^INSERT/);
  await store.renewSession('id',99);assert.deepEqual(calls.at(-1)!.params,['id',99]);
  await store.deleteSessions(hostile);assert.deepEqual(calls.at(-1)!.params,[hostile]);assert.ok(!calls.at(-1)!.text.includes(hostile));
});

test('a session used with under 15 days left is renewed to 30 days',async()=>{
  const t={now:Date.now()};const {store,base,close}=await start(t);
  try{
    await store.addSession({id:hash('fresh'),owner:'a',csrf:'c',expires:t.now+20*DAY});
    await store.addSession({id:hash('aging'),owner:'a',csrf:'c',expires:t.now+10*DAY});
    const fresh=await fetch(base+'/api/session',{headers:{Cookie:'delli_session=fresh'}});
    assert.equal(fresh.headers.get('set-cookie'),null);
    assert.equal((await store.session(hash('fresh'),t.now))?.expires,t.now+20*DAY);
    const aging=await fetch(base+'/api/library',{headers:{Cookie:'delli_session=aging'}});
    assert.equal(aging.status,200);
    assert.match(aging.headers.get('set-cookie')??'',/^delli_session=aging; .*Max-Age=2592000/);
    assert.equal((await store.session(hash('aging'),t.now))?.expires,t.now+30*DAY);
    t.now+=29*DAY;assert.equal((await (await fetch(base+'/api/session',{headers:{Cookie:'delli_session=aging'}})).json()).user.steamId,'a');
  }finally{await close();}
});

test('sign-out with scope=all ends every session of the account and no other',async()=>{
  const t={now:Date.now()};const {store,base,close}=await start(t);
  try{
    for(const [id,owner] of [['phone','a'],['desktop','a'],['someone','b']])await store.addSession({id:hash(id!),owner:owner!,csrf:id+'-csrf',expires:t.now+30*DAY});
    const single=await fetch(base+'/api/auth/logout',{method:'POST',headers:{Cookie:'delli_session=phone',Origin:origin,'X-CSRF-Token':'phone-csrf'}});
    assert.equal(single.status,200);assert.equal(await store.session(hash('phone'),t.now),undefined);assert.ok(await store.session(hash('desktop'),t.now));
    await store.addSession({id:hash('phone'),owner:'a',csrf:'phone-csrf',expires:t.now+30*DAY});
    const all=await fetch(base+'/api/auth/logout?scope=all',{method:'POST',headers:{Cookie:'delli_session=phone',Origin:origin,'X-CSRF-Token':'phone-csrf'}});
    assert.equal(all.status,200);assert.match(all.headers.get('set-cookie')??'',/^delli_session=; .*Max-Age=0/);
    assert.equal(await store.session(hash('phone'),t.now),undefined);assert.equal(await store.session(hash('desktop'),t.now),undefined);
    assert.ok(await store.session(hash('someone'),t.now));
    const forged=await fetch(base+'/api/auth/logout?scope=all',{method:'POST',headers:{Cookie:'delli_session=someone',Origin:'https://attacker.invalid','X-CSRF-Token':'someone-csrf'}});
    assert.equal(forged.status,403);assert.ok(await store.session(hash('someone'),t.now));
  }finally{await close();}
});
