import * as THREE from 'three';
import {disposeOwnedMeshes} from './webgl-resource-lifecycle.js';
import {servicePaint,disposeServicePaint} from './webgl-service-materials.js';

// Outdoor repair apron joins the existing vehicle factory: two drive-in spots,
// lifting jacks, mobile gantries, realistic machinery and blinking work lamps.
// Entirely visual. Simulation remains the owner of vehicles and repair credits.
const mat=(color,metalness=.18,roughness=.81)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
function block(root,name,size,at,material){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
 mesh.name=name;mesh.position.set(...at);
 mesh.castShadow=false;mesh.receiveShadow=true;
 mesh.raycast=()=>{};root.add(mesh);return mesh;
}
export function createFactoryServiceYard(){
 const root=new THREE.Group();root.name='FactoryExpandedVehicleWorkshop';
 root.userData={visualOnly:true,nonPlayable:true,maintenance:true};
 const concrete=mat('#a49b87'),asphalt=mat('#454c46'),yellow=mat('#e4ba64'),
 olive=mat('#777d60'),sand=mat('#b7ab88'),dark=mat('#283331'),
 steel=mat('#697572',.62,.39),glass=mat('#374e4d',.23,.34),
 rubber=mat('#272d2a'),red=mat('#bf644e');
 const desertCamo=servicePaint(['#a1916e','#c1ad86','#777b5e'],{seed:4,repeat:3}),
  oliveCamo=servicePaint(['#6b795f','#a09b79','#c9b189'],{seed:22,repeat:3}),
  workSteel=servicePaint(['#47554d','#68766e','#848a7d'],{pattern:'metal',seed:19,repeat:3,metalness:.62,roughness:.43}),
  grittyConcrete=servicePaint(['#757067','#9c9481','#b0a48e'],{pattern:'concrete',seed:39,repeat:4,roughness:.97});
 // Extend the factory's footprint with side workshop wings, avoiding the
 // existing central production door and its garage rollout animation.
 for(const side of [-1,1]){
  const x=side*131;
  block(root,'FactoryServiceWing', [55,54,126],[x,28,-28],side>0?desertCamo:oliveCamo);
  block(root,'FactoryWingCamoRoof',[61,6,134],[x,57,-28],side>0?oliveCamo:desertCamo);
  for(const z of [-71,-37,-3]){
   block(root,'FactoryRib',[5,56,6],[x+side*26,29,z],steel);
  }
  for(let n=0;n<3;n++)
   block(root,'FactoryWorkshopWindow',[12,15,3],[x-side*29,37,-65+n*34],glass);
  block(root,'FactoryVentilator',[24,9,19],[x,66,-26],dark);
  block(root,'FactoryWeatheredFront_'+side,[52,48,2],[x,28,36.5],side>0?desertCamo:oliveCamo);
  for(const seam of [-19,0,19]){
   block(root,'FactoryFacadePanelSeam_'+side,[2,49,2.8],[x+seam,29,39],workSteel);
   for(const h of [12,30,46])
    block(root,'FactoryFacadeRivet_'+side,[3,2,2],[x+seam,h,40],steel);
  }
  block(root,'FactorySideVentHousing_'+side,[29,18,4],[x,39,41],dark);
  for(let n=0;n<5;n++)
   block(root,'FactorySideVentLouvre_'+side,[26,2,5],[x,33+n*3,43],workSteel);
  block(root,'FactoryRoofAirDuct_'+side,[24,12,43],[x,73,-22],workSteel);
  block(root,'FactoryRoofAirDuctCap_'+side,[30,3,49],[x,81,-22],dark);
  for(const z of [-65,-25,16]){
   block(root,'FactoryRoofPBRRib_'+side,[62,3,3],[x,61,z],steel);
   block(root,'FactoryCamoArmorPatch_'+side,[21,1.6,24],
    [x+(z===-25?12:-12),62,z+8],side>0?oliveCamo:desertCamo);
  }
 }
 // The repair area sits in front (+Z) of the existing front gate.
 block(root,'FactoryVehicleRepairApron',[322,1.7,201],[0,.85,171],grittyConcrete);
 block(root,'FactoryMaintenanceDriveInLane',[52,.18,200],[0,1.8,160],asphalt);
 for(const side of [-1,1]){
  const cx=side*76,index=side<0?0:1;
  block(root,'VehicleRepairBaySurface_'+index,[123,.2,120],[cx,1.95,175],asphalt);
  for(const edge of [-57,57])
   block(root,'RepairBayOutline_'+index,[2,.20,121],[cx+edge,2.13,175],yellow);
  for(const z of [119,231])
   block(root,'RepairBayFrontStripe_'+index,[118,.25,3],[cx,2.18,z],yellow);
  block(root,'RepairBayCenterline_'+index,[3,.23,82],[cx,2.25,176],yellow);
  for(const z of [135,163,190,216]){
   block(root,'FactoryExpansionJoint_'+index,[111,.24,1.5],[cx,2.27,z],dark);
   for(const sx of [-44,44])
    block(root,'FactoryApronPlateBolt_'+index,[3,.48,3],[cx+sx,2.58,z],steel);
  }
  // Actual elevated hydraulic platform plus a drive-on ramp. Its upper deck
  // matches the simulation's dedicated visual grounding during repair.
  block(root,'VehicleLiftPlatform_'+index,[88,3,96],[cx,8,175],workSteel);
  const driveRamp=block(root,'VehicleDriveOnRamp_'+index,[88,2,46],[cx,5.5,242],steel);
  driveRamp.rotation.x=.18;
  for(const strip of [-38,38])
   block(root,'VehiclePlatformSafetyStrip_'+index,[4,.35,96],[cx+strip,9.8,175],yellow);
  // Vehicle enters nose-forward between the twin lowerable jacks.
  for(const rail of [-27,27]){
   block(root,'HydraulicVehicleLiftRail_'+index,[12,5,85],[cx+rail,4.5,176],steel);
   for(const z of [143,209])
    block(root,'RepairLiftFoot_'+index,[24,3,21],[cx+rail,3.9,z],dark);
  }
  // One lateral maintenance gantry per bay so even the big main battle tank
  // can drive under the open middle without colliding with a rendered prop.
  for(const sx of [-1,1]){
   const x=cx+sx*59;
   block(root,'VehicleServiceCranePost_'+index,[7,77,8],[x,39,161],olive);
   block(root,'RepairLamp_'+index,[13,7,11],[x,73,168],yellow);
  }
  block(root,'RepairGantryCrossbeam_'+index,[123,8,9],[cx,79,161],steel);
  block(root,'RepairWarningBeam_'+index,[95,3,5],[cx,82,161],red);
  block(root,'ServiceControlConsole_'+index,[19,24,18],[cx-59,14,227],dark);
  for(const side of [-1,1]){
   block(root,'FactoryHydraulicLine_'+index,[3,17,3],[cx+side*44,14,177],steel);
   block(root,'FactoryLiftCable_'+index,[2,2,50],[cx+side*47,3,182],rubber);
  }
  block(root,'FactoryToolChest_'+index,[24,19,18],[cx+57,12,241],red);
  for(const h of [10,16,22])
   block(root,'FactoryToolChestDrawer_'+index,[20,1.5,2],[cx+57,h,251],workSteel);
  block(root,'ControlPanelGlass_'+index,[15,8,2],[cx-59,22,237],glass);
  const indicator=block(root,'RepairStatusIndicator_'+index,[9,7,5],[cx-59,34,225],yellow);
  const glow=block(root,'VehicleWeldingFlash_'+index,[6,7,6],[cx+28,27,170],yellow);
  glow.material=mat('#f0d575',0,.6);
  indicator.visible=false;glow.visible=false;
  // Floating maintenance cross is readable from the isometric tactical
  // camera while keeping the unit's HP bar and selection ring unobstructed.
  const icon=new THREE.Group();icon.name='FactoryRepairIcon_'+index;
  icon.position.set(cx,112,174);icon.visible=false;root.add(icon);
  const iconMat=new THREE.MeshBasicMaterial({
   color:'#95ffd0',transparent:true,opacity:.95,depthTest:false,depthWrite:false
  });
  const circle=new THREE.Mesh(new THREE.TorusGeometry(13.5,2,8,28),iconMat);
  circle.name='FactoryRepairCircle_'+index;circle.rotation.x=-Math.PI/2;
  circle.raycast=()=>{};icon.add(circle);
  block(icon,'FactoryRepairCrossHorizontal_'+index,[16,1.5,4],[0,0,0],iconMat);
  block(icon,'FactoryRepairCrossVertical_'+index,[4,1.5,16],[0,0,0],iconMat);
  const sparks=new THREE.Group();sparks.name='FactoryWeldingSparks_'+index;
  sparks.position.set(cx+24,25,169);sparks.visible=false;root.add(sparks);
  const sparkMaterial=new THREE.MeshBasicMaterial({
   color:'#ffe19a',transparent:true,opacity:.97,depthTest:false,depthWrite:false
  });
  for(let n=0;n<9;n++){
   const shard=new THREE.Mesh(new THREE.ConeGeometry(1.6,9+(n%3)*3,4),sparkMaterial);
   shard.name='FactoryWeldingSpark_'+index+'_'+n;
   shard.position.set(Math.cos(n*2.4)*6,(n%4)*2,Math.sin(n*2.4)*6);
   shard.rotation.set(Math.sin(n*2.1)*.75,0,Math.cos(n*1.7)*.85);
   shard.raycast=()=>{};sparks.add(shard);
  }
  root.userData['bay'+index]={indicator,glow,icon,sparks};
 }
 // Sand-scoured red-white warning stripes at the apron entry.
 for(let i=0;i<14;i++){
  const stripe=block(root,'FactoryApronChevron',[13,.2,4],[-146+i*22,2.3,264],i%2?yellow:red);
  stripe.rotation.y=-.38;
 }
 // Crates / machinery are pushed off the driving area.
 for(const x of [-174,174]){
  block(root,'VehiclePartsDepot',[26,25,31],[x,13,145],oliveCamo);
  block(root,'VehiclePartsDepotLid',[30,4,35],[x,27,145],steel);
  for(let z=0;z<2;z++){
   const wheel=new THREE.Mesh(new THREE.TorusGeometry(13,4,7,16),rubber);
   wheel.name='VehicleSpareWheel';wheel.rotation.x=Math.PI/2;
   wheel.position.set(x,15,192+z*15);wheel.raycast=()=>{};root.add(wheel);
  }
 }
 root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.raycast=()=>{};}});
 return root;
}
export function updateFactoryServiceYard(entry,base,units,time){
 const yard=entry.factoryServiceYard;if(!yard)return;
 for(const bay of [0,1]){
  const state=yard.userData['bay'+bay];
  const vehicle=units.find(u=>u.hp>0&&u.factoryService?.baseId===base.id&&u.factoryService?.bay===bay);
  state.indicator.visible=Boolean(vehicle);
  const phase=vehicle?.factoryService?.phase;
  const repairing=phase==='repair';
  state.glow.visible=repairing&&Math.sin(time*20+bay*1.5)>-.2;
  state.icon.visible=repairing||phase==='ready';
  state.sparks.visible=repairing;
  if(state.icon.visible){
   state.icon.position.y=112+Math.sin(time*3+bay)*3;
   state.icon.rotation.y=time*.32;
  }
  if(repairing){
   state.sparks.rotation.y=time*5+bay;
   state.sparks.children.forEach((spark,n)=>{
    spark.visible=Math.sin(time*29+n*3.1+bay)>.05;
    spark.position.y=(n%4)*2+Math.max(0,Math.sin(time*12+n*1.9))*7;
   });
  }
  if(state.indicator.visible){
   state.indicator.scale.y=1+.22*Math.sin(time*4+bay);
  }
 }
}
export function disposeFactoryServiceYard(entry){
 const group=entry?.factoryServiceYard;
 if(!group)return;
 group.removeFromParent();disposeServicePaint(group);disposeOwnedMeshes(group);entry.factoryServiceYard=null;
}
