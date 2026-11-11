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
function cylinder(parent,name,radius,height,x,y,z,mat,axis='y'){
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,16),mat);
 mesh.name=name;mesh.position.set(x,y,z);
 if(axis==='z')mesh.rotation.x=Math.PI/2;
 mesh.castShadow=false;mesh.receiveShadow=true;
 parent.add(mesh);return mesh;
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
 // True weathered textures on the ramps and fuel depot. The old plain
 // tan/olive cubes read like missing-material placeholders at RTS zoom.
 const apronWear=servicePaint(['#918b7b','#aaa18e','#777a6d'],
  {pattern:'concrete',seed:67,repeat:6,roughness:.94});
 const rampGrip=servicePaint(['#626b64','#454e4b','#929080'],
  {pattern:'metal',seed:25,repeat:4,metalness:.3,roughness:.84});
 const fuelPaint=servicePaint(['#788371','#aba68b','#626b64'],
  {pattern:'metal',seed:61,repeat:3,metalness:.42,roughness:.65});
 const fuelMetal=servicePaint(['#444f4d','#92998e','#65716c'],
  {pattern:'metal',seed:63,repeat:3,metalness:.64,roughness:.46});
 const glow=new THREE.MeshBasicMaterial({color:paint.repair,transparent:true,opacity:.9});
 // Long military runway: one uninterrupted strip extends far past the
 // hangars; the old short cross-runway ahead of the building is gone.
 // Painted taxi directions are not a second black asphalt runway.
 box(group,'AirfieldExpandedConcreteApron',424,1.5,309,-115,.75,-14,wornPaving);
 box(group,'AirfieldRunwaySandShoulder',165,.7,614,132,1.05,105,wornPaving);
 box(group,'AirfieldExtendedRunway',141,1.6,600,132,1.85,105,runwayWear);
 // Two generously sized clear exterior aircraft stands beside hangars.
 for(const bay of [0,1]){
  const cx=bay===0?-151:-26;
  box(group,'AirfieldAircraftParkingPad_'+bay,115,.32,156,cx,1.68,120,apronWear);
  // Textured anti-slip loading ramp, continuous with the two aircraft
  // parking lanes. These are thin visual meshes, not collidable obstacles.
  box(group,'AirfieldParkingRampGrip_'+bay,112,.28,33,cx,2.04,192,rampGrip);
  for(const side of [-1,1]){
   box(group,'AirfieldParkingRampEdge_'+bay,3,.25,36,cx+side*54,2.25,192,yellow);
  }
  for(let n=0;n<7;n++){
   box(group,'AirfieldParkingRampTread_'+bay,103,.18,1.7,cx,2.28,176+n*4.8,fuelMetal);
  }
  for(const z of [82,123,163]){
   box(group,'AirfieldConcreteJoint_'+bay,111,.14,1.8,cx,2.04,z,steel);
  }
  for(const x of [-40,-20,20,40]){
   box(group,'AirfieldParkingWearMark_'+bay,4,.12,19,cx+x,2.08,147,runwayWear);
  }
  box(group,'AirfieldAircraftParkingCenterline_'+bay,3,.16,111,cx,1.96,119,yellow);
  for(const side of [-1,1]){
   box(group,'AirfieldAircraftParkingEdge_'+bay,2,.16,125,cx+side*54,1.95,120,markings);
   box(group,'AirfieldAircraftParkingChock_'+bay,18,2,5,cx+side*34,3.1,154,dark);
  }
  box(group,'AirfieldAircraftParkingStop_'+bay,93,.15,3,cx,1.96,54,yellow);
  box(group,'AirfieldAircraftParkingNumber_'+bay,14,.12,8,cx,1.98,184,markings);
 }
 for(let z=-180;z<=382;z+=42)
  box(group,'AirfieldRunwayCenterDash',3,.12,30,132,2.80,z,markings);
 for(const x of [64,200]){
  box(group,'AirfieldRunwayEdgeLine',2,.12,589,x,2.80,105,markings);
  for(let z=-184;z<=388;z+=42)
   box(group,'AirfieldRunwayLamp',5,2,8,x,4.0,z,yellow);
 }
 // Clear runway thresholds and staggered military landing-zone stripes.
 for(const z of [-184,-174,-164])for(const x of [88,107,157,176])
  box(group,'AirfieldRunwayThreshold',11,.16,5,x,2.83,z,markings);
 for(const z of [340,352,364,376])for(const x of [89,175])
  box(group,'AirfieldRunwayLandingBars',19,.15,7,x,2.84,z,markings);
 // One simple taxi guideline connects the wide stands with the long runway.
 // It does not cover the apron as the old short black runway did.
 box(group,'AirfieldTaxiCrossGuide',302,.16,2.6,-18,2.03,24,yellow);
 for(const x of [-193,-151,-109,-66,-24,18])
  box(group,'AirfieldTaxiGuideDash',16,.14,3,x,2.08,24,markings);
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
  // Armored hangar fascia, flush service lights and tapered upper cladding.
  // Preserve the unobstructed x±59 doorway for real bomber taxiing.
  box(group,'HangarRecessedFascia_'+bay,112,8,11,cx,77,front+10,roofCamo);
  for(const side of [-1,1]){
   box(group,'HangarCamoButtress_'+bay,11,43,21,cx+side*66,29,front-29,wallCamo);
   box(group,'HangarRoofSpine_'+bay,7,3,143,cx+side*37,100,-75,ribbedSteel);
   for(const z of [-138,-91,-44]){
    const fairing=box(group,'HangarAngledRoofPlate_'+bay,27,2.5,29,cx+side*29,102,z,
     (z===-91?roofCamo:roofSand));
    fairing.rotation.z=side*.15;
   }
  }
  for(const x of [-39,-13,13,39]){
   box(group,'HangarRoofVentSlit_'+bay,9,1.8,27,cx+x,103,-107,dark);
   box(group,'HangarServiceFloodlight_'+bay,9,3.5,5,cx+x,76,front+17,yellow);
  }
  for(const z of [-132,-88,-44]){
   box(group,'HangarSideArmorRib_'+bay,4,24,3,cx-64,46,z,steel);
   box(group,'HangarSideArmorRib_'+bay,4,24,3,cx+64,46,z,steel);
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
 for(const x of [110,154])for(const z of [-136,42,195,313])
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
 // Keep both aircraft door approaches fully empty. The control tower,
 // fuel tanks and ancillary equipment occupy the outside LEFT service strip.
 // The right maintenance bay is as unobstructed as the first.
 const towerX=-298,towerZ=-89;
 box(group,'AirfieldLeftControlTowerFoundation',88,9,86,towerX,5,towerZ,wornPaving);
 const shaft=box(group,'AirfieldLeftControlTowerShaft',61,111,58,towerX,62,towerZ,wallCamo);
 for(const y of [26,54,83,110])
  box(group,'AirfieldLeftControlTowerArmorBand',67,4,64,towerX,y,towerZ,ribbedSteel);
 for(const side of [-1,1]){
  box(group,'AirfieldLeftControlTowerRecess',6,67,17,towerX+side*32,71,towerZ,roofCamo);
  for(const y of [38,64,90])
   box(group,'AirfieldLeftControlTowerVent',7,3,23,towerX+side*35,y,towerZ,steel);
 }
 box(group,'AirfieldLeftControlTowerDeck',110,11,102,towerX,125,towerZ,ribbedSteel);
 box(group,'AirfieldLeftControlTowerGlazing',102,35,94,towerX,148,towerZ,glass);
 for(const x of [-36,-12,12,36])for(const z of [-48,48])
  box(group,'AirfieldLeftControlTowerMullion',3,33,4,towerX+x,148,towerZ+z,steel);
 for(const z of [-31,0,31])for(const x of [-53,53])
  box(group,'AirfieldLeftControlTowerSideMullion',4,32,3,towerX+x,148,towerZ+z,steel);
 box(group,'AirfieldLeftControlTowerRoof',118,9,108,towerX,170,towerZ,roofCamo);
 box(group,'AirfieldLeftControlTowerAntenna',3,42,3,towerX+39,196,towerZ-26,steel);
 box(group,'AirfieldLeftControlTowerSignalLamp',10,5,10,towerX+39,220,towerZ-26,yellow);
 for(const x of [towerX-48,towerX+48])for(const z of [towerZ-47,towerZ+47])
  box(group,'AirfieldLeftControlTowerRoofPost',3,13,3,x,182,z,steel);
 // Reposition the gas infrastructure to the far-left outer service strip,
 // never across the left or right aircraft arrival/repair corridors.
 // Compact weathered fuel compound: textured asphalt slab, corrugated
 // khaki tank shells, cylindrical caps, metallic bands, valves and piping.
 // No unfinished flat cuboid "barrel" placeholders beside the hangar.
 box(group,'AirfieldFuelServicePad',85,1.25,234,-333,1.35,15,apronWear);
 for(const z of [-70,-12,47,105])
  box(group,'AirfieldFuelConcreteJoint',81,.14,1.6,-333,2.25,z,fuelMetal);
 box(group,'AirfieldMaintenancePlant',32,18,47,-347,12,-166,wallCamo);
 box(group,'AirfieldMaintenanceAirDuct',12,4,28,-346,24,-166,ribbedSteel);
 box(group,'AirfieldFuelServiceContainer',36,24,48,-310,13,75,wallCamo);
 for(const x of [-326,-310,-294])
  box(group,'AirfieldFuelContainerRib',2.3,23,49,x,13.6,75,ribbedSteel);
 for(const z of [41,109]){
  // Real horizontal drums, not tan box primitives. The axial direction is
  // +Z; dark end caps and steel straps remain visible at tactical zoom.
  cylinder(group,'AirfieldFuelServiceTank',11,44,-342,17,z,fuelPaint,'z');
  for(const band of [-16,0,16])
   cylinder(group,'AirfieldFuelTankSteelBand',11.8,2.5,-342,17,z+band,fuelMetal,'z');
  for(const side of [-1,1]){
   cylinder(group,'AirfieldFuelTankEndCap',10.4,1.6,-342,17,z+side*22.8,ribbedSteel,'z');
   cylinder(group,'AirfieldFuelTankEndPlate',4.2,2.1,-342,17,z+side*24.2,dark,'z');
  }
  for(const offset of [-8,8])
   box(group,'AirfieldFuelTankSaddle',4,6,9,-342+offset,6.2,z,steel);
  // Pipe elbows follow the outside edge rather than blocking taxi lanes.
  cylinder(group,'AirfieldFuelValve',4.1,9,-319,14,z,fuelMetal);
  box(group,'AirfieldFuelPipeManifold',5,4,42,-320,10,z,ribbedSteel);
  box(group,'AirfieldFuelServicePipe',4.8,4,30,-317,11,z,fuelMetal);
  cylinder(group,'AirfieldFuelValveWheel',5,2.2,-318,20,z,yellow);
 }
 box(group,'AirfieldFuelSupplyMain',3.4,3.4,116,-319,9.8,78,fuelMetal);
 box(group,'AirfieldFuelServicePump',18,24,18,-306,13,136,ribbedSteel);
 box(group,'AirfieldFuelPumpDisplay',12,9,1.7,-306,21,146,glass);
 box(group,'AirfieldFuelPumpControl',5.5,3.2,2,-301,12,146,yellow);
 box(group,'AirfieldFuelPumpRoof',24,3,23,-306,27,136,roofSand);
 for(const x of [-169,-134,-44,-8])
  box(group,'HangarSafetyChevron',8,.15,5,x,3.5,42,yellow);
 group.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=false;mesh.receiveShadow=false;mesh.raycast=()=>{};}});
 return group;
}
/** Terrain-following surface mesh used by both the construction ghost and
 * the final airfield. The runway previously sank into dune crests because
 * its former 980-unit length was fixed to the building-center elevation.
 * Render-only: no terrain edits, building collisions or aircraft state changes.
 *
 * The paving is remeshed once with adaptive 18-unit subdivisions. Subsequent
 * mouse moves update the existing vertex buffer, without allocating meshes.
 * The same function is called for the ghost at its prospective location and
 * for the built site, including every cardinal facing.
 */
