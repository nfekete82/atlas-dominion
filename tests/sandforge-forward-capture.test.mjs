import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {forwardCaptureVanguard} from '../dist/src/reborn/assault-wave.js';
import {configureContender} from '../scripts/ai-strategy-tournament.mjs';
const ground=(id,p={})=>({
 id,ground:true,healthFraction:1,distanceToMission:280+id*12,
 distanceToRally:650,...p
});
const caseAt=(patch={})=>({
 enabled:true,mapVersion:11,time:80,phase:'gather',phaseSeconds:25,
 missionKind:'capture',sectorOwner:-1,knownGunCover:false,
 observedDefenders:0,homeUnderAttack:false,
 members:[ground(1),ground(2),ground(3),ground(4)],...patch
});
test('forward capture: use three healthy paid combatants already near a neutral objective',()=>{
 assert.deepEqual(forwardCaptureVanguard(caseAt()),[1,2,3,4]);
 assert.deepEqual(forwardCaptureVanguard(caseAt({members:[
  ground(1),ground(2),ground(3,{healthFraction:.4}),
  ground(4,{ground:false}),ground(5,{distanceToRally:300})]})),[]);
 assert.deepEqual(forwardCaptureVanguard(caseAt({members:[
  ground(3),ground(2),ground(1),ground(6,{distanceToMission:900})
 ]})),[1,2,3]);
});
test('forward capture: cannot bypass observed defenses, contested sectors or known artillery threat',()=>{
 for(const patch of [
  {enabled:false},{mapVersion:12},{time:39},{time:331},
  {missionKind:'structure'},{missionKind:'hunt'},{sectorOwner:0},
  {sectorOwner:1},{knownGunCover:true},{observedDefenders:1},
  {homeUnderAttack:true},{phase:'attack'},{phase:'defend'},
  {phase:'regroup',phaseSeconds:5},
 ]){
  assert.deepEqual(forwardCaptureVanguard(caseAt(patch)),[],JSON.stringify(patch));
 }
 assert.deepEqual(forwardCaptureVanguard(caseAt({phase:'regroup',phaseSeconds:7})),[1,2,3,4]);
});
test('forward capture: no anti-rally acceleration when fighters are already at their staging point',()=>{
 const members=[ground(1,{distanceToRally:250}),ground(2,{distanceToMission:650}),
  ground(3,{distanceToRally:360,distanceToMission:340}),
  ground(4,{distanceToRally:600,distanceToMission:510,healthFraction:.35})];
 assert.deepEqual(forwardCaptureVanguard(caseAt({members})),[]);
});
test('forward capture: same paid first 12 seconds, real clock, no extra units, cash or fog',()=>{
 const baseline=new Simulation(2058,11),forward=new Simulation(2058,11);
 configureContender(baseline.tactical,'early-barracks');
 configureContender(forward.tactical,'forward-capture');
 assert.equal(forward.tactical.earlyEconomyMode,'barracks-first');
 assert.equal(forward.tactical.forwardCaptureMode,'advance');
 for(let i=0;i<240;i++){baseline.step(.05);forward.step(.05);}
 assert.deepEqual(forward.units,baseline.units);
 assert.deepEqual(forward.bases,baseline.bases);
 assert.deepEqual(forward.credits,baseline.credits);
 assert.deepEqual(forward.territories,baseline.territories);
 assert.deepEqual(forward.visible,baseline.visible);
 assert.deepEqual(forward.explored,baseline.explored);
 assert.equal(forward.tactical.state.lastPlan,-3);
 assert.equal(forward.save().ai?.forwardCaptureMode,undefined);
});
