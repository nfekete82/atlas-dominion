import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareArenaReports,comparisonMarkdown} from '../scripts/ai-test-arena-compare.mjs';

function sample(seed,mode,values={}){return {
 seed,mapVersion:4,mode,initialStateHash:'world-'+seed,
 outcome:'timeout',score:500,enemyHQDamage:20,captures:2,
 redUnitsLost:4,blueUnitsLost:6,abortedMissions:1,
 firstOrganizedAttack:90,tactical:{combatReadyWaveLaunches:0},...values
};}
function report(label,details){return {schemaVersion:1,label,complete:true,
 completedRuns:details.length,expectedRuns:details.length,
 opponent:'guarded',opponentSourceHash:'same-opponent',catalogSourceHash:'same-catalog',
 requestedSeconds:180,timestep:.05,maps:[4],seeds:[2026,2027],modes:['director'],
 simulationSourceHash:label,details};}
test('AI A/B: identical playable worlds compare first attacks and actual combat-ready launches',()=>{
 const old=report('before',[sample(2026,'director'),sample(2027,'director',{firstOrganizedAttack:null})]);
 const next=report('after',[sample(2026,'director',{score:650,enemyHQDamage:40,captures:3,
  redUnitsLost:3,blueUnitsLost:8,abortedMissions:0,firstOrganizedAttack:62,
  tactical:{combatReadyWaveLaunches:2}}),
  sample(2027,'director',{firstOrganizedAttack:75})]);
 const result=compareArenaReports(old,next);
 assert.equal(result.pairs,2);assert.equal(result.meanScoreDelta,75);
 assert.equal(result.meanFirstOrganizedAttackDelta,-28);
 assert.equal(result.pairedAttackTimeSamples,1);
 assert.equal(result.organizedAttacksBefore,1);assert.equal(result.organizedAttacksAfter,2);
 assert.equal(result.combatReadyWaveLaunches,2);
 assert.equal(result.meanBlueLossesDelta,1);assert.equal(result.meanRedLossesDelta,-.5);
 assert.match(comparisonMarkdown(result),/Auslösungen der neuen Kampfkraft-Regel \| 2/);
});
test('AI A/B: reject unequal starting worlds and incomplete comparisons',()=>{
 const old=report('before',[sample(2026,'director'),sample(2027,'director')]);
 assert.throws(()=>compareArenaReports(old,report('after',[
  sample(2026,'director',{initialStateHash:'DIFFERENT'}),sample(2027,'director')
 ])),/Different or unmatched playable starting worlds/);
 assert.throws(()=>compareArenaReports({...old,complete:false},old),/complete schema v1/);
 assert.throws(()=>compareArenaReports(old,{...old,opponentSourceHash:'different'}),/Incompatible experiment/);
});
