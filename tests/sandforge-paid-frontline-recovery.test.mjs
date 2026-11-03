import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {frontlineRecoveryPriority} from '../dist/src/reborn/director-production.js';
import {configureContender} from '../scripts/ai-strategy-tournament.mjs';

const scenario=(p={})=>({
 mode:'frontline-recovery',mapVersion:11,time:110,
 livingFighters:2,queuedFighters:0,infantryOrdered:2,
 barracksReady:true,finishing:false,committedSiegeBudget:0,
 visibleEnemyAir:false,...p
});

test('frontline recovery: refill an actually depleted formation, never buy phantom capacity',()=>{
 assert.equal(frontlineRecoveryPriority(scenario()),'infantry');
 assert.equal(frontlineRecoveryPriority(scenario({livingFighters:3,queuedFighters:0})), 'infantry');
 assert.equal(frontlineRecoveryPriority(scenario({livingFighters:3,queuedFighters:1})),null);
 assert.equal(frontlineRecoveryPriority(scenario({livingFighters:2,queuedFighters:2})),null);
 assert.equal(frontlineRecoveryPriority(scenario({livingFighters:4})),null);
 assert.equal(frontlineRecoveryPriority(scenario({infantryOrdered:4})),null);
});

test('frontline recovery: paid siege, opponent air and cleanup cannot be starved',()=>{
 for(const p of [
  {committedSiegeBudget:600},
  {committedSiegeBudget:1},
  {visibleEnemyAir:true},
  {finishing:true},
  {barracksReady:false},
  {mode:'barracks-first'},
  {mode:'adaptive-contact'},
  {mapVersion:12},
  {time:54},
  {time:331}
 ])assert.equal(frontlineRecoveryPriority(scenario(p)),null,JSON.stringify(p));
});

test('frontline recovery: equal first 12 seconds, no free units/resources or foreign fog access',()=>{
 const a=new Simulation(2032,11),b=new Simulation(2032,11);
 configureContender(a.tactical,'early-barracks');
 configureContender(b.tactical,'frontline-recovery');
 assert.equal(a.tactical.earlyEconomyMode,'barracks-first');
 assert.equal(b.tactical.earlyEconomyMode,'frontline-recovery');
 for(let i=0;i<240;i++){a.step(.05);b.step(.05);}
 assert.deepEqual(a.bases,b.bases);
 assert.deepEqual(a.units,b.units);
 assert.deepEqual(a.credits,b.credits);
 assert.deepEqual(a.territories,b.territories);
 assert.deepEqual(a.visible,b.visible);
 assert.equal(b.tactical.state.lastPlan,-3);
 assert.equal(b.save().ai?.earlyEconomyMode,undefined);
});
