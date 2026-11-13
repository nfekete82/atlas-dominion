import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {SandforgeProductionGates,productionGatePose,GATE_TIMING} from '../scripts/webgl-production-gates.js';
import {buildingFacingAngle} from '../scripts/webgl-scale.js';

function fixture(facing=0,owner=0){
 const base={id:1,kind:'factory',owner,hp:1100,facing,x:500,y:500};
 const unit={id:2,kind:'tank',owner,hp:1000,x:612,y:582,orders:[{kind:'attackMove',x:900,y:900}],angle:Math.PI/4,fire:0};
 const game={time:10,bases:[base],units:[unit],productionReleases:[]};
 const root=new THREE.Group(),detail=new THREE.Group(),door=new THREE.Group();door.name='FactoryRollupDoor';detail.add(door);detail.scale.setScalar(57);root.add(detail);root.rotation.y=buildingFacingAngle(facing);
 const actor={node:new THREE.Group()},entry={node:root,detail};
 const bf={game,world:{size:1000},bases:new Map([[1,entry]]),units:new Map([[2,actor]]),heightAt:()=>0,entityPosition:u=>new THREE.Vector3(u.x-500,0,u.y-500)};
 const controller=new SandforgeProductionGates(bf);
 const event={baseId:1,unitId:2,at:10,kind:'tank',owner,from:{x:500,y:500},to:{x:612,y:582}};
 game.productionReleases.push(event);
 function tick(age){game.time=10+age;actor.node.visible=true;actor.node.position.copy(bf.entityPosition(unit));actor.productionMotion=null;controller.update();}
 return {game,base,unit,entry,actor,controller,event,tick};
}
test('door eases fully open before driving and closes only after clearance',()=>{
 assert.equal(productionGatePose(.1).open,0);
 assert.equal(productionGatePose(.75).open,.5);
 assert.equal(productionGatePose(1.25).open,1);
 assert.equal(productionGatePose(1.24).drive,0);
 assert.equal(productionGatePose(4.85).open,1);
 assert.equal(productionGatePose(5.85).done,true);
 assert.equal(GATE_TIMING.opening,1);
});
for(const owner of [0,1])for(const facing of [0,2,1,3])test(`real actor, cardinal ${facing}, faction ${owner}; simulation and rally immutable`,()=>{
 const f=fixture(facing,owner),before=JSON.stringify(f.unit);f.tick(0);
 assert.equal(f.controller.active.size,1);assert.equal(f.actor.node.visible,false);
 const clearAge=1.25+f.controller.active.get(1).duration;
 f.tick(.75);assert.equal(f.entry.gate.door.scale.y,.52);assert.equal(f.actor.node.visible,false);
 f.tick(1.25);assert.equal(f.actor.node.visible,true);
 const inside=f.actor.node.position.clone();f.tick(2.5);
 assert.ok(f.actor.node.position.distanceTo(inside)>30);
 assert.equal(f.actor.node.rotation.y,buildingFacingAngle(facing));
 assert.equal(f.entry.gate.door.scale.y,.040000000000000036);
 f.tick(clearAge);assert.ok(f.actor.node.position.distanceTo(new THREE.Vector3(112,0,82))<.0001);
 f.tick(clearAge+1);assert.equal(f.entry.gate.door.scale.y,1);assert.equal(f.controller.active.size,0);
 assert.equal(JSON.stringify(f.unit),before);assert.equal(f.game.units.length,1);f.controller.dispose();
});
for(const reason of ['command','attack','damage','baseDamage','unitDeath','baseDeath','fog','rewind'])test(`abort ${reason} restores real actor and closes gate`,()=>{
 const f=fixture();f.tick(0);f.tick(2);
 if(reason==='command')f.unit.orders=[{kind:'move',x:2,y:4}];
 if(reason==='attack')f.unit.fire=.2;
 if(reason==='damage')f.unit.hp--;
 if(reason==='baseDamage')f.base.hp--;
 if(reason==='unitDeath')f.game.units=[];
 if(reason==='baseDeath')f.game.bases=[];
 if(reason==='fog')f.entry.node.visible=false;
 f.tick(reason==='rewind'?-1:2.1);
 assert.equal(f.controller.active.size,0);assert.equal(f.entry.gate.door.scale.y,1);assert.equal(f.actor.productionMotion,null);
});
test('pause uses simulation clock; stale events and missing models do not hide units',()=>{
 const f=fixture();f.tick(0);f.tick(.75);const y=f.entry.gate.door.position.y;
 f.tick(.75);assert.equal(f.entry.gate.door.position.y,y);
 const late=fixture();late.tick(1);assert.equal(late.controller.active.size,0);assert.equal(late.actor.node.visible,true);
 const unloaded=fixture();unloaded.entry.detail=null;unloaded.tick(0);assert.equal(unloaded.actor.node.visible,true);
});
for(const owner of [0,1])test(`GLB faction ${owner} has a real opening; UVs and PBR textures survive`,()=>{
 const raw=readFileSync(new URL(`../src/assets/reborn/buildings-3d/factory-${owner}.glb`,import.meta.url));
 const len=raw.readUInt32LE(12),j=JSON.parse(raw.subarray(20,20+len)),bin=raw.subarray(28+len);
 const door=j.nodes.find(n=>n.name==='FactoryRollupDoor');assert.ok(door?.children.length>=2);
 assert.ok(j.images.length>0);assert.ok(j.materials.some(m=>m.pbrMetallicRoughness?.baseColorTexture));
 const moving=new Set(door.children),ray=new THREE.Raycaster(new THREE.Vector3(.18,.75,1.7),new THREE.Vector3(0,0,-1),0,2.5);
 const scene=new THREE.Group();
 for(const [ni,n]of j.nodes.entries()){
  if(n.mesh===undefined||moving.has(ni))continue;
  for(const p of j.meshes[n.mesh].primitives){
   const geometry=new THREE.BufferGeometry();
   const bounds=j.accessors[p.attributes.POSITION],translation=n.translation??[0,0,0];
   if(/ArmouredHull|CeramicHull|FactoryDoorFrame|AtlasUpgrade|Roof_/.test(n.name)){
    assert.ok(bounds.min[1]+translation[1]>-.025,`deformed fixed surface ${n.name}`);
    assert.ok(bounds.max[1]+translation[1]<2.3,`deformed roof ${n.name}`);
   }
   for(const [name,ai]of Object.entries(p.attributes)){
    const a=j.accessors[ai],v=j.bufferViews[a.bufferView],at=(v.byteOffset??0)+(a.byteOffset??0),size={VEC2:2,VEC3:3,VEC4:4}[a.type];
    assert.equal(a.componentType,5126);const values=new Float32Array(bin.buffer.slice(bin.byteOffset+at,bin.byteOffset+at+a.count*size*4));
    geometry.setAttribute({POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv'}[name]??name,new THREE.BufferAttribute(values,size));
   }
   if(p.indices!==undefined){const a=j.accessors[p.indices],v=j.bufferViews[a.bufferView],at=(v.byteOffset??0)+(a.byteOffset??0),Ctor=a.componentType===5125?Uint32Array:Uint16Array;
    geometry.setIndex(new THREE.BufferAttribute(new Ctor(bin.buffer.slice(bin.byteOffset+at,bin.byteOffset+at+a.count*Ctor.BYTES_PER_ELEMENT)),1));}
   const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.position.fromArray(n.translation??[0,0,0]);scene.add(mesh);
  }
 }
 scene.updateMatrixWorld(true);assert.equal(ray.intersectObjects(scene.children).length,0,'closed fixed facade remains behind the door');
 const roofRay=new THREE.Raycaster(new THREE.Vector3(.18,2,.9),new THREE.Vector3(0,-1,0),0,.7);
 assert.ok(roofRay.intersectObjects(scene.children).length>0,'the portal roof must remain closed before the first production');
});
test('independent buildings animate concurrently; repeated releases reuse a closed gate',()=>{
 const f=fixture(),second=fixture(2,1);
 second.base.id=3;second.unit.id=4;second.base.x=1000;second.unit.x=1112;
 second.entry.node.position.x=500;
 f.game.bases.push(second.base);f.game.units.push(second.unit);
 f.controller.battlefield.bases.set(3,second.entry);f.controller.battlefield.units.set(4,second.actor);
 f.game.productionReleases.push({...second.event,baseId:3,unitId:4});
 const tick=age=>{second.actor.node.visible=true;f.tick(age);};tick(0);
 assert.equal(f.controller.active.size,2);tick(.75);
 assert.equal(f.entry.gate.door.scale.y,second.entry.gate.door.scale.y);
 tick(5.9);assert.equal(f.controller.active.size,0);
 f.event={...f.event,at:f.game.time};f.game.productionReleases.push(f.event);
 f.controller.update();assert.equal(f.controller.active.size,1);
});
test('blocked visual lane aborts to the real unhidden actor instead of overlapping',()=>{
 const f=fixture();f.tick(0);f.tick(2);
 const other={node:new THREE.Group()};other.node.position.copy(f.actor.node.position);
 f.controller.battlefield.units.set(99,other);f.tick(2);
 assert.equal(f.controller.active.size,0);assert.equal(f.actor.node.visible,true);
 assert.ok(f.actor.node.position.distanceTo(new THREE.Vector3(112,0,82))<.0001);
});

test('render interpolation advances within a fixed simulation tick',()=>{
 const f=fixture();f.tick(0);f.game.time=12;f.actor.node.visible=true;f.controller.update(true,0);
 const start=f.actor.node.position.clone();f.controller.update(true,.5);
 assert.ok(f.actor.node.position.distanceTo(start)>.1);assert.equal(f.game.time,12);
});
test('authoritative capacity and blocked exits retain the paid queue without release events',async()=>{
 const {Simulation}=await import('../dist/src/reborn/simulation.js');
 const {RULES}=await import('../dist/src/reborn/config.js');
 for(const reason of ['capacity','blocked']){
  const g=new Simulation(2074,4);g.aiClock=-1e8;g.world.blocked.fill(0);g.world.opaque.fill(0);
  const base={id:900,kind:'factory',owner:0,x:1500,y:1500,radius:70,hp:1100,buildRemaining:0,
   cooldown:0,production:0,queue:[.01],queueTypes:['tank'],queueCosts:[550],rally:null};
  g.bases.push(base);g.status='playing';g.paused=false;
  const nearest=g.world.nearest.bind(g.world);
  if(reason==='capacity')while(g.count(0)<RULES.capacity)g.spawn(0,{x:2300,y:2300},'tank');
  else g.world.nearest=()=>null;
  g.step(.05);
  assert.equal(base.queue.length,1);assert.equal(g.productionReleases.length,0);
  if(reason==='capacity')g.units=g.units.filter(u=>u.owner!==0||u.kind==='engineer');
  g.world.nearest=nearest;g.status='playing';g.step(.05);
  assert.equal(base.queue.length,0);assert.equal(g.productionReleases.length,1);
  const release=g.productionReleases[0];assert.equal(g.units.filter(u=>u.id===release.unitId).length,1);
  const restored=Simulation.load(g.save());assert.equal(restored.productionReleases.length,0);
  assert.equal(restored.units.filter(u=>u.id===release.unitId).length,1);
 }
});

test('production waits for delayed factory GLB and drives through the real garage door',()=>{
 const f=fixture();f.game.stageWebGLProduction=true;
 let held=0,cancelled=0;
 f.game.extendProductionDeparture=(id,until)=>{assert.equal(id,2);held=Math.max(held,until);};
 f.game.cancelProductionDeparture=()=>cancelled++;
 f.entry.detail=null;
 f.tick(0);assert.equal(f.controller.active.size,0);
 assert.equal(f.actor.node.visible,false);
 f.tick(.65);assert.equal(f.controller.active.size,0);
 assert.ok(held>10.65);
 const detail=new THREE.Group(),door=new THREE.Group();door.name='FactoryRollupDoor';
 detail.scale.setScalar(57);detail.add(door);f.entry.node.add(detail);f.entry.detail=detail;
 f.tick(.70);
 assert.equal(f.controller.active.size,1);
 assert.ok(Math.abs(f.controller.active.get(1).visualAt-10.7)<.00001);
 assert.equal(f.actor.node.visible,false);
 f.tick(1.45);assert.ok(f.entry.gate.door.scale.y<1);
 assert.equal(cancelled,0);
 f.tick(3.5);assert.equal(f.controller.active.size,1);
 assert.ok(f.actor.node.position.distanceTo(new THREE.Vector3(112,0,82))>5);
 f.controller.dispose();
});
test('missing streaming factory GLB never leaves invisible or frozen vehicles',()=>{
 const f=fixture();f.game.stageWebGLProduction=true;
 let cancelled=0;
 f.game.extendProductionDeparture=()=>{};
 f.game.cancelProductionDeparture=()=>cancelled++;
 f.entry.detail=null;
 f.tick(0);assert.equal(f.actor.node.visible,false);
 f.tick(5.6);assert.equal(f.actor.node.visible,true);
 assert.equal(cancelled,1);
 assert.equal(f.controller.active.size,0);
});
test('factory interior is a valid visual drive route, not a normal public path',()=>{
 const f=fixture();f.game.stageWebGLProduction=true;
 f.controller.battlefield.world.walkable=()=>false;
 f.tick(0);assert.equal(f.controller.active.size,1);
 f.tick(2);assert.equal(f.controller.active.size,1);
 f.controller.dispose();
});
