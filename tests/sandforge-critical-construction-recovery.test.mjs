import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {criticalConstructionRecovery,validConstructionMonitor}
 from '../dist/src/reborn/critical-construction-recovery.js';
import {configureContender} from '../scripts/ai-strategy-tournament.mjs';

const input=(p={})=>({time:100,factoryId:1004,remaining:42,
 observedSiege:true,livingArtillery:false,underAttack:false,
 urgentDefense:false,workerAvailable:true,
 workerAlreadyBuilding:false,workerHasActivePath:false,...p});

test('factory rescue: wait for a measured 24s construction stall, not a magic seed',()=>{
 const a=criticalConstructionRecovery(input());
 assert.equal(a.retryBuild,false);
 assert.equal(a.reason,'progressing');
 assert.ok(validConstructionMonitor(a.monitor,100));
 assert.equal(criticalConstructionRecovery(input({time:123}),a.monitor).retryBuild,false);
 const b=criticalConstructionRecovery(input({time:124}),a.monitor);
 assert.equal(b.retryBuild,true);
 assert.equal(b.monitor.issuedAt,124);
 assert.equal(criticalConstructionRecovery(input({time:147}),b.monitor).retryBuild,false);
 assert.equal(criticalConstructionRecovery(input({time:148}),b.monitor).retryBuild,true);
});
test('factory rescue: visible actual progress resets the clock',()=>{
 const a=criticalConstructionRecovery(input()).monitor;
 const b=criticalConstructionRecovery(input({time:125,remaining:39}),a);
 assert.equal(b.retryBuild,false);
 assert.equal(b.monitor.progressAt,125);
 assert.equal(criticalConstructionRecovery(input({time:145,remaining:39}),b.monitor).retryBuild,false);
});
test('factory rescue: protect paid siege units, live defenses and real other builders',()=>{
 const a=criticalConstructionRecovery(input()).monitor;
 for(const patch of [
  {observedSiege:false},{livingArtillery:true},{underAttack:true},
  {urgentDefense:true},{workerAvailable:false}
 ])assert.equal(criticalConstructionRecovery(input({time:150,...patch}),a).retryBuild,false,JSON.stringify(patch));
 assert.equal(criticalConstructionRecovery(input({time:150,workerAlreadyBuilding:true,workerHasActivePath:true}),a).reason,'en-route');
 assert.equal(criticalConstructionRecovery(input({time:190,workerAlreadyBuilding:true,workerHasActivePath:true}),a).retryBuild,true,
  'repath only after 90 seconds of genuinely unchanged build progress');
});
test('factory rescue: absent or completed factory is a no-op, bad save state rejected',()=>{
 assert.equal(criticalConstructionRecovery(input({factoryId:null})).retryBuild,false);
 assert.equal(criticalConstructionRecovery(input({remaining:0})).monitor,undefined);
 assert.equal(validConstructionMonitor(undefined,100),true);
 assert.equal(validConstructionMonitor({buildingId:7,remaining:5,progressAt:150,issuedAt:0},100),false);
 assert.equal(validConstructionMonitor({buildingId:7,remaining:0,progressAt:10,issuedAt:0},100),false);
});
test('factory rescue: no free units or credits and shipped default stays off',()=>{
 for(const seed of [2026,2075,2074]){
  const baseline=new Simulation(seed,11),recovery=new Simulation(seed,11);
  configureContender(baseline.tactical,'early-barracks');
  configureContender(recovery.tactical,'critical-factory');
  assert.equal(baseline.tactical.constructionRecoveryMode,'off');
  assert.equal(recovery.tactical.constructionRecoveryMode,'stalled-factory');
  assert.equal(recovery.tactical.earlyEconomyMode,'barracks-first');
  for(let i=0;i<240;i++){baseline.step(.05);recovery.step(.05);}
  assert.deepEqual(recovery.credits,baseline.credits);
  assert.deepEqual(recovery.units,baseline.units);
  assert.deepEqual(recovery.bases,baseline.bases);
  assert.deepEqual(recovery.territories,baseline.territories);
  assert.deepEqual(recovery.explored,baseline.explored);
 }
 assert.equal(new Simulation(2026,11).tactical.constructionRecoveryMode,'off');
});
