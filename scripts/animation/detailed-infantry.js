import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {realisticDesertMaterials} from './realistic-desert-materials.js';

// PBR textile, nylon, ceramic and worn steel surfaces are baked into each GLB.
// Original human-proportioned tactical equipment around the licensed animated rig.
// All clothes and accessories follow anatomical joints; the battle scene remains sprite-based.
export function buildDetailedInfantry(model,team=0,role='infantry'){
 const bones={};model.traverse(n=>{if(n.isBone)bones[n.name]=n;});model.updateMatrixWorld(true);
 const p=name=>{if(!bones[name])throw Error('Missing rig joint '+name);return bones[name].getWorldPosition(new T.Vector3());};
 const oldMeshes=[];model.traverse(n=>{if(n.isMesh)oldMeshes.push(n);});oldMeshes.forEach(n=>n.visible=false);
 const m=realisticDesertMaterials(team);
 const parts=[];let triangles=0;
 const mesh=(name,geometry,mat,parent,position=[0,0,0])=>{const n=new T.Mesh(geometry,mat);n.name='Atlas_'+name;n.position.set(...position);n.castShadow=n.receiveShadow=true;parent.add(n);parts.push(n);triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;return n;};
 const box=(name,size,mat,parent,position=[0,0,0],radius=.018)=>mesh(name,new RoundedBoxGeometry(...size,Math.min(...size)<.03?1:3,Math.min(radius,...size.map(v=>v*.25))),mat,parent,position);
 const sphere=(name,size,mat,parent,position)=>{const n=mesh(name,new T.SphereGeometry(1,24,16),mat,parent,position);n.scale.set(...size);return n;};
 const cylinder=(name,radius,length,mat,parent,position,axis='z')=>{const n=mesh(name,new T.CylinderGeometry(radius,radius,length,20),mat,parent,position);if(axis==='z')n.rotation.x=Math.PI/2;if(axis==='x')n.rotation.z=Math.PI/2;return n;};
 const attach=(name,joint,at,rotation)=>{const g=new T.Group();g.name='Atlas_'+name;g.position.copy(at);if(rotation)g.quaternion.copy(rotation);model.add(g);g.updateMatrixWorld(true);bones[joint].attach(g);return g;};
 // Tapered textile volumes avoid rectangular, robotic arms and legs.
 // The clothing's full silhouette is authored as organic 3D geometry, not just retextured boxes.
 const segment=(name,joint,end,width,depth)=>{
  const a=p(joint),b=typeof end==='string'?p(end):end,delta=b.clone().sub(a),length=delta.length();
  const g=attach(name,joint,a.clone().add(b).multiplyScalar(.5),
   new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize()));
  const radii=[.51,.60,.59,.55,.49,.44,.38];
  const points=radii.map((v,i)=>new T.Vector2(width*v,(i/6-.5)*length*.91));
  points.unshift(new T.Vector2(0,-length*.455));points.push(new T.Vector2(0,length*.455));
  const garment=mesh(name+'Cloth',new T.LatheGeometry(points,20),m.cloth,g);
  garment.scale.z=depth/width;
  const crease=mesh(name+'FabricFold',new T.TorusGeometry(width*.48,.003,4,20),m.seam,g,[0,-length*.20,0]);
  crease.rotation.x=Math.PI/2;crease.scale.y=depth/width;
  return {g,length};
 };
  const bolts=(g,w,h,z)=>{for(const x of [-w/2,w/2])for(const y of [-h/2,h/2]){cylinder('Fastener',.009,.008,m.metal,g,[x,y,z]);box('FastenerSlot',[.010,.002,.003],m.edge,g,[x,y,z+.006],.0005);}};
 // Human-scale plate carrier, layered webbing, and fabric utility pouches.
 const chest=attach('Breastplate','Torso',new T.Vector3(0,1.25,.085));
 box('ChestRim',[.49,.35,.28],m.webbing,chest,[0,-.012,0],.048);box('ChestCeramic',[.43,.28,.14],m.webbing,chest,[0,0,.107],.037);
 for(const x of [-.105,.105]){const plate=box('BallisticPlate',[.183,.142,.033],m.armour,chest,[x,.061,.193],.016);plate.rotation.z=x>0?-.05:.05;}
 box('ChestNameTape',[.24,.025,.012],m.sand,chest,[0,-.045,.211],.004);
 for(const x of [-.17,.17])box('ShoulderHarness',[.038,.34,.025],m.dark,chest,[x,.015,.155],.006);
 // Sewn modular vest, MOLLE loops and real layered rifle-mag pouches.
 for(const y of [-.093,-.137]){
  box('MOLLEBand',[.405,.021,.028],m.webbing,chest,[0,y,.211],.003);
  for(const x of [-.17,-.102,-.034,.034,.102,.17])
   box('MOLLELoop',[.042,.018,.018],m.dark,chest,[x,y,.229],.003);
 }
 for(const x of [-.135,0,.135]){
  box('FrontMagazine',[.104,.145,.092],m.webbing,chest,[x,-.177,.222],.012);
  box('MagazineFlap',[.108,.042,.098],m.sand,chest,[x,-.126,.224],.007);
  box('MagazinePullTab',[.028,.052,.012],m.dark,chest,[x,-.135,.281],.003);
 }
 for(const x of [-.247,.247]){
  box('CarrierSideBuckle',[.034,.069,.045],m.metal,chest,[x,-.07,.166],.006);
  box('CarrierSideStrap',[.037,.15,.032],m.dark,chest,[x,-.145,.178],.005);
 }
 const abdomen=attach('AbdominalLames','Abdomen',new T.Vector3(0,.96,.06));
 box('FabricCummerbund',[.405,.22,.235],m.webbing,abdomen,[0,.025,.015],.038);
 for(const y of [-.037,.02,.077])box('CummerbundStitch',[.35,.007,.012],m.seam,abdomen,[0,y,.144],.003);
 const belt=attach('UtilityBelt','Body_1',new T.Vector3(0,.85,.02));box('Belt',[.48,.09,.29],m.dark,belt);box('Buckle',[.105,.069,.035],m.edge,belt,[0,0,.166]);
 for(const x of [-.205,.205]){box('AmmoPouch',[.105,.17,.12],m.webbing,belt,[x,-.11,.12]);box('PouchLid',[.113,.045,.13],m.sand,belt,[x,-.037,.12]);}
 const pack=attach('PowerPack','Torso',new T.Vector3(0,1.24,-.17));box('PackFrame',[.34,.40,.20],m.dark,pack,[0,0,0],.03);box('PackCasing',[.30,.36,.20],m.webbing,pack,[0,0,-.015],.03);
 box('PackStripe',[.10,.035,.026],m.team,pack,[0,.124,-.136]);
 for(const x of [-.105,.105]){
  box('BackpackStrap',[.038,.34,.023],m.sand,pack,[x,0,-.135],.006);
  box('BackpackBuckle',[.052,.045,.030],m.metal,pack,[x,.085,-.14],.004);
 }
 box('RucksackLowerPouch',[.29,.115,.14],m.webbing,pack,[0,-.225,-.09],.015);
 box('RucksackFlap',[.29,.035,.16],m.sand,pack,[0,-.162,-.092],.004);
 for(const x of [-.12,.12])for(let i=0;i<3;i++)box('MOLLEBackLoop',[.06,.014,.016],m.dark,pack,[x,-.09+i*.075,-.136],.003);
 cylinder('Antenna',.008,.34,m.metal,pack,[.15,.35,0],'y');sphere('AntennaCap',[.012,.017,.012],m.light,pack,[.15,.53,0]);
 // Open-face combat helmet: visible skin, nose and cheeks, not a robot visor.
 const head=attach('Helmet','Head',new T.Vector3(0,1.68,.13));
 sphere('HumanFace',[.153,.174,.147],m.skin,head,[0,-.043,.024]);
 sphere('TacticalHelmetShell',[.19,.133,.174],m.cloth,head,[0,.111,-.015]);
 box('HelmetLowerRim',[.348,.038,.255],m.sand,head,[0,.029,.027],.018);
 box('HelmetFrontBrow',[.305,.035,.075],m.webbing,head,[0,.051,.149],.009);
 for(const x of [-.080,.080]){
  box('GoggleRubber',[.145,.073,.029],m.dark,head,[x,.014,.164],.024);
  box('GoggleLens',[.116,.044,.012],m.light,head,[x,.016,.183],.016);
  sphere('ExposedCheek',[.065,.060,.033],m.skin,head,[x,-.073,.150]);
 }
 box('GoggleBridge',[.037,.034,.035],m.dark,head,[0,.018,.175],.009);
 sphere('Nose',[.036,.054,.047],m.skin,head,[0,-.066,.172]);
 box('FaceGaiter',[.24,.067,.058],m.cloth,head,[0,-.135,.129],.022);
 for(const x of [-1,1]){
  sphere('HumanEar',[.027,.045,.029],m.skin,head,[x*.157,-.042,-.008]);
  box('HelmetRail',[.052,.042,.125],m.sand,head,[x*.159,.122,.011],.012);
  box('HelmetChinStrap',[.017,.114,.017],m.dark,head,[x*.132,-.098,.102],.005);
  box('HelmetSideTeamPatch',[.042,.042,.013],m.team,head,[x*.167,.101,.055],.006);
 }
 box('HelmetMount',[.083,.048,.04],m.dark,head,[0,.15,.136],.009);
  const neck=attach('NeckSeal','Neck',new T.Vector3(0,1.44,.11));cylinder('FabricNeckGaiter',.106,.115,m.cloth,neck,[0,0,0],'y');
 // Cloth-wrapped anatomical limbs with minimal pads and readable faction patches.
 for(const side of ['L','R']){
  const upper=segment('UpperArm'+side,'UpperArm'+side,'LowerArm'+side,.15,.165),arm=upper.g;
  box('SleeveShoulderPatch',[.135,.09,.018],m.cloth,arm,[0,-upper.length*.12,.082],.018);
  box('FactionArmband',[.11,.05,.012],m.team,arm,[0,-upper.length*.14,.096],.008);
  const wrist=p('Index1'+side),lower=segment('Forearm'+side,'LowerArm'+side,wrist,.13,.139);
  box('SleeveCuff',[.115,.065,.12],m.webbing,lower.g,[0,-lower.length*.38,0],.022);
  // Glove axes match the named weapon grip sockets; the wrist is oriented in the bake.
  const hand=new T.Group();hand.name='Atlas_Glove'+side;bones['Index1'+side].add(hand);const sign=side==='R'?1:-1;
  box('GlovePalm'+side,[.046,.086,.090],m.dark,hand,[sign*.021,0,.019],.018);
  box('GloveCuff'+side,[.073,.069,.05],m.rubber,hand,[0,-.006,-.047],.014);
  box('KnucklePadding'+side,[.016,.075,.065],m.webbing,hand,[-sign*.004,.005,.024],.008);
  for(let finger=0;finger<4;finger++){
   box('Finger'+side+finger,[.063,.017,.025],m.dark,hand,[sign*.047,.030-finger*.021,.064],.007);
   box('Fingertip'+side+finger,[.018,.017,.036],m.dark,hand,[sign*.077,.030-finger*.021,.048],.007);
  }
  box('Thumb'+side,[.023,.029,.063],m.dark,hand,[sign*.060,.041,.003],.010);
  const thigh=segment('Thigh'+side,'UpperLeg'+side,'LowerLeg'+side,.185,.203);
  box('ReinforcedTrouser',[.155,thigh.length*.56,.035],m.cloth,thigh.g,[0,-.025,.112],.022);
  const pocket=box('ThighCargoPocket',[.175,thigh.length*.40,.105],m.webbing,thigh.g,[0,-.045,.155],.017);
  box('ThighPocketFlap',[.183,.048,.112],m.sand,thigh.g,[0,.038,.158],.006);
  box('ThighPocketBuckle',[.042,.035,.013],m.dark,thigh.g,[0,.015,.217],.004);
  const shin=segment('Shin'+side,'LowerLeg'+side,p('Foot'+side).clone().add(new T.Vector3(0,.08,0)),.15,.159);
  box('TrouserLowerFold',[.145,.051,.13],m.cloth,shin.g,[0,-shin.length*.38,0],.019);
  const knee=attach('Knee'+side,'LowerLeg'+side,p('LowerLeg'+side));sphere('ClothKnee',[.089,.091,.082],m.cloth,knee,[0,0,0]);box('KneePad',[.138,.118,.042],m.sand,knee,[0,0,.071],.028);
  const boot=attach('Boot'+side,'Foot'+side,p('Foot'+side).clone().add(new T.Vector3(0,.057,.07)));
  box('BootUpper',[.20,.16,.31],m.sand,boot,[0,.038,.015],.035);box('BootToe',[.205,.105,.19],m.sand,boot,[0,.013,.12],.026);box('Sole',[.218,.038,.34],m.rubber,boot,[0,-.045,.025],.009);
  for(let i=0;i<5;i++)box('Tread',[.221,.025,.023],m.rubber,boot,[0,-.059,-.105+i*.065],.003);
  for(let i=0;i<4;i++){
   box('BootLace',[.10,.006,.008],m.dark,boot,[0,.085-i*.021,.173],.002);
  }
 }
 // The weapon belongs to the right wrist. Its grip frames also author the gloves.
 const socket=new T.Group();socket.name='Atlas_WeaponSocket';bones.Index1R.add(socket);
 const rifle=new T.Group();rifle.name='Atlas_Rifle';socket.add(rifle);
 const grip=(name,position)=>{const g=new T.Group();g.name=name;g.position.set(...position);rifle.add(g);return g;};
 const rightGrip=grip('Atlas_GripR',[-.065,-.12,-.12]);grip('Atlas_GripL',[.065,-.095,.17]);
 socket.position.copy(rightGrip.position).negate();
 box('RifleReceiver',[.098,.115,.35],m.metal,rifle,[0,.005,-.005],.012);
 box('RifleUpper',[.087,.055,.38],m.metal,rifle,[0,.071,.012],.009);
 for(const x of [-.052,.052]){
  box('ReceiverPanel',[.009,.073,.23],m.metal,rifle,[x,.008,.005],.004);
  for(const z of [-.075,.075])cylinder('RiflePin',.006,.008,m.worn,rifle,[x,.002,z],'x');
 }
 box('StockSpine',[.052,.046,.13],m.metal,rifle,[0,.03,-.225],.007);
 box('Stock',[.083,.10,.145],m.metal,rifle,[0,-.005,-.252],.015);
 box('StockPad',[.091,.12,.025],m.rubber,rifle,[0,-.007,-.329],.01);
 box('CheekRest',[.081,.024,.115],m.dark,rifle,[0,.055,-.255],.007);
 box('PistolGrip',[.049,.14,.06],m.dark,rifle,[0,-.116,-.10],.01);
 // Open trigger guard, rather than a solid block through the firing finger.
 for(const x of [-.027,.027]){
  box('TriggerGuardFront',[.009,.065,.012],m.metal,rifle,[x,-.088,-.025],.003);
  box('TriggerGuardBase',[.009,.009,.075],m.metal,rifle,[x,-.122,-.057],.003);
 }
 const trigger=box('Trigger',[.010,.040,.012],m.worn,rifle,[0,-.075,-.051],.003);trigger.rotation.x=-.22;
 const magazine=box('Magazine',[.065,.16,.088],m.metal,rifle,[0,-.119,.055],.01);magazine.rotation.x=-.13;
 box('MagazineBase',[.073,.019,.095],m.rubber,rifle,[0,-.201,.065],.005);
 for(let i=0;i<3;i++)box('MagazineRib',[.068,.009,.073],m.dark,rifle,[0,-.09-i*.031,.052+i*.004],.003);
 box('Handguard',[.088,.078,.23],m.metal,rifle,[0,.012,.227],.012);
 box('ForwardGrip',[.049,.12,.06],m.dark,rifle,[0,-.088,.191],.009);
 cylinder('Barrel',.020,.25,m.metal,rifle,[0,.018,.386]);
 cylinder('BarrelCollar',.030,.043,m.worn,rifle,[0,.018,.354]);
 box('MuzzleBrake',[.067,.060,.08],m.metal,rifle,[0,.018,.51],.006);
 cylinder('MuzzleBore',.018,.006,m.rubber,rifle,[0,.018,.552]);
 for(const x of [-.034,.034])for(let i=0;i<3;i++)box('BrakePort',[.002,.031,.009],m.rubber,rifle,[x,.018,.487+i*.019],.001);
 for(let i=0;i<7;i++)box('RailTooth',[.065,.012,.016],m.worn,rifle,[0,.117,-.12+i*.055],.002);
 box('OpticBase',[.05,.025,.075],m.metal,rifle,[0,.133,-.055],.004);
 box('Optic',[.053,.049,.071],m.metal,rifle,[0,.167,-.055],.010);
 box('OpticLens',[.035,.030,.003],m.light,rifle,[0,.167,-.017],.006);
 box('EjectionPort',[.002,.025,.065],m.rubber,rifle,[-.058,.024,-.025],.002);
 box('ChargingHandle',[.032,.016,.025],m.worn,rifle,[-.068,.065,-.085],.003);
 for(const x of [-.046,.046])for(let i=0;i<5;i++)box('HandguardVent',[.003,.027,.014],m.rubber,rifle,[x,.016,.15+i*.035],.002);
 for(const x of [-.049,.049])box('ReceiverWear',[.002,.003,.11],m.worn,rifle,[x,.055,-.018],.001);
 box('WeaponMark',[.002,.014,.026],m.team,rifle,[-.058,.015,.09],.002);
 // Role geometry shares the same animation rig and hand sockets.
 if(role==='heavy'){
  for(const side of ['L','R']){
   const arm=model.getObjectByName('Atlas_UpperArm'+side);
   box('HeavyPaddedShoulder',[.21,.17,.195],m.webbing,arm,[0,-.045,0],.035);
   box('HeavyShoulderTeamPatch',[.12,.045,.014],m.team,arm,[0,-.055,.115],.008);
  }
  box('HeavyBallisticPanel',[.40,.22,.065],m.armour,chest,[0,.04,.216],.024);
  box('HeavyAmmoBackpack',[.38,.38,.205],m.webbing,pack,[0,0,-.08],.04);
  for(const x of [-.15,.15])box('HeavyPackWebbing',[.07,.33,.04],m.sand,pack,[x,.01,-.2],.014);
  box('HeavyWeaponReceiver',[.15,.17,.38],m.metal,rifle,[0,.015,.015],.022);
  box('HeavyAmmoCase',[.23,.19,.16],m.webbing,rifle,[-.145,-.13,.01],.017);
  // Exposed ammo belt makes the heavy gun distinct in a top-down RTS view.
  for(let i=0;i<13;i++)cylinder('BeltRound',.013,.075,m.worn,rifle,
    [-.145+Math.sin(i*.28)*.015,-.034-i*.016,.055+i*.022],'y');
  cylinder('HeavyWeaponShroud',.065,.30,m.edge,rifle,[0,.018,.61]);
  box('HeavyMuzzleBrake',[.15,.11,.14],m.metal,rifle,[0,.018,.81],.012);
  const muzzle=rifle.getObjectByName('Atlas_MuzzleBore');muzzle.position.z=.888;
 }else if(role==='medic'){
  for(const name of ['Atlas_SleeveShoulderPatch','Atlas_FactionArmband'])model.traverse(n=>{if(n.name===name)n.scale.set(.9,.9,.9);});
 }
 // Support roles keep the same animated skeleton, with authored kit and a compact pistol.
 if(role==='medic'||role==='engineer'){
  for(const child of [...rifle.children])if(child.isMesh){if(child.name==='Atlas_MuzzleBore')child.name='Atlas_RifleMuzzleHidden';child.visible=false;}
  rifle.getObjectByName('Atlas_GripL').position.set(.065,-.10,-.095);
  box('PistolSlide',[.075,.075,.25],m.metal,rifle,[0,-.015,-.04],.009);
  box('PistolRearSight',[.082,.022,.023],m.worn,rifle,[0,.035,-.14],.003);
  box('PistolFrontSight',[.015,.020,.015],m.worn,rifle,[0,.035,.073],.002);
  const pistolGrip=box('PistolHandle',[.065,.145,.080],m.dark,rifle,[0,-.11,-.125],.012);pistolGrip.rotation.x=-.13;
  box('PistolTriggerGuard',[.012,.065,.012],m.worn,rifle,[0,-.075,-.037],.002);
  cylinder('MuzzleBore',.016,.008,m.rubber,rifle,[0,-.015,.090]);
  const white=m.sand,green=m.medic;
  const cross=(parent,z)=>{box('MedicalCrossVertical',[.065,.23,.015],green,parent,[0,.025,z],.002);box('MedicalCrossHorizontal',[.22,.065,.018],green,parent,[0,.025,z],.002);};
  if(role==='medic'){
   box('MedicalSatchel',[.45,.48,.27],white,pack,[0,-.005,-.065],.045);
   box('MedicalPackFlap',[.47,.09,.29],m.dark,pack,[0,.19,-.065],.018);cross(pack,-.211);
   box('MedicalChestPatch',[.27,.27,.014],white,chest,[0,.035,.232],.012);cross(chest,.249);
   box('MedicalHelmetBand',[.32,.075,.030],white,head,[0,.12,.178],.008);
   for(const x of [-.28,.28]){const casePart=box('MedicalSideKit',[.12,.24,.16],white,pack,[x,-.07,-.06],.025);box('MedicalKitStripe',[.125,.055,.165],green,casePart);}
  }else{
   const yellow=new T.MeshStandardMaterial({color:'#d9a947',roughness:.8});
   box('ToolPack',[.43,.44,.25],m.dark,pack,[0,-.01,-.04],.035);
   for(const x of [-.14,.14])box('ToolPackBrace',[.055,.41,.025],yellow,pack,[x,-.01,-.18],.006);
   const tool=box('SpannerShaft',[.035,.42,.035],m.worn,pack,[.28,.04,-.09],.006);tool.rotation.z=-.15;
   for(const x of [.23,.31])box('SpannerJaw',[.035,.09,.05],m.worn,pack,[x,.27,-.09],.005);
   box('ToolCase',[.21,.27,.19],yellow,belt,[-.31,-.12,0],.025);
   box('ToolCaseLatch',[.22,.045,.025],m.metal,belt,[-.31,-.10,.105],.004);
   box('TechnicalHelmetBand',[.30,.06,.028],yellow,head,[0,.115,.177],.006);
  }
 }
 model.userData.atlasDesign={name:'Atlas Legion '+role+' / natural human desert infantry',version:2,team,role,parts:parts.length,triangles:Math.round(triangles),materials:'Seeded 512px multicam PBR textiles, MOLLE nylon, sand ceramic and weathered steel',weaponBinding:'Right wrist socket / two-hand grip frames',geometry:'Human silhouette: organic tapered cloth limbs, visible skin, nose and cheeks, open-face helmet, light plate carrier and tactical boots',humanFace:true,organicLimbGeometry:true,rig:'Quaternius Toon Shooter Game Kit / CC0-1.0'};
 model.updateMatrixWorld(true);return model.userData.atlasDesign;
}