const AIRFIELD_GROUND_SURFACE=/^(AirfieldFuelServicePad|AirfieldFuelConcreteJoint|AirfieldParkingRampGrip|AirfieldParkingRampEdge|AirfieldParkingRampTread|AirfieldConcreteJoint|AirfieldParkingWearMark|AirfieldExpandedConcreteApron|AirfieldRunwaySandShoulder|AirfieldExtendedRunway|AirfieldAircraftParking(?:Pad|Centerline|Edge|Stop|Number)|AirfieldRunwayCenterDash|AirfieldRunwayEdgeLine|AirfieldRunwayThreshold|AirfieldRunwayLandingBars|AirfieldTouchdownRubber|AirfieldTaxiCrossGuide|AirfieldTaxiGuideDash|HangarCenterGuide|HangarApronStop|HangarSafetyChevron|AirfieldApronExpansionJoint)/;
const AIRFIELD_GROUND_PROPS=/^(AirfieldRunwayLamp|AirfieldAircraftParkingChock)$/;
export function conformAirfieldSurface(group,base,heightAt,{force=false}={}){
 if(!group||typeof heightAt!=='function'||!Number.isFinite(base?.x)||!Number.isFinite(base?.y))return 0;
 // Moving a construction ghost by a few pixels must not resample tens of
 // thousands of vertices every pointer frame. Finished sites are baked once.
 const key=[Math.round(base.x/12),Math.round(base.y/12),base.facing??0].join(':');
 if(!force&&group.userData.airfieldTerrainKey===key)return 0;
 group.userData.airfieldTerrainKey=key;
 const yaw=[0,Math.PI,Math.PI/2,Math.PI*1.5][base.facing??0]??0;
 const cs=Math.cos(yaw),sn=Math.sin(yaw);
 const origin=heightAt(base.x,base.y);
 if(!Number.isFinite(origin))return 0;
 let changed=0;
 group.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.parameters)return;
  const name=mesh.name;
  if(!AIRFIELD_GROUND_SURFACE.test(name)&&!AIRFIELD_GROUND_PROPS.test(name))return;
  const old=mesh.geometry;
  if(AIRFIELD_GROUND_PROPS.test(name)){
   // Lamps/chocks stand on the same draped pavement, rather than becoming
   // buried below the surrounding sand.
   const y0=mesh.userData.airfieldBaseY??mesh.position.y;
   mesh.userData.airfieldBaseY=y0;
   const wx=base.x+mesh.position.x*cs+mesh.position.z*sn;
   const wz=base.y-mesh.position.x*sn+mesh.position.z*cs;
   const rise=heightAt(wx,wz)-origin;
   if(Number.isFinite(rise))mesh.position.y=y0+rise;
   changed++;return;
  }
  const {width:w,height:h,depth:d}=old.parameters;
  if(!Number.isFinite(w)||!Number.isFinite(d))return;
  let data=mesh.userData.airfieldTerrainData;
  if(!data){
   // No excessive tessellation for 2-unit stripes; the long central paving
   // gets a proper grid that matches the 3D heightfield, including crests.
   const nx=Math.max(1,Math.min(34,Math.ceil(w/18)));
   const nz=Math.max(1,Math.min(64,Math.ceil(d/18)));
   const geometry=new THREE.BoxGeometry(w,h,d,nx,1,nz);
   const verts=geometry.getAttribute('position');
   data={original:Float32Array.from(verts.array),geometry};
   mesh.geometry=geometry;mesh.userData.airfieldTerrainData=data;
   old.dispose();
  }
  const verts=data.geometry.getAttribute('position');
  const source=data.original;
  for(let i=0;i<verts.count;i++){
   const at=i*3;
   const x=mesh.position.x+source[at],z=mesh.position.z+source[at+2];
   const wx=base.x+x*cs+z*sn,wz=base.y-x*sn+z*cs;
   const sampled=heightAt(wx,wz);
   // Three.js samples the same terrain used for unit grounding. An
   // extra two world units avoids microscopic z fighting at steep edges.
   const rise=Number.isFinite(sampled)?sampled-origin+2:0;
   verts.setY(i,source[at+1]+rise);
  }
  verts.needsUpdate=true;
  data.geometry.computeVertexNormals();
  data.geometry.computeBoundingSphere();
  changed++;
 });
 return changed;
}

