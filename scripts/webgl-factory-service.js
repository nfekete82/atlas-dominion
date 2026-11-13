import * as THREE from 'three';
import {applyBuildingDesign} from './webgl-building-design.js';
import {worldCamouflageBiome,tintFactionMaterials} from './webgl-faction-accents.js';
import {disposeOwnedMeshes} from './webgl-resource-lifecycle.js';
import {servicePaint,disposeServicePaint} from './webgl-service-materials.js';

/** Small OPEN service lift beside the factory. No false garage roof, walls,
 * doors or support posts can block driving or hide a repaired tank.
 * The production doorway remains completely unobstructed.
 */
const mat=(color,metalness=.18,roughness=.81)=>
 new THREE.MeshStandardMaterial({color,metalness,roughness});
function block(root,name,size,at,material){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
 mesh.name=name;mesh.position.set(...at);
 mesh.castShadow=false;mesh.receiveShadow=true;mesh.raycast=()=>{};
 root.add(mesh);return mesh;
}
export function createFactoryServiceYard(){
 const root=new THREE.Group();root.name='FactoryOpenRepairPlatform';
 root.userData={visualOnly:true,nonPlayable:true,maintenance:true,openPlatform:true};
 const yellow=mat('#dfba65'),dark=mat('#25312e'),steel=mat('#73817d',.55,.42);
 const red=mat('#b15e4c'),camo=servicePaint(['#9c947a','#c5b38b','#777e62'],{seed:4,repeat:3});
 const workSteel=servicePaint(['#47554d','#68766e','#848a7d'],
  {pattern:'metal',seed:19,repeat:3,metalness:.62,roughness:.43});
 const concrete=servicePaint(['#757067','#9c9481','#b0a48e'],
  {pattern:'concrete',seed:39,repeat:4,roughness:.97});
 const cx=164;
 // Existing factory remains the producer. Only the drive-on lift and short
 // apron belong to this group; its roof is the open sky.
 block(root,'FactoryVehicleRepairApron',[111,1.3,131],[cx,.7,52],concrete);
 block(root,'VehicleRepairBaySurface_0',[90,.2,91],[cx,1.55,42],camo);
 block(root,'VehicleLiftPlatform_0',[84,3,80],[cx,8,36],workSteel);
 const ramp=block(root,'VehicleDriveOnRamp_0',[82,2,31],[cx,5.3,89],steel);
 ramp.rotation.x=.18;
 for(const side of [-1,1]){
  block(root,'HydraulicVehicleLiftRail_0',[6,4.8,72],[cx+side*38,7,36],workSteel);
  block(root,'VehiclePlatformSafetyStrip_0',[3,.3,74],[cx+side*43,9.7,36],yellow);
  block(root,'FactoryServiceTireTrack_0',[3,.18,50],[cx+side*26,1.75,91],dark);
  block(root,'RepairPadBollard_0',[6,14,6],[cx+side*48,8,-10],camo);
  block(root,'RepairPadReflector_0',[6,3,6],[cx+side*48,16,-10],yellow);
  block(root,'RepairPadDrain_0',[9,.2,5],[cx+side*27,1.6,-3],workSteel);
 }
 block(root,'FactoryToolChest_0',[21,17,16],[cx-47,12,-12],red);
 for(const h of [8,14,19])block(root,'FactoryToolChestDrawer_0',
  [19,1.2,2],[cx-47,h,-3],steel);
 block(root,'FactoryRepairConsole_0',[16,15,13],[cx+45,10,-13],workSteel);
 block(root,'FactoryRepairConsoleScreen_0',[10,7,1.3],[cx+45,17,-6],yellow);
 block(root,'FactoryHydraulicPump_0',[14,12,15],[cx-44,9,-8],camo);
 block(root,'RepairPadUnderbodyLight_0',[28,1.2,6],[cx,9.6,0],yellow);
 const indicator=block(root,'RepairStatusIndicator_0',[8,7,4],[cx+46,21,-8],yellow);
 const glow=block(root,'VehicleWeldingFlash_0',[6,7,6],[cx+27,23,36],yellow);
 indicator.visible=false;glow.visible=false;
 const icon=new THREE.Group();icon.name='FactoryRepairIcon_0';
 icon.position.set(cx,56,36);icon.visible=false;root.add(icon);
 const iconMat=new THREE.MeshBasicMaterial({
  color:'#95ffd0',transparent:true,opacity:.85,depthTest:false,depthWrite:false
 });
 const circle=new THREE.Mesh(new THREE.TorusGeometry(11,1.7,8,28),iconMat);
 circle.name='FactoryRepairCircle_0';circle.rotation.x=-Math.PI/2;
 circle.raycast=()=>{};icon.add(circle);
 block(icon,'FactoryRepairCrossHorizontal_0',[14,1.3,3],[0,0,0],iconMat);
 block(icon,'FactoryRepairCrossVertical_0',[3,1.3,14],[0,0,0],iconMat);
 const sparks=new THREE.Group();sparks.name='FactoryWeldingSparks_0';
 sparks.position.set(cx+26,24,36);sparks.visible=false;root.add(sparks);
 const sparkMat=new THREE.MeshBasicMaterial({
  color:'#ffe19a',transparent:true,opacity:.9,depthTest:false,depthWrite:false
 });
 for(let n=0;n<7;n++){
  const shard=new THREE.Mesh(new THREE.ConeGeometry(1.5,8+n%3*3,4),sparkMat);
  shard.position.set(Math.cos(n*2.4)*5,n%3*3,Math.sin(n*2.4)*5);
  shard.raycast=()=>{};sparks.add(shard);
 }
 root.userData.bay0={indicator,glow,icon,sparks};
 root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.raycast=()=>{};}});
 if(worldCamouflageBiome()!=='desert')tintFactionMaterials(root,0,'factory','building');
 else applyBuildingDesign(root,{kind:'factory',biome:worldCamouflageBiome()});
 return root;
}
export function updateFactoryServiceYard(entry,base,units,time){
 const yard=entry.factoryServiceYard;if(!yard)return;
 const state=yard.userData.bay0;
 const vehicle=units.find(u=>u.hp>0&&u.factoryService?.baseId===base.id&&
  (u.factoryService?.bay===0||u.factoryService?.bay===1));
 state.indicator.visible=Boolean(vehicle);
 const phase=vehicle?.factoryService?.phase,repairing=phase==='repair';
 state.glow.visible=repairing&&Math.sin(time*20)>-.2;
 state.icon.visible=repairing||phase==='ready';
 state.sparks.visible=repairing;
 if(state.icon.visible){
  state.icon.position.y=56+Math.sin(time*3)*2;
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
