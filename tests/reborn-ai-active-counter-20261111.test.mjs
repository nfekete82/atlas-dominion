import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rocketInfantryQuota,bomberAntiArmorQuota,
 selectObservedCounterTarget} from '../dist/src/reborn/ai-counter-doctrine.js';
import {produceCombinedArmy} from '../dist/src/reborn/director-production.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';

test('rocket infantry form a meaningful bounded screen after sighting helicopters and tanks',()=>{
 const base={fighters:8,time:150,barracksReady:true,underAttack:false};
 assert.equal(rocketInfantryQuota({...base,vehicles:0,air:0}),2);
 assert.equal(rocketInfantryQuota({...base,vehicles:1,air:0}),2);
 assert.equal(rocketInfantryQuota({...base,vehicles:3,air:0}),4);
 assert.equal(rocketInfantryQuota({...base,vehicles:0,air:1}),2);
 assert.equal(rocketInfantryQuota({...base,vehicles:0,air:3}),4);
 assert.equal(rocketInfantryQuota({...base,vehicles:9,air:9}),4);
 assert.equal(rocketInfantryQuota({...base,barracksReady:false,vehicles:4,air:4}),0);
 assert.ok(rocketInfantryQuota({...base,underAttack:true,vehicles:2,air:1})>=2,
  'air-defense demand must survive a genuine home attack');
});

test('paid bomber is an anti-tank weapon, even when one enemy helicopter is visible',()=>{
 const base={airfieldReady:true,income:70,fighters:8,
  groundVehicles:3,enemyArmor:3,enemyAir:0,underAttack:false,finishing:false};
 assert.equal(bomberAntiArmorQuota(base),2);
 assert.equal(bomberAntiArmorQuota({...base,enemyAir:1}),1);
 assert.equal(bomberAntiArmorQuota({...base,enemyAir:2}),0);
 assert.equal(bomberAntiArmorQuota({...base,enemyArmor:1}),1);
 assert.equal(bomberAntiArmorQuota({...base,enemyArmor:0}),0);
 assert.equal(bomberAntiArmorQuota({...base,airfieldReady:false}),0);
 assert.equal(bomberAntiArmorQuota({...base,income:20}),0);
 assert.equal(bomberAntiArmorQuota({...base,underAttack:true}),0);
});

const actor=(id,kind,x,y)=>({id,kind,x,y,hp:UNITS[kind].hp});
const base=(id,kind)=>({id,kind,owner:1,hp:1000,buildRemaining:0,
 queue:[],queueTypes:[],queueCosts:[],production:0});
function productionFixture(seen){
 const own=[base(10,'barracks'),base(11,'factory'),base(12,'airfield')];
 const army=[actor(1,'infantry',200,200),actor(2,'infantry',210,200),
  actor(3,'heavy',220,200),actor(4,'tank',230,200),
  actor(5,'tank',240,200),actor(6,'rover',250,200),actor(7,'infantry',260,200)];
 const spent=[];
 const g={time:130,credits:[5000,5000],count(owner){return owner===1?army.length:0;},
  queued(owner){return owner===1?own.reduce((n,b)=>n+b.queue.length,0):0;},
  recruit(id,kind){
   const producer=own.find(b=>b.id===id);
   if(!producer||!UNITS[kind].producers.includes(producer.kind)||
      producer.queue.length>=2||this.credits[1]<UNITS[kind].cost)return false;
   producer.queue.push(UNITS[kind].buildTime);
   producer.queueTypes.push(kind);
   producer.queueCosts.push(UNITS[kind].cost);
   this.credits[1]-=UNITS[kind].cost;
   spent.push(kind);return true;
  }};
 const s={economy:{produced:{},built:{}}};
 const c={own,army,seen,income:70,underAttack:false,
  knownTurrets:0,knownEnemyHQ:false,reserve:0,siegeReserve:0,
  maxArmy:36,scores:Object.fromEntries(Object.keys(UNITS).map(k=>[k,80])),
  defenseNeedsWorker:false,finishing:false};
 return {g,s,c,own,spent};
}

