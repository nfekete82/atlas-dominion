import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';
import {buildingArtWidth} from '../dist/src/reborn/visual-scale.js';
import {infantryStructureColliders} from '../dist/src/reborn/infantry-structure-collision.js';
import {RULES} from '../dist/src/reborn/config.js';

const point={x:1880,y:1950};
function arena(kind='factory'){
 const g=new Simulation(2026,4);g.aiClock=-1e8;g.units=[];
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 // Retain the original headquarters for victory/economy and place a full
 // building in a clear lane (no construction or unit spawn shortcuts).
 const b={...g.bases[0],id:8877,kind,...point,owner:0,
   radius:BUILDINGS[kind].radius,hp:BUILDINGS[kind].hp,
   buildRemaining:0,queue:[],queueTypes:[],queueCosts:[],production:0};
 g.bases.push(b);g.credits[0]=5000;
 g.updateVision();
 return {g,b};
}
const bounds=(b)=>infantryStructureColliders([b]);
const walk=(g,b,u)=>g.world.walkable(u,bounds(b),Math.max(0,UNITS[u.kind].radius-10));
const run=(g,seconds,check=()=>{})=>{for(let i=0;i<Math.round(seconds/RULES.tick);i++){g.step(RULES.tick);check();}};

test('visual footprint: infantry collision grows beyond old construction circle',()=>{
 const {b}=arena('factory'),c=bounds(b)[0];
 assert.ok(c.radius>b.radius+20);
 assert.ok(c.y<b.y);
 assert.ok(c.radius<buildingArtWidth(b.kind,BUILDINGS[b.kind].width)*.5);
 assert.deepEqual(bounds({...b,hp:0}),[]);
});

for(const kind of ['infantry','heavy','engineer','medic'])
 test(`ground movement: ${kind} circles factory instead of crossing the rendered walls`,()=>{
  const {g,b}=arena();
  const u=g.spawn(0,{x:b.x-270,y:b.y-22},kind),goal={x:b.x+270,y:b.y-22};
  assert.equal(g.command([u.id],{kind:'move',...goal}),1);
  let crossed=false,lowest=Infinity;
  run(g,13,()=>{
   assert.ok(walk(g,b,u),`${kind} crossed the visible building wall at ${u.x},${u.y}`);
   lowest=Math.min(lowest,Math.hypot(u.x-b.x,u.y-b.y));
   if(u.x>b.x+90)crossed=true;
  });
  assert.ok(crossed,`${kind} failed to find a route around the factory`);
  assert.ok(lowest>b.radius-3);
 });

test('command target: clicking inside visible facade resolves to a legal ground position',()=>{
 const {g,b}=arena('headquarters');
 const u=g.spawn(0,{x:b.x-260,y:b.y+50},'infantry');
 const forbidden={x:b.x+60,y:b.y-45};
 assert.equal(g.command([u.id],{kind:'move',...forbidden}),1);
 const goal=u.orders[0];
 assert.ok(walk(g,b,goal),'unit target must not be inside the visible HQ walls');
 run(g,10,()=>assert.ok(walk(g,b,u)));
});

test('new training: infantry exits beyond the visible barracks wall',()=>{
 const {g,b}=arena('barracks');g.credits[0]=5000;
 assert.equal(g.recruit(b.id,'infantry'),true);
 run(g,UNITS.infantry.buildTime);
 const release=g.productionReleases.at(-1);
 assert.ok(release,'production event exists');
 const u=g.units.find(u=>u.id===release.unitId);
 assert.ok(walk(g,b,u),'new infantry must not spawn inside visible building walls');
});

test('legacy unit overlapping enlarged artwork can escape, never entering the true collision circle',()=>{
 const {g,b}=arena('factory');
 const visual=bounds(b)[0],clearance=UNITS.infantry.radius;
 const u=g.spawn(0,{x:b.x+visual.radius-17,y:visual.y},'infantry');
 assert.equal(g.world.walkable(u,[b]),true);
 assert.equal(walk(g,b,u),false,'old-save position is within newly reserved visual wall');
 assert.equal(g.command([u.id],{kind:'move',x:b.x+270,y:b.y}),1);
 run(g,6,()=>{
  assert.ok(g.world.walkable(u,[b]),'legacy escape must not pass through physical building');
 });
 assert.ok(walk(g,b,u),'unit should exit the enlarged visual footprint');
 assert.ok(Math.hypot(u.x-b.x,u.y-b.y)>=b.radius+clearance);
});

test('infantry separation must never push a soldier through the enlarged facade',()=>{
 const {g,b}=arena('factory'),visual=bounds(b)[0];
 const x=b.x+visual.radius+12;
 const a=g.spawn(0,{x,y:visual.y},'infantry');
 const v=g.spawn(0,{x:x+2,y:visual.y},'medic');
 run(g,1,()=>{
  assert.ok(walk(g,b,a));
  assert.ok(walk(g,b,v));
 });
});

test('saved infantry near an old facade is relocated to a safe exterior point on load',()=>{
 const {g,b}=arena('barracks');
 const visual=bounds(b)[0],old={x:b.x+visual.radius-9,y:visual.y};
 assert.ok(g.world.walkable(old,[b]));
 assert.ok(!g.world.walkable(old,bounds(b)));
 const soldier=g.spawn(0,old,'infantry');
 const restored=Simulation.load(g.save());
 const u=restored.units.find(v=>v.id===soldier.id);
 const restoredBase=restored.bases.find(x=>x.id===b.id);
 assert.ok(walk(restored,restoredBase,u));
});

test('no needless blockage for soldiers outside the building footprint',()=>{
 const {g,b}=arena('factory'),u=g.spawn(0,{x:b.x+200,y:b.y+175},'infantry');
 assert.equal(g.command([u.id],{kind:'move',x:b.x+320,y:b.y+175}),1);
 run(g,3,()=>assert.ok(walk(g,b,u)));
 assert.ok(u.x>b.x+265,'soldiers still walk efficiently when walls are not in their way');
});
