import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visibleCliffIds} from '../dist/src/reborn/cliff-visibility.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

test('cliff fog: one currently visible opaque cell relights only its rock formation',()=>{
 const ids=Int16Array.from([-1,0,0,1,1,2,2,-1]);
 const seen=Uint8Array.from([0,0,1,0,0,0,0,0]);
 assert.deepEqual([...visibleCliffIds(seen,ids,3)],[1,0,0]);
 seen[2]=0;
 assert.deepEqual([...visibleCliffIds(seen,ids,3)],[0,0,0],
  'past exploration alone must never relight a cliff');
 seen[4]=1;seen[6]=1;
 assert.deepEqual([...visibleCliffIds(seen,ids,3)],[0,1,1]);
});
test('cliff fog: the renderer never changes enemy visibility, navigation or saved exploration',()=>{
 const g=new Simulation(2026,4),before=JSON.stringify(g.save());
 const beforeBlocked=g.world.blocked.slice(),beforeOpaque=g.world.opaque.slice();
 const previouslyVisible=g.visible[0].slice(),previouslyExplored=g.explored[0].slice();
 const lit=visibleCliffIds(g.visible[0],g.world.cliffIds,g.world.generated.mesas.length);
 assert.equal(lit.length,g.world.generated.mesas.length);
 assert.deepEqual(g.visible[0],previouslyVisible);
 assert.deepEqual(g.explored[0],previouslyExplored);
 assert.deepEqual(g.world.blocked,beforeBlocked);
 assert.deepEqual(g.world.opaque,beforeOpaque);
 assert.equal(JSON.stringify(g.save()),before);
});
test('cliff fog: invalid geometry and out-of-range cliff IDs cannot reveal anything',()=>{
 assert.throws(()=>visibleCliffIds(new Uint8Array(2),new Int16Array(3),1),/Invalid/);
 assert.throws(()=>visibleCliffIds(new Uint8Array(1),new Int16Array(1),-1),/Invalid/);
 assert.deepEqual([...visibleCliffIds(Uint8Array.from([1,1,1]),Int16Array.from([-1,4,0]),1)],[1]);
});
