import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOptions,runMatch,summarize} from '../scripts/benchmark-reborn-ai.mjs';

test('benchmark CLI accepts reference-friendly single modes and several map sizes',()=>{
 const options=parseOptions(['--maps','3,4,5','--modes','director','--seeds','2026,2027','--seconds','1800','--label','original']);
 assert.deepEqual(options.maps,[3,4,5]);assert.deepEqual(options.modes,['director']);assert.equal(options.seconds,1800);
 for(const argv of [['--modes','cheat'],['--maps','4,4'],['--seconds','NaN'],['--output'],['--secret','1'],['--seeds','2026,2026']])assert.throws(()=>parseOptions(argv));
});

// This fixture verifies observer accounting, not the AI's playing strength.
// Its HQ is deliberately on a different territory than the first blue sector,
// and is captured/repaired after destruction, as real Simulation.step permits.
class AccountingFixture {
 constructor(){
  this.time=0;this.status='playing';this.credits=[950,950];this.tick=0;
  this.tactical={state:{phase:'gather',groupId:0,group:[],target:null,objective:null,progressAt:0,recovering:[]}};
  this.units=[{id:1,owner:1,kind:'infantry',hp:100,x:0,y:0},{id:2,owner:0,kind:'infantry',hp:100,x:0,y:0}];
  const base=(id,owner,kind,territory,hp)=>({id,owner,kind,territory,hp,x:0,y:0,queue:[],queueTypes:[],buildRemaining:0});
  this.bases=[base(1000,0,'headquarters',5,1200),base(1001,1,'factory',1,500),base(1002,0,'barracks',2,300)];
  this.territories=[{id:2,owner:0,point:{x:0,y:0}},{id:5,owner:0,point:{x:0,y:0}},{id:1,owner:1,point:{x:0,y:0}},{id:8,owner:-1,point:{x:0,y:0}}];
  this.explored=[new Uint8Array([1]),new Uint8Array([1])];this.memories=[[],[]];this.workEffects=[];this.shots=[];
 }
 recruit(id,kind){const b=this.bases.find(b=>b.id===id);if(!b)return false;this.credits[b.owner]-=100;b.queue.push(1);b.queueTypes.push(kind);return true;}
 cancel(){}
 command(){}
 strike(source,target,amount){target.hp-=amount;}
 count(owner){return this.units.filter(u=>u.owner===owner&&u.hp>0).length;}
 income(){return 10;}
 canSee(){return true;}
 step(dt){
  this.time+=dt;this.tick++;this.workEffects=[];this.shots=[];
  const hq=this.bases.find(b=>b.id===1000),factory=this.bases.find(b=>b.id===1001),s=this.tactical.state;
  if(this.tick===1)this.recruit(1001,'rover');
  if(this.tick===2){this.units.push({id:3,owner:1,kind:'rover',hp:200,x:0,y:0});factory.queue=[];factory.queueTypes=[];this.memories[1].push({...hq});}
  if(this.tick===3){this.strike(3,hq,100);this.command([3],{kind:'attack',target:1000,x:0,y:0});s.phase='attack';s.group=[1,3];s.groupId=1;s.objective=1000;s.target=5;}
  if(this.tick===4)this.strike(3,hq,1500);
  if(this.tick===5){hq.owner=1;hq.hp=600;s.phase='gather';}
  if(this.tick===6)this.territories.find(t=>t.id===8).owner=1;
  if(this.tick===7)this.territories.find(t=>t.id===8).owner=0;
  if(this.tick===8)this.territories.find(t=>t.id===8).owner=1;
  if(this.tick===9){s.recovering=[3];this.units.find(u=>u.id===3).hp=100;this.workEffects=[{kind:'repair',target:3,amount:20,at:this.time}];}
  if(this.tick===10){s.recovering=[];this.units.find(u=>u.id===3).hp=200;this.shots=[{owner:1,kind:'rover',source:3,at:this.time}];}
  if(this.tick===11){this.strike(3,this.units.find(u=>u.id===2),100);this.units=this.units.filter(u=>u.hp>0);}
  if(this.tick===12){this.strike(3,this.bases.find(b=>b.id===1002),300);this.bases=this.bases.filter(b=>b.hp>0);this.status='defeat';}
 }
}

test('benchmark counts actual births, gross recaptures, exact HQ damage and true terminal wins',()=>{
 const options=parseOptions(['--map','4','--modes','director','--seeds','2026','--seconds','30','--opponent','idle']);
 const result=runMatch({Simulation:AccountingFixture,UNITS:{rover:{hp:200}}},options,2026,'director',4);
 assert.equal(result.win,true);assert.equal(result.loss,false);assert.equal(result.outcome,'win');
 assert.equal(result.enemyHQSeen,true);assert.equal(result.enemyHQDamaged,true);assert.equal(result.enemyHQDestroyed,true);assert.equal(result.enemyHQCaptured,true);
 assert.equal(result.enemyHQDamage,1200,'overkill is excluded');assert.equal(result.blueHeadquartersHp,0,'captured HQ does not count as remaining blue HP');
 assert.equal(result.enemyBuildingsDestroyed,2);assert.equal(result.enemyBuildingsDamaged,2);assert.equal(result.enemyBuildingDamage,1500);
 assert.equal(result.captures,2);assert.equal(result.netCaptures,1);assert.equal(result.territoriesLost,1);
 assert.deepEqual(result.redOrdersByKind,{rover:1});assert.deepEqual(result.redProducedByKind,{rover:1});assert.equal(result.paidRecruitCredits,100);
 assert.equal(result.blueUnitsLost,1);assert.deepEqual(result.blueLossesByKind,{infantry:1});
 assert.equal(result.vehicleEvacuations,1);assert.equal(result.vehicleReturned,1);assert.equal(result.repairedVehiclesReused,1);assert.equal(result.vehicleRepairHp,20);
 assert.equal(result.buildingAttackCommands,1);assert.equal(result.abortedMissions,0);assert.equal(result.missionEvents[0].outcome,'completed');
 assert.equal(result.cpu.steps,12);assert.equal(result.productionSeconds.factory.available,.6);assert.equal(result.productionSeconds.factory.busy,.05);
 const summary=summarize([result]);assert.equal(summary['map4:director'].wins,1);assert.equal(summary['map4:director'].hqDestroyed,1);
});

test('parallel production measures overlapping queue time rather than adding producer durations',()=>{
 class ParallelFixture extends AccountingFixture {
  constructor(){
   super();
   for(const [id,kind] of [[1003,'barracks'],[1004,'airfield']])this.bases.push({id,kind,owner:1,hp:500,territory:1,x:0,y:0,buildRemaining:0,queue:[5],queueTypes:['infantry']});
  }
 }
 const options=parseOptions(['--map','4','--modes','director','--seeds','2026','--seconds','30','--opponent','idle']);
 const result=runMatch({Simulation:ParallelFixture,UNITS:{rover:{hp:200}}},options,2026,'director',4);
 assert.equal(result.maxParallelProducers,3);assert.equal(result.parallelProductionSeconds,.6);assert.equal(result.tripleProductionSeconds,.05);
 assert.equal(result.productiveBarracksSeconds,.6);assert.equal(result.productiveAirfieldSeconds,.6);
});
