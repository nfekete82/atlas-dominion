import * as THREE from 'three';
import {disposeOwnedMeshes} from './webgl-resource-lifecycle.js';
import {servicePaint,disposeServicePaint} from './webgl-service-materials.js';

// The original factory GLB remains the entire production building. Only a
// small SINGLE-bay repair garage stands beside its LEFT wall, never in front
// of the central vehicle production door. No unit collision is attached.
const mat=(color,metalness=.18,roughness=.81)=>
 new THREE.MeshStandardMaterial({color,metalness,roughness});
function block(root,name,size,at,material){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
 mesh.name=name;mesh.position.set(...at);
 mesh.castShadow=false;mesh.receiveShadow=true;mesh.raycast=()=>{};
 root.add(mesh);return mesh;
}
export function createFactoryServiceYard(){
 const root=new THREE.Group();root.name='FactoryCompactSideRepairShop';
 root.userData={visualOnly:true,nonPlayable:true,maintenance:true};
 const yellow=mat('#e4ba64'),dark=mat('#283331'),steel=mat('#697572',.62,.39),
 red=mat('#bf644e'),glass=mat('#374e4d',.23,.34);
 const camo=servicePaint(['#a1916e','#c1ad86','#777b5e'],{seed:4,repeat:3});
 const roofCamo=servicePaint(['#6b795f','#a09b79','#c9b189'],{seed:22,repeat:3});
 const workSteel=servicePaint(['#47554d','#68766e','#848a7d'],
  {pattern:'metal',seed:19,repeat:3,metalness:.62,roughness:.43});
 const concrete=servicePaint(['#757067','#9c9481','#b0a48e'],
  {pattern:'concrete',seed:39,repeat:4,roughness:.97});
 const cx=-192,cz=45,front=121;
 // Small side apron and one actual drive-on lift. The original central
 // factory exit x=0 is untouched, including its animated doors.
 block(root,'FactoryVehicleRepairApron',[139,1.3,191],[cx,.7,75],concrete);
 block(root,'VehicleRepairBaySurface_0',[106,.2,137],[cx,1.55,61],dark);
 block(root,'FactorySideWorkshopWallLeft',[5,49,121],[cx-56,26,45],camo);
 block(root,'FactorySideWorkshopWallRight',[5,49,121],[cx+56,26,45],camo);
 block(root,'FactorySideWorkshopRear',[119,49,5],[cx,26,-16],camo);
 block(root,'FactoryRepairGarageRoof_0',[126,5,128],[cx,56,47],roofCamo);
 for(const z of [-2,24,50,76,103])
  block(root,'FactoryGarageRoofRib_0',[121,3,3],[cx,60,z],workSteel);
 for(const side of [-1,1]){
  for(const z of [-3,42,86])
   block(root,'FactoryCamoVerticalRib_0',[7,44,6],[cx+side*59,30,z],steel);
  block(root,'FactoryWorkshopVent_0',[8,12,25],[cx+side*60,39,47],dark);
  block(root,'FactoryServiceGarageLight_0',[10,5,7],[cx+side*47,51,front+4],yellow);
  block(root,'RepairBayOutline_0',[3,.25,115],[cx+side*50,1.8,65],yellow);
 }
 block(root,'FactoryServiceGarageHeader_0',[124,9,10],[cx,53,front],workSteel);
 block(root,'FactoryServiceGarageNumber_0',[24,3,4],[cx,62,front+5],yellow);
 const doorLeft=block(root,'FactoryServiceDoorLeft_0',[50,43,4],
  [cx-27,30,front+4],workSteel);
 const doorRight=block(root,'FactoryServiceDoorRight_0',[50,43,4],
  [cx+27,30,front+4],workSteel);
 for(const [index,door] of [doorLeft,doorRight].entries())
  for(let n=0;n<5;n++)
   block(door,'FactoryDoorRib_'+index,[47,1.7,3],[0,-16+n*8,3],steel);
 // Real 9.5-unit high surface matches serviceVisualGround(). A tank can
 // reach the ramp without crossing a wall, support or production lane.
 block(root,'VehicleLiftPlatform_0',[86,3,83],[cx,8,45],workSteel);
 const ramp=block(root,'VehicleDriveOnRamp_0',[86,2,43],[cx,5.3,95],steel);
 ramp.rotation.x=.18;
 for(const side of [-1,1]){
  block(root,'HydraulicVehicleLiftRail_0',[11,5,71],[cx+side*28,4.8,45],steel);
  block(root,'VehiclePlatformSafetyStrip_0',[3,.25,82],[cx+side*39,9.7,45],yellow);
  block(root,'FactoryServiceTireTrack_0',[3,.15,66],[cx+side*29,1.75,150],dark);
 }
 block(root,'FactoryToolChest_0',[23,18,17],[cx-47,12,-4],red);
 for(const h of [8,14,20])
  block(root,'FactoryToolChestDrawer_0',[20,1.4,2],[cx-47,h,5],steel);
 block(root,'FactoryRepairConsole_0',[20,19,16],[cx+45,12,-3],steel);
 block(root,'FactoryRoofAirDuct_0',[22,9,34],[cx-26,66,23],workSteel);
 block(root,'FactoryServiceVentGrille_0',[31,17,3],[cx+22,35,-19],dark);
 for(let n=0;n<5;n++)
  block(root,'FactorySideVentLouvre_0',[28,1.6,4],[cx+22,29+n*3,-17],steel);
 const indicator=block(root,'RepairStatusIndicator_0',[9,7,5],[cx+47,34,123],yellow);
 const glow=block(root,'VehicleWeldingFlash_0',[6,7,6],[cx+29,26,45],yellow);
 indicator.visible=false;glow.visible=false;
 const icon=new THREE.Group();icon.name='FactoryRepairIcon_0';
 icon.position.set(cx,83,45);icon.visible=false;root.add(icon);
 const iconMat=new THREE.MeshBasicMaterial({
  color:'#95ffd0',transparent:true,opacity:.85,depthTest:false,depthWrite:false
 });
 const circle=new THREE.Mesh(new THREE.TorusGeometry(11,1.7,8,28),iconMat);
 circle.name='FactoryRepairCircle_0';circle.rotation.x=-Math.PI/2;
 circle.raycast=()=>{};icon.add(circle);
 block(icon,'FactoryRepairCrossHorizontal_0',[14,1.3,3],[0,0,0],iconMat);
 block(icon,'FactoryRepairCrossVertical_0',[3,1.3,14],[0,0,0],iconMat);
 const sparks=new THREE.Group();sparks.name='FactoryWeldingSparks_0';
 sparks.position.set(cx+25,25,42);sparks.visible=false;root.add(sparks);
 const sparkMat=new THREE.MeshBasicMaterial({
  color:'#ffe19a',transparent:true,opacity:.9,depthTest:false,depthWrite:false
 });
 for(let n=0;n<7;n++){
  const shard=new THREE.Mesh(new THREE.ConeGeometry(1.5,8+n%3*3,4),sparkMat);
  shard.position.set(Math.cos(n*2.4)*5,n%3*3,Math.sin(n*2.4)*5);
  shard.raycast=()=>{};sparks.add(shard);
 }
 root.userData.bay0={indicator,glow,icon,sparks,doorLeft,doorRight,
  doorOpen:.85,lastDoorTime:null};
 // The two false external factory wings and second service hall are gone.
 root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.raycast=()=>{};}});
 return root;
}
export function updateFactoryServiceYard(entry,base,units,time){
 const yard=entry.factoryServiceYard;if(!yard)return;
 const state=yard.userData.bay0;
 const vehicle=units.find(u=>u.hp>0&&u.factoryService?.baseId===base.id&&
  (u.factoryService?.bay===0||u.factoryService?.bay===1));
 state.indicator.visible=Boolean(vehicle);
 const phase=vehicle?.factoryService?.phase;
 const targetOpen=phase==='approach'||phase==='parking'?1:
  phase==='repair'||phase==='ready'?.35:.85;
 const elapsed=state.lastDoorTime===null?.05:
  Math.max(0,Math.min(.2,time-state.lastDoorTime));
 state.lastDoorTime=time;
 state.doorOpen+=(targetOpen-state.doorOpen)*Math.min(1,elapsed*3.8);
 for(const door of [state.doorLeft,state.doorRight]){
  door.position.y=30+26*state.doorOpen;
  door.scale.y=1-.96*state.doorOpen;
 }
 const repairing=phase==='repair';
 state.glow.visible=repairing&&Math.sin(time*20)>-.2;
 state.icon.visible=repairing||phase==='ready';
 state.sparks.visible=repairing;
 if(state.icon.visible){
  state.icon.position.y=83+Math.sin(time*3)*2;
  state.icon.rotation.y=time*.32;
 }
 if(repairing){
  state.sparks.rotation.y=time*5;
  state.sparks.children.forEach((spark,n)=>{
   spark.visible=Math.sin(time*29+n*3.1)>.05;
   spark.position.y=(n%3)*2+Math.max(0,Math.sin(time*12+n*1.9))*7;
  });
 }
 if(state.indicator.visible)state.indicator.scale.y=1+.22*Math.sin(time*4);
}
export function disposeFactoryServiceYard(entry){
 const group=entry?.factoryServiceYard;
 if(!group)return;
 group.removeFromParent();disposeServicePaint(group);disposeOwnedMeshes(group);
 entry.factoryServiceYard=null;
}
