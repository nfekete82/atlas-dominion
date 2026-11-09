import * as THREE from 'three';
import {disposeOwnedMeshes} from './webgl-resource-lifecycle.js';

// Decorative props live next to authored buildings, independently of glTF
// loading and without altering building collision, navigation or saves.
const mat=(color,metalness=0,roughness=.82)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const rubber=mat('#252b29'),tread=mat('#525953',.38),steel=mat('#677471',.57,.52);
const wood=mat('#625b47'),sand=mat('#b9a77a'),olive=mat('#66735d'),dark=mat('#283335',.35);
function mesh(parent,name,geometry,material,x,y,z){
 const o=new THREE.Mesh(geometry,material);
 o.name=name;o.position.set(x,y,z);
 o.castShadow=true;o.receiveShadow=true;
 parent.add(o);return o;
}
function box(parent,name,size,material,x,y,z){
 return mesh(parent,name,new THREE.BoxGeometry(...size),material,x,y,z);
}
function wheel(parent,x,z,n){
 for(let i=0;i<n;i++){
  const w=mesh(parent,'SpareTyre',new THREE.TorusGeometry(10,3.2,9,24),
   rubber,x,5.5+i*5.8,z);
  w.rotation.x=-Math.PI/2;
  mesh(parent,'WheelHub',new THREE.CylinderGeometry(4,4,1.3,12),
   steel,x,5.5+i*5.8,z);
 }
}
// All infantry yard props already inherit the 0.48 building-yard scale.
// Scaling helmet and rifle assemblies a second time made them ~0.264 of
// the authored dimensions, smaller than the soldiers' head and weapon.
export const INFANTRY_YARD_PROP_SCALE=1;
function helmet(parent,x,z){
 const g=new THREE.Group();
 g.name='InfantryHelmetAssembly';g.position.set(x,14,z);
 g.scale.setScalar(INFANTRY_YARD_PROP_SCALE);parent.add(g);
 const shell=mesh(g,'InfantryHelmet',new THREE.SphereGeometry(
  9,16,9,0,Math.PI*2,0,Math.PI*.55),olive,0,4.8,0);
 shell.rotation.y=.2;
 const brim=mesh(g,'HelmetRim',new THREE.CylinderGeometry(9.5,9.5,1.8,16),
  dark,0,0,0);
 brim.rotation.y=.15;
}
function rifle(parent,x,z){
 const g=new THREE.Group();
 g.name='InfantryWeaponRackRifle';g.position.set(x,13,z);g.rotation.y=-.28;
 g.scale.setScalar(INFANTRY_YARD_PROP_SCALE);parent.add(g);
 box(g,'RifleReceiver',[4.6,4.3,14],dark,0,0,0);
 box(g,'RifleBarrel',[2.0,2.0,28],steel,0,0,19);
 box(g,'RifleStock',[5,3.8,11],wood,0,0,-12);
 box(g,'RifleMagazine',[3,9,4],steel,0,-6,0);
 box(g,'RifleSight',[2,3,4],steel,0,4,3);
}
/** Site decoration remains purely visual; there are deliberate openings along
 * the front (+Z) for engineers, infantry, factories and aircraft. Nothing here
 * enters the simulation's collision, terrain, build validation or save format. */
export const YARD_DECOR_KINDS=Object.freeze([
 'headquarters','barracks','factory','research','silo','interceptor',
 'airfield','generator'
]);
const fencedSites=new Set([
 'headquarters','barracks','factory','research','silo','interceptor'
]);
const fencePost=mat('#716d58',.22,.72);
const fenceRail=mat('#99967b',.34,.64);
const lampGlass=new THREE.MeshStandardMaterial({
 color:'#d7e8da',emissive:'#b3e5df',emissiveIntensity:.72,
 metalness:.08,roughness:.4
});
const crateBand=mat('#998b6a',.22,.77);
const barrelPaint=mat('#606f67',.27,.7);

