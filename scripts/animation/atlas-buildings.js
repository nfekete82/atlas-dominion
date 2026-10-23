import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

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
  box('Roof',[width+.08,.14,depth+.10],m.edge,[0,height+.31,0],model,.045);box('RoofCeramic',[width-.08,.12,depth-.08],m.sand,[0,height+.39,0],model,.04);
  for(const x of [-width*.36,width*.36]){box('FactionPillar',[.17,height*.80,.055],m.team,[x,.36+height*.48,depth/2+.045]);bolts(x,.37+height*.48,depth/2+.079,.10,height*.65);}
 };
 let dish=null,beacon=null;
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
  facade(2.45,1.65,.81);box('BarracksUpper',[1.35,.30,1.34],m.sand,[-.24,1.31,-.04],model,.09);
  box('EntryFrame',[.65,.70,.14],m.edge,[.58,.64,.87]);box('EntryDoor',[.49,.59,.06],m.dark,[.58,.60,.96]);strip(.58,1.02,.98,.45);
  for(const x of [-.85,-.35]){box('Window',[.29,.18,.045],m.glass,[x,.85,.85],model,.025);strip(x,.70,.89,.20);}
  vent(-.73,1.29,.67,.43,.21);antenna(.78,1.18,-.50,.66);
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
  pedestal(1.13,1.10);cylinder('TurretSupport',.35,.46,.56,m.sand,[0,.53,0],model,12);cylinder('TurretBearing',.40,.40,.10,m.edge,[0,.86,0]);
  box('TurretHousing',[.81,.38,.69],m.sand,[0,1.10,0],model,.09);box('TurretStripe',[.10,.035,.51],m.team,[0,1.31,0],model,.007);
  for(const x of [-.20,.20]){const barrel=cylinder('DefenceBarrel',.05,.065,.84,m.dark,[x,1.09,.60]);barrel.rotation.x=Math.PI/2;const muzzle=cylinder('Muzzle',.075,.075,.10,m.edge,[x,1.09,1.02]);muzzle.rotation.x=Math.PI/2;}
  strip(0,1.12,.36,.19);antenna(.31,1.26,-.18,.31);
 }else throw Error('Unknown building '+kind);
 const clips=[];
 if(dish){const times=[],values=[];for(let i=0;i<=64;i++){times.push(i/64*48);values.push(...new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),i/64*Math.PI*2).toArray());}clips.push(new T.AnimationClip('RadarSpin',48,[new T.QuaternionKeyframeTrack('RadarDish.quaternion',times,values)]));}
 if(beacon)clips.push(new T.AnimationClip('BeaconPulse',3.8,[new T.VectorKeyframeTrack('Beacon.scale',[0,.16,.35,.70,3.8],[1,1,1,1.12,1.12,1.12,.45,.45,.45,.45,.45,.45,1,1,1])]));
 model.userData.atlasDesign={name:buildingNames[kind],kind,team,parts,triangles:Math.round(triangles),geometry:'Atlas original ceramic / bronze building geometry',source:'Atlas Dominion / original procedural models'};
 return {model,clips,dish,beacon};
}
