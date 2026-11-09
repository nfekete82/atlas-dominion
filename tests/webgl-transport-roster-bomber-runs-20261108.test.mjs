import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {BOMBER_ORBIT_SPEED,BOMBER_ORBIT_RADII} from '../dist/src/reborn/bomber-orbit.js';
import {bomberAttackWaypoints,BOMBER_BOMB_RELEASE_DISTANCE} from '../dist/src/reborn/bomber-attack.js';
import {visualUnitScale} from '../scripts/webgl-scale.js';
import {selectedTransportManifest} from '../scripts/webgl-transport-controls.js';

const sim=()=>{const g=new Simulation(2074,4);g.aiClock=1e8;
 g.units=[];g.bases=[];g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.status='playing';g.paused=false;g.tactical.plan=()=>{};return g;};

test('model-only helicopter grows substantially and bomber grows slightly; movement and collision untouched',()=>{
 assert.equal(visualUnitScale('scout'),1.34);
 assert.equal(visualUnitScale('bomber'),1.03);
 assert.equal(UNITS.bomber.speed,350);
 assert.equal(BOMBER_ORBIT_SPEED,145);
 assert.ok(BOMBER_ORBIT_RADII[0]>=200);
 assert.equal(UNITS.scout.width,106);
 assert.equal(UNITS.bomber.width,107);
});

test('four and ten passenger slots mirror real occupants and never leak unselected passengers',()=>{
 const heli={id:70,kind:'scout',owner:0,hp:360,transport:{cargo:[1,3],phase:'cruise'}};
 const jeep={id:71,kind:'rover',owner:0,hp:295,transport:{cargo:[2],phase:'cruise'}};
 const infantry={id:1,kind:'infantry',owner:0,hp:100,carrier:70};
 const medic={id:3,kind:'medic',owner:0,hp:100,carrier:70};
 const engineer={id:2,kind:'engineer',owner:0,hp:100,carrier:71};
 const units=[heli,jeep,infantry,medic,engineer,
  {id:4,kind:'infantry',owner:1,hp:100,carrier:70}];
 const manifest=selectedTransportManifest(units,new Set([70]));
 assert.equal(manifest.capacity,10);
 assert.equal(manifest.occupied,2);
 assert.deepEqual(manifest.slots.slice(0,2),[
  {id:1,kind:'infantry',hp:100},{id:3,kind:'medic',hp:100}]);
 assert.ok(manifest.slots.slice(2).every(s=>s===null));
 const truck=selectedTransportManifest(units,new Set([71]));
 assert.equal(truck.capacity,4);
 assert.equal(truck.occupied,1);
 assert.equal(truck.slots[0].kind,'engineer');
 assert.equal(selectedTransportManifest(units,new Set([70,71])),null);
 assert.equal(selectedTransportManifest(units,new Set([1])),null);
 assert.equal(selectedTransportManifest(units,new Set()),null);
});

test('real 20Hz helicopter unloads one named passenger, then the remaining passengers',()=>{
 const g=sim(),h=g.spawn(0,{x:1800,y:2000},'scout');
 const passengers=Array.from({length:3},(_,i)=>g.spawn(0,
  {x:1760+i*18,y:1940+i*8},i===1?'medic':'infantry'));
 assert.equal(g.command(passengers.map(u=>u.id),{kind:'board',target:h.id,x:h.x,y:h.y}),3);
 for(let i=0;i<600&&h.transport.cargo.length<3;i++)g.step(.05);
 assert.equal(h.transport.cargo.length,3,'all three actually boarded');
 const count=g.units.length;
 assert.equal(g.transports.unload(h.id,{x:1960,y:2110},passengers[1].id),true);
 for(let i=0;i<600&&passengers[1].carrier;i++)g.step(.05);
 assert.equal(passengers[1].carrier,undefined,'medic alone disembarks');
 assert.deepEqual(h.transport.cargo.sort((a,b)=>a-b),
  [passengers[0].id,passengers[2].id].sort((a,b)=>a-b));
 for(let i=0;i<150&&h.transport.phase!=='cruise';i++)g.step(.05);
 assert.equal(g.transports.unload(h.id,{x:2110,y:2240}),true);
 for(let i=0;i<600&&h.transport.cargo.length;i++)g.step(.05);
 assert.equal(h.transport.cargo.length,0);
 assert.equal(g.units.length,count,'no passenger duplicated or destroyed');
});

