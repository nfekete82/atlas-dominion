import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {canyonGroundSampler} from '../dist/src/reborn/canyon-height.js';
import {rollingHillHeight} from '../dist/src/reborn/rolling-hills.js';
import {generateOases,safeOasis} from '../scripts/webgl-oasis-generation.js';
function setup(seed,version){const game=Simulation.campaign(seed,version),sample=canyonGroundSampler(seed,game.world.generated.ridges);
 return {world:game.world,seed,startRegions:game.startRegions,heightAt:(x,z)=>sample(x,z)+rollingHillHeight(game.hills,x,z)};}
for(const [count,version] of [[4,19],[8,20],[12,21],[16,22]]){
 test(`${count} bastions: deterministic, safe, finite, all three types`,()=>{
  for(const seed of [2026,2074,1,0,4294967295]){
   const options=setup(seed,version),before=options.world.blocked.slice(),a=generateOases(options);
   assert.deepEqual(a,generateOases(options));assert.ok(a.length>=2&&a.length<=4,`count ${a.length} seed ${seed}`);
   if(count===4)assert.equal(a.length,3);
   for(const [i,o] of a.entries()){
    assert.ok(Number.isFinite(o.x)&&Number.isFinite(o.y));assert.ok(safeOasis(o,options,a.slice(0,i)));
   }
   assert.deepEqual(options.world.blocked,before);
  }
  assert.notDeepEqual(generateOases(setup(2026,version)),generateOases(setup(2074,version)));
 });
}
test('old maps and save round trips preserve map coordinates and generation',()=>{
 for(const version of [15,16,17,18,19,20,21,22]){
  const g=Simulation.campaign(2074,version),saved=g.save(),restored=Simulation.load(saved);
  const a=setup(2074,version),b={...a,world:restored.world,startRegions:restored.startRegions};
  assert.deepEqual(generateOases(a),generateOases(b));assert.deepEqual(g.save(),saved);
 }
});
test('no unsafe fallback on a fully blocked map',()=>{
 const o=setup(2074,19);o.world.blocked.fill(1);assert.deepEqual(generateOases(o),[]);
});
