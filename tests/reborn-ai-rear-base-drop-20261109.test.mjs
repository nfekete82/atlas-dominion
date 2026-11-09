import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {homeGarrisonSize,cleanupReserveSize} from '../dist/src/reborn/tactical-ai.js';

const setup=()=>{
 const g=new Simulation(2026,3);
 g.time=150;g.aiClock=-1e6;g.credits=[0,0];g.units=[];
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const playerHQ=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 assert.ok(home&&playerHQ,'fixture needs actual existing HQs');
 Object.assign(home,{x:1050,y:1600});
 Object.assign(playerHQ,{x:3200,y:3300});
 return {g,home};
};

test('rear-base assault: a visible stronger landed squad triggers real defenders, not an automatic retreat',()=>{
 const {g,home}=setup();
 const defenders=[g.spawn(1,{x:home.x+175,y:home.y+50},'infantry')];
 const medic=g.spawn(1,{x:home.x+120,y:home.y+75},'medic');
 const raiders=[
  g.spawn(0,{x:home.x-115,y:home.y-140},'heavy'),
  g.spawn(0,{x:home.x-145,y:home.y-175},'heavy'),
  g.spawn(0,{x:home.x-170,y:home.y-115},'infantry')
 ];
 g.updateVision();
 assert.ok(raiders.every(u=>g.canSee(1,u)), 'HQ must actually observe the landed units');
 g.tactical.plan();
 const defense=g.tactical.state.battle?.squads.find(q=>q.role==='defense');
 assert.ok(defense,'modern commander should take emergency-defense ownership');
 assert.ok(defense.ids.includes(defenders[0].id));
 assert.ok(raiders.some(u=>defenders[0].orders[0]?.target===u.id),
  'even outnumbered paid defenders must attack an observed invader, not flee');
 assert.equal(defenders[0].orders[0]?.tactical?.mode,'defend');
 assert.ok(defense.ids.includes(medic.id),'medic remains assigned to home defense');
 assert.notEqual(medic.orders[0]?.kind,'attack','medic must not be sent into enemy gunfire');
 assert.equal(g.credits[1],0,'defense never creates invisible funds');
 assert.equal(g.units.length,5,'defense never spawns free garrison reinforcements');
});

test('rear-base defense ignores unseen infantry behind the same HQ',()=>{
 const {g,home}=setup();
 const guard=g.spawn(1,{x:home.x+140,y:home.y},'infantry');
 const hidden=g.spawn(0,{x:home.x-160,y:home.y+110},'heavy');
 g.visible[1].fill(0);
 assert.equal(g.canSee(1,hidden),false);
 g.tactical.plan();
 assert.equal(g.tactical.state.battle?.squads.some(s=>s.role==='defense'),false);
 assert.notEqual(guard.orders[0]?.target,hidden.id,
  'the defender must not acquire hidden targets through the strategic director');
});

test('large modern armies retain several real fighters for rear-base attacks',()=>{
 const cases=[[0,0],[5,0],[6,1],[7,1],[8,2],[13,2],[14,3],[25,3]];
 for(const [fighters,guard] of cases)
  assert.equal(homeGarrisonSize(fighters,false),guard,'fighters='+fighters);
 for(const fighters of [0,4,7,9,15])
  assert.equal(homeGarrisonSize(fighters,true),cleanupReserveSize(true,fighters),
   'endgame cleanup budget is unchanged');
});
