import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {campaignLayout,mapWorldSize} from '../dist/src/reborn/config.js';
import {battlefieldStart,TERRAIN_GRADING_SPACIOUS,TERRAIN_GRADING_V2,
 terrainGradingForMap} from '../dist/src/reborn/battlefield-terrain.js';
const versions=[[23,27],[24,28],[25,29],[26,30]];
test('new campaign sides grow exactly 20%, older versions remain unchanged',()=>{
 assert.equal(TERRAIN_GRADING_SPACIOUS.homeFlatRadius,1050);
 for(const [oldV,newV] of versions){
  assert.equal(mapWorldSize(newV),Math.round(mapWorldSize(oldV)*1.2));
  assert.equal(terrainGradingForMap(oldV,2),TERRAIN_GRADING_V2);
  assert.equal(terrainGradingForMap(newV,2),TERRAIN_GRADING_SPACIOUS);
  assert.equal(terrainGradingForMap(newV,1),TERRAIN_GRADING_V2);
  assert.deepEqual([campaignLayout(newV,2026).columns,campaignLayout(newV,2026).rows],
   [campaignLayout(oldV,2026).columns,campaignLayout(oldV,2026).rows]);
 }
});
test('both start regions gain flat, obstacle-free 850-unit building grounds',()=>{
 for(const version of [27,28,29,30]){
  const g=new Simulation(2026,version,false,true,'mixed');
  const homes=campaignLayout(version,g.seed).headquarters.map(id=>
   battlefieldStart(g.world.generated.sites[id],g.world.size));
  assert.ok(g.startRegions.every(x=>x.radius>=850));
  for(const p of homes)for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5])
   for(const dist of [150,450,700,850]){
    const x=p.x+Math.cos(angle)*dist,y=p.y+Math.sin(angle)*dist;
    assert.ok(g.world.terrainHeight(x,y)<.08,'flat terrain within 850 of start');
    assert.ok(!g.world.blocked[g.world.index({x,y})],'no blocking rocks on HQ pad');
   }
 }
});
test('old v23 start and map remain stable',()=>{
 const g=new Simulation(2026,23,false,true,'mixed');
 assert.equal(g.world.size,6240);
 assert.ok(g.startRegions.every(r=>r.radius===600));
});

test('new map versions survive the existing v2 save envelope without rewriting old saves',()=>{
 for(const version of [27,28,29,30]){
  const original=Simulation.campaign(42,version,'open');
  const save=original.save();
  assert.equal(save.version,2);
  assert.equal(save.mapVersion,version);
  const restored=Simulation.load(save);
  assert.equal(restored.world.size,mapWorldSize(version));
  assert.equal(restored.world.mapVersion,version);
  assert.equal(restored.territories.length,original.territories.length);
  assert.equal(restored.world.generated.battlefield.generatorVersion,2);
 }
});
