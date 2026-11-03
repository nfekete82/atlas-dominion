import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {chooseOperation,operationBias,validOperation} from '../dist/src/reborn/operation-controller.js';
import {configureContender} from '../scripts/ai-strategy-tournament.mjs';

const sector=(p={})=>({sector:2,owner:0,income:25,routeLength:800,
 routeRisk:1,observedTower:false,observedHQ:false,visibleFighters:0,...p});
const view=(p={})=>({at:100,livingFighters:5,hasArtillery:false,
 enemyHQEliminated:false,observedEnemyHQ:false,visibleHomeThreat:false,
 knownEnemyTowerCount:1,fronts:[sector()],...p});

test('operations: single deterministic intent and public territory scoring',()=>{
 const o=chooseOperation(view());
 assert.equal(o.next.mode,'expand');
 assert.equal(o.openFront,2);
 assert.equal(o.changed,true);
 assert.equal(chooseOperation(view({fronts:[
  sector({sector:5,routeLength:1000}),sector({sector:4,routeLength:1000})
 ]})).openFront,4);
 assert.equal(operationBias('expand',{kind:'capture',sector:2,openFront:true,exposedTower:false}),-3200);
 assert.equal(operationBias('expand',{kind:'structure',sector:2,openFront:false,exposedTower:true}),1400);
});
test('operations: defense > confirmed cleanup > paid siege > expansion > assault > buildup',()=>{
 assert.equal(chooseOperation(view({visibleHomeThreat:true})).next.mode,'defend');
 assert.equal(chooseOperation(view({enemyHQEliminated:true})).next.mode,'cleanup');
 assert.equal(chooseOperation(view({hasArtillery:true})).next.mode,'siege');
 assert.equal(chooseOperation(view({fronts:[]})).next.mode,'buildup');
 assert.equal(chooseOperation(view({fronts:[],knownEnemyTowerCount:0,observedEnemyHQ:true})).next.mode,'assault');
 assert.equal(chooseOperation(view({livingFighters:1})).next.mode,'buildup');
});
test('operations: never infer that hidden or risky sectors are open',()=>{
 for(const patch of [
  {observedTower:true},{observedHQ:true},{visibleFighters:1},
  {routeLength:2401},{routeLength:Infinity},{routeRisk:7},
  {routeRisk:Infinity},{routeLength:0},{owner:1}
 ])assert.equal(chooseOperation(view({fronts:[sector(patch)]})).openFront,null,JSON.stringify(patch));
});
test('operations: stable dwell time, urgent defense and serializable state',()=>{
 const old=chooseOperation(view()).next;
 const wait=chooseOperation(view({at:105,fronts:[]}),old);
 assert.equal(wait.next.mode,'expand');
 assert.equal(wait.changed,false);
 const changed=chooseOperation(view({at:130,fronts:[]}),old);
 assert.equal(changed.next.mode,'buildup');
 assert.equal(changed.changed,true);
 assert.equal(chooseOperation(view({at:105,visibleHomeThreat:true}),old).next.mode,'defend');
 assert.ok(validOperation(old,100));
 assert.equal(validOperation({...old,since:200},100),false);
 assert.equal(validOperation({mode:'attack',since:0,reason:'wrong'},100),false);
});
test('operations: identical paid opening and untouched default behavior',()=>{
 const a=new Simulation(2026,11),b=new Simulation(2026,11);
 configureContender(a.tactical,'early-barracks');
 configureContender(b.tactical,'operation-controller');
 assert.equal(b.tactical.strategicMode,'operations');
 assert.equal(b.tactical.earlyEconomyMode,'barracks-first');
 assert.equal(new Simulation(2026,11).tactical.strategicMode,'classic');
 for(let i=0;i<240;i++){a.step(.05);b.step(.05);}
 assert.deepEqual(a.units,b.units);
 assert.deepEqual(a.credits,b.credits);
 assert.deepEqual(a.bases,b.bases);
 assert.deepEqual(a.visible,b.visible);
 assert.deepEqual(a.territories,b.territories);
 assert.equal(b.tactical.state.lastPlan,-3);
 const normal=new Simulation(2026,12);
 configureContender(normal.tactical,'operation-controller');
 for(let i=0;i<600;i++)normal.step(.05);
 assert.equal(normal.tactical.state.commander?.operation,undefined);
});