function storageCrate(group,x,z,size=16,paint=olive){
 const g=new THREE.Group();g.name='SupplyCrate';g.position.set(x,0,z);group.add(g);
 box(g,'CrateBody',[size,size*.73,size*.84],paint,0,size*.365,0);
 box(g,'CrateLid',[size+2,2,size*.88],wood,0,size*.78,0);
 for(const side of [-1,1])
  box(g,'CrateBand',[2,size*.76,size*.88+1],crateBand,side*size*.33,size*.4,0);
 return g;
}
function supplyBarrel(group,x,z){
 const g=new THREE.Group();g.name='SupplyBarrel';g.position.set(x,0,z);group.add(g);
 mesh(g,'BarrelShell',new THREE.CylinderGeometry(6.4,6.4,17,10),barrelPaint,0,8.5,0);
 for(const height of [2.5,14.5])
  mesh(g,'BarrelBand',new THREE.CylinderGeometry(6.7,6.7,1.3,10),fenceRail,0,height,0);
 box(g,'BarrelCap',[8,1.2,8],dark,0,17.7,0);
}
function securityLamp(group,x,z,height=53){
 const g=new THREE.Group();g.name='SecurityLamp';g.position.set(x,0,z);group.add(g);
 box(g,'LampFoot',[11,2.5,11],steel,0,1.25,0);
 mesh(g,'LampPost',new THREE.CylinderGeometry(1.8,2.1,height,8),fencePost,0,height*.5,0);
 box(g,'LampArm',[13,2.7,3.2],steel,5,height,0);
 box(g,'LampHead',[9,5.2,8],dark,9,height-1,0);
 // Emissive diffuser is visible at RTS zoom without expensive PointLights.
 box(g,'LampDiffuser',[7,1.4,6],lampGlass,9,height-4.1,0);
 return g;
}
function instanceBoxes(group,name,paint,parts){
 if(!parts.length)return;
 const instances=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),paint,parts.length);
 instances.name=name;
 instances.userData={visualOnly:true,nonPlayable:true,siteDecor:true};
 const helper=new THREE.Object3D();
 for(let i=0;i<parts.length;i++){
  const p=parts[i];
  helper.position.set(p.x,p.y,p.z);
  helper.rotation.set(0,p.yaw??0,0);
  helper.scale.set(p.w,p.h,p.d);
  helper.updateMatrix();
  instances.setMatrixAt(i,helper.matrix);
 }
 instances.instanceMatrix.needsUpdate=true;
 instances.computeBoundingSphere();
 instances.castShadow=true;
 instances.receiveShadow=true;
 group.add(instances);
}
function instanceFenceWires(group,parts){
 if(!parts.length)return;
 // Cross-bracing reads like a light wire fence at strategic camera distance.
 const wires=new THREE.InstancedMesh(new THREE.CylinderGeometry(.42,.42,1,5),
  fenceRail,parts.length);
 wires.name='YardFenceMesh';
 wires.userData={visualOnly:true,nonPlayable:true,siteDecor:true};
 const helper=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
 const direction=new THREE.Vector3();
 for(let i=0;i<parts.length;i++){
  const p=parts[i];
  direction.set(p.dx,p.dy,p.dz);
  const length=direction.length();
  helper.position.set(p.x,p.y,p.z);
  helper.quaternion.setFromUnitVectors(up,direction.normalize());
  helper.scale.set(1,length,1);
  helper.updateMatrix();
  wires.setMatrixAt(i,helper.matrix);
 }
 wires.instanceMatrix.needsUpdate=true;
 wires.computeBoundingSphere();
 wires.castShadow=false;wires.receiveShadow=true;
 group.add(wires);
}
function perimeterFence(group,width){
 // Three sides only: rear and flanks; the front remains a wide OPEN gateway.
 // Posts, rails and chainlink-style X-bracing: three batched draw calls.
 const x=width*.65,rear=-width*.53,front=width*.28;
 const posts=[],rails=[],wires=[],seen=new Set();
 function line(x0,z0,x1,z1){
  const dx=x1-x0,dz=z1-z0,dist=Math.hypot(dx,dz);
  const steps=Math.max(2,Math.ceil(dist/26));
  const yaw=Math.atan2(dx,dz);
  for(let i=0;i<=steps;i++){
   const t=i/steps,px=x0+dx*t,pz=z0+dz*t;
   const key=px.toFixed(3)+':'+pz.toFixed(3);
   if(!seen.has(key)){
    seen.add(key);posts.push({x:px,y:10.5,z:pz,w:3.3,h:21,d:3.3});
   }
   if(i===steps)continue;
   const u=(i+.5)/steps;
   const mx=x0+dx*u,mz=z0+dz*u;
   for(const y of [7,16.5])
    rails.push({x:mx,y,z:mz,w:2.5,h:2,d:dist/steps+.8,yaw});
   const sx=dx/steps,sz=dz/steps;
   wires.push({x:mx,y:11.5,z:mz,dx:sx,dy:13,dz:sz});
   wires.push({x:mx,y:11.5,z:mz,dx:sx,dy:-13,dz:sz});
  }
 }
 line(-x,rear,x,rear);
 line(-x,rear,-x,front);
 line(x,rear,x,front);
 instanceBoxes(group,'YardFencePosts',fencePost,posts);
 instanceBoxes(group,'YardFenceRails',fenceRail,rails);
 instanceFenceWires(group,wires);
 group.userData.fencePosts=posts.length;
 group.userData.fenceRails=rails.length;
 group.userData.fenceWires=wires.length;
}
function addSiteDecor(root,kind,width){
 // Dedicated grouping avoids changing the legacy barracks/factory prop names
 // and lets renderer integration identify the decorations independently.
 const g=new THREE.Group();
 g.name='BasePerimeter_'+kind;
 g.userData={visualOnly:true,nonPlayable:true,siteDecor:true};
 root.add(g);
 const large=width>=155;
 if(fencedSites.has(kind))perimeterFence(g,width);
 const supplies=new THREE.Group();
 supplies.name='BaseSupplyCache';supplies.position.set(width*.55,0,-width*.2);
 g.add(supplies);
 // Different silhouettes per facility, all deterministic and inexpensive.
 storageCrate(supplies,0,0,large?19:13);
 storageCrate(supplies,large?18:13,12,large?14:11,sand);
 if(kind!=='airfield'){
  box(supplies,'SupplyPallet',[43,3.2,27],wood,9,1.6,4);
  supplyBarrel(supplies,-16,-11);
  if(kind==='factory'||kind==='research'||kind==='headquarters')
   supplyBarrel(supplies,-3,-19);
 }
 // Place masts near the side fencing, never along the open front door/spawn.
 const lampHeight=Math.min(60,Math.max(43,width*.29));
 securityLamp(g,-width*.56,width*.20,lampHeight);
 if(large&&kind!=='airfield')securityLamp(g,width*.53,-width*.40,lampHeight);
 if(kind==='headquarters'||kind==='research'||kind==='silo'){
  // A small technical crate station reads like base infrastructure.
  const service=new THREE.Group();
  service.name='ServiceStation';service.position.set(-width*.53,0,-width*.18);
  g.add(service);
  box(service,'ServiceConsole',[21,19,13],steel,0,9.5,0);
  box(service,'ConsoleScreen',[13,7,1.4],dark,0,17,7);
  box(service,'ConsoleIndicator',[9,2,1.6],lampGlass,0,20.5,7.2);
 }
 g.userData.lamps=g.children.filter(child=>child.name==='SecurityLamp').length;
 g.userData.supplyCrates=supplies.children.filter(child=>child.name==='SupplyCrate').length;
 return g;
}

