import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {World} from '../dist/src/reborn/world.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {mapWorldSize,mapLayout} from '../dist/src/reborn/config.js';
import {generateMap} from '../dist/src/reborn/world-generation.js';
import {visualUnitScale} from '../dist/webgl-scale.js';
import {buildingProps} from '../dist/src/reborn/building-decor.js';

const versions=[[15,19,4],[16,20,8],[17,21,12],[18,22,16]];

test('new WebGL desert map IDs are 50% wider and taller without touching classic map versions',()=>{
 for(const [oldVersion,newVersion] of versions){
  assert.equal(mapWorldSize(newVersion),Math.round(mapWorldSize(oldVersion)*1.5));
  assert.equal(mapLayout(newVersion).columns,mapLayout(oldVersion).columns);
  assert.equal(mapLayout(newVersion).rows,mapLayout(oldVersion).rows);
  assert.equal(mapLayout(newVersion).spacing,Math.round(mapLayout(oldVersion).spacing*1.5));
 }
});

test('large desert generation stays deterministic, spacious and navigable for all bastion counts',()=>{
 for(const [oldVersion,version,count] of versions){
  const world=new World(2074,version),map=world.generated;
  assert.equal(world.size,mapWorldSize(version));
  assert.equal(map.sites.length,count);
  assert.ok(map.ruins.length>=4,'ruins missing on map '+version);
  assert.ok(map.ruins.every(ruin=>ruin.width>=108 && ruin.depth>=89),
   'all roomy desert ruins must be physically upscaled on '+version);
  assert.ok(map.ruins.every(ruin=>!world.walkable({x:ruin.x,y:ruin.y})),
   'enlarged ruin collision footprints must be solid on '+version);
  assert.ok(map.mesas.length<=Math.round(13+count*.75),'too many mesas on '+version);
  assert.deepEqual(map,generateMap(2074,version),'generation must be deterministic');
  for(const p of map.sites)assert.ok(world.walkable(p),'unwalkable bastion '+version);
  for(let i=0;i<map.sites.length;i++)for(let j=i+1;j<map.sites.length;j++){
   const a=map.sites[i],b=map.sites[j];
   assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=mapLayout(version).spacing-.1,
    'bastions are overcrowded on '+version);
  }
  const route=world.path(map.sites[0],map.sites.at(-1));
  assert.ok(route.length>0,'world must remain traversable on '+version);
  const old=new World(2074,oldVersion);
  assert.equal(old.size,mapWorldSize(oldVersion));
 }
});

test('visual scaling keeps soldiers smaller than trucks without changing gameplay radii',()=>{
 for(const kind of ['infantry','medic','engineer'])
  assert.equal(visualUnitScale(kind),.64);
 assert.equal(visualUnitScale('heavy'),.66);
 assert.equal(visualUnitScale('rover'),1.34);
 assert.equal(visualUnitScale('artillery'),1.32);
 assert.equal(visualUnitScale('tank'),1.22);
 assert.ok(visualUnitScale('bomber')>0&&visualUnitScale('bomber')<=1);
});

test('v19-v22 games can build HQ, save and reload with original simulation state',()=>{
 for(const [,version] of versions){
  const game=Simulation.campaign(2074,version);
  const site=game.headquartersCandidates(0).find(p=>
   game.buildError(0,'headquarters',p)===null);
  assert.ok(site,'no usable HQ location on '+version);
  const save=game.save(),restored=Simulation.load(save);
  assert.equal(restored.world.mapVersion,version);
  assert.equal(restored.world.size,game.world.size);
  assert.deepEqual(restored.territories.map(t=>t.point),game.territories.map(t=>t.point));
  assert.equal(restored.units.length,game.units.length);
 }
});

test('production WebGL preview ships all root-relative modules in its static imports',()=>{
 const entry=readFileSync('dist/webgl-preview.js','utf8');
 const modules=[...entry.matchAll(/from\s*['"]\/([^'"]+\.js)['"]/g)].map(m=>m[1]);
 assert.ok(modules.includes('webgl-perf-watch.js'),
  'combat profiler import must be included in deployment smoke test');
 for(const modulePath of modules){
  assert.ok(existsSync('dist/'+modulePath),
   'Missing WebGL static import /'+modulePath+' in dist; preview would stall at loading');
 }
});

test('all four 3D building facings survive saves, and legacy facing=1 remains valid',()=>{
 for(const facing of [0,2,1,3]){
  const game=Simulation.campaign(2074,19);
  const site=game.headquartersCandidates(0)
   .find(p=>game.buildError(0,'headquarters',p)===null);
  assert.ok(site,'no clear HQ site');
  const base=game.build(0,'headquarters',site,undefined,facing);
  assert.ok(base,'engineer cannot create HQ fixture');
  assert.equal(base.facing??0,facing);
  const save=game.save();
  const restored=Simulation.load(save);
  assert.equal(restored.bases.find(b=>b.id===base.id)?.facing??0,facing);
  if(facing===3){
   const invalid=structuredClone(save);
   const building=invalid.bases.find(b=>b.id===base.id);
   building.facing=4;
   assert.throws(()=>Simulation.load(invalid),/beschädigt/);
  }
 }
});

test('building props preserve classic facings and rotate consistently for 90 and 270 degrees',()=>{
 const anchor={x:1200,y:1400},radius=65,seed=2074;
 for(const kind of ['headquarters','barracks','factory','airfield','generator','turret','bastion']){
  const standard=buildingProps(kind,anchor,radius,1000,seed,0);
  assert.ok(standard.length>0,kind+' needs at least one service prop');
  for(const facing of [1,2,3]){
   const oriented=buildingProps(kind,anchor,radius,1000,seed,facing);
   assert.equal(oriented.length,standard.length);
   for(let i=0;i<standard.length;i++){
    const a=standard[i],actual=oriented[i],dx=a.x-anchor.x,dy=a.y-anchor.y;
    const expected=facing===1?{x:-dx,y:dy}:
     facing===2?{x:dy,y:-dx}:{x:-dy,y:dx};
    assert.equal(actual.kind,a.kind);
    assert.equal(actual.variant,a.variant);
    assert.ok(Math.abs(actual.x-anchor.x-expected.x)<1e-8,
     kind+' facing '+facing+' X prop drift');
    assert.ok(Math.abs(actual.y-anchor.y-expected.y)<1e-8,
     kind+' facing '+facing+' Y prop drift');
   }
  }
 }
});
