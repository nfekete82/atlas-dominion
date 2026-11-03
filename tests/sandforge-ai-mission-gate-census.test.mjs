import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {missionGateSnapshot,classifyMissionGate,MissionGateObserver,parseOptions,REASONS}
 from '../scripts/ai-mission-gate-census.mjs';

const state=(p={})=>({
 time:130,phase:'gather',mission:'structure',missionSector:2,objective:8,
 objectiveObserved:true,coveringTower:true,progressAge:55,
 fieldFighters:5,livingArtillery:false,committedArtillery:false,
 visibleHomeThreat:false,openFronts:1,adjacentFronts:1,...p
});

test('mission blockers: every independent known gate has an exclusive reason',()=>{
 const cases=[
  [{mission:null},'no-mission'],
  [{mission:'capture'},'other-mission'],
  [{time:74},'before-experiment-window'],
  [{objectiveObserved:false},'objective-not-observed'],
  [{coveringTower:false},'no-known-covering-turret'],
  [{progressAge:41},'recent-mission-progress'],
  [{fieldFighters:3},'too-few-field-fighters'],
  [{livingArtillery:true},'living-artillery'],
  [{committedArtillery:true},'paid-artillery-commitment'],
  [{visibleHomeThreat:true},'visible-home-threat'],
  [{openFronts:0},'no-observed-open-adjacent-sector'],
  [{},'eligible-before-routing']
 ];
 for(const [patch,expected] of cases){
  const reason=classifyMissionGate(state(patch));
  assert.equal(reason,expected,JSON.stringify(patch));
  assert.ok(REASONS.includes(reason));
 }
});
test('mission blockers: no hidden BLUE entities and observer cannot alter game or fog',()=>{
 const g=new Simulation(2026,11),a=g.save();
 const s=missionGateSnapshot(g);
 assert.equal(s.mission,null);
 assert.ok(!('enemyUnits' in s));
 assert.ok(!('hiddenBuildings' in s));
 assert.deepEqual(g.save(),a);
 const observer=new MissionGateObserver();
 for(let i=0;i<100;i++){g.step(.05);observer.observe(g);}
 const report=observer.finish();
 assert.ok(report.sampledSeconds>=4);
 assert.equal(Object.values(report.reasons).reduce((n,v)=>n+v,0),report.sampledSeconds);
 const after=g.save();
 missionGateSnapshot(g);observer.observe(g);
 assert.deepEqual(g.save(),after);
});
test('mission blockers: accounting and first-state transitions remain stable',()=>{
 const o=new MissionGateObserver();
 o.absorb(state({time:1,mission:null}));
 o.absorb(state({time:2,mission:'capture'}));
 o.absorb(state({time:45,progressAge:10}));
 o.absorb(state({time:90,progressAge:44,openFronts:0}));
 o.absorb(state({time:91,progressAge:45}));
 const r=o.finish();
 assert.equal(r.sampledSeconds,5);
 assert.equal(r.reasons['no-mission'],1);
 assert.equal(r.reasons['other-mission'],1);
 assert.equal(r.reasons['before-experiment-window'],1);
 assert.equal(r.reasons['no-observed-open-adjacent-sector'],1);
 assert.equal(r.reasons['eligible-before-routing'],1);
 assert.equal(r.coveringStructureSeconds,3);
 assert.equal(r.staleTowerSeconds,2);
 assert.equal(r.preRouteEligibleSeconds,1);
 assert.equal(r.episodes.length,5);
});
test('mission blockers: bounded seeds, opponents and horizon',()=>{
 const opts=parseOptions(['--opponent','armored','--seeds','2026,2058','--seconds','360']);
 assert.deepEqual(opts.seeds,[2026,2058]);
 assert.equal(opts.opponent,'armored');
 for(const flags of [['--opponent','invalid'],['--seeds','bad'],
  ['--seeds','2,2'],['--seconds','9000'],['--what','else']])
  assert.throws(()=>parseOptions(flags));
});
