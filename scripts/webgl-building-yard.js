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
// The authored infantry stands ~36 world units high after visual scaling.
// Props should match a soldier's *head and rifle*, not the full body height.
export const INFANTRY_YARD_PROP_SCALE=.55;
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
export function createBuildingYard(kind,width=160){
 if(kind!=='factory'&&kind!=='barracks')return null;
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
 }else{
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
 return root;
}

/** Mesh geometries are unique to each service yard; PBR materials are
 * module-shared and must remain alive for other factories and barracks. */
export function disposeBuildingYard(yard){
 if(!yard)return;
 disposeOwnedMeshes(yard,{materials:false});
 yard.removeFromParent();
}
