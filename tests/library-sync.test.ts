import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../src/model';
import {settingsKey,validateLibrary,type Saved} from '../src/storage';
import {cloudFavorites,hasUnmergedGuestFavorites,persistGuest,LibraryStorageError,syncErrorMessage,mergeConflict,mergeGuestFavorites,persistQueue,queueKey,validateSnapshot,type CloudEntry} from '../src/library-sync';
const item=(id:string,name=id,length=8):CloudEntry=>({id,name,settings:{...defaults,cl_crosshair_length:length}});
const account='76561198000000001';
test('library validation preserves IDs and migrates legacy entries',()=>{
 const entry={...item('stable'),favorite:true,alias:'',date:'2026-10-15'};
 assert.equal(validateLibrary([entry])[0]!.id,'stable');
 const migrated=validateLibrary([{...entry,id:undefined}])[0]!;assert.match(migrated!.id,/^[a-z0-9-]+$/i);assert.equal(validateLibrary([migrated])[0]!.id,migrated!.id);
});
test('settings identity ignores insertion order',()=>{
 const reversed=Object.fromEntries(Object.entries(defaults).reverse());assert.equal(settingsKey(defaults),settingsKey(reversed as typeof defaults));
});
test('guest merge preserves cloud identity and naming for exact settings duplicates',()=>{
 const cloud=item('cloud','Cloud name');const guest=item('guest','Guest name');
 assert.deepEqual(mergeGuestFavorites([cloud],[guest]),[cloud]);
 assert.equal(mergeGuestFavorites([cloud],[item('other','Other',9)]).length,2);
});
test('cloud payload excludes local history and aliases',()=>{
 const values:Saved[]=[{...item('favorite'),favorite:true,alias:'private',date:'today'},{...item('history'),favorite:false,alias:'private',date:'today'}];
 assert.deepEqual(cloudFavorites(values),[item('favorite')]);
});
test('three-way merge preserves independent edits and both deletions',()=>{
 const base=[item('a'),item('b'),item('c'),item('d')];const local=[item('a','Local'),item('b'),item('d')];const remote=[item('a'),item('b','Remote'),item('c')];
 assert.deepEqual(mergeConflict(base,local,remote),[item('a','Local'),item('b','Remote')]);
});
test('three-way merge duplicates divergent edits rather than losing a version',()=>{
 const merged=mergeConflict([item('a')],[item('a','Local',9)],[item('a','Remote',10)]);
 assert.equal(merged.length,2);assert.equal(merged[0]!.id,'a');assert.equal(merged[0]!.name,'Remote');assert.notEqual(merged[1]!.id,'a');assert.equal(merged[1]!.name,'Local');
});
test('delete against concurrent edit preserves the edited version',()=>{
 assert.deepEqual(mergeConflict([item('a')],[],[item('a','Changed')]),[item('a','Changed')]);
 assert.deepEqual(mergeConflict([item('a')],[item('a','Changed')],[]),[item('a','Changed')]);
 assert.deepEqual(mergeConflict([item('a')],[],[item('a')]),[]);
});
test('snapshot validation rejects duplicate IDs, malformed revisions and unsafe settings',()=>{
 assert.throws(()=>validateSnapshot({revision:-1,entries:[]}));assert.throws(()=>validateSnapshot({revision:0,entries:[item('a'),item('a')]}));
 assert.throws(()=>validateSnapshot({revision:0,entries:[{...item('a'),settings:{quit:1}}]}));
 assert.deepEqual(validateSnapshot({revision:2,entries:[{...item('a'),alias:'private'}]}),{revision:2,entries:[item('a')]});
});
test('durable snapshots isolate accounts and surface storage failure',()=>{
 const store=new Map<string,string>();const prior=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{setItem:(key:string,value:string)=>store.set(key,value)}});
 try{
 const queue={base:{revision:1,entries:[]},entries:[item('a')],history:[]};persistQueue(account,queue);persistQueue('76561198000000002',{...queue,entries:[item('b')]});
 assert.notEqual(queueKey(account),queueKey('76561198000000002'));assert.equal(store.size,2);assert.equal(JSON.parse(store.get('delli.v3.'+queueKey(account))!).entries[0].id,'a');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{setItem:()=>{throw Error('Quota');}}});assert.throws(()=>persistQueue(account,queue),/could not be saved/);
 }finally{if(prior)Object.defineProperty(globalThis,'localStorage',prior);else Reflect.deleteProperty(globalThis,'localStorage');}
});
test('capacity conflicts retain all entries by failing instead of truncating',()=>{
 assert.throws(()=>mergeConflict([],Array.from({length:30},(_,n)=>item('l'+n)),Array.from({length:30},(_,n)=>item('r'+n))),/limit/);
 assert.throws(()=>mergeGuestFavorites(Array.from({length:50},(_,n)=>item('r'+n,'R',n)),[item('new','New',100)]),/limit/);
});

test('persistence failure has a truthful message and leaves previous guest data intact',()=>{
 const previous=JSON.stringify([{...item('old'),favorite:true}]);const prior=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>previous,setItem:()=>{throw Error('Quota');}}});
 try{assert.throws(()=>persistGuest([]),LibraryStorageError);assert.match(syncErrorMessage(new LibraryStorageError()),/^Changes could not be saved on this device/);assert.doesNotMatch(syncErrorMessage(new LibraryStorageError()),/retained/);assert.match(syncErrorMessage(new TypeError('Network offline')),/saved local changes are retained/);assert.equal(localStorage.getItem('delli.v3.library'),previous);}
 finally{if(prior)Object.defineProperty(globalThis,'localStorage',prior);else Reflect.deleteProperty(globalThis,'localStorage');}
});
test('guest merge invitation only covers missing favorite settings',()=>{
 const favorite=(entry:CloudEntry):Saved=>({...entry,favorite:true,alias:'',date:''});
 assert.equal(hasUnmergedGuestFavorites([favorite(item('g'))],[favorite(item('cloud','Cloud'))]),false);
 assert.equal(hasUnmergedGuestFavorites([favorite(item('g','G',9))],[favorite(item('cloud'))]),true);
 assert.equal(hasUnmergedGuestFavorites([{...favorite(item('history')),favorite:false}],[]),false);
});
test('unchanged durable snapshots do not trigger cross-tab storage ping-pong',()=>{
 const q={base:{revision:0,entries:[]},entries:[],history:[]};let writes=0;const prior=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>JSON.stringify(q),setItem:()=>writes++}});
 try{persistQueue(account,q);assert.equal(writes,0);}finally{if(prior)Object.defineProperty(globalThis,'localStorage',prior);else Reflect.deleteProperty(globalThis,'localStorage');}
});
