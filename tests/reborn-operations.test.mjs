import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceOperation,nextTaskForcePurchase,requiredTaskForce,validOperation} from '../dist/src/reborn/operations-command.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {newCampaign} from '../dist/src/reborn/campaign-commander.js';
import {developArmy} from '../dist/src/reborn/army-economy.js';
import {addProducer} from './fixtures/reborn-production.mjs';

test('operations: one observable objective determines a durable, role-specific roster',()=>{
 assert.deepEqual(requiredTaskForce(false,0),{infantry:3});
 assert.deepEqual(requiredTaskForce(true,0),{infantry:3,heavy:1,medic:1,tank:1});
 assert.deepEqual(requiredTaskForce(true,2),{infantry:3,heavy:1,medic:1,artillery:2});
 const mission={sector:5,objective:889};
 const a=advanceOperation(undefined,mission,30,true,2,'gather');
 const b=advanceOperation(a,mission,42,true,2,'gather');
 assert.deepEqual(a,b,'unchanged objective must not reset assembly on a macro pulse');
 const launched=advanceOperation(b,mission,48,true,2,'attack');
 assert.equal(launched.phase,'commit');assert.equal(launched.wave,1);
 const still=advanceOperation(launched,mission,51,true,2,'attack');
 assert.equal(still.wave,1,'an ongoing attack is one operation, not a new wave every AI tick');
 const rebuilding=advanceOperation(still,mission,60,true,2,'regroup');
 assert.equal(rebuilding.phase,'rebuild');
 const second=advanceOperation(rebuilding,mission,80,true,2,'attack');
 assert.equal(second.wave,2,'a rebuilt army launches a second wave on the same objective');
 assert.equal(advanceOperation(second,{sector:6,objective:null},82,false,0,'gather').wave,0,
  'an objective change starts a new, independently financed plan');
});

test('operations: buy the missing paid infantry screen before siege weapon and reserve optional armor',()=>{
 const plan=advanceOperation(undefined,{sector:2,objective:100},80,true,1,'rebuild');
 const available=k=>['infantry','heavy','medic','tank','artillery'].includes(k);
 const counts={infantry:0,heavy:0,medic:0,tank:0,artillery:0};
 for(let i=0;i<3;i++){
  assert.equal(nextTaskForcePurchase(plan,counts,available),'infantry');counts.infantry++;
 }
 assert.equal(nextTaskForcePurchase(plan,counts,available),'heavy');counts.heavy++;
 assert.equal(nextTaskForcePurchase(plan,counts,available),'artillery');counts.artillery++;
 assert.equal(nextTaskForcePurchase(plan,counts,available),'medic');counts.medic++;
 assert.equal(nextTaskForcePurchase(plan,counts,available),null);
 assert.equal(nextTaskForcePurchase(plan,{infantry:3,heavy:1},k=>k==='medic'),'medic',
  'no available factory must never cause deadlocked waiting for an impossible rocket');
});

test('operations: commander saves and restores its mission and rebuilding state',()=>{
 const g=new Simulation(2026,4);g.aiClock=-1e8;
 g.tactical.plan();
 const s=g.tactical.state;
 assert.ok(s.commander?.mission,'must have an observable strategic objective');
 assert.ok(s.operation,'operation is present for current campaign');
 assert.equal(s.operation.sector,s.commander.mission.sector);
 assert.equal(s.operation.objective,s.commander.mission.objective);
 assert.equal(validOperation(s.operation,g.time,g.territories.length),true);
 const clone=Simulation.load(g.save());
 assert.deepEqual(clone.tactical.state.operation,s.operation);
 clone.tactical.state.operation.roster.infantry=Infinity;
 assert.throws(()=>Simulation.load(clone.save()),'corrupt force counts must be rejected');
});

test('operations: paid factory supports the siege while barracks replace missing front soldiers',()=>{
 const g=new Simulation(2026,4);g.aiClock=-1e8;
 const barracks=addProducer(g,'barracks',1);
 const factory=addProducer(g,'factory',1);
 const home=g.bases.find(b=>b.kind==='headquarters'&&b.owner===1);
 const army=g.units.filter(u=>u.owner===1);
 // Start after a failed infantry wave, without granting phantom money or
 // replacing any combat units outside Simulation.recruit.
 g.units=g.units.filter(u=>u.owner===0||u.kind==='engineer');
 for(let i=0;i<3;i++)g.spawn(1,{x:home.x+70+i*20,y:home.y+70},'infantry');
 g.spawn(1,{x:home.x+110,y:home.y+130},'heavy');
 g.tactical.state.commander=newCampaign();
 g.tactical.state.commander.mission={kind:'structure',x:900,y:900,sector:2,objective:999,
  hp:650,since:0,progressAt:0,distance:1200};
 g.tactical.state.operation=advanceOperation(undefined,{sector:2,objective:999},g.time,true,1,'rebuild');
 g.credits[1]=650;
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1),()=>0);
 assert.ok(factory.queueTypes.includes('artillery'),'real paid rocket needed against observed fortification');
 assert.equal(g.tactical.state.economy.produced.artillery,1);
 assert.ok(g.credits[1]>=0,'all purchases draw from actual credits');
 assert.ok(barracks.queueTypes.length<=2,'regular queue restrictions remain');
});

test('operations: older saved campaigns without an operational order load normally',()=>{
 const g=new Simulation(2026,4),saved=g.save();
 delete saved.ai.operation;
 const loaded=Simulation.load(saved);
 assert.equal(loaded.tactical.state.operation,undefined);
});
