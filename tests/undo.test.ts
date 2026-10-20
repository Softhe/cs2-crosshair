import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pushUndo,UNDO_GROUP_MS} from '../src/useUndo.ts';
import {defaults} from '../src/model.ts';

test('a slider drag is one undo step; other settings, pauses and ungrouped changes start new steps',()=>{
  const at=(n:number)=>({...defaults,cl_crosshair_gap:n});
  let step=pushUndo([],at(0),null,'cl_crosshair_gap',0);
  for(let t=100;t<=3000;t+=100)step=pushUndo(step.items,at(t),step.last,'cl_crosshair_gap',t);
  assert.deepEqual(step.items,[at(0)]); // continuous drag keeps the value from before it started
  step=pushUndo(step.items,at(1),step.last,'cl_crosshair_length',3100);assert.equal(step.items.length,2);
  step=pushUndo(step.items,at(2),step.last,'cl_crosshair_length',3100+UNDO_GROUP_MS);assert.equal(step.items.length,3);
  step=pushUndo(step.items,at(3),step.last,undefined,3200);step=pushUndo(step.items,at(4),step.last,undefined,3200);assert.equal(step.items.length,5);
  let capped=pushUndo([],at(0),null,undefined,0);for(let i=1;i<40;i++)capped=pushUndo(capped.items,at(i),capped.last,undefined,0);assert.equal(capped.items.length,30);
});
