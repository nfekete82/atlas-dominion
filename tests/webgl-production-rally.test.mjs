import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';

function freshFactory(kind='factory',unitKind='rover'){
 const g=new Simulation(2026,4);
 g.world.blocked.fill(0);g.world.components.fill(0);g.aiClock=1e8;
 g.credits=[5000,5000];g.stageWebGLProduction=true;
 const b={...g.bases[0],id:1700,x:1700,y:1700,kind,radius:BUILDINGS[kind].radius,
  hp:BUILDINGS[kind].hp,buildRemaining:0,queue:[UNITS[unitKind].buildTime],
  queueTypes:[unitKind],queueCosts:[UNITS[unitKind].cost],
  production:UNITS[unitKind].buildTime-.05,rally:{x:2200,y:2070}};
 g.bases.push(b);g.step(.05);
 const release=g.productionReleases.at(-1);
 const u=g.units.find(x=>x.id===release?.unitId&&x.kind===unitKind);
 assert.ok(u,'unit produced from '+kind);
 return {g,b,u};
}

test('WebGL factory rollout keeps ONE authoritative Jeep at its spawn until door clearance',()=>{
 const {g,u}=freshFactory();
 const start={x:u.x,y:u.y};
 assert.ok(g.isProductionDepartureHeld(u.id));
 assert.equal(u.orders[0].kind,'attackMove','automatic rally is already queued');
 // Renderer extends for a longer rotated factory route if necessary.
 g.extendProductionDeparture(u.id,g.time+7);
 for(let i=0;i<100;i++)g.step(.05);
 assert.ok(g.isProductionDepartureHeld(u.id));
 assert.deepEqual({x:u.x,y:u.y},start,'no invisible travel before visual handoff');
 for(let i=0;i<100;i++)g.step(.05);
 assert.equal(g.isProductionDepartureHeld(u.id),false);
 assert.ok(Math.hypot(u.x-start.x,u.y-start.y)>4,'real unit follows path to rally after opening');
 assert.equal(g.units.filter(x=>x.id===u.id).length,1,'no duplicate actor');
});

test('manual movement interrupts staged rollout immediately',()=>{
 const {g,u}=freshFactory();
 assert.ok(g.isProductionDepartureHeld(u.id));
 const x=u.x,y=u.y;
 assert.ok(g.command([u.id],{kind:'move',x:x+100,y:y+95})>0);
 assert.equal(g.isProductionDepartureHeld(u.id),false);
 for(let i=0;i<30;i++)g.step(.05);
 assert.ok(Math.hypot(u.x-x,u.y-y)>4);
});

test('barracks troop can similarly wait for an airlock before walking to rally',()=>{
 const {g,u}=freshFactory('barracks','infantry');
 const start={x:u.x,y:u.y};
 assert.ok(g.isProductionDepartureHeld(u.id));
 for(let i=0;i<40;i++)g.step(.05);
 assert.deepEqual({x:u.x,y:u.y},start);
 for(let i=0;i<110;i++)g.step(.05);
 assert.ok(Math.hypot(u.x-start.x,u.y-start.y)>2);
});
