import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Add service hardware to the existing assemblies. New static parts are
 * batched by surface; animated source meshes and their names remain intact. */
export function upgradeBuildingDetails(model,kind,team){
 const source={parts:model.userData.atlasDesign.parts,triangles:model.userData.atlasDesign.triangles};
 const batches=new Map(),features=[];
 const mat=new T.MeshStandardMaterial({name:'Atlas service hardware'});
 function add(name,geometry,role,at=[0,0,0],rotation=[0,0,0],parent=model,identification=false){
  const matrix=new T.Matrix4().compose(new T.Vector3(...at),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),new T.Vector3(1,1,1));
  geometry.applyMatrix4(matrix);
  // Common attributes keep merged geometry compact and avoid material groups.
  if(geometry.index)geometry=geometry.toNonIndexed();
  for(const key of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(key))geometry.deleteAttribute(key);
  const key=parent.uuid+role+identification;if(!batches.has(key))batches.set(key,{parent,role,identification,geometries:[],names:[]});
  const batch=batches.get(key);batch.geometries.push(geometry);batch.names.push(name);features.push(name);
 }
 const box=(name,size,role,at,rotation=[0,0,0],parent=model)=>add(name,new RoundedBoxGeometry(...size,1,Math.min(.012,...size.map(v=>v*.15))),role,at,rotation,parent);
 const cyl=(name,r,h,role,at,rotation=[0,0,0],parent=model,segments=16)=>add(name,new T.CylinderGeometry(r,r,h,segments),role,at,rotation,parent);
 const rod=(name,a,b,r=.015,role='steel',parent=model)=>{
  const start=new T.Vector3(...a),end=new T.Vector3(...b),d=end.clone().sub(start),geometry=new T.CylinderGeometry(r,r,d.length(),10);
  geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));add(name,geometry,role,start.add(end).multiplyScalar(.5).toArray(),[0,0,0],parent);
 };
 const bolt=(x,y,z,parent=model)=>cyl('HexFastener',.016,.013,'steel',[x,y,z],[Math.PI/2,0,0],parent,6);
 function panel(x,y,z,w,h,role='sand'){
  box('ReplaceableArmour',[w,h,.035],role,[x,y,z]);
  for(const dx of [-w*.42,w*.42])for(const dy of [-h*.40,h*.40])bolt(x+dx,y+dy,z+.025);
 }
 function fan(x,y,z,r=.17){
  box('FanHousing',[r*2.5,.19,r*2.5],'sand',[x,y-.075,z]);
  cyl('FanRecess',r,.012,'rubber',[x,y+.025,z]);cyl('FanHub',r*.22,.035,'steel',[x,y+.047,z]);
  for(let i=0;i<7;i++)box('FanBlade',[r*.22,.012,r*1.55],'steel',[x,y+.039,z],[0,i*Math.PI/7,0]);
  for(let i=-3;i<=3;i++)box('FanSafetyGrille',[r*1.87,.014,.012],'steel',[x,y+.068,z+i*r*.25]);
  for(const dx of [-r,r])for(const dz of [-r,r])cyl('GrilleBolt',.014,.012,'steel',[x+dx,y+.074,z+dz],[0,0,0],model,6);
 }
 function ladder(x,bottom,top,z){
  for(const dx of [-.105,.105])rod('LadderRail',[x+dx,bottom,z],[x+dx,top,z],.018);
  for(let y=bottom+.08;y<top;y+=.15)rod('LadderRung',[x-.10,y,z],[x+.10,y,z],.013);
 }
 function crate(x,y,z){
  box('SealedEquipmentCase',[.34,.23,.24],'rubber',[x,y,z]);box('EquipmentLid',[.35,.045,.25],'sand',[x,y+.12,z]);
  for(const dx of [-.12,.12])box('CaseStrap',[.025,.24,.255],'steel',[x+dx,y,z]);
 }
 function sign(x,y,z,w=.43,h=.19,parent=model,rotation=[0,0,0]){
  box('IdentificationFrame',[w+.035,h+.035,.027],'steel',[x,y,z],rotation,parent);
  const g=new T.PlaneGeometry(w,h);add('FactionIdentification',g,'identity',[x,y,z+.017],rotation,parent,true);
 }
 function hazard(x,y,z,w=.12,h=.69){box('SafetyChevrons',[w,h,.023],'hazard',[x,y,z]);}

 if(kind==='headquarters'){
  // Large new silhouette/readability details: visible at the actual RTS sprite size.
  // Unlike the fine bolts, these features survive the 512px bake and game downscale.
  box('CommandGateRecess',[1.54,.93,.115],'rubber',[0,.78,1.635]);
  box('ArmouredBlastDoorLeft',[.70,.83,.13],'steel',[-.365,.77,1.723]);
  box('ArmouredBlastDoorRight',[.70,.83,.13],'steel',[.365,.77,1.723]);
  for(const yy of [.51,.73,.95,1.14])
   box('CommandDoorRibs',[1.41,.041,.145],'sand',[0,yy,1.793]);
  for(const xx of [-.74,.74]){
   box('CommandDoorJamb',[.115,1.12,.16],'camo',[xx,.77,1.72]);
   box('WarningSideBand',[.075,.72,.17],'hazard',[xx*1.13,.73,1.77]);
  }
  box('HeadquartersRoofArmourA',[.68,.10,.83],'camo',[-.87,1.51,-.49]);
  box('HeadquartersRoofArmourB',[.68,.10,.83],'camo',[.87,1.51,-.49]);
  box('CommandCanopy',[1.72,.145,.47],'steel',[0,1.315,1.77]);
  sign(0,1.39,2.023,.83,.20);
  fan(.82,1.48,.52,.17);fan(1.25,1.48,.52,.13);
  box('HVACDuct',[.48,.17,.15],'steel',[.72,1.45,.12]);
  rod('RoofConduit',[1.28,1.45,-.12],[1.28,1.45,.82],.024,'rubber');
  ladder(-1.18,.36,1.48,1.36);
  for(const x of [-.64,.64])panel(x,.69,1.54,.15,.48,'sand');
  sign(0,.96,1.552,.49,.14);
  crate(-1.15,.42,-1.26);crate(-.73,.42,-1.26);
  // Grounded side reinforcement stays inside the original corner pods.
  for(const side of [-1,1])for(const z of [-.65,.0,.65]){
   box('SideBlastRib',[.07,.75,.065],'steel',[side*1.59,.68,z]);
   box('SideReplaceableArmour',[.035,.53,.51],'sand',[side*1.633,.72,z+.28]);
  }
 }else if(kind==='factory'){
  // The industrial opening must read as a full-size armored vehicle gate.
  box('FactoryBlastShutter',[1.62,1.04,.09],'rubber',[.18,.78,1.435]);
  for(let i=0;i<8;i++){
   box('FactoryShutterPlate',[1.48,.104,.105],i%2?'camo':'steel',[.18,.36+i*.115,1.51]);
  }
  for(const xx of [-.66,1.01]){
   box('HeavyGateColumn',[.16,1.35,.16],'steel',[xx,.78,1.54]);
   box('GateHazardStripe',[.086,1.10,.17],'hazard',[xx,.74,1.638]);
  }
  box('FactoryLoadingCanopy',[2.10,.14,.41],'camo',[.18,1.42,1.61]);
  box('FactoryRoofArmor',[1.24,.10,.71],'camo',[.12,1.65,-.45]);
  // Replace broad team-painted roof with a field-painted industrial shell.
  for(const x of [-1.32,1.32]){
   panel(x,.74,1.125,.22,.67);hazard(x,.73,1.155,.075,.61);
   box('DoorRail',[.065,.90,.075],'steel',[x<0?-.59:.97,.72,1.36]);
  }
  sign(.19,1.22,1.37,.65,.15);
  for(const side of [-1,1])for(let i=0;i<4;i++){
   box('ServiceWallCassette',[.065,.67,.40],'camo',[side*1.535,.73,-.78+i*.50]);
   box('CassetteSeam',[.075,.017,.33],'steel',[side*1.55,.50,-.78+i*.50]);
  }
  fan(-.84,1.80,-.10,.24);fan(.36,1.80,-.10,.24);
  rod('ExtractionDuct',[-.84,1.58,-.55],[-.84,1.58,-.91],.095);
  ladder(-1.18,.28,1.42,1.15);
  for(const x of [-.93,.93]){
   box('RoofServiceRail',[.025,.14,1.67],'steel',[x,1.44,-.02]);
   for(const z of [-.80,.0,.80])box('RailStanchion',[.028,.22,.028],'steel',[x,1.35,z]);
  }
  crate(-1.23,.41,-1.08);crate(-.81,.41,-1.08);
  box('ServiceHoist',[.38,.17,.48],'sand',[-1.12,.48,1.10]);
  for(const x of [-.46,.85])box('DoorTrack',[.035,.025,.31],'steel',[x,.27,1.16]);
 }else if(kind==='barracks'){
  box('BarracksEntryRecess',[.86,1.04,.08],'rubber',[-.18,.79,1.43]);
  box('BarracksBlastDoor',[.74,.93,.11],'steel',[-.18,.77,1.501]);
  for(const yy of [.48,.71,.94])
   box('BarracksDoorStiffener',[.76,.048,.14],'sand',[-.18,yy,1.563]);
  for(const xx of [-1.04,.72])
   box('BarracksFrontArmor',[.30,.81,.09],'camo',[xx,.79,1.47]);
  box('BarracksDoorOverhang',[1.25,.12,.36],'steel',[-.18,1.34,1.57]);
  box('BarracksRoofCamo',[1.23,.08,.75],'camo',[0,1.80,-.38]);
  sign(.42,1.08,1.399,.48,.12);
  fan(.88,1.72,-.50,.15);
  ladder(-1.13,.26,1.81,-1.04);
  for(const z of [-.60,-.10,.40])box('SideWindow',[.019,.20,.27],'glass',[1.413,.91,z]);
  crate(-.80,.41,1.10);crate(-1.20,.41,1.10);
  for(const x of [-.75,-.25,.25])box('RoofLiftingEye',[.075,.055,.026],'steel',[x,1.92,-.65]);
  box('FieldRadio',[.29,.18,.22],'sand',[-.85,1.96,-.16]);
  rod('RadioWhip',[-.85,2.03,-.16],[-.85,2.36,-.16],.009);
 }else if(kind==='airfield'){
  // Large contrasting hangar panels and landing-direction bars.
  box('HangarSideArmor',[.07,.81,1.39],'camo',[1.395,.83,-.29]);
  box('HangarOverheadSafetyBeam',[1.87,.145,.11],'hazard',[.41,1.42,.72]);
  for(const x of [-.35,1.19]){
   box('HangarGateGuide',[.105,1.10,.115],'steel',[x,.85,.69]);
  }
  // Retain the landing deck and tower. A steel hangar fills the back of the
  // same foundation, leaving a marked apron in front of its closed doors.
  const x=.41,z=-.28;
  box('HangarShell',[1.87,.98,1.66],'camo',[x,.85,z]);
  box('HangarRoofLeft',[1.01,.095,1.78],'sand',[x-.46,1.43,z],[0,0,.22]);
  box('HangarRoofRight',[1.01,.095,1.78],'sand',[x+.46,1.43,z],[0,0,-.22]);
  box('RidgeCap',[.13,.08,1.80],'steel',[x,1.55,z]);
  box('HangarDoorRecess',[1.71,.87,.035],'rubber',[x,.81,.566]);
  for(let i=0;i<8;i++){
   box('HangarDoorLeaf',[.195,.77,.032],'steel',[x-.706+i*.202,.81,.595]);
   for(const y of [.53,.80,1.07])box('DoorPressedPanel',[.163,.19,.018],'sand',[x-.706+i*.202,y,.617]);
  }
  for(const dx of [-.90,.90]){box('HangarButtress',[.095,.98,.13],'steel',[x+dx,.84,.60]);hazard(x+dx,.81,.676,.077,.72);}
  box('DoorUpperTrack',[1.91,.10,.10],'steel',[x,1.29,.62]);sign(x,1.31,.682,.67,.095);
  for(let i=0;i<5;i++){
   const rz=-1.00+i*.36;
   box('HangarRoofRibLeft',[1.01,.025,.025],'steel',[x-.46,1.49,rz],[0,0,.22]);
   box('HangarRoofRibRight',[1.01,.025,.025],'steel',[x+.46,1.49,rz],[0,0,-.22]);
   box('HangarWallRib',[.035,.90,.045],'steel',[1.36,.82,rz]);
  }
  box('SideServiceDoor',[.026,.59,.28],'steel',[1.36,.68,-.56]);
  fan(.88,1.59,-.69,.13);crate(-.31,.48,.90);
  box('ApronStopLine',[1.44,.012,.045],'hazard',[.41,.35,.88]);
  for(const px of [.0,.83])box('ApronGuide',[.028,.012,.33],'sand',[px,.35,1.08]);
  ladder(-1.36,.35,1.51,-.28);
  rod('ControlAerial',[-1.20,1.54,-.87],[-1.20,1.94,-.87],.012);
  model.traverse(n=>{
   if(n.name.includes('LandingGuide')){n.scale.setScalar(.31);n.position.set(.41,.35,1.12);}
   if(n.name.includes('GuideBar')){n.scale.z=.35;n.position.x=.41;n.position.z=1.10;}
  });
 }else if(kind==='generator'){
  box('GeneratorCorePanel',[.53,.82,.17],'camo',[0,.83,.56]);
  box('GeneratorServiceDoor',[.36,.62,.19],'steel',[0,.82,.68]);
  box('GeneratorWarningBand',[.37,.11,.21],'hazard',[0,.52,.81]);
  for(const x of [-.58,.58]){
   box('CoolantRadiator',[.19,.67,.55],'steel',[x,.68,0]);
   for(let i=0;i<10;i++)box('RadiatorCoolingFin',[.23,.018,.58],'steel',[x,.40+i*.058,0]);
   rod('CoolantSupply',[x,.46,.27],[x,.46,.44],.034,'rubber');
   rod('CoolantReturn',[x,.91,.27],[x,.91,.44],.034,'steel');
   rod('CoreFeed',[x,.46,.44],[x*.35,.46,.44],.034,'steel');
  }
  box('ServiceSwitchgear',[.31,.40,.18],'sand',[0,.58,.51]);
  sign(0,.61,.615,.24,.13);hazard(0,.41,.616,.28,.044);
  for(const x of [-.35,.35])rod('ArmouredCable',[x,.28,-.47],[x,1.31,-.28],.022,'rubber');
  cyl('PressureValve',.075,.028,'steel',[.32,.65,.48],[Math.PI/2,0,0]);
  fan(0,.32,-.48,.14);
 }else if(kind==='turret'){
  box('TurretBaseArmor',[.67,.38,.69],'camo',[0,.34,0]);
  for(const xx of [-.30,.30])
   box('TurretBaseArmourLip',[.12,.28,.78],'steel',[xx,.43,.0]);
  const head=model.getObjectByName('TurretHead');
  sign(0,.17,-.482,.28,.12,head,[0,Math.PI,0]);
  for(const x of [-.38,.38]){
   rod('HydraulicFeed',[x,-.06,-.18],[x,-.16,-.36],.015,'rubber',head);
   cyl('SmokeDischarger',.027,.15,'steel',[x,.22,-.33],[.5,0,0],head,12);
  }
 }else if(kind==='bastion'){
  box('BastionFrontBlastShield',[.98,.43,.11],'camo',[0,.39,.69]);
  box('BastionArmourTopCap',[1.02,.06,.17],'steel',[0,.64,.69]);
  for(const xx of [-.47,.47])
   box('BastionIdentityStripe',[.075,.40,.13],'hazard',[xx,.39,.76]);
  // Keep the complete imported radar and CaptureSweep hierarchy untouched.
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3,x=Math.sin(a)*.58,z=Math.cos(a)*.58;
   box('BlastReinforcement',[.08,.28,.06],'steel',[x,.29,z],[0,a,0]);
   cyl('AnchorBolt',.022,.018,'steel',[x,.44,z],[0,0,0],model,6);
  }
  sign(0,.44,.628,.29,.14);
  box('RelayServiceBox',[.23,.26,.15],'sand',[-.30,.56,-.25]);
  rod('RelayCable',[-.30,.48,-.33],[-.12,1.12,-.17],.018,'rubber');
 }
 for(const {parent,role,identification,geometries,names} of batches.values()){
  const geometry=mergeGeometries(geometries,false);if(!geometry)throw Error('Cannot batch service hardware');
  const mesh=new T.Mesh(geometry,mat);mesh.name='AtlasUpgrade_'+kind+'_'+role+(identification?'_badge':'');mesh.userData={surface:role,identification,details:names};mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);
  for(const g of geometries)g.dispose();
 }
 let parts=0,triangles=0;model.traverse(n=>{if(n.isMesh){parts++;triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;}});
 Object.assign(model.userData.atlasDesign,{sourceGeometry:source,parts,triangles:Math.round(triangles),serviceDetails:features.length,serviceFeatures:[...new Set(features)]});
}
