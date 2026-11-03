import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {chooseMission,newCampaign,validCampaign} from '../dist/src/reborn/campaign-commander.js';
import {chooseOperation,validOperation} from '../dist/src/reborn/operation-controller.js';
import {configureContender} from '../scripts/ai-strategy-tournament.mjs';

test('conservative operations: new controller is opt-in, four bastions only',()=>{
 const a=new Simulation(2026,11),b=new Simulation(2026,11);
 configureContender(a.tactical,'early-barracks');
 configureContender(b.tactical,'conservative-operations');
 assert.equal(a.tactical.operationDirectorMode,'off');
 assert.equal(b.tactical.operationDirectorMode,'new-missions');
 assert.equal(b.tactical.earlyEconomyMode,'barracks-first');
 assert.equal(new Simulation(2026,11).tactical.operationDirectorMode,'off');
 for(let i=0;i<240;i++){a.step(.05);b.step(.05);}
 assert.deepEqual(a.credits,b.credits);
 assert.deepEqual(a.bases,b.bases);
 assert.deepEqual(a.units,b.units);
 assert.deepEqual(a.territories,b.territories);
 assert.deepEqual(a.visible,b.visible);
 assert.deepEqual(a.explored,b.explored);
 const larger=new Simulation(2026,12);
 configureContender(larger.tactical,'conservative-operations');
 for(let i=0;i<600;i++)larger.step(.05);
 assert.equal(larger.tactical.state.commander?.operation,undefined);
});

test('conservative operations: an active mission is the operational authority even when strategic intent changes',()=>{
 const g=new Simulation(2026,11),s=newCampaign();
 const target=g.territories.find(t=>t.owner!==1&&t.neighbors.some(id=>g.territories[id].owner===1));
 assert.ok(target,'map must have a publicly adjacent open frontier');
 g.time=100;
 const prior={kind:'capture',x:target.point.x,y:target.point.y,sector:target.id,
  objective:null,hp:0,since:40,progressAt:90,distance:700};
 s.mission=prior;
 const own=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier);
 const origin=own.find(u=>u.kind==='infantry')??own[0];
 const context={strategy:'unknown',force:own,losses:[],fronts:[],intelligent:true,
  conservativeOperations:true,
  route:p=>({length:Math.hypot(p.x-origin.x,p.y-origin.y)+1,risk:0})};
 const returned=chooseMission(g,s,origin,context);
 assert.equal(returned,prior,'may not abort a healthy standing attack/capture');
 assert.equal(s.aborted,0,'no artificial retreat');
 assert.ok(s.operation,'central decision is still made');
 assert.ok(validOperation(s.operation,g.time));
 assert.equal(g.tactical.operationDirectorMode,'off','explicit context never silently sets live switch');
});

test('conservative operations: valid optional strategy state and malformed save rejection',()=>{
 const g=new Simulation(2026,11),s=newCampaign();
 assert.ok(validCampaign(s,40,p=>p.x>=0&&p.y>=0,g.territories.length));
 s.operation={mode:'siege',since:30,reason:'paid-counter-ready'};
 assert.ok(validCampaign(s,40,p=>p.x>=0&&p.y>=0,g.territories.length));
 s.operation={mode:'attack',since:30,reason:'unknown'};
 assert.equal(validCampaign(s,40,p=>p.x>=0&&p.y>=0,g.territories.length),false);
 s.operation={mode:'expand',since:99,reason:'future'};
 assert.equal(validCampaign(s,40,p=>p.x>=0&&p.y>=0,g.territories.length),false);
});

test('conservative operations: defensive priority and revealed obstacles cannot be bypassed',()=>{
 const view={at:100,livingFighters:5,hasArtillery:false,
  enemyHQEliminated:false,observedEnemyHQ:false,
  visibleHomeThreat:false,knownEnemyTowerCount:1,
  fronts:[{sector:2,owner:0,income:25,routeLength:800,routeRisk:1,
   observedTower:false,observedHQ:false,visibleFighters:0,currentlyVisible:true}]};
 assert.equal(chooseOperation(view).next.mode,'expand');
 assert.equal(chooseOperation({...view,visibleHomeThreat:true}).next.mode,'defend');
 assert.equal(chooseOperation({...view,hasArtillery:true}).next.mode,'siege');
 assert.equal(chooseOperation({...view,fronts:[{...view.fronts[0],observedTower:true}]}).openFront,null);
 assert.equal(chooseOperation({...view,fronts:[{...view.fronts[0],visibleFighters:1}]}).openFront,null);
 assert.equal(chooseOperation({...view,fronts:[{...view.fronts[0],currentlyVisible:false}]}).openFront,null,
  'fog-hidden capture point cannot be treated as observed safe route');
});

test('conservative operations: own opening inventory and purchased costs remain unchanged',()=>{
 for(const seed of [2026,2029,2062]){
  const ref=new Simulation(seed,11),cand=new Simulation(seed,11);
  configureContender(ref.tactical,'early-barracks');
  configureContender(cand.tactical,'conservative-operations');
  for(let i=0;i<240;i++){ref.step(.05);cand.step(.05);}
  assert.deepEqual(cand.save().credits,ref.save().credits,'no free money');
  assert.deepEqual(cand.units,ref.units,'no free troops');
  assert.deepEqual(cand.bases,ref.bases,'no new building permissions');
 }
});
