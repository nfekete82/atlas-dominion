import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../dist/src/reborn/world.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {campaignLayout} from '../dist/src/reborn/config.js';
import {BATTLEFIELD_GENERATOR,TERRAIN_GRADING_V2,battlefieldStart,
 terrainGradingEdge} from '../dist/src/reborn/battlefield-terrain.js';

const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('new bastion terrain pads are genuinely wider, smooth and shared by ground and AI',()=>{
 assert.equal(BATTLEFIELD_GENERATOR,2);
 assert.equal(TERRAIN_GRADING_V2.bastionFlatRadius,480);
 for(const [seed,profile] of [[2074,'dunes'],[3035439572,'mixed']]){
  const world=new World(seed,24,profile);
  const t=world.generated.battlefield;
  assert.equal(t.generatorVersion,2);
  assert.equal(world.validation.valid,true);
  const sites=world.generated.sites;
  const homes=campaignLayout(24,seed).headquarters.map(i=>battlefieldStart(sites[i],world.size));
  for(const p of sites){
   for(const rad of [0,125,260,400,450])for(let j=0;j<12;j++){
    const a=j*Math.PI/6,x=p.x+rad*Math.cos(a),y=p.y+rad*Math.sin(a);
    assert.ok(Math.abs(world.terrainHeight(x,y))<1e-5,
     'flat bastion building pad must contain all terrain at radius '+rad);
    assert.ok(world.terrainSlope(x,y)<1e-5,
     'entire real foundation must be level, not only height at center');
   }
  }
  // The shoulder remains a continuous moderate grade around the pads.
  const sample=sites.find((_,i)=>!campaignLayout(24,seed).headquarters.includes(i));
  assert.ok(sample);
  for(let j=0;j<12;j++){
   const a=j*Math.PI/6,p={x:sample.x+560*Math.cos(a),y:sample.y+560*Math.sin(a)};
   assert.ok(world.terrainSlope(p.x,p.y)<.5);
  }
  assert.equal(terrainGradingEdge(sites[0].x+480,sites[0].y,sites,homes,2),0);
  assert.ok(terrainGradingEdge(sites[0].x+570,sites[0].y,sites,homes,2)>=0);
  assert.ok(world.generated.mesas.every(m=>m.outline.every(p=>
   sites.every(s=>Math.hypot(p.x-s.x,p.y-s.y)>390))),
   'rock mesas may no longer obstruct the excavated sector pads');
 }
});

test('saving and loading an older generator-1 match preserves its exact previous hills',()=>{
 const seed=3035439572;
 const old=new Simulation(seed,24,false,true,'dunes',1);
 const saved=old.save();
 assert.equal(saved.generatorVersion,1);
 const restored=Simulation.load(saved);
 assert.equal(restored.world.generated.battlefield.generatorVersion,1);
 assert.equal(restored.world.generated.battlefield.profile,'dunes');
 for(const p of [{x:1111,y:2266},{x:2440,y:3830},{x:5400,y:1870}]){
  assert.equal(restored.world.terrainHeight(p.x,p.y),
   old.world.terrainHeight(p.x,p.y));
  assert.equal(restored.world.terrainSlope(p.x,p.y),
   old.world.terrainSlope(p.x,p.y));
 }
 const modern=new Simulation(seed,24,false,true,'dunes');
 const newSave=modern.save();
 assert.equal(newSave.generatorVersion,2);
 assert.equal(Simulation.load(newSave).world.generated.battlefield.generatorVersion,2);
 assert.notDeepEqual(Array.from(modern.world.generated.battlefield.heights),
  Array.from(old.world.generated.battlefield.heights),
  'new revision must actually contain expanded flat build areas');
});

test('terrain colours reveal excavated shoulders without new meshes or frame work',()=>{
 const preview=src('scripts/webgl-preview.js');
 const generator=src('src/reborn/world-generation.ts');
 const heightfield=src('src/reborn/battlefield-terrain.ts');
 assert.match(preview,/terrainGradingEdge\(x,z,terrain\.sites,gradingHomes,2\)/);
 assert.match(preview,/vertexColor\.lerp\(sandstone,earth\*\.16\)/);
 assert.match(generator,/generatorVersion===1\?780:TERRAIN_GRADING_V2\.homeFlatRadius/);
 assert.match(generator,/TERRAIN_GRADING_V2\.bastionFlatRadius\+TERRAIN_GRADING_V2\.rockSafetyMargin/);
 assert.match(heightfield,/generatorVersion===1\)/);
 assert.match(heightfield,/generatorVersion:BattlefieldGeneratorVersion/);
});
