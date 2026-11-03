import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {newOperations,operationScore,decideOperation}
 from '../dist/src/reborn/operations-commander.js';
import {configureContender} from '../scripts/ai-strategy-tournament.mjs';

const target=(p={})=>({key:'capture:2',kind:'capture',sector:2,
 objective:null,owner:-1,income:25,structureKind:null,
 routeLength:900,routeRisk:1,knownTowers:0,visibleDefenders:0,
 knownEnemyBase:false,...p});
const obs=(p={})=>({time:95,mapVersion:11,ownSectors:1,fighters:6,
 artillery:0,recentLosses:0,enemyHQEliminated:false,homeThreat:false,
 activeKey:null,activeProgressAge:Infinity,activeObjectiveDamaged:false,
 candidates:[target()],...p});

test('operations: prioritize public income over unsiegeable known guns',()=>{
 const choices=[target(),target({key:'structure:55',kind:'structure',objective:55,
  owner:0,routeLength:700,knownTowers:1,structureKind:'headquarters'})];
 const p=decideOperation(newOperations(),obs({candidates:choices}));
 assert.equal(p.key,'capture:2');
 assert.equal(p.phase,'expand');
 assert.equal(p.changed,true);
 assert.equal(p.state.switches,1);
 assert.equal(p.state.since,95);
});
test('operations: a genuine paid artillery unit makes reachable HQ assault possible',()=>{
 const choices=[target(),target({key:'structure:55',kind:'structure',objective:55,
  owner:0,routeLength:700,knownTowers:1,structureKind:'headquarters'})];
 const result=decideOperation(newOperations(),obs({artillery:1,candidates:choices}));
 assert.equal(result.key,'structure:55');
 assert.equal(result.phase,'finish');
});
test('operations: public enemy control is preferred to equal-risk neutral ground',()=>{
 const choices=[target({key:'capture:3',sector:3,owner:0}),
  target({key:'capture:2',sector:2,owner:-1})];
 const result=decideOperation(newOperations(),obs({candidates:choices}));
 assert.equal(result.key,'capture:3');
 assert.equal(result.phase,'breakthrough');
});
test('operations: progress and minimum target lock prevent three-second target churn',()=>{
 const choices=[target({key:'capture:3',sector:3,owner:0,routeLength:720}),
  target({key:'capture:2',sector:2,owner:0,routeLength:850})];
 const memory={...newOperations(),key:'capture:2',phase:'breakthrough',
  since:80,switches:1};
 const retained=decideOperation(memory,obs({time:94,activeKey:'capture:2',
  activeProgressAge:5,candidates:choices}));
 assert.equal(retained.key,'capture:2');
 assert.equal(retained.changed,false);
 assert.equal(memory.switches,1,'pure planner cannot mutate original');
 const switched=decideOperation(retained.state,obs({time:145,
  activeKey:'capture:2',activeProgressAge:75,candidates:choices}));
 assert.equal(switched.key,'capture:3');
 assert.equal(switched.state.switches,2);
 assert.equal(switched.state.failedKey,'capture:2');
});
test('operations: visible HQ threat defers to existing tactical defender',()=>{
 const original=newOperations();
 const result=decideOperation(original,obs({homeThreat:true}));
 assert.equal(result.phase,'defend');
 assert.equal(result.key,null);
 assert.equal(result.changed,false);
 assert.equal(original.phase,'expand');
});
test('operations: never invent an unwalkable safe route or ignore visible defenders',()=>{
 const invalid=[target({routeLength:Infinity}),target({routeLength:0}),
  target({routeRisk:100}),target({routeRisk:Infinity})];
 assert.equal(decideOperation(newOperations(),obs({candidates:invalid})).phase,'recover');
 const clear=target({key:'capture:2',owner:-1});
 const seenEnemy=target({key:'capture:3',sector:3,visibleDefenders:4,
  routeLength:clear.routeLength});
 assert.equal(decideOperation(newOperations(),obs({candidates:[clear,seenEnemy]})).key,
  'capture:2');
});
test('operations: exact paid opening, unchanged default, preserved savegame schema',()=>{
 const a=new Simulation(2026,11),b=new Simulation(2026,11);
 configureContender(a.tactical,'early-barracks');
 configureContender(b.tactical,'operations-v1');
 assert.equal(a.tactical.operationsMode,'legacy');
 assert.equal(b.tactical.operationsMode,'v1');
 assert.equal(b.tactical.earlyEconomyMode,'barracks-first');
 for(let i=0;i<240;i++){a.step(.05);b.step(.05);}
 assert.deepEqual(a.units,b.units);
 assert.deepEqual(a.bases,b.bases);
 assert.deepEqual(a.credits,b.credits);
 assert.deepEqual(a.territories,b.territories);
 assert.deepEqual(a.visible,b.visible);
 assert.equal(a.tactical.state.lastPlan,-3);
 assert.equal(b.tactical.state.lastPlan,-3);
 assert.equal(b.save().ai?.operationsMode,undefined);
 const old=new Simulation(2026,11);old.tactical.restore(undefined);
 assert.equal(old.tactical.operationsMode,'legacy');
 assert.equal(old.tactical.operations.key,null);
});
test('operations: verified targets tie-break deterministically independent of enumeration',()=>{
 const frontA=target({key:'capture:3',sector:3}),
 frontB=target({key:'capture:2',sector:2});
 const a=decideOperation(newOperations(),obs({candidates:[frontA,frontB]}));
 const b=decideOperation(newOperations(),obs({candidates:[frontB,frontA]}));
 assert.equal(a.key,'capture:2');assert.equal(a.key,b.key);
 assert.ok(Number.isFinite(operationScore(frontA,obs(),newOperations())));
});
