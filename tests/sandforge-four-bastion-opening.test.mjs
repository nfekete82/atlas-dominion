import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {aiOpeningDelay,shortMapFirstBarracks} from '../dist/src/reborn/small-map-opening.js';
import {RULES} from '../dist/src/reborn/config.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';

const step=(g,n)=>{for(let i=0;i<Math.round(n/RULES.tick);i++)g.step(RULES.tick);};

test('small four-bastion map starts planning early, other maps retain original policy',()=>{
 assert.equal(aiOpeningDelay(11,'responsive'),6);
 assert.equal(aiOpeningDelay(11,'classic'),RULES.aiOpeningDelay);
 for(const map of [3,4,7,8,12,13,14])
  assert.equal(aiOpeningDelay(map,'responsive'),RULES.aiOpeningDelay);
});

test('small-map barracks-first is explicit, map-scoped and stops after a paid barracks exists',()=>{
 const hq={kind:'headquarters',hp:1200};
 assert.equal(shortMapFirstBarracks(11,'responsive',[hq]),true);
 assert.equal(shortMapFirstBarracks(11,'classic',[hq]),false);
 assert.equal(shortMapFirstBarracks(12,'responsive',[hq]),false);
 assert.equal(shortMapFirstBarracks(11,'responsive',[hq,{kind:'barracks',hp:BUILDINGS.barracks.hp*.25}]),false);
 assert.equal(shortMapFirstBarracks(11,'responsive',[hq,{kind:'barracks',hp:0}]),true);
});

test('four-bastion opening is fair: identical map, units, sight, credits and income',()=>{
 const fast=new Simulation(2026,11),classic=new Simulation(2026,11);
 classic.smallMapTempo='classic';
 assert.deepEqual(fast.bases,classic.bases);
 assert.deepEqual(fast.units,classic.units);
 assert.deepEqual(fast.territories,classic.territories);
 assert.deepEqual(fast.credits,classic.credits);
 assert.deepEqual(fast.explored,classic.explored);
 assert.deepEqual(fast.visible,classic.visible);
 assert.deepEqual(fast.income(1),classic.income(1));
 assert.equal(fast.credits[1],950);
 assert.equal(fast.territories.length,4);
});

test('four-bastion responsive strategy issues legal work before classic starts',()=>{
 const fast=new Simulation(2026,11),classic=new Simulation(2026,11);
 classic.smallMapTempo='classic';
 step(fast,12);step(classic,12);
 assert.ok(fast.tactical.state.lastPlan>=6, 'responsive AI plans within first 12 seconds');
 assert.equal(classic.tactical.state.lastPlan,-3,'legacy AI still waits for 25 seconds');
 const built=fast.bases.filter(b=>b.owner===1&&b.kind==='barracks');
 assert.ok(built.length===1,'responsive AI orders exactly one paid barracks in opening');
 assert.equal(fast.credits[1],950+fast.income(1)-BUILDINGS.barracks.cost,
  'only one normal 10-second income payment and the actual barracks cost apply');
 assert.ok(classic.bases.every(b=>b.owner!==1||b.kind!=='barracks'));
});

test('eight-bastion and classic four-bastion retain standard generator-first priority',()=>{
 for(const [version,tempo] of [[11,'classic'],[12,'responsive']]){
  const g=new Simulation(2026,version);g.smallMapTempo=tempo;
  step(g,30);
  const buildings=g.bases.filter(b=>b.owner===1&&b.kind!=='headquarters');
  assert.ok(buildings.some(b=>b.kind==='generator'),
   'the original large-map economy must still prefer the initial generator');
 }
});

test('opening tempo uses no saved-game cheats, is transparent to save/load and never affects player order semantics',()=>{
 const fast=new Simulation(2026,11);step(fast,8);
 const saved=fast.save();
 assert.ok(!Object.hasOwn(saved,'smallMapTempo'));
 const restored=Simulation.load(saved);
 assert.equal(restored.smallMapTempo,'responsive');
 assert.equal(restored.credits[0],fast.credits[0]);
 assert.equal(restored.territories.filter(t=>t.owner===0).length,fast.territories.filter(t=>t.owner===0).length);
});
