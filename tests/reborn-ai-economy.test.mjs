import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {developArmy} from '../dist/src/reborn/army-economy.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {addProducer} from './fixtures/reborn-production.mjs';

function established(seed=2026){
 const g=new Simulation(seed,4),home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const barracks=addProducer(g,'barracks',1),factory=addProducer(g,'factory',1),airfield=addProducer(g,'airfield',1);
 for(let i=0;i<4;i++)g.spawn(1,{x:home.x-140-i*15,y:home.y+100},'infantry');
 g.spawn(1,{x:home.x-170,y:home.y+110},'heavy');
 for(const [i,kind] of ['rover','tank','artillery'].entries())g.spawn(1,{x:home.x-220-i*45,y:home.y+160},kind);
 return {g,home,barracks,factory,airfield};
}
const pulse=g=>developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier),()=>0);
const paid=g=>g.bases.filter(b=>b.owner===1).flatMap(b=>b.queueCosts??[]).reduce((a,b)=>a+b,0);

test('economy: first transport aircraft has a protected paid budget ahead of ground replacements',()=>{
 const {g,factory,barracks,airfield}=established();
 g.credits[1]=550;
 pulse(g);
 assert.equal(g.credits[1],550,'factory and barracks preserve an unaffordable transport budget');
 assert.equal(factory.queue.length+barracks.queue.length+airfield.queue.length,0);
 assert.equal(g.tactical.state.savingFor,'scout');
 g.credits[1]+=100;
 const before=g.credits[1];
 pulse(g);
 assert.deepEqual(airfield.queueTypes,['scout']);
 assert.equal(before-g.credits[1],UNITS.scout.cost);
 assert.equal(paid(g),600);
 assert.notEqual(g.tactical.state.savingFor,'scout','a paid transport queue satisfies the transport deficit');
});

test('economy: aircraft savings result in real production without duplicate transport purchases',()=>{
 const {g,airfield}=established();g.credits[1]=600;pulse(g);g.aiClock=-1e8;
 for(let i=0;i<370;i++)g.step(.05);
 assert.ok(g.units.some(u=>u.owner===1&&u.kind==='scout'));
 assert.equal(g.tactical.state.economy.produced.scout,1);
 g.credits[1]=650;pulse(g);assert.equal(airfield.queueTypes.includes('scout'),false);
});

test('economy: full vehicle queue does not deadlock another available producer',()=>{
 const {g,factory,barracks,airfield}=established();
 g.credits[1]=3000;
 assert.ok(g.recruit(factory.id,'tank'));assert.ok(g.recruit(factory.id,'artillery'));
 g.credits[1]=600;
 pulse(g);
 assert.deepEqual(airfield.queueTypes,['scout']);
 assert.equal(factory.queue.length,2,'the paid ground queue remains intact');
 assert.equal(barracks.queue.length,0);
 assert.equal(g.credits[1],0);
});

test('economy: construction and repair worker replacement overrides army savings and soft size cap',()=>{
 const {g,home}=established();
 g.units=g.units.filter(u=>u.owner!==1||u.kind!=='engineer');
 while(g.count(1)<18)g.spawn(1,{x:home.x-100,y:home.y+150},'infantry');
 g.credits[1]=200;
 pulse(g);
 assert.deepEqual(home.queueTypes,['engineer']);
 assert.equal(home.queueCosts[0],200);
 assert.equal(g.credits[1],0,'worker replacement must still be fully paid');
});

test('economy: hidden enemy aircraft and HQ do not create production intelligence',()=>{
 const g=new Simulation(2043,4),home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const enemy=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 addProducer(g,'barracks',1);const factory=addProducer(g,'factory',1);
 for(let i=0;i<5;i++)g.spawn(1,{x:home.x-100-i*12,y:home.y+100},'infantry');
 const hidden=g.spawn(0,{x:enemy.x,y:enemy.y},'bomber');g.updateVision();
 assert.equal(g.canSee(1,hidden),false);
 assert.equal(g.memories[1].some(m=>m.id===enemy.id),false);
 g.credits[1]=400;pulse(g);
 assert.deepEqual(factory.queueTypes,['rover'],'unknown air and HQ cannot force anti-air or siege policy');
 assert.equal(g.credits[1],400-UNITS.rover.cost);
});

test('economy: established armor saves for heavy support rather than replacing every loss with cheap infantry',()=>{
 const {g,home,barracks}=established();
 g.units=g.units.filter(u=>u.owner!==1||u.kind!=='heavy');
 g.spawn(1,{x:home.x-180,y:home.y+220},'bomber');
 g.spawn(1,{x:home.x-160,y:home.y+220},'scout');
 g.credits[1]=200;pulse(g);
 assert.equal(g.credits[1],200);
 assert.equal(barracks.queue.length,0);
 assert.equal(g.tactical.state.savingFor,'heavy');
 g.credits[1]+=100;pulse(g);
 assert.deepEqual(barracks.queueTypes,['heavy']);
 assert.equal(barracks.queueCosts[0],250);
 assert.equal(g.credits[1],50);
});

test('economy: aircraft loss preserves reconnaissance progression and rebuilds a ground escort',()=>{
 const {g,airfield,barracks}=established();
 g.credits[1]=600;pulse(g);
 assert.deepEqual(airfield.queueTypes,['scout']);
 g.aiClock=-1e8;
 for(let i=0;i<370;i++)g.step(.05);
 g.units=g.units.filter(u=>u.owner!==1||!['scout','infantry'].includes(u.kind));
 g.credits[1]=600;pulse(g);
 assert.deepEqual(barracks.queueTypes,['infantry'],'a depleted escort comes before another expensive aircraft');
 assert.equal(g.tactical.state.savingFor,'infantry');
 g.credits[1]=600;pulse(g);
 assert.deepEqual(barracks.queueTypes,['infantry','infantry']);
 assert.equal(g.tactical.state.savingFor,'scout','first transport aircraft loss must not reset the reconnaissance milestone');
 g.credits[1]=600;pulse(g);
 assert.deepEqual(airfield.queueTypes,['scout']);
 assert.equal(airfield.queueCosts[0],600);
});
