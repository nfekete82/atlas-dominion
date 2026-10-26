import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {developArmy} from '../dist/src/reborn/army-economy.js';
import {assessBattle,fightingPower,fightingPowerAgainst} from '../dist/src/reborn/battle-response.js';
import {newAdaptive,updateAdaptive} from '../dist/src/reborn/adaptive-strategy.js';
import {addProducer} from './fixtures/reborn-production.mjs';

function scene(){
 const g=new Simulation(2026,4),home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 const barracks=addProducer(g,'barracks',1),factory=addProducer(g,'factory',1),airfield=addProducer(g,'airfield',1);
 for(let i=0;i<4;i++)g.spawn(1,{x:home.x-100-i*20,y:home.y+100},'infantry');
 const enemy=kind=>g.spawn(0,{x:home.x-220,y:home.y+100},kind);
 const pulse=()=>{g.updateVision();developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier),()=>0);};
 return {g,home,barracks,factory,airfield,enemy,pulse};
}

test('matched strength uses the actual heavy armor penalty rather than nominal weapon damage',()=>{
 const {g,home,enemy}=scene(),heavy=g.spawn(1,home,'heavy'),tank=enemy('tank'),infantry=enemy('infantry');
 assert.equal(fightingPowerAgainst([heavy],[infantry]),fightingPower([heavy]));
 assert.ok(Math.abs(fightingPowerAgainst([heavy],[tank])/fightingPower([heavy])-Math.sqrt(.45))<1e-12);
});

test('an artillery army cannot count firepower against known aircraft or claim a safe siege screen',()=>{
 const {g,home,enemy}=scene(),rockets=Array.from({length:8},()=>g.spawn(1,home,'artillery')),air=enemy('gunship');
 assert.equal(fightingPowerAgainst(rockets,[air]),0);
 assert.equal(assessBattle(rockets,[air],[],0,true).stance,'withdraw');
 const tower={id:900,x:home.x-500,y:home.y,hp:650,range:600};
 assert.notEqual(assessBattle(rockets,[air],[tower],0).stance,'siege');
});

test('observed massed infantry creates a paid heavy infantry deficit before discretionary aircraft',()=>{
 const {g,barracks,enemy,pulse}=scene();for(let i=0;i<6;i++)enemy('infantry');
 g.credits[1]=250;pulse();assert.deepEqual(barracks.queueTypes,['heavy']);
 assert.equal(barracks.queueCosts[0],250);assert.equal(g.credits[1],0);
});

test('observed armor receives a fully paid tank response during an attack',()=>{
 const {g,factory,enemy,pulse}=scene();enemy('tank');enemy('tank');
 g.credits[1]=450;pulse();assert.deepEqual(factory.queueTypes,['tank']);
 assert.equal(factory.queueCosts[0],450);assert.equal(g.credits[1],0);
});

test('known air force funds an affordable anti-air screen and then combat aircraft rather than artillery',()=>{
 const {g,barracks,factory,airfield,enemy,pulse}=scene();enemy('gunship');enemy('gunship');
 g.credits[1]=250;pulse();assert.deepEqual(barracks.queueTypes,['heavy']);assert.deepEqual(factory.queueTypes,[]);
 g.credits[1]=750;pulse();assert.deepEqual(airfield.queueTypes,['gunship']);assert.equal(airfield.queueCosts[0],750);
 assert.equal(g.credits[1],0);assert.equal(factory.queueTypes.includes('artillery'),false);
});

test('recent observed air doctrine persists through fog but ages out',()=>{
 const {g,home,enemy,pulse}=scene();const air=enemy('gunship');g.updateVision();
 const s=g.tactical.state;s.adaptive=newAdaptive();updateAdaptive(g,s.adaptive,home,[]);
 assert.equal(s.adaptive.strategy,'air');g.units=g.units.filter(u=>u!==air);g.credits[1]=200;pulse();
 assert.equal(s.savingFor,'heavy');g.time=31;g.credits[1]=200;pulse();
 assert.notEqual(s.savingFor,'heavy');
});

test('production diagnostics distinguish saving for a role, a completed composition, full queues and army cap',()=>{
 const {g,barracks,factory,airfield,pulse}=scene();g.credits[1]=0;pulse();
 assert.equal(g.tactical.state.economy.production.facilities[factory.id].reason,'saving-unit');
 assert.ok(g.tactical.state.economy.production.facilities[factory.id].missing>0);
 assert.equal(g.tactical.state.economy.production.facilities[g.bases.find(b=>b.owner===1&&b.kind==='headquarters').id].reason,'composition-complete');
 g.credits[1]=1000;assert.ok(g.recruit(factory.id,'tank'));assert.ok(g.recruit(factory.id,'tank'));pulse();
 assert.equal(g.tactical.state.economy.production.facilities[factory.id].reason,'queue-blocked');
 while(g.count(1)+g.queued(1)<Math.min(36,Math.max(18,Math.floor(g.income(1)/3)+10)))g.spawn(1,{x:barracks.x,y:barracks.y},'infantry');pulse();
 assert.equal(g.tactical.state.economy.production.reason,'army-cap');
 const loaded=Simulation.load(g.save());assert.deepEqual(loaded.tactical.state.economy.production,g.tactical.state.economy.production);
 const broken=g.save();broken.ai.economy.production.missing=-1;assert.throws(()=>Simulation.load(broken));
});
