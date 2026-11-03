import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {tempoSnapshot,classifyTempo,TempoObserver,parseTempoAuditOptions,
 AUDIT_CONTENDERS,TEMPO_REASONS} from '../scripts/ai-assault-tempo-audit.mjs';

function snapshot(patch={}){
 return {at:1,phase:'gather',commander:'buildup',
  mission:{kind:'capture',sector:1,objective:null,progressAt:1},
  objectiveSeenHp:null,groupId:0,fighters:5,groupSize:3,
  attackOrders:0,visibleTowerCover:false,artillery:0,queuedArtillery:0,
  ownSectors:1,ownTerritorySignature:'1000',credits:500,income:50,
  savingFor:null,productionReason:null,...patch};
}
test('assault observer is read-only, owns no commands and respects initial fog',()=>{
 const g=new Simulation(2026,11),before=g.save();
 const s=tempoSnapshot(g);
 assert.ok(['gather','regroup','attack','defend'].includes(s.phase));
 assert.equal(s.ownSectors,1);
 assert.equal(s.artillery,0);
 assert.ok(!Object.hasOwn(s,'blueUnits'));
 assert.ok(!Object.hasOwn(s,'hiddenEnemies'));
 const observer=new TempoObserver();
 for(let i=0;i<40;i++)g.step(.05),observer.observe(g);
 const report=observer.finish();
 assert.ok(report.sampledSeconds>1);
 assert.ok(report.sampledSeconds<=g.time+1e-5);
 assert.ok(report.rootCauseSeconds);
 // Sampling a frozen state is pure; normal simulation steps themselves are not.
 const unchanged=g.save();
 tempoSnapshot(g);observer.observe(g);
 assert.deepEqual(g.save(),unchanged);
 assert.notDeepEqual(g.save(),before,'test must have advanced actual simulation');
});
test('tempo: reason categories are mutually exclusive, ordered by real mission state',()=>{
 const cases=[
  [snapshot({phase:'defend'}),'home-defense'],
  [snapshot({phase:'regroup'}),'regroup'],
  [snapshot({phase:'attack',attackOrders:2}),'attack-with-orders'],
  [snapshot({phase:'attack',attackOrders:0}),'attack-without-orders'],
  [snapshot({mission:null}),'no-mission'],
  [snapshot({visibleTowerCover:true}),'siege-wait'],
  [snapshot({visibleTowerCover:true,queuedArtillery:1}),'assembly'],
  [snapshot({fighters:2}),'insufficient-force'],
  [snapshot(),'assembly'],
 ];
 for(const [s,expected] of cases){
  assert.equal(classifyTempo(s),expected);
  assert.ok(TEMPO_REASONS.includes(expected));
 }
});
test('tempo: simulated seconds reconcile and real observed objective HP counts as progress',()=>{
 const o=new TempoObserver();
 o.absorb(snapshot({at:1,phase:'attack',attackOrders:2,
  mission:{kind:'structure',sector:1,objective:9,progressAt:0},
  objectiveSeenHp:100}),1);
 o.absorb(snapshot({at:2,phase:'attack',attackOrders:2,
  mission:{kind:'structure',sector:1,objective:9,progressAt:0},
  objectiveSeenHp:90}),1);
 o.absorb(snapshot({at:50,phase:'attack',attackOrders:1,
  mission:{kind:'structure',sector:1,objective:9,progressAt:0},
  objectiveSeenHp:90}),48);
 o.absorb(snapshot({at:51,phase:'regroup',attackOrders:0,
  mission:{kind:'capture',sector:2,objective:null,progressAt:51},
  objectiveSeenHp:null}),1);
 const r=o.finish();
 assert.equal(r.sampledSeconds,51);
 assert.equal(r.rootCauseSeconds['attack-with-orders'],50);
 assert.equal(r.rootCauseSeconds.regroup,1);
 assert.equal(r.firstObjectiveProgress,2);
 assert.equal(r.missionChanges,1);
 assert.ok(r.noObjectiveProgressSeconds>=48);
 assert.equal(r.longestUnproductiveAttack,48);
});
test('tempo: flags and representative benchmark contenders are bounded',()=>{
 assert.deepEqual([...AUDIT_CONTENDERS],['current','early-barracks','threat-guard','flank-tempo']);
 const p=parseTempoAuditOptions(['--opponent','armored','--seeds','2026,2051','--seconds','360']);
 assert.deepEqual(p.seeds,[2026,2051]);
 assert.equal(p.seconds,360);
 for(const args of [
  ['--opponent','unknown'],['--seeds','2,2'],['--seeds','oops'],
  ['--seconds','20'],['--seconds','1200'],['--foo','bar']
 ])assert.throws(()=>parseTempoAuditOptions(args));
});
