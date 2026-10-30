import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {shouldUseStandoffSiege} from '../dist/src/reborn/tactical-ai.js';

test('4.4: an observed single turret uses verified standoff rather than direct rally projection',()=>{
 assert.equal(shouldUseStandoffSiege([1004],1004),true);
 assert.equal(shouldUseStandoffSiege([1004,1005],1004),true);
 assert.equal(shouldUseStandoffSiege([1004,1005],1006),true,
  'previous multi-tower behavior is preserved near a covered objective');
 assert.equal(shouldUseStandoffSiege([1004],1006),false,
  'a production building is not mistaken for the single turret');
 assert.equal(shouldUseStandoffSiege([],1004),false,
  'no invisible or stale turret may be inferred');
});

test('4.4: real director dispatches an observed turret to standoff planning',()=>{
 const g=new Simulation(2028,4);
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const artillery=g.spawn(1,{x:hq.x+60,y:hq.y+120},'artillery');
 const target={id:1004,x:hq.x-620,y:hq.y+100};
 g.tactical.state.knownTurrets=[{...target,hp:650,range:600,seenAt:0}];
 let called=0;
 g.tactical.standoffSiege=(members,goal,guns)=>{
  called++;
  assert.equal(goal.id,target.id);
  assert.equal(guns[0].id,artillery.id);
  return true;
 };
 assert.equal(g.tactical.siege([artillery],target),true);
 assert.equal(called,1);
});

test('4.4: unseen single tower and ordinary production targets preserve original siege behavior',()=>{
 const g=new Simulation(2029,4);
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const artillery=g.spawn(1,{x:hq.x+80,y:hq.y+90},'artillery');
 let called=0;
 g.tactical.standoffSiege=()=>{called++;return true;};
 g.tactical.siege([artillery],{id:1004,x:hq.x-630,y:hq.y+100});
 assert.equal(called,0);
 g.tactical.state.knownTurrets=[{id:1004,x:hq.x-630,y:hq.y+100,hp:650,range:600,seenAt:0}];
 g.tactical.siege([artillery],{id:1006,x:hq.x-650,y:hq.y+120});
 assert.equal(called,0);
});
