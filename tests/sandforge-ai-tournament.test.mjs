import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {OPPONENTS,scriptedBlueTurn} from '../scripts/ai-tournament-opponents.mjs';
import {CONTENDERS,configureContender,tournamentOptions,summarizeTournament} from '../scripts/ai-strategy-tournament.mjs';

test('tournament: exactly four reproducible, legal BLUE opponents',()=>{
 assert.deepEqual(OPPONENTS,['guarded','pressure','expansion','armored']);
 assert.equal(new Set(OPPONENTS).size,4);
 assert.equal(new Set(CONTENDERS).size,4);
 assert.throws(()=>scriptedBlueTurn(new Simulation(2026,11),'omniscient'));
});
test('tournament: flags validate seeds, complete A/B and real time horizon',()=>{
 const opts=tournamentOptions(['--seeds','2026,2027','--seconds','360',
  '--opponents','guarded,pressure','--contenders','current,legacy-wave']);
 assert.deepEqual(opts.seeds,[2026,2027]);
 assert.deepEqual(opts.contenders,['current','legacy-wave']);
 for(const args of [
  ['--seeds','2026,2026'],
  ['--seconds','20'],
  ['--opponents','unknown'],
  ['--contenders','legacy-wave,baseline'],
  ['--other','123'],
  ['--seeds','bad']])assert.throws(()=>tournamentOptions(args));
});
test('tournament: A/B controllers start with precisely equal playable state',()=>{
 const baseline=new Simulation(2026,11);
 for(const name of CONTENDERS){
  const g=new Simulation(2026,11);configureContender(g.tactical,name);
  assert.deepEqual(g.units,baseline.units);
  assert.deepEqual(g.bases,baseline.bases);
  assert.deepEqual(g.credits,baseline.credits);
  assert.deepEqual(g.territories,baseline.territories);
  assert.deepEqual(g.visible,baseline.visible);
  assert.deepEqual(g.explored,baseline.explored);
 }
});
test('tournament: no unearned blue resources or prohibited direct state mutation',()=>{
 const g=new Simulation(2026,11),seedCredits=g.credits[0];
 for(const kind of OPPONENTS){
  // Controllers may issue paid orders, but the engine's actual credits
  // MUST never rise and no spawned units may appear without an engine tick.
  const h=new Simulation(2026,11),oldIds=h.units.map(u=>u.id);
  scriptedBlueTurn(h,kind);
  assert.ok(h.credits[0]<=seedCredits,kind+' granted free credits');
  assert.deepEqual(h.units.map(u=>u.id),oldIds,kind+' spawned a free unit');
  assert.deepEqual(h.territories,g.territories,kind+' changed ownership directly');
  assert.deepEqual(h.visible,g.visible,kind+' altered fog of war');
 }
});
test('tournament: no winner invented when all matches time out',()=>{
 const contenders=['current','legacy-wave'],opponents=['guarded'],seeds=[2026,2027],rows=[];
 for(const strategy of contenders)for(const seed of seeds)rows.push({
  strategy,seed,opponent:'guarded',outcome:'timeout',initialStateHash:'same',
  captures:strategy==='current'?2:3,netCaptures:strategy==='current'?1:2,
  redUnitsLost:strategy==='current'?2:3,blueUnitsLost:1,redSectors:2,enemyHQDamage:0,
  abortedMissions:0});
 const report=summarizeTournament(rows,contenders,opponents,seeds);
 assert.equal(report.decisiveMatches,0);
 assert.equal(report.hasDecisiveEvidence,false);
 assert.equal(report.championApproved,false);
 assert.deepEqual(report.leaderboard.map(x=>x.wins),[0,0]);
 assert.equal(report.comparisons['legacy-wave'].avgCaptureDelta,1);
 assert.equal(report.comparisons['legacy-wave'].avgDeathDelta,1);
 assert.equal(report.leaderboard[0].timeouts,2);
});
test('tournament: unpaired state hashes abort comparison',()=>{
 const rows=[
  {strategy:'current',seed:1,opponent:'guarded',outcome:'timeout',initialStateHash:'A',captures:1},
  {strategy:'baseline',seed:1,opponent:'guarded',outcome:'timeout',initialStateHash:'B',captures:2}
 ];
 assert.throws(()=>summarizeTournament(rows,['current','baseline'],['guarded'],[1]),/initial state/);
});
test('tournament: selectable BLUE attack only issues valid commands when eligible',()=>{
 const g=new Simulation(2026,11);
 for(const opponent of OPPONENTS){
  g.time=80;
  const before=[...g.credits];
  scriptedBlueTurn(g,opponent);
  assert.ok(g.credits[0]<=before[0]);
  assert.equal(g.credits[1],before[1]);
  assert.ok(g.units.every(u=>u.hp>0));
 }
});
