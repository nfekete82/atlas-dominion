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
 assert.deepEqual(requiredTaskForce(true,2),{infantry:3,heavy:1,medic:1,artillery:1});
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

test('operations: only an actual rebuilt attack receives a mandatory cheap infantry replacement',()=>{
 const mission={sector:2,objective:100};
 const fresh=advanceOperation(undefined,mission,80,true,2,'gather');
 const launched=advanceOperation(fresh,mission,90,true,2,'attack');
 const failed=advanceOperation(launched,mission,98,true,2,'regroup');
 const available=k=>['infantry','heavy','medic','tank','artillery'].includes(k);
 assert.equal(nextTaskForcePurchase(fresh,{infantry:0},available),null,
  'opening attacks may recruit rapidly instead of saving for an ideal composition');
 assert.equal(nextTaskForcePurchase(launched,{infantry:0},available),null,
  'active battles must not repeatedly replace expensive reserved quotas');
 assert.equal(nextTaskForcePurchase(failed,{infantry:0,heavy:0,tank:2},available),'infantry',
  'rebuilding 2 surviving tanks without a frontline demands paid infantry first');
 assert.equal(nextTaskForcePurchase(failed,{infantry:1,heavy:1,tank:2},available),'infantry');
 assert.equal(nextTaskForcePurchase(failed,{infantry:2,heavy:1,tank:2},available),null,
  'do not keep saving for a second costly artillery piece while soldiers can attack');
 assert.equal(nextTaskForcePurchase(failed,{infantry:0,heavy:0},k=>k==='tank'),null,
  'missing barracks is not a reason to reserve a non-existent infantry producer');
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

test('operations: after a failed wave, real barracks rebuild cheap troops even with two surviving tanks',()=>{
 const g=new Simulation(2026,4);g.aiClock=-1e8;
 const barracks=addProducer(g,'barracks',1);
 const factory=addProducer(g,'factory',1);
 const hq=g.bases.find(b=>b.kind==='headquarters'&&b.owner===1);
 g.units=g.units.filter(u=>u.owner===0||u.kind==='engineer');
 for(let i=0;i<2;i++)g.spawn(1,{x:hq.x+90+i*30,y:hq.y+100},'tank');
 const mission={sector:2,objective:999};
 g.tactical.state.commander=newCampaign();
 g.tactical.state.commander.mission={kind:'structure',x:900,y:900,sector:2,objective:999,
  hp:650,since:0,progressAt:0,distance:1200};
 const fresh=advanceOperation(undefined,mission,g.time,true,1,'gather');
 const running=advanceOperation(fresh,mission,g.time,true,1,'attack');
 g.tactical.state.operation=advanceOperation(running,mission,g.time,true,1,'regroup');
 g.credits[1]=150;
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1),()=>0);
 assert.equal(barracks.queueTypes[0],'infantry',
  'operation rebuilding overrides an unaffordable 450-credit replacement tank');
 assert.equal(g.tactical.state.economy.produced.infantry,1);
 assert.equal(g.credits[1],50,'regular paid recruitment, no extra money');
 assert.ok(factory.queue.length<=2);
});

test('operations: older saved campaigns without an operational order load normally',()=>{
 const g=new Simulation(2026,4),saved=g.save();
 delete saved.ai.operation;
 const loaded=Simulation.load(saved);
 assert.equal(loaded.tactical.state.operation,undefined);
});
