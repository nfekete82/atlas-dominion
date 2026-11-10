import * as THREE from 'three';
import {disposeOwnedMeshes} from './webgl-resource-lifecycle.js';
import {servicePaint,disposeServicePaint} from './webgl-service-materials.js';

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
 const roofSand=servicePaint(['#a8946c','#c5af87','#72765c'],{seed:7,repeat:4});
 const roofCamo=servicePaint(['#657258','#aa9c78','#c1ab86'],{seed:31,repeat:4});
 const wallCamo=servicePaint(['#918467','#b4a17d','#70765d'],{seed:15,repeat:3});
 const ribbedSteel=servicePaint(['#45514a','#69776e','#899083'],{pattern:'metal',seed:45,repeat:2,metalness:.57,roughness:.52});
 const wornPaving=servicePaint(['#77736b','#a49c86','#b3a892'],{pattern:'concrete',seed:39,repeat:5,roughness:.96});
 const runwayWear=servicePaint(['#3d4542','#515752','#64665e'],{pattern:'concrete',seed:49,repeat:5,roughness:.96});
 const glow=new THREE.MeshBasicMaterial({color:paint.repair,transparent:true,opacity:.9});
 // Broad apron, runway, centerline, safe taxi crossing and threshold stripes.
 box(group,'AirfieldExpandedConcreteApron',462,1.5,372,0,.75,0,wornPaving);
 box(group,'AirfieldExtendedRunway',133,1.6,380,130,1.8,0,runwayWear);
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
  box(group,'HangarBayBackWall_'+bay,120,63,8,cx,34,rear,wallCamo);
  for(const side of [-1,1]){
   const edge=cx+side*half;
   box(group,'HangarBaySideWall_'+bay,6,68,184,edge,36,-77,wallCamo);
   for(const z of [-149,-108,-67,-26]){
    box(group,'HangarVerticalRib_'+bay,9,71,8,edge,39,z,ribbedSteel);
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
  for(const z of [-147,-100,-55,-11]){
   box(group,'HangarRoofReinforcement_'+bay,116,2,3,cx,98,z,ribbedSteel);
  }
  for(const side of [-1,1]){
   const x=cx+side*42;
   box(group,'HangarRoofVent_'+bay,17,10,22,x,107,-97,ribbedSteel);
   box(group,'HangarRoofVentCap_'+bay,22,3,27,x,113,-97,dark);
   box(group,'HangarSideCamouflagePanel_'+bay,3,29,55,cx+side*62,47,-83,roofCamo);
   for(const z of [-112,-93,-74,-55])
    box(group,'HangarSideVentLouvre_'+bay,4,2.1,23,cx+side*64,45,z,steel);
  }
  box(group,'HangarRearVent_'+bay,45,17,3,cx,45,rear-5,dark);
  for(const y of [39,45,51])
   box(group,'HangarRearVentRib_'+bay,42,2,4,cx,y,rear-7,ribbedSteel);
  box(group,'HangarEntryLintel_'+bay,124,7,9,cx,80,front,steel);
  box(group,'HangarBayNumber_'+bay,23,3,4,cx,82,front+5,yellow);
  for(const side of [-1,1])
   box(group,'HangarEntryColumn_'+bay,9,75,11,cx+side*half,40,front,steel);
  box(group,'HangarCenterGuide_'+bay,3,.18,135,cx,3.4,-61,yellow);
  box(group,'HangarApronStop_'+bay,106,.18,4,cx,3.45,32,yellow);
  // Two working shutters per bay, separated at the middle when opened.
  const left=box(group,'HangarDoorLeft_'+bay,52,64,5,cx-27,36,front+5,ribbedSteel);
  const right=box(group,'HangarDoorRight_'+bay,52,64,5,cx+27,36,front+5,ribbedSteel);
  for(const [half,door] of [left,right].entries()){
   for(const yy of [-22,-11,0,11,22]){
    box(door,'HangarDoorCorrugation_'+bay+'_'+half,48,1.8,2,0,yy,3.4,steel);
   }
  }
  for(const side of [-1,1]){
   box(group,'HangarDoorGuideRail_'+bay,5,69,8,cx+side*59,39,front+8,ribbedSteel);
   box(group,'HangarHazardChevron_'+bay,5,4,10,cx+side*59,17,front+13,yellow);
  }
  const sparkGroup=new THREE.Group();
  sparkGroup.name='HangarRepairSparks_'+bay;
  sparkGroup.position.set(cx,19,-85);
  group.add(sparkGroup);
  for(let i=0;i<4;i++)box(sparkGroup,'MaintenanceSpark_'+i,2.1,2.1,2.1,
   -21+i*14,i%2?7:0,0,glow);
  sparkGroup.visible=false;
  group.userData['bay'+bay]={left,right,cx,open:0,sparks:sparkGroup};
 }
 // Scuffed touchdown marks and pavement expansion joints.
 for(const x of [111,151])for(const z of [-126,-53,81,146])
  box(group,'AirfieldTouchdownRubber',4,.12,18,x,2.76,z,dark);
 for(const x of [-195,-110,-45,29])for(const z of [-143,-72,8])
  box(group,'AirfieldApronExpansionJoint',24,.11,1.5,x,1.65,z,steel);
 for(const x of [-216,45]){
  box(group,'HangarMaintenanceToolCabinet',15,26,19,x,14,-109,ribbedSteel);
  for(const yy of [11,18,25])
   box(group,'HangarCabinetDrawer',12,1.4,2,x,yy,-98,dark);
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
 group.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=false;mesh.receiveShadow=false;mesh.raycast=()=>{};}});
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
 disposeServicePaint(root);disposeOwnedMeshes(root);entry.airfieldServiceYard=null;
}