test('bomber routes a fixed broad turn without teleporting or chasing the moving target',()=>{
 const p={x:1500,y:2000},target={x:1900,y:2000};
 const route=bomberAttackWaypoints(p,target,4160,1);
 assert.equal(route.length,3);
 assert.ok(route.every(q=>q.x>=8&&q.y>=8&&q.x<=4152&&q.y<=4152));
 assert.ok(Math.hypot(route[0].x-target.x,route[0].y-target.y)>=390);
 assert.ok(Math.hypot(route[1].x-target.x,route[1].y-target.y)>=500);
 assert.ok(Math.hypot(route[2].x-target.x,route[2].y-target.y)>=450);
 const reverse=bomberAttackWaypoints(p,target,4160,-1);
 assert.notDeepEqual(reverse,route);
 const edge=bomberAttackWaypoints({x:4060,y:4060},{x:4100,y:4100},4160,1);
 assert.ok(edge.every(q=>q.x<=4152&&q.y<=4152));
 assert.ok(BOMBER_BOMB_RELEASE_DISTANCE<120);
});

test('real bomber flies toward a ground target, drops delayed bomb, flies away and approaches again',()=>{
 const g=sim();
 const b=g.spawn(0,{x:1600,y:2000},'bomber');
 const t=g.spawn(1,{x:2000,y:2000},'tank');
 g.updateVision();
 assert.equal(g.command([b.id],{x:t.x,y:t.y,kind:'attack',target:t.id}),1);
 let bombs=[],maxLoopDistance=0,firstAt=Infinity,damageAt=Infinity,impact=false;
 for(let tick=0;tick<1400;tick++){
  g.step(.05);
  for(const projectile of g.missiles)if(projectile.type==='bomb'&&!bombs.includes(projectile.id)){
   bombs.push(projectile.id);if(!Number.isFinite(firstAt))firstAt=g.time;
   assert.equal(projectile.owner,0);
   assert.ok(projectile.impactAt>projectile.at,'bomb has true falling time');
  }
  if(bombs.length&&b.bomberRun)maxLoopDistance=Math.max(maxLoopDistance,
   Math.hypot(b.x-t.x,b.y-t.y));
  if(t.hp<UNITS.tank.hp){damageAt=Math.min(damageAt,g.time);impact=true;}
  if(bombs.length>=2&&impact)break;
 }
 assert.ok(bombs.length>=2,'at least two distinct bombing runs over ground target');
 assert.ok(maxLoopDistance>200,'bomber physically sweeps out into a large loop');
 assert.ok(impact,'bombs cause delayed real damage');
 assert.ok(damageAt>firstAt+.4,'impact is not instantaneous ranged cannon fire');
 assert.equal(b.kind,'bomber');
});

test('HUD delegates per-passenger buttons and keeps U for all; WebGL renders bombs as falling meshes',()=>{
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 const hud=readFileSync('scripts/webgl-classic-hud.js','utf8');
 const vfx=readFileSync('scripts/webgl-combat-vfx.js','utf8');
 assert.match(battlefield,/data-passenger-id/);
 assert.match(battlefield,/this\.unloadPassenger\(Number\(button\.dataset\.carrierId\),Number\(button\.dataset\.passengerId\)\)/);
 assert.match(battlefield,/this\.game\.transports\.unload\(carrier\.id,point,passenger\.id\)/);
 assert.match(hud,/ALLE AUSLADEN/);
 assert.match(vfx,/this\.updateFallingBombs\(active,subTick\)/);
 assert.match(vfx,/missile\.type==='bomb'/);
});