export function createBuildingYard(kind,width=160){
 if(!YARD_DECOR_KINDS.includes(kind))return null;
 const root=new THREE.Group();
 root.name='sf-yard-'+kind;
 root.userData={visualOnly:true,nonPlayable:true,buildingContext:kind};
 // Place recognizable outdoor inventory at the flanks, not over the
 // doors or spawn lanes. Parent rotation follows the placed building.
 if(kind==='factory'){
  const g=new THREE.Group();g.name='VehicleSpareParts';
  g.position.set(-width*.47,0,width*.30);root.add(g);
  box(g,'RepairPallet',[63,4,45],wood,3,2,0);
  wheel(g,-17,-8,3);wheel(g,10,-10,2);
  box(g,'EngineBlock',[24,14,20],steel,30,12,2);
  for(const x of [23,30,37])box(g,'EngineCoolingFin',[3,6,23],tread,x,22,2);
  for(let i=0;i<8;i++){
   const link=box(g,'SpareTrackLink',[9,3,17],tread,-31+i*8,4,28);
   link.rotation.y=(i%2?-.06:.06);
   box(g,'TrackRidge',[8,2,3],steel,-31+i*8,6,28);
  }
  box(g,'ToolCase',[22,10,13],sand,31,7,-21);
  box(g,'ToolCaseHandle',[9,2,2],dark,31,13,-21);
 }else if(kind==='barracks'){
  const g=new THREE.Group();g.name='InfantryEquipment';
  // Geometry was authored at building scale: 19-unit helmets and ~53-unit
  // rifles looked as large as a human next to the 3D infantry (~36 units).
  // Keep all individual assets and their spacing proportional, without
  // changing collision, unit models, or the garage/barracks portal.
  g.scale.setScalar(.48);
  g.position.set(width*.43,0,width*.34);root.add(g);
  box(g,'EquipmentPallet',[79,4,46],wood,0,2,0);
  box(g,'HelmetRack',[75,4,13],steel,-1,12,-10);
  for(const x of [-24,0,24])helmet(g,x,-10);
  box(g,'WeaponRack',[10,27,49],wood,30,17,20);
  for(const [i,x] of [-1,0,1].entries())rifle(g,-25+i*18,17);
  for(let i=0;i<2;i++){
   box(g,'AmmunitionCrate',[16,12,13],olive,-26+i*19,10,33);
   box(g,'AmmunitionClasp',[11,2,2],steel,-26+i*19,17,39);
  }
 }
 addSiteDecor(root,kind,width);
 return root;
}

/** Mesh geometries are unique to each service yard; PBR materials are
 * module-shared and must remain alive for other factories and barracks. */
export function disposeBuildingYard(yard){
 if(!yard)return;
 // Instanced fences own GPU instance buffers in addition to their geometry.
 yard.traverse(mesh=>{if(mesh.isInstancedMesh)mesh.dispose();});
 disposeOwnedMeshes(yard,{materials:false});
 yard.removeFromParent();
}
