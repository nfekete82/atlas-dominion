import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Original rigid vehicle models in the approved Legion material family. */
export function buildAtlasVehicle(kind,team=0){
 const model=new T.Group();model.name='Atlas_'+kind;let parts=0,triangles=0;
 const material=(name,color,roughness=.67,metalness=.25,extra={})=>new T.MeshStandardMaterial({name,color,roughness,metalness,...extra});
 const m={sand:material('Atlas sand ceramic','#b9a77c'),edge:material('Atlas bronze edges','#665037',.45,.63),dark:material('Atlas dark steel','#26313c',.55,.58),rubber:material('Atlas black seals','#151d24',.96,.02),team:material('Atlas faction enamel',team?'#a93429':'#194e94',.36,.38),glass:material('Atlas armoured glass',team?'#4b302b':'#183e53',.22,.55),light:material('Atlas faction emission',team?'#ff5142':'#37c8ff',.21,.4,{emissive:team?'#ff5142':'#37c8ff',emissiveIntensity:.75})};
 const mesh=(name,geometry,mat,at=[0,0,0],parent=model)=>{const n=new T.Mesh(geometry,mat);n.name=name+'_'+parts++;n.position.set(...at);n.castShadow=n.receiveShadow=true;parent.add(n);triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;return n;};
 const geometries=new Map();
 const geometry=(key,make)=>{if(!geometries.has(key))geometries.set(key,make());return geometries.get(key);};
 const box=(name,size,mat,at,parent=model,r=.035)=>mesh(name,geometry('box:'+size.join(',')+':'+r,()=>new RoundedBoxGeometry(...size,2,Math.min(r,...size.map(v=>v*.2)))),mat,at,parent);
 const cylinder=(name,r,h,mat,at,parent=model,segments=20)=>mesh(name,geometry('cylinder:'+r+':'+h+':'+segments,()=>new T.CylinderGeometry(r,r,h,segments)),mat,at,parent);
 const group=(name,at=[0,0,0],parent=model)=>{const g=new T.Group();g.name=name;g.position.set(...at);parent.add(g);return g;};
 const bolt=(x,y,z,parent=model)=>{const b=cylinder('Bolt',.016,.014,m.edge,[x,y,z],parent,8);b.rotation.x=Math.PI/2;};
 function vent(x,y,z,w=.3,h=.2,parent=model){box('VentFrame',[w+.04,h+.04,.025],m.edge,[x,y,z],parent);box('VentCavity',[w,h,.035],m.rubber,[x,y,z+.02],parent);for(let i=0;i<4;i++)box('VentFin',[w*.86,.018,.02],m.dark,[x,y-h*.32+i*h*.21,z+.04],parent);}
 function lamp(x,y,z,parent=model){box('HeadlightRecess',[.16,.10,.05],m.dark,[x,y,z],parent);box('Headlight',[.11,.04,.058],m.light,[x,y,z+.01],parent);}
 const wheels=[],links=[];let rotor=null,tailRotor=null;
 function wheel(x,y,z,r=.24){
  const g=group('Wheel',[x,y,z]);const tyre=cylinder('Tyre',r,.16,m.rubber,[0,0,0],g);tyre.rotation.z=Math.PI/2;
  for(const side of [-1,1]){const hub=cylinder('BronzeWheelHub',r*.60,.02,m.edge,[side*.09,0,0],g);hub.rotation.z=Math.PI/2;const axle=cylinder('WheelAxle',r*.22,.025,m.sand,[side*.105,0,0],g);axle.rotation.z=Math.PI/2;for(let j=0;j<5;j++){const a=j*Math.PI*2/5;box('Spoke',[.018,r*.64,.035],m.dark,[side*.112,Math.cos(a)*r*.35,Math.sin(a)*r*.35],g).rotation.x=a;}}
  for(let j=0;j<12;j++){const a=j*Math.PI/6,n=box('TyreTread',[.18,.025,r*.28],m.dark,[0,Math.cos(a)*r,Math.sin(a)*r],g,.006);n.rotation.x=a;}
  wheels.push(g);return g;
 }
 if(kind==='rover'){
  box('Chassis',[1.10,.18,1.70],m.dark,[0,.36,0]);box('LowerArmour',[1.02,.30,1.45],m.edge,[0,.56,0]);box('CeramicCab',[.92,.55,1.04],m.sand,[0,.91,-.16],model,.09);
  box('Roof',[1.00,.10,1.10],m.edge,[0,1.23,-.16]);box('RoofCeramic',[.85,.055,.91],m.sand,[0,1.30,-.16]);
  const screen=box('Windscreen',[.77,.27,.045],m.glass,[0,1.00,.385]);screen.rotation.x=-.15;
  box('WindowDivider',[.025,.28,.055],m.edge,[0,1.00,.411]);
  box('Bonnet',[.95,.13,.51],m.sand,[0,.71,.61]);box('NoseStripe',[.18,.018,.42],m.team,[0,.79,.64]);
  box('FrontBumper',[1.23,.09,.10],m.dark,[0,.43,.90]);box('RearBumper',[1.20,.09,.10],m.edge,[0,.46,-.91]);
  for(const x of [-.60,.60])for(const z of [-.57,.58])wheel(x,.28,z,.26);
  for(const x of [-.49,.49]){
   box('SideWindow',[.03,.22,.42],m.glass,[x,1.00,-.15]);box('SideFactionPanel',[.045,.20,.48],m.team,[x,.70,-.18]);
   for(const z of [-.57,.58])box('WheelArch',[.28,.10,.63],m.sand,[x,.59,z]);
   box('SideRail',[.10,.055,1.48],m.edge,[x,.47,0]);
  }
  for(const x of [-.35,.35]){lamp(x,.69,.89);bolt(x,.60,.90);}
  vent(0,.63,-.78,.50,.18);const antenna=cylinder('Antenna',.012,.58,m.edge,[.32,1.58,-.52],model,8);cylinder('AntennaTip',.021,.05,m.light,[.32,1.89,-.52]);
  cylinder('RoofMount',.18,.06,m.edge,[0,1.35,-.12]);box('Sensor',[.25,.12,.27],m.dark,[0,1.44,-.12]);lamp(0,1.44,.03);
 }else if(kind==='tank'||kind==='artillery'){
  const artillery=kind==='artillery',length=artillery?2.12:1.92;
  box('TrackedChassis',[1.14,.28,length],m.dark,[0,.38,0]);box('HullBronze',[1.23,.37,length*.89],m.edge,[0,.63,0],model,.08);box('CeramicHull',[1.16,.20,length*.85],m.sand,[0,.85,0],model,.07);
  for(const side of [-1,1]){
   box('TrackCavity',[.34,.43,length+.10],m.rubber,[side*.73,.36,0],model,.12);
   for(let i=0;i<5;i++)wheel(side*.84,.34,-length*.37+i*length*.185,.20);
   box('CeramicTrackGuard',[.37,.12,length+.13],m.sand,[side*.72,.67,0]);box('GuardStripe',[.22,.025,length*.38],m.team,[side*.72,.75,-.28]);
   for(let i=0;i<24;i++){
    const link=box('TrackLink',[.36,.055,.13],m.dark,[0,0,0],model,.008);links.push({mesh:link,side,index:i,length});
   }
   for(const z of [-.66,0,.66])bolt(side*.73,.65,z+length*.5);
  }
  for(const x of [-.40,.40]){lamp(x,.72,length*.47);vent(x,.86,-length*.36,.25,.13);}
  cylinder('TurretBearing',.43,.08,m.dark,[0,.99,-.12]);
  const turret=group('Tank_Turret');
  box('TurretHousing',[.91,.37,.83],m.edge,[0,1.20,-.13],turret,.10);box('TurretCeramic',[.83,.31,.80],m.sand,[0,1.25,-.13],turret,.09);
  box('TurretStripe',[.14,.023,.65],m.team,[0,1.42,-.15],turret);cylinder('CommanderHatch',.17,.05,m.dark,[-.22,1.44,-.22],turret);cylinder('HatchPlate',.14,.035,m.sand,[-.22,1.48,-.22],turret);
  for(const x of [-.45,.45]){box('TurretFactionBadge',[.025,.13,.31],m.team,[x,1.23,-.17],turret);vent(x*.65,1.17,-.56,.20,.15,turret);}
  const gun=group('Tank_Gun');box('GunMantlet',[.33,.23,.22],m.edge,[0,1.21,.34],gun,.05);
  const lengthBarrel=artillery?1.35:.88,z=.45+lengthBarrel/2;
  cylinder('Barrel',artillery?.065:.075,lengthBarrel,m.dark,[0,1.22,z],gun).rotation.x=Math.PI/2;
  cylinder('BarrelCollar',.095,.16,m.sand,[0,1.22,.59],gun).rotation.x=Math.PI/2;
  box('MuzzleBrake',[.17,.16,.22],m.edge,[0,1.22,.48+lengthBarrel],gun,.018);box('MuzzleOpening',[.105,.065,.024],m.rubber,[0,1.22,.60+lengthBarrel],gun,.008);
  lamp(.25,1.26,.30,turret);
 }else{
  const bomber=kind==='bomber',gunship=kind==='gunship';
  box('Airframe',[.70,.45,1.65],m.edge,[0,.65,0],model,.18);box('CeramicFuselage',[.64,.40,1.51],m.sand,[0,.73,.02],model,.16);
  box('Cockpit',[.52,.27,.60],m.glass,[0,.90,.58],model,.10);box('CockpitSpine',[.055,.045,.60],m.edge,[0,1.03,.58]);
  box('NoseEnamel',[.16,.025,.30],m.team,[0,.87,.96]);lamp(0,.62,.86);
  for(const side of [-1,1]){
   box('SideEnamel',[.04,.18,.54],m.team,[side*.34,.71,-.20]);
   box('Wing',[bomber?1.10:.57,.075,.44],m.sand,[side*(bomber?.72:.45),.64,-.16],model,.025);
   box('WingTip',[.16,.085,.36],m.team,[side*(bomber?1.20:.69),.66,-.16]);
   if(gunship||bomber){const pod=cylinder('WeaponPod',.105,.61,m.dark,[side*.62,.48,.10]);pod.rotation.x=Math.PI/2;cylinder('WeaponRim',.12,.07,m.edge,[side*.62,.48,.42]).rotation.x=Math.PI/2;}
   const exhaust=cylinder('Exhaust',.12,.36,m.dark,[side*.26,.71,-.90]);exhaust.rotation.x=Math.PI/2;lamp(side*.22,.72,-1.10);
  }
  box('TailBoom',[.19,.19,1.10],m.edge,[0,.74,-1.18]);box('TailFin',[.055,.49,.40],m.team,[0,1.02,-1.60]);box('TailPlane',[.83,.05,.23],m.sand,[0,.80,-1.56]);
  if(!bomber){
   for(const side of [-1,1]){box('Skid',[.07,.07,1.56],m.dark,[side*.42,.15,.02]);for(const z of [-.42,.45])box('SkidStrut',[.045,.36,.045],m.edge,[side*.36,.33,z]).rotation.z=side*-.25;}
   cylinder('RotorMast',.055,.32,m.edge,[0,1.12,-.07]);rotor=group('AtlasRotor',[0,1.31,-.07]);cylinder('RotorHub',.10,.07,m.edge,[0,0,0],rotor);
   for(let i=0;i<3;i++){const blade=box('RotorBlade',[1.43,.025,.10],m.dark,[0,0,0],rotor,.006);blade.position.set(Math.cos(i*Math.PI*2/3)*.61,0,Math.sin(i*Math.PI*2/3)*.61);blade.rotation.y=-i*Math.PI*2/3;}
   tailRotor=group('TailRotor',[.08,.96,-1.62]);for(let i=0;i<2;i++)box('TailBlade',[.025,.53,.07],m.dark,[0,0,0],tailRotor,.006).rotation.x=i*Math.PI/2;
  }
 }
 function animate(tag,phase){
  const moving=tag!=='idle';for(const wheel of wheels){const side=Math.sign(wheel.position.x),direction=tag==='turnLeft'?side:tag==='turnRight'?-side:1;wheel.rotation.x=moving?phase*Math.PI*2*direction:0;}
  // Each tread is a real rigid link travelling around the closed wheel loop.
  for(const {mesh,side,index,length} of links){
   const direction=tag==='turnLeft'?side:tag==='turnRight'?-side:1,t=((index/24+(moving?phase/24*direction:0))%1+1)%1,a=t*Math.PI*2;
   mesh.position.set(side*.76,.36+Math.sin(a)*.245,Math.cos(a)*(length*.5+.02));mesh.rotation.x=Math.atan2(-Math.sin(a)*(length*.5+.02),Math.cos(a)*.245);
  }
  if(rotor)rotor.rotation.y=phase*Math.PI*2/3;if(tailRotor)tailRotor.rotation.x=phase*Math.PI;
 }
 animate('idle',0);
 model.userData.atlasDesign={kind,team,parts,triangles:Math.round(triangles),geometry:'Atlas original ceramic / bronze vehicle geometry',source:'Atlas Dominion / original procedural models'};
 return {model,rotor,animate};
}
