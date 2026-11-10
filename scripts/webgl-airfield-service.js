import * as THREE from 'three';
import {disposeOwnedMeshes} from './webgl-resource-lifecycle.js';

// Explicit, two-bay 3D service hangar on the simulation's local flightline.
// All meshes are presentation-only; the actual bomber remains one Simulation unit.
const paint={
 concrete:'#9a9180',runway:'#444a46',white:'#ddd3bd',yellow:'#e7bd64',
 sand:'#b6a57c',olive:'#7c8065',steel:'#525c58',dark:'#1d2828',
 repair:'#f1ca6c',glass:'#304c50'
};
function material(color,extra={}){
 return new THREE.MeshStandardMaterial({color,roughness:.84,metalness:.12,...extra});
}
function box(parent,name,w,h,d,x,y,z,mat){
 const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
 o.name=name;o.position.set(x,y,z);o.castShadow=h>5;o.receiveShadow=true;
 parent.add(o);return o;
}
export function createAirfieldServiceYard(){
 const group=new THREE.Group();
 group.name='AirfieldTwoBayMaintenanceHangar';
 group.userData={visualOnly:true,nonPlayable:true,hangarService:true};
 const concrete=material(paint.concrete),runway=material(paint.runway),
  markings=material(paint.white),yellow=material(paint.yellow),
  steel=material(paint.steel),sand=material(paint.sand),
  camo=material(paint.olive),dark=material(paint.dark),
  glass=material(paint.glass,{metalness:.32,roughness:.29});
 const roofSand=material(paint.sand,{transparent:true,opacity:.84,side:THREE.DoubleSide});
 const roofCamo=material(paint.olive,{transparent:true,opacity:.84,side:THREE.DoubleSide});
 const glow=new THREE.MeshBasicMaterial({color:paint.repair,transparent:true,opacity:.9});
 // Broad apron, runway, centerline, safe taxi crossing and threshold stripes.
 box(group,'AirfieldExpandedConcreteApron',462,1.5,372,0,.75,0,concrete);
 box(group,'AirfieldExtendedRunway',133,1.6,380,130,1.8,0,runway);
 box(group,'AirfieldCrossTaxiLane',345,.8,38,-38,2.7,17,runway);
 for(let z=-154;z<=156;z+=48)
  box(group,'AirfieldRunwayCenterDash',3,.12,24,130,2.75,z,markings);
 for(const x of [73,187]){
  box(group,'AirfieldRunwayEdgeLine',2,.12,364,x,2.75,0,markings);
  for(let z=-160;z<=160;z+=42){
   box(group,'AirfieldRunwayLamp',5,2,8,x,4.0,z,yellow);
  }
 }
 for(const z of [-164,-155,-146])for(const x of [95,112,148,165])
  box(group,'AirfieldRunwayThreshold',8,.14,4,x,2.8,z,markings);
 for(const bay of [0,1]){
  const cx=bay===0?-151:-26,half=59,front=18,rear=-171;
  // The bay is sized for the actual bomber wings, not a miniature parked prop.
  box(group,'HangarBayFloor_'+bay,116,.35,185,cx,3.0,-77,dark);
  box(group,'HangarBayBackWall_'+bay,120,63,8,cx,34,rear,sand);
  for(const side of [-1,1]){
   const edge=cx+side*half;
   box(group,'HangarBaySideWall_'+bay,6,68,184,edge,36,-77,sand);
   for(const z of [-149,-108,-67,-26]){
    box(group,'HangarVerticalRib_'+bay,9,71,8,edge,39,z,steel);
   }
  }
  // Barrel-shaped camouflaged roof with an opening below its center arch.
  for(let j=0;j<12;j++){
   const x0=-half+j*(2*half/12),x1=x0+2*half/12;
   const arc=x=>76+22*Math.sqrt(Math.max(0,1-(x/65)**2));
   const dy=arc(x1)-arc(x0),dx=x1-x0;
   const panel=box(group,'HangarCamoArch_'+bay,Math.hypot(dx,dy)+2,4,193,
    cx+(x0+x1)/2,(arc(x0)+arc(x1))/2,-76,j%3===0?roofCamo:roofSand);
   panel.rotation.z=Math.atan2(dy,dx);
  }
  box(group,'HangarEntryLintel_'+bay,124,7,9,cx,80,front,steel);
  box(group,'HangarBayNumber_'+bay,23,3,4,cx,82,front+5,yellow);
  for(const side of [-1,1])
   box(group,'HangarEntryColumn_'+bay,9,75,11,cx+side*half,40,front,steel);
  box(group,'HangarCenterGuide_'+bay,3,.18,135,cx,3.4,-61,yellow);
  box(group,'HangarApronStop_'+bay,106,.18,4,cx,3.45,32,yellow);
  // Two working shutters per bay, separated at the middle when opened.
  const left=box(group,'HangarDoorLeft_'+bay,52,64,5,cx-27,36,front+5,steel);
  const right=box(group,'HangarDoorRight_'+bay,52,64,5,cx+27,36,front+5,steel);
  const sparkGroup=new THREE.Group();
  sparkGroup.name='HangarRepairSparks_'+bay;
  sparkGroup.position.set(cx,19,-85);
  group.add(sparkGroup);
  for(let i=0;i<4;i++)box(sparkGroup,'MaintenanceSpark_'+i,2.1,2.1,2.1,
   -21+i*14,i%2?7:0,0,glow);
  sparkGroup.visible=false;
  group.userData['bay'+bay]={left,right,cx,open:0,sparks:sparkGroup};
 }
 // Wartime workshop details that read at tactical camera distance.
 for(const x of [-204,28]){
  box(group,'HangarSecurityLampMast',5,60,5,x,32,32,steel);
  box(group,'HangarSecurityLamp',18,7,12,x,64,32,yellow);
 }
 box(group,'AirfieldMaintenancePlant',32,18,47,-207,12,-147,camo);
 box(group,'AirfieldMaintenanceAirDuct',12,4,28,-206,24,-150,steel);
 box(group,'AirfieldFuelServiceContainer',36,24,48,205,13,-110,camo);
 for(const x of [-169,-134,-44,-8])
  box(group,'HangarSafetyChevron',8,.15,5,x,3.5,42,yellow);
 return group;
}
export function updateAirfieldServiceYard(entry,base,units,time,dt){
 const group=entry.airfieldServiceYard;if(!group)return;
 for(const bay of [0,1]){
  const gate=group.userData['bay'+bay];
  const aircraft=units.find(u=>u.hp>0&&u.airfieldService?.baseId===base.id&&u.airfieldService?.bay===bay);
  const phase=aircraft?.airfieldService?.phase;
  const target=phase&&phase!=='approach'&&phase!=='landing'?1:0;
  gate.open+=(target-gate.open)*Math.min(1,Math.max(0,dt)*2.5);
  // The two halves physically slide sideways into reinforced wall pockets.
  gate.left.position.x=gate.cx-27-28*gate.open;
  gate.right.position.x=gate.cx+27+28*gate.open;
  gate.sparks.visible=phase==='repair';
  if(gate.sparks.visible){
   gate.sparks.children.forEach((spark,i)=>{
    spark.visible=Math.sin(time*21+i*2.1)>-.2;
    const size=.7+.55*Math.abs(Math.sin(time*13+i));
    spark.scale.setScalar(size);
   });
  }
 }
}
export function hideOldAirfieldHangar(entry){
 if(!entry.detail||entry.airfieldOldHidden)return;
 entry.detail.traverse(child=>{
  if(/^(Hangar|ParkedJet|JetWheel)/.test(child.name))child.visible=false;
 });
 entry.airfieldOldHidden=true;
}
export function disposeAirfieldServiceYard(entry){
 if(!entry?.airfieldServiceYard)return;
 const root=entry.airfieldServiceYard;root.removeFromParent();
 disposeOwnedMeshes(root);entry.airfieldServiceYard=null;
}
