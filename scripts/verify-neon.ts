import {createNeonStore} from '../server/neon-store.ts';
import {neon} from '@neondatabase/serverless';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const url=process.env.DATABASE_URL;if(!url)throw Error('DATABASE_URL is required.');
const prefix='verification-'+randomUUID(),owner=prefix+'-owner',other=prefix+'-other';
const sql=neon(url);const a=await createNeonStore(url),b=await createNeonStore(url);
try{
  const first=await Promise.all([a.save(owner,0,[{id:'a',name:'First fixture',settings:{}}]),b.save(owner,0,[{id:'b',name:'Second fixture',settings:{}}])]);assert.equal(first.filter(Boolean).length,1);assert.equal((await b.latest(owner)).revision,1);assert.equal(await b.save(owner,0,[]),null);assert.deepEqual(await b.latest(other),{revision:0,entries:[]});
  await a.addState(prefix,Date.now()+60000);assert.equal(await b.consumeState(prefix,Date.now()),true);assert.equal(await a.consumeState(prefix,Date.now()),false);
  assert.equal(await a.addNonce(prefix,Date.now()+60000),true);assert.equal(await b.addNonce(prefix,Date.now()+60000),false);
  await a.addSession({id:prefix,owner,csrf:'fixture',expires:Date.now()+60000});assert.equal((await b.session(prefix,Date.now()))?.owner,owner);await b.deleteSession(prefix);assert.equal(await a.session(prefix,Date.now()),undefined);
  console.log('Real Neon verification PASS: cross-connection persistence, atomic first-save conflict, stale revision rejection, owner isolation, one-time state/nonce, shared sessions.');
}finally{
  // These rows belong exclusively to this verification run, never to a Steam account.
  await sql.query('DELETE FROM libraries WHERE owner=$1 OR owner=$2',[owner,other]);await sql.query('DELETE FROM sessions WHERE id=$1',[prefix]);await sql.query('DELETE FROM states WHERE id=$1',[prefix]);await sql.query('DELETE FROM nonces WHERE nonce=$1',[prefix]);a.close();b.close();
}