export function updateAirfieldServiceYard(entry,base,units,time,dt){
 const group=entry.airfieldServiceYard;if(!group)return;
 for(const bay of [0,1]){
  const gate=group.userData['bay'+bay];
  const aircraft=units.find(u=>u.hp>0&&u.airfieldService?.baseId===base.id&&u.airfieldService?.bay===bay);
  const phase=aircraft?.airfieldService?.phase;
  // Start opening while the bomber is still landing. The shutters must
  // be fully clear before ground taxi reaches the entrance.
  const target=phase&&phase!=='approach'?1:0;
  gate.open+=(target-gate.open)*Math.min(1,Math.max(0,dt)*2.5);
  // The two halves physically slide sideways into reinforced wall pockets.
  gate.left.position.x=gate.cx-27-28*gate.open;
  gate.right.position.x=gate.cx+27+28*gate.open;
  // A sideways split alone leaves only a 58-unit slot, narrower than
  // the bomber's 107-unit wings. Retract both corrugated doors up into
  // the fascia so the FULL physical entrance becomes unobstructed.
  gate.left.scale.y=gate.right.scale.y=1-.94*gate.open;
  gate.left.position.y=gate.right.position.y=36+42*gate.open;
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
  if(/^(?:Atlas_)?(?:Hangar|ParkedJet|JetWheel|AirfieldRunway|AirfieldConcreteApron|TaxiwayFromHangar|Runway|ApronStopLine|SecurityPerimeter|ControlTower|Tower|MaintenanceServiceBlock|ServiceFlatRoof|ServiceRollerDoor|ServiceDoorLouvre|RoofCoolingUnit|AntennaEquipmentPad|AntennaStem|Beacon|FuelStorageTank|FuelTankSteelBand|FuelTankSupport|FuelPipingMain|FuelPipeTap|CargoContainer|AirbaseFloodlightMast|AirbaseFloodlightTop|AirbaseFloodlightLens|GroundPlinth|CeramicFoundation)/.test(child.name))
   {child.visible=false;child.userData.airfieldLegacyHidden=true;}
 });
 entry.airfieldOldHidden=true;
}
export function disposeAirfieldServiceYard(entry){
 if(!entry?.airfieldServiceYard)return;
 const root=entry.airfieldServiceYard;root.removeFromParent();
 disposeServicePaint(root);disposeOwnedMeshes(root);entry.airfieldServiceYard=null;
}
