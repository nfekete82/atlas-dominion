import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 failureSignals,analyzeArena,compareMatched,arenaMarkdown
} from '../scripts/ai-test-arena-analysis.mjs';
import {arenaOptions} from '../scripts/ai-test-arena.mjs';

const match=(mode,seed,overrides={})=>({
 seed,mapVersion:4,mode,initialStateHash:'same-'+seed,
 outcome:'timeout',win:false,loss:false,elapsedSeconds:240,
 score:100,captures:1,enemyHQDamage:0,redUnitsLost:3,blueUnitsLost:1,
 firstFrontContact:80,firstAssault:90,enemyHQSeen:false,enemyHQDamaged:false,
 stalledMissions:0,missionCount:1,abortedMissions:0,
 productionSeconds:{barracks:{available:100,idle:20}},
 productionIdleReasons:{'unexplained-idle':0},
 ...overrides
});
const report=details=>({
 expectedRuns:details.length,complete:true,details,
 simulationSourceHash:'same',catalogSourceHash:'same',opponentSourceHash:'same'
});

test('arena: default experiment has 48 map/seed/mode matches and user flags override defaults',()=>{
 const opts=arenaOptions([]);
 assert.deepEqual(opts.maps,[3,4,5]);
 assert.equal(opts.seeds.length,8);
 assert.deepEqual(opts.modes,['baseline','director']);
 assert.equal(opts.seconds,240);
 assert.equal(opts.maps.length*opts.seeds.length*opts.modes.length,48);
 const smoke=arenaOptions(['--maps','3','--seeds','42','--seconds','60','--modes','director']);
 assert.deepEqual(smoke.maps,[3]);assert.deepEqual(smoke.seeds,[42]);
 assert.equal(smoke.seconds,60);assert.deepEqual(smoke.modes,['director']);
 assert.throws(()=>arenaOptions(['--seeds','42,42']),/Invalid benchmark options/);
});

test('arena: no timeouts are relabeled as losses and only wins count as wins',()=>{
 const rows=[match('director',1,{outcome:'win',win:true,score:10000}),
  match('director',2,{outcome:'timeout',score:100}),
  match('director',3,{outcome:'loss',loss:true,score:50})];
 const a=analyzeArena(report(rows));
 assert.equal(a.byMode.director.wins,1);
 assert.equal(a.byMode.director.losses,1);
 assert.equal(a.byMode.director.timeouts,1);
 assert.equal(a.byMode.director.winRateAll,33.333);
 assert.equal(a.byMode.director.decisiveWinRate,50);
 const md=arenaMarkdown({...report(rows),analysis:a});
 assert.match(md,/Zeitlimits/);
 assert.match(md,/keine Niederlagen/);
});

test('arena: identical world hashes compare baseline and director with proper score signs',()=>{
 const a=analyzeArena(report([
  match('baseline',2026,{outcome:'timeout',score:100,enemyHQDamage:0,captures:1,redUnitsLost:12}),
  match('director',2026,{outcome:'win',win:true,score:10100,enemyHQDamage:400,captures:6,redUnitsLost:5})
 ]));
 assert.equal(a.modeComparison.pairs,1);
 assert.equal(a.modeComparison.directorExtraWins,1);
 assert.equal(a.modeComparison.meanScoreDelta,10000);
 assert.equal(a.modeComparison.meanHQDamageDelta,400);
 assert.equal(a.modeComparison.meanCaptureDelta,5);
 assert.equal(a.modeComparison.meanRedLossesDelta,-7);
});

test('arena: mismatched starting worlds never become paired wins',()=>{
 const a=analyzeArena(report([
  match('baseline',2026,{initialStateHash:'world-a',outcome:'loss'}),
  match('director',2026,{initialStateHash:'world-b',outcome:'win',win:true})
 ]));
 assert.equal(a.modeComparison.pairs,0);
 assert.equal(a.modeComparison.worldMismatches.length,1);
 assert.equal(a.modeComparison.directorExtraWins,0);
});

test('arena: evidence-based signals avoid asserting loss causes without observations',()=>{
 assert.deepEqual(failureSignals(match('director',10,{outcome:'win',win:true,
  stalledMissions:2,redUnitsLost:30})),[]);
 const r=match('director',10,{
  firstFrontContact:null,stalledMissions:2,missionCount:4,abortedMissions:3,
  redUnitsLost:10,blueUnitsLost:2,enemyHQSeen:true,
  productionSeconds:{factory:{available:100,idle:70}},
  productionIdleReasons:{'unexplained-idle':65}
 });
 assert.deepEqual(failureSignals(r),[
  'late-contact','mission-stalls','repeated-aborts','loss-imbalance',
  'unexplained-production-idle','hq-without-damage'
 ]);
 const a=analyzeArena(report([r]));
 assert.equal(a.topSignals.length,6);
 assert.equal(a.diagnosticSample,1);
 assert.ok(a.topSignals.every(p=>p.matches===1&&p.examples[0].seed===10));
});

test('arena: prior and current report compare only matched map seed mode hashes',()=>{
 const before=report([
  match('director',1,{outcome:'loss',score:3}),
  match('director',2,{initialStateHash:'old-map',score:5})
 ]);
 const after=report([
  match('director',1,{outcome:'win',score:200}),
  match('director',2,{initialStateHash:'new-map',score:40})
 ]);
 const diff=compareMatched(before,after);
 assert.equal(diff.pairs,1);
 assert.equal(diff.extraWins,1);
 assert.equal(diff.meanScoreDelta,197);
 assert.equal(diff.worldMismatches.length,1);
 assert.throws(()=>compareMatched({...before,simulationSourceHash:'old'},after,true),/fingerprints differ/);
});
