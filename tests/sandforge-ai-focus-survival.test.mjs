import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {focusFireDistanceAdjustment,shouldWithdrawInfantry} from '../dist/src/reborn/ai-focus-survival.js';

test('focus: coordinated damaged target is attractive but massive overkill is discouraged',()=>{
 const alone=focusFireDistanceAdjustment({hp:90,maxHp:100,ownDamage:17,assigned:0,alliedDps:0});
 const supported=focusFireDistanceAdjustment({hp:42,maxHp:100,ownDamage:17,assigned:2,alliedDps:35});
 const overkill=focusFireDistanceAdjustment({hp:8,maxHp:100,ownDamage:17,assigned:5,alliedDps:150});
 assert.equal(alone,0);
 assert.ok(supported<alone);
 assert.ok(overkill>supported,'five soldiers must not waste a volley on an 8HP enemy');
 assert.equal(focusFireDistanceAdjustment({hp:0,maxHp:100,ownDamage:17,assigned:4,alliedDps:100}),0);
});

test('retreat: medic, cover, true hit and low health are all required',()=>{
 const base={kind:'infantry',hp:42,maxHp:100,medicWithin:160,friendlyScreen:2,
  underFire:true,alreadyRecovering:false};
 assert.equal(shouldWithdrawInfantry(base),true);
 assert.equal(shouldWithdrawInfantry({...base,medicWithin:800}),false);
 assert.equal(shouldWithdrawInfantry({...base,friendlyScreen:1}),false);
 assert.equal(shouldWithdrawInfantry({...base,hp:70}),false);
 assert.equal(shouldWithdrawInfantry({...base,underFire:false}),false);
 assert.equal(shouldWithdrawInfantry({...base,alreadyRecovering:true}),false);
 assert.equal(shouldWithdrawInfantry({...base,kind:'engineer'}),false);
 assert.equal(shouldWithdrawInfantry({...base,kind:'heavy',hp:120,maxHp:420}),true);
 assert.equal(shouldWithdrawInfantry({...base,kind:'heavy',hp:200,maxHp:420}),false);
});

test('combat: RED chooses visible focused enemy, BLUE and classic keep closer target',()=>{
 const g=new Simulation(2026,11);
 g.aiClock=-1e8;
 const p={x:1700,y:1700};
 const red=g.spawn(1,p,'infantry'),ally=g.spawn(1,{x:1714,y:1720},'infantry');
 const nearer=g.spawn(0,{x:1770,y:1700},'infantry');
 const focused=g.spawn(0,{x:1790,y:1700},'infantry');
 g.spatial.rebuild(g.units);g.updateVision();
 nearer.hp=100;focused.hp=32;ally.combatTarget=focused.id;
 g.tactical.focusMode='classic';
 assert.equal(g.acquire(red)?.id,nearer.id,'ordinary AI picks closer target');
 g.tactical.focusMode='coordinated';
 assert.equal(g.acquire(red)?.id,focused.id,'squad selects already wounded enemy');
 assert.ok(g.canSee(1,focused),'the focused target is genuinely visible');
 // Isolate the player check from the preceding RED squad and ensure
 // identical open field / real sight lines rather than map-specific cliffs.
 const h=new Simulation(2026,11);
 h.units=[];h.unitById.clear();
 h.world.blocked.fill(0);h.world.opaque.fill(0);h.world.components.fill(0);
 const player=h.spawn(0,{x:1700,y:1700},'infantry');
 const playerClose=h.spawn(1,{x:1760,y:1700},'infantry');
 const playerFar=h.spawn(1,{x:1800,y:1700},'infantry');
 playerFar.hp=10;h.updateVision();h.spatial.rebuild(h.units);h.tactical.focusMode='coordinated';
 assert.equal(h.acquire(player)?.id,playerClose.id,'player auto-targeting remains distance-based');
});

test('combat: explicit RED attack target is authoritative even with coordinated target mode',()=>{
 const g=new Simulation(2026,11),u=g.spawn(1,{x:1700,y:1700},'infantry'),
   a=g.spawn(0,{x:1760,y:1700},'infantry'),
   b=g.spawn(0,{x:1800,y:1700},'infantry');
 g.updateVision();g.spatial.rebuild(g.units);g.tactical.focusMode='coordinated';
 u.orders=[{kind:'attack',x:b.x,y:b.y,target:b.id}];
 assert.equal(g.acquire(u)?.id,b.id);
});

test('combat: real hit can extract wounded RED infantry with support, not player or unsupported units',()=>{
 const g=new Simulation(2026,11);
 g.tactical.survivalMode='adaptive';g.aiClock=-1e8;
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const center={x:home.x-175,y:home.y-30};
 const injured=g.spawn(1,center,'infantry');
 g.spawn(1,{x:center.x+35,y:center.y+20},'infantry');
 g.spawn(1,{x:center.x+45,y:center.y+30},'heavy');
 g.spawn(1,{x:center.x-20,y:center.y+35},'medic');
 const blue=g.spawn(0,{x:center.x+155,y:center.y},'infantry');
 injured.hp=48;
 g.strike(blue,injured,7);
 assert.ok(g.tactical.state.recovering.includes(injured.id),'actual damage triggers recovery');
 assert.equal(injured.orders[0]?.kind,'move');
 assert.equal(injured.hp,41,'no synthetic HP or regeneration');
 assert.equal(blue.orders.length,0,'red strategy cannot command blue unit');
 // Existing healing gate is real and requires getting back above 80% HP.
 const resting=g.tactical.recovery(g.units.filter(u=>u.owner===1),home);
 assert.ok(resting.has(injured.id));
 injured.hp=UNITS.infantry.hp*.84;
 g.tactical.recovery(g.units.filter(u=>u.owner===1),home);
 assert.ok(!g.tactical.state.recovering.includes(injured.id),'healed soldier re-enters combat pool');
});

test('combat: default policies remain classic until an A/B test confirms an advantage',()=>{
 const g=new Simulation(2026,11);
 assert.equal(g.tactical.focusMode,'classic');
 assert.equal(g.tactical.survivalMode,'classic');
 const s=g.save();
 const loaded=Simulation.load(s);
 assert.equal(loaded.tactical.focusMode,'classic');
 assert.equal(loaded.tactical.survivalMode,'classic');
 assert.equal(s.ai?.focusMode,undefined);
});