test('real paid combined production queues rockets and bombers simultaneously vs enemy tanks',()=>{
 const f=productionFixture([actor(80,'tank',530,500),actor(81,'artillery',560,500)]);
 produceCombinedArmy(f.g,f.s,f.c);
 assert.ok(f.own[0].queueTypes.includes('rocket'),
  'barracks must buy genuine infantry rocket against seen armor');
 assert.ok(f.own[2].queueTypes.includes('bomber'),
  'operational airfield must buy genuine anti-tank bomber');
 const creditSpent=5000-f.g.credits[1];
 assert.ok(creditSpent>=UNITS.rocket.cost+UNITS.bomber.cost);
 assert.equal(creditSpent,f.spent.reduce((n,k)=>n+UNITS[k].cost,0),
  'no free units or unaccounted credits');
 const queued=f.own.map(b=>b.queueTypes.slice());
 produceCombinedArmy(f.g,f.s,f.c);
 assert.ok(f.own.every(b=>b.queueTypes.length<=2),
  'queued purchases count toward specialist quota, no spamming');
 assert.ok(f.g.credits[1]>=0);
 assert.ok(queued[0].includes('rocket')&&queued[2].includes('bomber'));
});

test('enemy transport helicopter triggers shoulder-rocket purchases, not ineffective vehicles',()=>{
 const f=productionFixture([actor(84,'scout',600,500)]);
 produceCombinedArmy(f.g,f.s,f.c);
 assert.ok(f.own[0].queueTypes.includes('rocket'),
  'enemy scout helicopters must count as air threats');
});

test('AI targeting prioritizes observed enemy aviation and tanks, not infantry',()=>{
 const from={x:400,y:400};
 const targets=[actor(90,'infantry',410,420),actor(91,'tank',500,500),
  actor(92,'bomber',510,500),actor(93,'scout',520,500)];
 assert.equal(selectObservedCounterTarget('rocket',from,targets,500)?.id,92);
 assert.equal(selectObservedCounterTarget('bomber',from,targets,500)?.id,91);
 assert.equal(selectObservedCounterTarget('bomber',from,
  [targets[0],targets[2],targets[3]],500),undefined);
});

test('real tactical director assigns reserve rocket and bomber to currently seen enemy armor',()=>{
 const g=new Simulation(20261111,24);
 g.aiClock=1e9;g.tactical.plan=()=>{};
 const red=g.units.find(u=>u.owner===1);
 const blue=g.units.find(u=>u.owner===0);
 assert.ok(red&&blue);
 const pos={x:red.x+180,y:red.y+80};
 const missile=g.spawn(1,{x:red.x+65,y:red.y+65},'rocket');
 const bomber=g.spawn(1,{x:red.x+85,y:red.y+75},'bomber');
 const tank=g.spawn(0,pos,'tank');
 let canSee=g.canSee;
 g.canSee=(owner,u)=>owner===1&&u.id===tank.id;
 try{
  g.tactical.dispatchObservedSpecialists([missile,bomber]);
  assert.equal(missile.orders[0]?.kind,'attack');
  assert.equal(missile.orders[0]?.target,tank.id);
  assert.equal(bomber.orders[0]?.kind,'attack');
  assert.equal(bomber.orders[0]?.target,tank.id);
  const prev=[missile.orders[0],bomber.orders[0]];
  g.tactical.dispatchObservedSpecialists([missile,bomber]);
  assert.equal(missile.orders[0],prev[0],'stable order, no 3s reset spam');
  assert.equal(bomber.orders[0],prev[1]);
  g.canSee=()=>false;g.stop([missile.id]);g.stop([bomber.id]);
  g.tactical.dispatchObservedSpecialists([missile,bomber]);
  assert.equal(missile.orders.length,0,'no omniscient targeting through fog');
  assert.equal(bomber.orders.length,0);
  g.canSee=(owner,u)=>owner===1&&u.id===tank.id;
  bomber.airfieldService={baseId:1,bay:0,phase:'repair',elapsed:0,paidHp:0};
  missile.hold=true;
  g.tactical.dispatchObservedSpecialists([missile,bomber]);
  assert.equal(missile.orders.length,0,'explicit hold respected');
  assert.equal(bomber.orders.length,0,'bomber in repair remains in hangar');
 }finally{g.canSee=canSee;}
});
