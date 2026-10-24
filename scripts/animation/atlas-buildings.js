import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {refineTurret} from './turret-finish.js';

export const buildingNames={headquarters:'Feldkommando',bastion:'Bastion',barracks:'Kaserne',factory:'Fahrzeugfabrik',airfield:'Flugfeld',generator:'Energiekern',turret:'Geschützturm'};

/** Original geometry, using the approved infantry's ceramic / bronze / enamel palette. */
export function buildAtlasBuilding(kind,team=0){
 const model=new T.Group();model.name='Atlas_'+kind;let parts=0,triangles=0;
 let seed=74;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#d2c3a1';c.fillRect(0,0,256,256);
 for(let i=0;i<7000;i++){c.fillStyle=random()<.12?'rgba(55,43,28,.21)':'rgba(255,249,224,.09)';c.fillRect(random()*256,random()*256,.4+random()*1.5,.4+random()*1.5);}
 const paint=new T.CanvasTexture(canvas);paint.colorSpace=T.SRGBColorSpace;
 const color=team===-1?'#e5e8e9':team===1?'#a93429':'#194e94',light=team===-1?'#ffffff':team===1?'#ff5142':'#37c8ff';
 const material=(name,color,roughness=.64,metalness=.25,extra={})=>new T.MeshStandardMaterial({name,color,roughness,metalness,...extra});
 const m={sand:material('Atlas sand ceramic','#e0cfac',.67,.25,{map:paint}),edge:material('Atlas bronze edges','#665037',.45,.63),dark:material('Atlas dark steel','#26313c',.55,.58),rubber:material('Atlas black seals','#151d24',.96,.02),team:material('Atlas faction enamel',color,.36,.38),light:material('Atlas faction emission',light,.21,.4,{emissive:light,emissiveIntensity:.75}),glass:material('Atlas armoured glass',team===1?'#542e28':'#21465b',.21,.6)};
 const mesh=(name,geometry,mat,parent=model,at=[0,0,0])=>{const n=new T.Mesh(geometry,mat);n.name='Atlas_'+name+'_'+parts++;n.position.set(...at);n.castShadow=n.receiveShadow=true;triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;parent.add(n);return n;};
 const box=(name,size,mat,at=[0,0,0],parent=model,r=.045)=>mesh(name,new RoundedBoxGeometry(...size,3,Math.min(r,...size.map(v=>v*.23))),mat,parent,at);
 const cylinder=(name,rTop,rBottom,h,mat,at,parent=model,segments=32)=>mesh(name,new T.CylinderGeometry(rTop,rBottom,h,segments),mat,parent,at);
 const dome=(name,radius,mat,at,parent=model)=>{const n=mesh(name,new T.SphereGeometry(radius,32,16,0,Math.PI*2,0,Math.PI/2),mat,parent,at);return n;};
 const ring=(name,radius,tube,mat,at,parent=model)=>{const n=mesh(name,new T.TorusGeometry(radius,tube,8,64),mat,parent,at);n.rotation.x=Math.PI/2;return n;};
 const vent=(x,y,z,w=.38,h=.30,parent=model)=>{box('VentFrame',[w+.065,h+.05,.055],m.edge,[x,y,z],parent,.015);box('VentInset',[w,h,.065],m.rubber,[x,y,z+.008],parent,.008);for(let i=0;i<5;i++)box('VentFin',[w*.85,.023,.035],m.dark,[x,y-h*.36+i*h*.18,z+.052],parent,.004);};
 const strip=(x,y,z,w=.5,parent=model)=>{box('StripRecess',[w+.07,.095,.055],m.dark,[x,y,z],parent,.012);box('LightStrip',[w,.035,.065],m.light,[x,y,z+.014],parent,.008);};
 const bolts=(x,y,z,w,h,parent=model)=>{for(const a of [-1,1])for(const b of [-1,1]){const n=cylinder('Bolt',.018,.018,.018,m.edge,[x+a*w/2,y+b*h/2,z],parent,12);n.rotation.x=Math.PI/2;}};
 const pedestal=(width,depth)=>{box('GroundPlinth',[width,.12,depth],m.edge,[0,.06,0],model,.05);box('CeramicFoundation',[width-.08,.16,depth-.08],m.sand,[0,.17,0],model,.055);};
 const facade=(width,depth,height)=>{
  pedestal(width+.25,depth+.25);box('ArmouredHull',[width,height,depth],m.edge,[0,.25+height/2,0],model,.10);box('CeramicHull',[width-.08,height-.08,depth+.025],m.sand,[0,.30+height/2,0],model,.10);
  box('Roof',[width+.08,.14,depth+.10],m.edge,[0,height+.31,0],model,.045);box('RoofCeramic',[width-.08,.12,depth-.08],kind==='barracks'?m.sand:m.team,[0,height+.39,0],model,.04);
  for(const x of [-width*.36,width*.36]){box('FactionPillar',[.17,height*.80,.055],m.team,[x,.36+height*.48,depth/2+.045]);bolts(x,.37+height*.48,depth/2+.079,.10,height*.65);}
 };
 let dish=null,beacon=null,turret=null;
 function radar(x,y,z,size=1){
  const shaft=cylinder('RadarGimbal',.075*size,.095*size,.20*size,m.edge,[x,y,z]);
  dish=new T.Group();dish.name='RadarDish';dish.position.set(x,y+.09*size,z);model.add(dish);
  const mount=new T.Group();mount.rotation.x=-.28;dish.add(mount);
  // A real parabolic reflector, with coherent front/back geometry and feed arm.
  const points=[];for(let i=0;i<=16;i++){const r=i/16*.40*size;points.push(new T.Vector2(r,r*r/(.72*size)));}
  const reflector=mesh('ParabolicReflector',new T.LatheGeometry(points,48),m.sand,mount);reflector.rotation.x=Math.PI/2;reflector.position.z=-.05*size;reflector.material=reflector.material.clone();reflector.material.side=T.DoubleSide;
  const rim=mesh('DishRim',new T.TorusGeometry(.40*size,.018*size,8,64),m.edge,mount,[0,0,.172*size]);
  const boom=box('DishFeedArm',[.032*size,.032*size,.51*size],m.edge,[0,-.13*size,.14*size],mount,.006);boom.rotation.x=-.24;
  box('DishReceiver',[.075*size,.065*size,.075*size],m.dark,[0,-.07*size,.38*size],mount,.012);
  box('DishReceiverLight',[.038*size,.025*size,.018*size],m.light,[0,-.07*size,.425*size],mount,.004);
 }
 function antenna(x,y,z,height=.8){
  cylinder('AntennaStem',.025,.04,height,m.edge,[x,y+height/2,z]);
  beacon=new T.Group();beacon.name='Beacon';beacon.position.set(x,y+height+.025,z);model.add(beacon);
  cylinder('BeaconLens',.043,.043,.11,m.light,[0,0,0],beacon,24);
 }

 if(kind==='headquarters'){
  facade(3.10,2.50,1.05);
  // Fortified corner pods and structural ribs keep the footprint firmly grounded.
  for(const x of [-1.43,1.43])for(const z of [-1.08,1.08]){
   cylinder('CornerFoot',.28,.37,.65,m.sand,[x,.44,z],model,8);cylinder('CornerCollar',.29,.30,.10,m.edge,[x,.82,z],model,24);dome('CornerDome',.265,m.edge,[x,.87,z]);strip(x,.50,z>.0?z+.31:z-.31,.10);
  }
  box('EntryFrame',[1.24,.86,.22],m.edge,[0,.69,1.31],model,.065);box('HangarDoor',[1.02,.68,.06],m.dark,[0,.65,1.45]);
  for(const x of [-.255,.255]){box('DoorPlate',[.46,.57,.075],m.sand,[x,.64,1.49],model,.028);box('DoorStripe',[.35,.07,.015],m.team,[x,.83,1.535],model,.005);}
  strip(0,1.13,1.47,.94);const ramp=box('EntryRamp',[1.28,.09,.80],m.edge,[0,.10,1.69],model,.025);ramp.rotation.x=-.12;
  for(let i=0;i<6;i++)box('RampTread',[1.08,.025,.032],m.dark,[0,.17+i*.008,1.37+i*.10],model,.004);
  for(const x of [-1.0,1.0]){vent(x,.83,1.29,.34,.34);const rib=box('WallButtress',[.20,.84,.24],m.edge,[x*1.25,.59,1.28],model,.025);rib.rotation.x=-.16;}
  box('CommandLoft',[1.45,.54,1.40],m.sand,[-.39,1.61,-.26],model,.11);box('CommandRoof',[1.51,.12,1.46],m.edge,[-.39,1.93,-.26]);
  for(const x of [-.83,-.39,.05]){box('CommandWindow',[.33,.20,.045],m.glass,[x,1.63,.47],model,.025);strip(x,1.52,.50,.23);}
  cylinder('RoofReactorBase',.42,.45,.12,m.edge,[-.53,2.02,-.30]);ring('RoofReactorLight',.36,.022,m.light,[-.53,2.09,-.30]);dome('RoofReactor',.35,m.sand,[-.53,2.12,-.30]);
  cylinder('CommsTowerFoot',.31,.39,.22,m.edge,[.99,1.54,-.59],model,16);cylinder('CommsTower',.20,.26,1.13,m.sand,[.99,2.18,-.59],model,16);
  for(let i=0;i<3;i++){cylinder('TowerBand',.235,.235,.10,m.edge,[.99,1.78+i*.38,-.59]);box('TowerEmission',[.12,.23,.045],m.light,[.99,1.95+i*.31,-.385],model,.018);}
  radar(.99,2.83,-.59,.93);antenna(.42,1.96,-.82,1.0);
  vent(-.97,1.40,-.18,.34,.22);
 }else if(kind==='bastion'){
  cylinder('RelayPlinth',.65,.74,.15,m.edge,[0,.075,0],model,12);cylinder('RelayFoundation',.64,.68,.20,m.sand,[0,.23,0],model,12);
  ring('CaptureRing',.53,.045,m.light,[0,.35,0]);cylinder('RelayDeck',.49,.54,.13,m.dark,[0,.36,0],model,32);
  for(let i=0;i<6;i++){const a=i*Math.PI/3,x=Math.cos(a)*.58,z=Math.sin(a)*.58,g=new T.Group();g.position.set(x,.29,z);g.rotation.y=-a+Math.PI/2;model.add(g);box('RadialArmour',[.27,.25,.25],m.sand,[0,0,0],g);box('RadialIndicator',[.14,.045,.025],m.light,[0,.02,.14],g,.008);}
  cylinder('RelayMast',.13,.22,1.55,m.edge,[0,1.12,0],model,16);
  for(let i=0;i<3;i++){cylinder('RelayCollar',.20,.20,.12,m.sand,[0,.69+i*.50,0]);box('RelayCore',[.13,.31,.06],m.light,[0,.92+i*.49,.145],model,.018);}
  radar(.10,2.10,0,.80);antenna(-.31,.45,-.10,1.83);
 }else if(kind==='barracks'){
  facade(2.65,1.95,.98);
  // An armoured troop airlock, service wing and layered roof identify production at game scale.
  for(const x of [-1.19,1.19])for(const z of [-.82,.82]){
   cylinder('ReinforcedCorner',.18,.24,1.05,m.edge,[x,.74,z],model,8);
   box('CornerCeramic',[.27,.88,.29],m.sand,[x,.76,z]);box('CornerEnamel',[.28,.24,.30],m.team,[x,1.02,z]);
  }
  box('AirlockHousing',[1.08,.91,.46],m.edge,[.42,.76,1.02],model,.09);
  box('AirlockArmour',[.96,.82,.47],m.team,[.42,.78,1.04],model,.07);
  box('EntryRecess',[.75,.68,.08],m.rubber,[.42,.72,1.30]);
  for(const x of [.23,.61]){box('AirlockDoor',[.34,.61,.06],m.dark,[x,.73,1.35]);box('DoorCeramic',[.25,.30,.025],m.sand,[x,.81,1.395]);}
  strip(.42,1.20,1.34,.79);box('EntryCanopy',[1.18,.10,.68],m.edge,[.42,1.30,1.13]);
  box('EntryRamp',[1.10,.12,.51],m.dark,[.42,.13,1.42]);for(let i=0;i<5;i++)box('RampGrating',[.96,.024,.035],m.edge,[.42,.20,1.24+i*.08]);
  box('PersonnelLoft',[1.68,.40,1.37],m.edge,[-.30,1.54,-.12],model,.08);
  for(const x of [-.86,-.30,.26]){box('RoofArmour',[.51,.13,1.40],m.sand,[x,1.80,-.12]);box('RoofFactionPanel',[.40,.025,.66],m.team,[x,1.88,-.10]);}
  for(const x of [-1.00,-.66]){box('WindowFrame',[.30,.31,.07],m.edge,[x,.86,1.01]);box('WindowGlass',[.23,.21,.035],m.glass,[x,.88,1.06]);strip(x,.66,1.07,.19);}
  for(const x of [-.83,-.28,.27]){box('LoftWindow',[.38,.19,.035],m.glass,[x,1.54,.59]);bolts(x,1.54,.62,.43,.25);}
  for(const x of [-1.36,1.36])for(let i=0;i<4;i++){box('SideArmour',[.08,.52,.38],i===1||i===2?m.team:m.sand,[x,.81,-.70+i*.46]);box('PanelFastener',[.09,.035,.045],m.edge,[x,.99,-.70+i*.46]);}
  for(const z of [-.52,.28]){box('RoofHVAC',[.46,.34,.55],m.edge,[.89,1.50,z]);for(let i=0;i<6;i++)box('CoolingLouvre',[.38,.024,.057],m.dark,[.89,1.69,z-.21+i*.083]);}
  vent(-.30,1.54,.60,.52,.22);vent(-.78,.63,-1.01,.43,.33);
  for(const x of [-.9,.2,.9]){box('SupplyCell',[.34,.48,.19],m.dark,[x,.57,-1.06]);box('SupplyArmour',[.28,.30,.06],m.sand,[x,.60,-1.17]);}
  antenna(.89,1.70,-.65,.67);
 }else if(kind==='factory'){
  facade(3.0,2.15,.96);box('FactoryDoorFrame',[1.60,.94,.15],m.edge,[.19,.73,1.14]);box('FactoryDoor',[1.40,.76,.07],m.dark,[.19,.65,1.25]);
  for(let i=0;i<7;i++)box('ShutterSlat',[1.32,.065,.045],m.sand,[.19,.34+i*.098,1.29],model,.008);strip(.19,1.12,1.32,1.16);
  for(const x of [-.84,.36]){box('RoofModule',[.83,.31,1.18],m.edge,[x,1.51,-.11]);for(let i=0;i<6;i++)box('HeatExchanger',[.65,.045,.075],m.dark,[x,1.70,-.54+i*.17],model,.007);}
  for(const x of [-1.1,1.1]){cylinder('Exhaust',.11,.13,.48,m.edge,[x,1.72,-.78]);cylinder('ExhaustRim',.14,.14,.07,m.dark,[x,1.99,-.78]);}
  antenna(-1.12,1.40,.48,.65);
 }else if(kind==='airfield'){
  pedestal(3.30,2.75);box('LandingDeck',[3.14,.09,2.57],m.dark,[0,.29,0],model,.04);
  for(const x of [-1.35,1.35]){box('DeckStripe',[.08,.017,2.14],m.team,[x,.347,0],model,.007);for(let i=0;i<5;i++)box('RunwayLight',[.09,.035,.07],m.light,[x,.36,-.89+i*.45],model,.008);}
  ring('LandingGuide',.75,.025,m.sand,[0,.35,0]);box('GuideBar',[.05,.015,.76],m.sand,[0,.355,0],model,.004);
  box('ControlTowerBase',[.70,.83,.72],m.edge,[-1.0,.72,-.74]);box('ControlRoom',[.88,.38,.88],m.sand,[-1.0,1.30,-.74],model,.05);
  box('ControlGlass',[.68,.20,.035],m.glass,[-1.0,1.32,-.28],model,.012);strip(-1.0,1.15,-.27,.54);antenna(-.92,1.52,-.75,.61);
 }else if(kind==='generator'){
  pedestal(1.45,1.35);cylinder('CoreFoot',.49,.58,.18,m.edge,[0,.36,0],model,12);cylinder('CoreVessel',.34,.39,1.0,m.dark,[0,.92,0],model,24);
  for(let i=0;i<6;i++){const a=i*Math.PI/3,g=new T.Group();g.position.set(Math.sin(a)*.36,.95,Math.cos(a)*.36);g.rotation.y=a;model.add(g);box('ReactorArmour',[.24,.85,.12],m.sand,[0,0,0],g);box('CoreWindow',[.095,.54,.035],m.light,[0,0,.075],g,.014);}
  cylinder('CoreCap',.40,.45,.15,m.sand,[0,1.51,0],model,24);ring('CoreRing',.33,.025,m.light,[0,1.60,0]);dome('CoreDome',.29,m.edge,[0,1.61,0]);antenna(.45,.30,-.42,.60);
 }else if(kind==='turret'){
  // The plinth and rotary bearing stay fixed; every weapon and optic belongs to TurretHead.
  pedestal(1.32,1.27);cylinder('SupportCore',.36,.47,.48,m.dark,[0,.51,0],model,24);
  for(let i=0;i<8;i++){const a=i*Math.PI/4,g=new T.Group();g.position.set(Math.sin(a)*.39,.52,Math.cos(a)*.39);g.rotation.y=a;model.add(g);box('PedestalPlate',[.25,.44,.14],m.sand,[0,0,0],g);box('PedestalBolt',[.035,.035,.018],m.edge,[.075,.14,.08],g,.003);}
  cylinder('BearingBase',.48,.49,.13,m.edge,[0,.82,0],model,48);ring('BearingRace',.44,.026,m.dark,[0,.90,0]);
  for(let i=0;i<24;i++){const a=i*Math.PI/12;box('BearingTooth',[.045,.06,.065],m.dark,[Math.sin(a)*.445,.91,Math.cos(a)*.445]).rotation.y=a;}
  turret=new T.Group();turret.name='TurretHead';turret.position.set(0,1.08,0);model.add(turret);
  box('HeadChassis',[1.03,.36,.86],m.edge,[0,.05,0],turret,.085);
  box('HeadArmour',[.92,.32,.81],m.sand,[0,.09,0],turret,.075);
  for(const x of [-.36,.36]){
   const cheek=box('FactionWeaponArmour',[.24,.31,.66],m.team,[x,.16,.02],turret,.04);cheek.rotation.z=x>0?-.13:.13;
   box('ArmourWear',[.13,.013,.035],m.edge,[x,.326,.10],turret,.002);
   bolts(x,.12,.445,.13,.18,turret);vent(x,.06,-.44,.23,.19,turret);
  }
  box('CrownPlate',[.38,.075,.72],m.sand,[0,.31,-.015],turret);
  box('CrownStripe',[.15,.024,.43],m.team,[0,.36,-.03],turret,.006);
  for(const x of [-.22,.22]){
   cylinder('GunTrunnion',.13,.13,.19,m.edge,[x,.06,.42],turret,24).rotation.x=Math.PI/2;
   cylinder('GunSleeve',.08,.09,.37,m.sand,[x,.06,.60],turret,24).rotation.x=Math.PI/2;
   cylinder('DefenceBarrel',.045,.06,.60,m.dark,[x,.06,.82],turret,24).rotation.x=Math.PI/2;
   for(let i=0;i<5;i++)cylinder('BarrelCoolingRing',.069,.069,.025,m.edge,[x,.06,.68+i*.065],turret,20).rotation.x=Math.PI/2;
   box('MuzzleBrake',[.13,.12,.18],m.edge,[x,.06,1.13],turret,.012);
   box('MuzzleBore',[.075,.065,.012],m.rubber,[x,.06,1.226],turret,.004);
   for(const side of [-1,1])for(let i=0;i<3;i++)box('MuzzlePort',[.008,.042,.023],m.rubber,[x+side*.068,.06,1.075+i*.048],turret,.001);
   const muzzle=new T.Object3D();muzzle.name=x<0?'TurretMuzzleL':'TurretMuzzleR';muzzle.position.set(x,.06,1.24);turret.add(muzzle);
  }
  box('SensorHousing',[.25,.15,.20],m.dark,[0,.10,.49],turret,.025);strip(0,.12,.60,.13,turret);
  cylinder('OpticGimbal',.085,.085,.10,m.edge,[-.15,.38,-.17],turret,24);
  box('TargetOptic',[.19,.13,.19],m.dark,[-.15,.47,-.17],turret,.02);box('OpticGlass',[.13,.06,.015],m.glass,[-.15,.48,-.064],turret,.008);
  for(let i=0;i<5;i++)box('CrownVent',[.025,.024,.22],m.dark,[.06+i*.045,.36,-.18],turret,.003);
  cylinder('CommsWhip',.009,.016,.36,m.edge,[.34,.53,-.31],turret,12);box('StatusLamp',[.045,.045,.035],m.light,[.34,.74,-.31],turret,.006);
 }else throw Error('Unknown building '+kind);
 if(kind==='turret'){const refined=refineTurret(model,m,team);parts+=refined.parts;triangles+=refined.triangles;}
 const clips=[];
 if(turret){const times=[],values=[];for(let i=0;i<=64;i++){times.push(i/64*2);values.push(...new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),i/64*Math.PI*2).toArray());}clips.push(new T.AnimationClip('TurretTraverse',2,[new T.QuaternionKeyframeTrack('TurretHead.quaternion',times,values)]));}
 if(dish){const times=[],values=[];for(let i=0;i<=64;i++){times.push(i/64*48);values.push(...new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),i/64*Math.PI*2).toArray());}clips.push(new T.AnimationClip('RadarSpin',48,[new T.QuaternionKeyframeTrack('RadarDish.quaternion',times,values)]));}
 if(beacon)clips.push(new T.AnimationClip('BeaconPulse',3.8,[new T.VectorKeyframeTrack('Beacon.scale',[0,.16,.35,.70,3.8],[1,1,1,1.12,1.12,1.12,.45,.45,.45,.45,.45,.45,1,1,1])]));
 model.userData.atlasDesign={revision:kind==='turret'?3:2,name:buildingNames[kind],kind,team,parts,triangles:Math.round(triangles),geometry:kind==='turret'?'Refined ceramic armour, brushed champagne trim, weathered enamel and machined graphite; original registered weapon rig':'Atlas original ceramic / bronze building geometry',source:'Atlas Dominion / original procedural models'};
 return {model,clips,dish,beacon,turret};
}
