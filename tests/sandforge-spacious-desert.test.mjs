import {test} from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/src/reborn/world.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {mapWorldSize,mapLayout} from '../dist/src/reborn/config.js';
import {generateMap} from '../dist/src/reborn/world-generation.js';
import {visualUnitScale} from '../dist/webgl-scale.js';

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
 for(const kind of ['infantry','medic','engineer','heavy'])
  assert.equal(visualUnitScale(kind),.72);
 assert.equal(visualUnitScale('rover'),1.34);
 assert.equal(visualUnitScale('artillery'),.92);
 assert.equal(visualUnitScale('tank'),.95);
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
