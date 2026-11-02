import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {firstSiegeRocketReserve,developArmy} from '../dist/src/reborn/army-economy.js';
import {addProducer} from './fixtures/reborn-production.mjs';

const input={director:true,factoryPresent:true,observedSiege:true,underAttack:false,
 urgentDefense:false,visibleAir:false,visibleArmorThreat:false,fighters:5,artillery:0};

test('AI siege budget is derived only from real observation and a valid economy',()=>{
 assert.equal(firstSiegeRocketReserve(input),UNITS.artillery.cost);
 for(const change of [{director:false},{factoryPresent:false},{observedSiege:false},
  {underAttack:true},{urgentDefense:true},{visibleAir:true},
  {visibleArmorThreat:true},{fighters:2},{artillery:1}]){
  assert.equal(firstSiegeRocketReserve({...input,...change}),0,JSON.stringify(change));
 }
});

function scenario(known=true){
 const g=new Simulation(2026,4),home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 g.time=130;g.aiClock=-1e8;g.credits[1]=650;
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 g.world.cliffIds.fill(-1);g.explored[1].fill(1);
 const barracks=addProducer(g,'barracks',1),factory=addProducer(g,'factory',1);
 addProducer(g,'generator',1); // Opening power core is already paid and online.
 factory.buildRemaining=6;
 for(let i=0;i<5;i++)g.spawn(1,{x:home.x+100+i*20,y:home.y+105},'infantry');
 if(known)g.tactical.state.knownTurrets=[{id:9007,x:home.x+1600,y:home.y+1400,
  hp:650,seenAt:120,range:600}];
 return {g,barracks,factory,army:()=>g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier)};
}

test('AI siege budget is held during factory construction and spent on the first real rocket',()=>{
 const {g,barracks,factory,army}=scenario();
 developArmy(g,g.tactical.state,army(),()=>0);
 assert.equal(g.credits[1],650,'barracks must not spend the committed rocket budget');
 assert.deepEqual(barracks.queueTypes,[]);
 assert.deepEqual(factory.queueTypes,[]);
 factory.buildRemaining=0;
 // Finish the builder's work order as the real simulation does on completion.
 const builder=g.units.find(u=>u.owner===1&&u.kind==='engineer');
 builder.orders=[];
 developArmy(g,g.tactical.state,army(),()=>0);
 assert.deepEqual(factory.queueTypes,['artillery'],'first rocket was paid for, not merely planned');
 assert.equal(g.credits[1],50);
 assert.equal(g.tactical.state.economy.produced.artillery,1);
 developArmy(g,g.tactical.state,army(),()=>0);
 assert.equal(factory.queueTypes.filter(k=>k==='artillery').length,1,'queue prevents double reservation');
});

test('AI unseen targets do not trigger virtual siege budgeting or block the barracks',()=>{
 const {g,barracks,army}=scenario(false);
 developArmy(g,g.tactical.state,army(),()=>0);
 assert.ok(barracks.queueTypes.length>0,'normal infantry production remains paid and available');
 assert.ok(g.credits[1]<650,'without observation there is no withheld money');
});

test('AI keeps the first essential generator even when a turret is observed',()=>{
 const {g,factory,army}=scenario();
 g.bases=g.bases.filter(b=>b.kind!=='generator');
 factory.buildRemaining=0;
 const builder=g.units.find(u=>u.owner===1&&u.kind==='engineer');builder.orders=[];
 developArmy(g,g.tactical.state,army(),()=>0);
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='generator').length,1);
});

test('AI emergency defense releases siege budget rather than freezing the army',()=>{
 const {g,barracks,army}=scenario();
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const threat=g.spawn(0,{x:home.x+140,y:home.y+170},'infantry');
 g.updateVision();
 assert.ok(g.canSee(1,threat));
 developArmy(g,g.tactical.state,army(),()=>0);
 assert.ok(barracks.queueTypes.length>0,'threatened HQ may recruit defenders');
});
