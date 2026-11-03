import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {findReachableUnfortifiedFront} from '../dist/src/reborn/campaign-commander.js';
import {configureContender} from '../scripts/ai-strategy-tournament.mjs';

const front=(p={})=>({id:2,owner:-1,adjacent:true,knownDefense:false,
 visibleDefenders:0,routeLength:800,routeRisk:1,income:25,...p});
const state=(p={})=>({active:true,ageSinceProgress:55,fieldFighters:5,
 hasArtillery:false,committedArtillery:false,homeThreat:false,
 blockedByKnownTurret:true,fronts:[front()],...p});
test('mission escape: only a genuine observed stall with a safe reachable public front',()=>{
 assert.equal(findReachableUnfortifiedFront(state()),2);
 assert.equal(findReachableUnfortifiedFront(state({fronts:[
  front({id:3,owner:0,routeLength:900}),
  front({id:2,owner:-1,routeLength:1000})
 ]})),3);
});
test('mission escape: protect progress, real siege investment, own HQ and unit strength',()=>{
 for(const patch of [
  {active:false},{ageSinceProgress:41},{fieldFighters:3},
  {hasArtillery:true},{committedArtillery:true},
  {homeThreat:true},{blockedByKnownTurret:false}
 ])assert.equal(findReachableUnfortifiedFront(state(patch)),null,JSON.stringify(patch));
});
test('mission escape: reject known/visible defenders and impossible routes',()=>{
 for(const patch of [
  {owner:1},{adjacent:false},{knownDefense:true},{visibleDefenders:1},
  {routeLength:0},{routeLength:Infinity},{routeLength:2201},
  {routeRisk:6},{routeRisk:Infinity}
 ])assert.equal(findReachableUnfortifiedFront(state({fronts:[front(patch)]})),null,JSON.stringify(patch));
 assert.equal(findReachableUnfortifiedFront(state({fronts:[
  front({id:4}),front({id:3})
 ]})),3,'stable tie-break across repeated runs');
});
test('mission escape: paid opening, real fog and normal 25s attack clock are untouched',()=>{
 const early=new Simulation(2046,11),escape=new Simulation(2046,11);
 configureContender(early.tactical,'early-barracks');
 configureContender(escape.tactical,'measured-escape');
 assert.equal(escape.tactical.earlyEconomyMode,'barracks-first');
 assert.equal(escape.tactical.missionEscapeMode,'observed-open-front');
 for(let i=0;i<240;i++){early.step(.05);escape.step(.05);}
 assert.deepEqual(early.bases,escape.bases);
 assert.deepEqual(early.credits,escape.credits);
 assert.deepEqual(early.units,escape.units);
 assert.deepEqual(early.visible,escape.visible);
 assert.equal(escape.tactical.state.lastPlan,-3);
 assert.equal(escape.save().ai?.missionEscapeMode,undefined,'experiment flag must not serialize');
 const other=new Simulation(2046,12);
 configureContender(other.tactical,'measured-escape');
 for(let i=0;i<240;i++)other.step(.05);
 assert.equal(other.bases.some(b=>b.owner===1&&b.kind==='barracks'),false,
  'paid early barracks only applies to the four-bastion map');
});
