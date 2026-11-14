import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';

function freshFactory(kind='factory',unitKind='rover',facing=0,rally={x:2200,y:2070}){
 const g=new Simulation(2026,4);
 g.world.blocked.fill(0);g.world.components.fill(0);g.aiClock=1e8;
 g.credits=[5000,5000];g.stageWebGLProduction=true;
 const b={...g.bases[0],id:1700,x:1700,y:1700,kind,radius:BUILDINGS[kind].radius,
  hp:BUILDINGS[kind].hp,facing,buildRemaining:0,queue:[UNITS[unitKind].buildTime],
  queueTypes:[unitKind],queueCosts:[UNITS[unitKind].cost],
  production:UNITS[unitKind].buildTime-.05,rally};
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

for(const facing of [0,2,1,3])test('factory spawn points forward at the actual gate for facing '+facing,()=>{
 const angle=[0,Math.PI,Math.PI/2,Math.PI*1.5][facing];
 const forward={x:Math.sin(angle),y:Math.cos(angle)};
 const rally={x:1700+forward.x*550,y:1700+forward.y*550};
 const {g,b,u}=freshFactory('factory','tank',facing,rally);
 const projection=(p)=>(p.x-b.x)*forward.x+(p.y-b.y)*forward.y;
 const side=(p)=>(p.x-b.x)*forward.y-(p.y-b.y)*forward.x;
 const start={x:u.x,y:u.y};
 assert.ok(projection(start)>=b.radius+135,'tank must spawn clear of the front shutter');
 assert.ok(Math.abs(side(start))<1,'clear front lane must not put the tank beside/behind the factory');
 assert.ok(g.world.walkable(start,g.obstacles(),Math.max(0,UNITS.tank.radius-10)));
 assert.equal(u.orders[0]?.kind,'attackMove');
 assert.ok(g.isProductionDepartureHeld(u.id));
 for(let i=0;i<220;i++)g.step(.05);
 assert.ok(projection(u)>projection(start)+25,'rally must continue outward instead of reversing round the factory');
 assert.ok(Math.abs(side(u))<80,'tank should not loop round the building on a free exit lane');
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


for(const facing of [0,2,1,3])test('MK2 pioneer exits in front of the gate and STAYS if no rally: facing '+facing,()=>{
 const {g,b,u}=freshFactory('headquarters','engineer',facing,null);
 const angle=[0,Math.PI,Math.PI/2,Math.PI*1.5][facing];
 const forward={x:Math.sin(angle),y:Math.cos(angle)};
 const side={x:Math.cos(angle),y:-Math.sin(angle)};
 const spot={x:u.x,y:u.y};
 const front=(spot.x-b.x)*forward.x+(spot.y-b.y)*forward.y;
 const offset=(spot.x-b.x)*side.x+(spot.y-b.y)*side.y;
 assert.ok([72,96,120].some(d=>Math.abs(front-(b.radius+d))<1),
  'front-facing safe spawn must be one of the three gate distances');
 assert.ok([0,23,46].some(d=>Math.abs(Math.abs(offset)-d)<1),
  'spawn remains in the gate lane (centred or one of the short fallback slots)');
 assert.ok(Math.abs(offset)<46.01,'never use legacy large diagonal off to the side');
 assert.deepEqual(u.orders,[],'no unsolicited rally movement');
 assert.ok(g.isProductionDepartureHeld(u.id));
 for(let i=0;i<180;i++)g.step(.05);
 assert.deepEqual({x:u.x,y:u.y},spot,'pioneer waits outside the fence');
 assert.deepEqual(u.orders,[]);
 assert.ok(!g.isProductionDepartureHeld(u.id));
});

for(const facing of [0,2,1,3])test('MK2 pioneer walks toward an explicit rally only AFTER the gate: facing '+facing,()=>{
 const angle=[0,Math.PI,Math.PI/2,Math.PI*1.5][facing];
 const forward={x:Math.sin(angle),y:Math.cos(angle)};
 const rally={x:1700+forward.x*550,y:1700+forward.y*550};
 const {g,b,u}=freshFactory('headquarters','engineer',facing,rally);
 const spot={x:u.x,y:u.y};
 assert.equal(u.orders[0]?.kind,'attackMove');
 g.extendProductionDeparture(u.id,g.time+6.6);
 for(let i=0;i<100;i++)g.step(.05);
 assert.deepEqual({x:u.x,y:u.y},spot,'wait for door and fence gate');
 for(let i=0;i<110;i++)g.step(.05);
 const projected=(u.x-spot.x)*forward.x+(u.y-spot.y)*forward.y;
 assert.ok(projected>15,'pioneer advances to the rally point in real Simulation');
 assert.ok(projected<450,'pioneer does not teleport to rally point');
 assert.equal(g.units.filter(v=>v.id===u.id).length,1);
 assert.equal(b.rally.x,rally.x);
});

test('MK2 HQ retains a paid production order when its front gate is blocked',()=>{
 const g=new Simulation(2074,4);
 g.world.blocked.fill(0);g.world.components.fill(0);g.aiClock=1e8;
 g.credits=[5000,5000];g.stageWebGLProduction=true;
 const b={...g.bases[0],id:1751,x:1700,y:1700,kind:'headquarters',
  radius:BUILDINGS.headquarters.radius,hp:BUILDINGS.headquarters.hp,facing:0,
  buildRemaining:0,queue:[UNITS.engineer.buildTime],
  queueTypes:['engineer'],queueCosts:[UNITS.engineer.cost],
  production:UNITS.engineer.buildTime-.05,rally:null};
 g.bases.push(b);
 const nearest=g.world.nearest.bind(g.world);
 g.world.nearest=()=>null;
 g.step(.05);
 assert.equal(b.queue.length,1);
 assert.equal(g.productionReleases.length,0);
 g.world.nearest=nearest;
 g.step(.05);
 assert.equal(b.queue.length,0);
 assert.equal(g.productionReleases.length,1);
});

test('fence-free MK2 barracks cannot block simulation when its entry is occupied',()=>{
 const g=new Simulation(3098,4);
 g.world.blocked.fill(0);g.world.components.fill(0);g.aiClock=1e8;
 g.credits=[5000,5000];g.stageWebGLProduction=true;
 g.barracksMk2Enabled=true;g.barracksMk2ExitDistance=145;
 const b={...g.bases[0],id:1930,x:1700,y:1700,kind:'barracks',
  radius:BUILDINGS.barracks.radius,hp:BUILDINGS.barracks.hp,
  facing:0,buildRemaining:0,queue:[UNITS.infantry.buildTime],
  queueTypes:['infantry'],queueCosts:[UNITS.infantry.cost],
  production:UNITS.infantry.buildTime-.05,rally:null};
 g.bases.push(b);
 const originalWalkable=g.world.walkable.bind(g.world);
 let checks=0,nearest=0;
 const originalNearest=g.world.nearest.bind(g.world);
 g.world.walkable=(...args)=>{checks++;return false;};
 g.world.nearest=(...args)=>{nearest++;return originalNearest(...args);};
 for(let i=0;i<12;i++)g.step(.05);
 assert.equal(b.queue.length,1,'paid unit stays queued while exit unavailable');
 assert.equal(g.productionReleases.length,0);
 assert.ok(checks<=15,'blocked exit scanned once, not on every 20-Hz tick');
 assert.ok(nearest<10,'no repeated heavyweight nearest-search loop in barracks production');
 // Restore the world and ensure production recovers on the bounded retry.
 g.world.walkable=originalWalkable;g.world.nearest=originalNearest;
 for(let i=0;i<32&&b.queue.length;i++)g.step(.05);
 assert.equal(b.queue.length,0,'production resumes as soon as the exit is safe');
 assert.equal(g.productionReleases.length,1);
 const release=g.productionReleases[0];
 assert.equal(g.isProductionDepartureHeld(release.unitId),false,
  'never hold an authoritative unit for the decorative door animation');
 const unit=g.units.find(u=>u.id===release.unitId);
 assert.ok(unit);
 assert.deepEqual(unit.orders,[],'without a rallypoint the unit remains at its release spot');
});

test('MK2 Kaserne stage uses a bounded spawn candidate list rather than nearest-search on each tick',async()=>{
 const {barracksMk2DoorExitCandidates}=await import('../dist/src/reborn/production-exit.js');
 for(const facing of [0,1,2,3]){
  const b={x:1700,y:1700,radius:53,facing};
  const positions=barracksMk2DoorExitCandidates(b,145);
  assert.equal(positions.length,15);
  assert.ok(positions.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  const heading=[0,Math.PI,Math.PI/2,Math.PI*1.5][facing];
  const toward={x:Math.sin(heading),y:Math.cos(heading)};
  assert.ok(positions.every(p=>(p.x-b.x)*toward.x+(p.y-b.y)*toward.y>=144.9));
 }
});

test('MK2 barracks door animation never moves, hides or holds the real produced unit',async()=>{
 const {SandforgeProductionGates}=await import('../scripts/webgl-production-gates.js');
 const game={
  time:0,stageWebGLProduction:true,productionReleases:[],
  units:[{id:50,kind:'infantry',hp:100,orders:[]}],
  bases:[{id:30,kind:'barracks',hp:1000}],
  cancelProductionDeparture(id){this.cancelled=id;},
  extendProductionDeparture(){throw Error('MK2 barracks must never block the simulation');}
 };
 const actor={node:{visible:true,position:{x:180,y:0,z:140}},productionMotion:null};
 const before={...actor.node.position};
 const portal={mk2:true,left:{position:{x:-1}},right:{position:{x:1}},
  leftX:-1,rightX:1,hall:{visible:false}};
 const lamp={visible:false,material:{emissiveIntensity:0}};
 const entry={id:30,mk2Barracks:true,node:{visible:true},
  gate:{kind:'barracks',portal,hall:portal.hall,lamp}};
 const battlefield={game,bases:new Map([[30,entry]]),
  units:new Map([[50,actor]])};
 const presenter=new SandforgeProductionGates(battlefield);
 game.productionReleases.push({baseId:30,unitId:50,kind:'infantry',at:0});
 presenter.update();
 assert.equal(game.cancelled,50);
 assert.equal(presenter.active.size,0,'no actor path rollout started');
 assert.equal(presenter.safeBarracks.size,1,'only cosmetic door cue registered');
 assert.deepEqual(actor.node.position,before);
 game.time=.7;presenter.update();
 assert.equal(portal.left.position.x,-2.36,'sliding door opens while actor stays authoritative');
 assert.deepEqual(actor.node.position,before);
 game.time=2.3;presenter.update();
 assert.equal(presenter.safeBarracks.size,0);
 assert.equal(portal.left.position.x,-1,'shutter closes after finite animation');
 assert.deepEqual(actor.node.position,before);
 assert.equal(actor.node.visible,true);
});
