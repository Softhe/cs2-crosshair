import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanupPreviewFixtures} from '../scripts/preview-cleanup.ts';

test('hosted cleanup removes remaining fixtures and closes storage despite multiple failures',async()=>{
  const remaining={sessions:new Set(['session-one','session-two']),states:new Set(['state-one','state-two']),libraries:new Set(['owner-one','owner-two'])};
  let browserClosed=false,storeCloseAttempted=false;
  const secret='postgres://private-credential@example.invalid/database';
  const failures=await cleanupPreviewFixtures({
    sessions:[...remaining.sessions],states:[...remaining.states],owners:[...remaining.libraries],
    closeBrowser:async()=>{browserClosed=true;throw Error(secret);},
    deleteSession:async id=>{if(id==='session-one')throw Error(secret);remaining.sessions.delete(id);},
    deleteState:async id=>{if(id==='state-one')throw Error(secret);remaining.states.delete(id);},
    deleteLibrary:async owner=>{if(owner==='owner-one')throw Error(secret);remaining.libraries.delete(owner);},
    closeStore:()=>{storeCloseAttempted=true;throw Error(secret);},
  });
  assert.equal(browserClosed,true);assert.equal(storeCloseAttempted,true);
  assert.deepEqual([...remaining.sessions],['session-one']);
  assert.deepEqual([...remaining.states],['state-one']);
  assert.deepEqual([...remaining.libraries],['owner-one']);
  assert.equal(failures.length,5);
  const report=new AggregateError(failures,'Fixture cleanup failed.');
  assert.match(report.errors.map((error:Error)=>error.message).join('\n'),/session 1 removal/);
  assert.match(report.errors.map((error:Error)=>error.message).join('\n'),/store close/);
  assert.doesNotMatch(report.errors.map((error:Error)=>String(error)).join('\n'),/private-credential|session-one|state-one|owner-one/);
});

test('hosted cleanup succeeds with partial setup and no fixture identities',async()=>{
  let browserClosed=false,storeClosed=false;
  const failures=await cleanupPreviewFixtures({
    sessions:[],states:[],owners:[],
    closeBrowser:()=>{browserClosed=true;},closeStore:()=>{storeClosed=true;},
    deleteSession:()=>assert.fail('No session was created.'),
    deleteState:()=>assert.fail('No auth state was created.'),
    deleteLibrary:()=>assert.fail('No fixture owner was claimed.'),
  });
  assert.deepEqual(failures,[]);assert.equal(browserClosed,true);assert.equal(storeClosed,true);
});
