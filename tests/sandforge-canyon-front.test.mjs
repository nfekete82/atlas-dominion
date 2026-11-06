import {test} from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/src/reborn/world.js';
import {mapWorldSize,CAMPAIGN_SIZES} from '../dist/src/reborn/config.js';
import {generateMap} from '../dist/src/reborn/world-generation.js';
import {canyonCliffBlocked,canyonRuinBlocked} from '../dist/src/reborn/canyon-front.js';

const variants=[[11,15],[12,16],[13,17],[14,18]];
test('canyon: new versions increase all four map widths without changing old save geometry',()=>{
 for(const [oldVersion,newVersion] of variants){
  assert.ok(mapWorldSize(newVersion)>mapWorldSize(oldVersion)*1.12);
  const old=new World(2026,oldVersion);
  assert.equal(old.generated.ridges.length,0);
  assert.equal(old.generated.ruins.length,0);
 }
 assert.deepEqual(Object.values(CAMPAIGN_SIZES),[15,16,17,18]);
});
test('canyon: deterministic seeded ridges, physically blocked faces and walkable ramp passages',()=>{
 for(const version of [15,16,17,18]){
  const world=new World(2074,version),same=generateMap(2074,version);
  assert.deepEqual(world.generated.ridges,same.ridges);
  assert.deepEqual(world.generated.ruins,same.ruins);
  assert.equal(world.generated.ridges.length,1);
  const ridge=world.generated.ridges[0];
  assert.equal(ridge.ramps.length,2);
  const midpoint=ridge.spine[Math.floor(ridge.spine.length/2)];
  assert.ok(canyonCliffBlocked(midpoint,ridge),'cliff centre should be physically solid');
  assert.equal(world.walkable(midpoint),false);
  for(const gate of ridge.ramps){
   const a=ridge.spine.findLast(p=>p.x<=gate.x),b=ridge.spine.find(p=>p.x>=gate.x);
   assert.ok(a&&b);
   const t=(gate.x-a.x)/(b.x-a.x);
   const entry={x:gate.x,y:a.y+(b.y-a.y)*t};
   assert.equal(canyonCliffBlocked(entry,ridge),false);
   assert.equal(world.walkable(entry),true,'wide ramp is a real playable passage');
   assert.ok(world.path({x:entry.x,y:entry.y-175},{x:entry.x,y:entry.y+175}).length>0,'cross-ridge path must exist');
  }
 }
});
test('canyon: rendered ruin footprints collide with ground paths but not HQ/bastion sites',()=>{
 for(const version of [15,16,17,18]){
  const w=new World(2029,version),g=w.generated;
  assert.ok(g.ruins.length>=4,'map should have several ruined buildings');
  for(const ruin of g.ruins){
   assert.ok(canyonRuinBlocked(ruin,ruin));
   assert.equal(w.walkable(ruin),false,'ruin is not a ghost decoration');
   assert.ok(g.sites.every(p=>Math.hypot(p.x-ruin.x,p.y-ruin.y)>180));
  }
  assert.ok(g.sites.every(p=>w.walkable(p)),'every capturable bastion retains buildable ground');
  assert.ok(w.path(g.sites[0],g.sites.at(-1)).length>0,'the two far bastions remain connected');
 }
});
test('canyon: same seeds create identical obstacle and ramp grids',()=>{
 const a=new World(2026,16),b=new World(2026,16);
 assert.deepEqual(a.blocked,b.blocked);
 assert.deepEqual(a.opaque,b.opaque);
 assert.deepEqual(a.generated.ruins,b.generated.ruins);
});
