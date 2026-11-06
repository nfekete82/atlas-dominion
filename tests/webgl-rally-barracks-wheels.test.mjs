import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {prepareBarracksAirlock} from '../scripts/webgl-barracks-airlock.js';

test('both original faction GLBs carry the real PBR door surfaces inside merged steel/sand geometry',()=>{
 for(const faction of [0,1]){
  const bytes=readFileSync(new URL(`../src/assets/reborn/buildings-3d/barracks-${faction}.glb`,import.meta.url));
  const length=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+length));
  assert.ok(j.nodes.some(n=>/AtlasUpgrade_barracks_steel/.test(n.name??'')));
  assert.ok(j.nodes.some(n=>/AtlasUpgrade_barracks_sand/.test(n.name??'')));
 }
});

test('barracks doorway extracts authored merged mesh pieces and cuts the actual PBR wall',()=>{
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:'#999988'});
 const body=new THREE.Mesh(new THREE.BoxGeometry(2.65,.98,1.95),material);
 body.name='Atlas_CeramicHull';body.position.y=.74;root.add(body);
 const steelGeometry=new THREE.BufferGeometry();
 steelGeometry.setAttribute('position',new THREE.Float32BufferAttribute([
  -.50,.40,1.50,.13,.40,1.50,-.15,1.10,1.50,
  1.10,.40,.75,1.30,.40,.75,1.20,.85,.75
 ],3));
 const batch=new THREE.Mesh(steelGeometry,material);
 batch.name='AtlasUpgrade_barracks_steel';root.add(batch);
 const renderer={localClippingEnabled:false},entry={kind:'barracks',detail:root};
 const gate=prepareBarracksAirlock(entry,renderer);
 assert.ok(gate);assert.equal(gate.kind,'barracks');
 assert.equal(gate.splits.length,1);
 assert.equal(gate.splits[0].part.parent,gate.door);
 assert.equal(gate.splits[0].part.geometry.getIndex().count,3);
 assert.equal(batch.geometry.getIndex().count,3);
 assert.equal(renderer.localClippingEnabled,true);
 assert.notEqual(body.material,material);
 assert.equal(body.material.clipIntersection,true);
 assert.equal(body.material.clippingPlanes.length,6);
 assert.equal(gate.hall.visible,false);
 gate.door.position.y=1;gate.updateClip();
 assert.ok(gate.planes.every(p=>Number.isFinite(p.constant)));
 gate.cleanup();
 assert.equal(body.material,material);
 assert.equal(batch.geometry,steelGeometry);
});

async function fixture(kind,facing=0){
 const {Simulation}=await import('../dist/src/reborn/simulation.js');
 const {BUILDINGS,UNITS}=await import('../dist/src/reborn/catalog.js');
 const g=new Simulation(2074,4);g.aiClock=-1e9;
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.credits[0]=1e6;g.paused=false;g.status='playing';
 const unitKind=kind==='factory'?'rover':'infantry',spec=BUILDINGS[kind];
 const b={id:9900,kind,owner:0,x:1500,y:1500,facing,radius:spec.radius,hp:spec.hp,
  buildRemaining:0,cooldown:0,queue:[UNITS[unitKind].buildTime],
  queueTypes:[unitKind],queueCosts:[UNITS[unitKind].cost],
  production:UNITS[unitKind].buildTime-.01,rally:{x:2050,y:2050}};
 g.bases.push(b);
 g.step(.05);
 const release=g.productionReleases.find(e=>e.baseId===b.id);
 assert.ok(release,'production release must exist');
 const u=g.units.find(u=>u.id===release.unitId);
 assert.ok(u);
 return {g,b,u,release,Simulation};
}
for(const kind of ['factory','barracks'])for(const facing of [0,1,2,3]){
 test(`${kind} facing ${facing}: idle staging and then physical rally movement without jumping`,async()=>{
  const {g,u,release,Simulation}=await fixture(kind,facing);
  const origin={x:u.x,y:u.y},originalOrder=JSON.stringify(u.orders);
  const expiry=u.productionExitUntil;
  assert.ok(expiry>release.at+1);
  assert.ok(u.orders.length>0,'rally is assigned, but not executed yet');
  while(g.time+.06<expiry){
   g.step(.05);
   assert.ok(Math.hypot(u.x-origin.x,u.y-origin.y)<.001,'unit moved invisibly during visible door exit');
  }
  const save=g.save();
  const loaded=Simulation.load(save);
  const savedUnit=loaded.units.find(x=>x.id===u.id);
  assert.equal(savedUnit.productionExitUntil,u.productionExitUntil);
  assert.equal(JSON.stringify(u.orders),originalOrder);
  for(let i=0;i<45;i++)g.step(.05);
  assert.equal(u.productionExitUntil,undefined);
  assert.ok(Math.hypot(u.x-origin.x,u.y-origin.y)>1,'unit never drove/walked to its real rally');
 });
}
test('manual override and stop immediately release a staged factory unit',async()=>{
 const a=await fixture('factory');
 assert.ok(a.u.productionExitUntil);
 a.g.command([a.u.id],{kind:'move',x:a.u.x+220,y:a.u.y+180});
 assert.equal(a.u.productionExitUntil,undefined);
 const b=await fixture('factory');
 b.g.stop([b.u.id]);
 assert.equal(b.u.productionExitUntil,undefined);
});
