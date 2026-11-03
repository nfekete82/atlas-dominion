import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {selectStalledSiegeFlank} from '../dist/src/reborn/campaign-commander.js';
import {configureContender} from '../scripts/ai-strategy-tournament.mjs';

const front=(patch={})=>({
 id:2,owner:-1,adjacent:true,income:25,
 knownDefense:false,visibleDefense:false,routeLength:850,routeRisk:1,
 ...patch
});
const inputs=(patch={})=>({
 stalledSeconds:56,objectiveKind:'structure',confirmedEndgame:false,
 fighters:6,hasArtillery:false,observedCoveringTower:true,visibleHomeThreat:false,
 fronts:[front()],
 ...patch
});

test('tempo: a real stalled unsieged objective permits a reachable unfortified flank',()=>{
 assert.equal(selectStalledSiegeFlank(inputs()),2);
 assert.equal(selectStalledSiegeFlank(inputs({fronts:[
  front({id:3,owner:0,routeLength:1100}),
  front({id:2,owner:-1,routeLength:900,routeRisk:3}),
 ]})),3,'contest public opponent economy where route is viable');
});
test('tempo: moving or damaging an objective, siege gun and endgame protect the original attack',()=>{
 for(const alt of [
  {stalledSeconds:44},{objectiveKind:'capture'},
  {confirmedEndgame:true},{fighters:3},{hasArtillery:true},
  {observedCoveringTower:false},{visibleHomeThreat:true},
 ]){
  assert.equal(selectStalledSiegeFlank(inputs(alt)),null,JSON.stringify(alt));
 }
});
test('tempo: never claim a fogged or defended flank is safe, reject risky routes',()=>{
 for(const alt of [
  {adjacent:false},{owner:1},{knownDefense:true},{visibleDefense:true},
  {routeLength:Infinity},{routeLength:0},{routeLength:2401},
  {routeRisk:8},{routeRisk:Infinity}
 ]){
  assert.equal(selectStalledSiegeFlank(inputs({fronts:[front(alt)]})),null,JSON.stringify(alt));
 }
 assert.equal(selectStalledSiegeFlank(inputs({fronts:[
  front({id:1,visibleDefense:true}),front({id:3,routeLength:950}),
  front({id:4,routeLength:950})
 ]})),3,'stable ID tie-break');
});
test('tempo: exact same paid 12s opening, no early planning, state or fog cheat',()=>{
 const a=new Simulation(2046,11),b=new Simulation(2046,11);
 configureContender(a.tactical,'early-barracks');
 configureContender(b.tactical,'flank-tempo');
 assert.equal(b.tactical.earlyEconomyMode,'barracks-first');
 assert.equal(b.tactical.flankTempoMode,'flank');
 for(let i=0;i<240;i++){a.step(.05);b.step(.05);}
 assert.deepEqual(a.bases,b.bases);
 assert.deepEqual(a.credits,b.credits);
 assert.deepEqual(a.units,b.units);
 assert.deepEqual(a.visible,b.visible);
 assert.deepEqual(a.territories,b.territories);
 assert.equal(b.tactical.state.lastPlan,-3);
 assert.equal(b.save().ai?.flankTempoMode,undefined);
 const other=new Simulation(2046,12);
 configureContender(other.tactical,'flank-tempo');
 assert.equal(other.tactical.flankTempoMode,'flank');
 for(let i=0;i<240;i++)other.step(.05);
 assert.equal(other.bases.some(x=>x.owner===1&&x.kind==='barracks'),false,
  'original map scope and early-build behavior is unchanged');
});
