import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {chooseOperation,validOperation} from '../dist/src/reborn/operation-controller.js';
import {OperationShadowObserver,observeOperationView,parseOptions} from '../scripts/ai-operations-shadow.mjs';

test('shadow: uses no hidden live enemy information, no orders or saved state changes',()=>{
 const g=new Simulation(2026,11),before=g.save();
 const observation=observeOperationView(g);
 assert.ok(observation.at>=0);
 assert.ok(observation.fronts.every(f=>!Object.hasOwn(f,'hiddenEnemy')));
 const a=new OperationShadowObserver();
 a.observe(g);
 assert.deepEqual(g.save(),before,'observer must be strictly read-only');
 assert.equal(a.finish().samples,0,'first observation is at 30s');
});
test('shadow: after real combat updates it still cannot change the game',()=>{
 const g=new Simulation(2026,11),observer=new OperationShadowObserver();
 for(let i=0;i<660;i++)g.step(.05);
 const before=g.save();
 observer.observe(g);
 const result=observer.finish();
 assert.ok(result.samples>=1,'must produce an actual decision');
 assert.equal(Object.values(result.modeSeconds).reduce((n,v)=>n+v,0),result.observedSeconds);
 assert.equal(Object.values(result.actualMissionSeconds).reduce((n,v)=>n+v,0),result.observedSeconds);
 assert.deepEqual(g.save(),before);
 assert.ok(result.transitions.length>=1);
 assert.ok(validOperation(observer.operation,g.time));
});
test('shadow: strategic intent remains explicit, stable and conditional on observations',()=>{
 const view={at:100,livingFighters:5,hasArtillery:false,
  enemyHQEliminated:false,observedEnemyHQ:false,visibleHomeThreat:false,
  knownEnemyTowerCount:1,fronts:[{sector:2,owner:0,income:25,
   routeLength:700,routeRisk:2,observedTower:false,observedHQ:false,
   visibleFighters:0}]};
 const a=chooseOperation(view);
 assert.equal(a.next.mode,'expand');
 assert.equal(a.openFront,2);
 assert.equal(chooseOperation({...view,at:105,fronts:[]},a.next).next.mode,'expand');
 assert.equal(chooseOperation({...view,at:125,fronts:[]},a.next).next.mode,'buildup');
 assert.equal(chooseOperation({...view,at:105,visibleHomeThreat:true},a.next).next.mode,'defend');
 assert.equal(chooseOperation({...view,at:105,hasArtillery:true},a.next).next.mode,'siege');
 assert.equal(chooseOperation({...view,fronts:[{...view.fronts[0],visibleFighters:1}]}).openFront,null);
});
test('shadow: CLI only accepts bounded legal paid matches',()=>{
 const a=parseOptions(['--opponent','guarded','--seeds','2026,2066','--seconds','360']);
 assert.deepEqual(a.seeds,[2026,2066]);
 assert.equal(a.opponent,'guarded');
 for(const x of [['--opponent','cheat'],['--seeds','7,7'],
  ['--seeds','NaN'],['--seconds','30'],['--bad','1']])
  assert.throws(()=>parseOptions(x));
});
