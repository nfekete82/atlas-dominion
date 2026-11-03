import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {chooseParallelCapture} from '../dist/src/reborn/siege-parallel-capture.js';
import {configureContender} from '../scripts/ai-strategy-tournament.mjs';

const front=(p={})=>({id:2,owner:0,income:25,routeLength:870,routeRisk:1,
 rememberedFortification:false,visibleEnemyFighters:0,...p});
const scenario=(p={})=>({enabled:true,mapVersion:11,time:128,
 siegeMissionAge:45,confirmedObservedTower:true,
 observedObjectiveDamage:false,confirmedEnemyHQDefeated:false,
 fieldFighters:5,livingArtillery:false,visibleHomeThreat:false,
 fronts:[front()],...p});

test('parallel capture: a real paid mobile group may take a public unfortified sector',()=>{
 assert.equal(chooseParallelCapture(scenario()),2);
 assert.equal(chooseParallelCapture(scenario({fronts:[
  front({id:3,owner:-1,routeLength:950}),
  front({id:2,owner:0,routeLength:1000})
 ]})),2,'enemy sector is worth more when comparable');
 assert.equal(chooseParallelCapture(scenario({fronts:[front({id:4}),front({id:3})]})),3);
});
test('parallel capture: never divert from damaged objective, real gun or threatened HQ',()=>{
 for(const patch of [
  {enabled:false},{mapVersion:12},{time:69},{siegeMissionAge:35},
  {confirmedObservedTower:false},{observedObjectiveDamage:true},
  {confirmedEnemyHQDefeated:true},{fieldFighters:2},
  {livingArtillery:true},{visibleHomeThreat:true}
 ])assert.equal(chooseParallelCapture(scenario(patch)),null,JSON.stringify(patch));
});
test('parallel capture: no known guns, seen defenders, impossible or risky route',()=>{
 for(const patch of [
  {owner:1},{rememberedFortification:true},{visibleEnemyFighters:1},
  {routeLength:0},{routeLength:2401},{routeLength:Infinity},
  {routeRisk:6},{routeRisk:Infinity},{routeRisk:-1}
 ])assert.equal(chooseParallelCapture(scenario({fronts:[front(patch)]})),null,JSON.stringify(patch));
 assert.equal(chooseParallelCapture(scenario({fronts:[]})),null);
});
test('parallel capture: equal paid opening and unmodified normal gameplay',()=>{
 const a=new Simulation(2026,11),b=new Simulation(2026,11);
 configureContender(a.tactical,'early-barracks');
 configureContender(b.tactical,'parallel-capture');
 assert.equal(a.tactical.earlyEconomyMode,'barracks-first');
 assert.equal(b.tactical.earlyEconomyMode,'barracks-first');
 assert.equal(b.tactical.parallelCaptureMode,'open-sector');
 for(let i=0;i<240;i++){a.step(.05);b.step(.05);}
 assert.deepEqual(a.credits,b.credits);
 assert.deepEqual(a.bases,b.bases);
 assert.deepEqual(a.units,b.units);
 assert.deepEqual(a.territories,b.territories);
 assert.deepEqual(a.visible,b.visible);
 assert.equal(b.tactical.state.lastPlan,-3,'same first operational decision time');
 assert.equal(b.save().ai?.parallelCaptureMode,undefined,'opt-in flag not serialized');
});
