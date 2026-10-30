import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {newCampaign} from '../dist/src/reborn/campaign-commander.js';
import {attemptEndgameStandoff} from '../dist/src/reborn/tactical-ai.js';

test('4.5: no speculative standoff before verified HQ loss or with clear direct LOS',()=>{
 assert.equal(attemptEndgameStandoff(false,true,false),false);
 assert.equal(attemptEndgameStandoff(true,false,false),false);
 assert.equal(attemptEndgameStandoff(true,true,true),false);
 assert.equal(attemptEndgameStandoff(true,true,false),true);
});

function fixture({endgame=true,known=true,clear=false}={}){
 const g=new Simulation(2028,4);
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(home);
 const artillery=g.spawn(1,{x:home.x+90,y:home.y+140},'artillery');
 assert.ok(artillery);
 const target={id:99100,x:home.x+470,y:home.y+220};
 if(known)g.tactical.state.knownTurrets=[{...target,hp:600,range:600,seenAt:0}];
 if(endgame){
  g.time=120;
  g.tactical.state.commander={...newCampaign(),
   observedEnemyHQ:{id:99001,x:home.x-400,y:home.y-200},enemyHQEliminatedAt:90};
 }
 g.world.line=()=>clear;
 return {g,home,artillery,target};
}

test('4.5: dispatch to standoff only in observed obstructed cleanup',()=>{
 for(const [endgame,known,clear,shouldDispatch] of [
   [false,true,false,false],[true,false,false,false],
   [true,true,true,false],[true,true,false,true]]){
  const {g,artillery,target}=fixture({endgame,known,clear});
  let calls=0;
  g.tactical.standoffSiege=()=>{calls++;return true;};
  g.tactical.siege([artillery],target);
  assert.equal(calls,shouldDispatch?1:0,
   'must not replace established assault without all three safeguards');
 }
});

test('4.5: refused alternate shot returns to AI 4.3 attack, not safe rally',()=>{
 const {g,artillery,target}=fixture();
 let called=0;
 g.tactical.standoffSiege=()=>{called++;return false;};
 assert.equal(g.tactical.siege([artillery],target),true);
 assert.equal(called,1);
 assert.equal(artillery.orders[0]?.kind,'attack');
 assert.equal(artillery.orders[0]?.target,target.id);
 assert.equal(artillery.orders[0]?.tactical?.mode,'assault');
});

test('4.5: no viable standoff shot returns false without issuing retreat orders',()=>{
 const {g,artillery,target}=fixture();
 g.world.walkable=()=>true;
 g.world.line=()=>true;
 g.tactical.route=()=>[];
 assert.equal(g.tactical.standoffSiege([artillery],target,[artillery],true),false);
 assert.deepEqual(artillery.orders,[]);
});

test('4.5: existing multi-gun doctrine retains its original dispatch',()=>{
 const {g,artillery,target}=fixture({endgame:false,clear:true});
 g.tactical.state.knownTurrets.push({...target,id:99101,x:target.x+40,y:target.y+80});
 assert.ok(g.world.mapVersion>=3,'requires modern tactical map');
 assert.equal(g.tactical.state.knownTurrets.length,2,'both guns were observed');
 assert.equal(g.tactical.state.knownTurrets.filter(t=>Math.hypot(t.x-target.x,t.y-target.y)<t.range+200).length,2,
  'both known guns must be within the original multi-tower zone');
 let calls=0;
 g.tactical.standoffSiege=(_members,_target,_artillery,fallback)=>{calls++;assert.equal(fallback,undefined);return true;};
 assert.equal(g.tactical.siege([artillery],target),true);
 assert.equal(calls,1);
});
