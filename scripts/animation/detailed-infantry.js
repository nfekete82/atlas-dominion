import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Original hard-surface armour built around the CC0 Quaternius skeleton.
// Every plate follows a real animated joint; there are no screen-space limb tricks.
export function buildDetailedInfantry(model,team=0){
 const bones={};model.traverse(n=>{if(n.isBone)bones[n.name]=n;});model.updateMatrixWorld(true);
 const p=name=>{if(!bones[name])throw Error('Missing rig joint '+name);return bones[name].getWorldPosition(new T.Vector3());};
 const oldMeshes=[];model.traverse(n=>{if(n.isMesh)oldMeshes.push(n);});oldMeshes.forEach(n=>n.visible=false);
 let seed=74;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle='#d2c3a1';ctx.fillRect(0,0,512,512);
 for(let i=0;i<17000;i++){const v=rand();ctx.fillStyle=v<.09?'rgba(55,43,28,.28)':v<.4?'rgba(93,74,45,.10)':'rgba(255,249,224,.09)';ctx.fillRect(rand()*512,rand()*512,rand()*1.8+.3,rand()*1.8+.3);}
 for(let i=0;i<100;i++){ctx.strokeStyle='rgba(60,44,24,.14)';ctx.lineWidth=.4+rand();ctx.beginPath();const x=rand()*512,y=rand()*512;ctx.moveTo(x,y);ctx.lineTo(x+rand()*10-5,y+rand()*2);ctx.stroke();}
 const paint=new T.CanvasTexture(canvas);paint.colorSpace=T.SRGBColorSpace;paint.wrapS=paint.wrapT=T.RepeatWrapping;
 const material=(name,color,roughness,metalness,extra={})=>new T.MeshStandardMaterial({name,color,roughness,metalness,...extra});
 const m={armour:material('Atlas sand ceramic','#e0cfac',.67,.25,{map:paint}),edge:material('Atlas bronze edges','#665037',.45,.63),dark:material('Atlas flexible undersuit','#182736',.94,.04),metal:material('Atlas dark steel','#2c3339',.42,.72),team:material('Atlas faction enamel',team?'#9f2925':'#194e94',.36,.38),light:material('Atlas visor',team?'#ff5142':'#37c8ff',.21,.4,{emissive:team?'#f12612':'#079dff',emissiveIntensity:.65}),rubber:material('Atlas sole','#15191c',.96,.02)};
 const parts=[];let triangles=0;
 const mesh=(name,geometry,mat,parent,position=[0,0,0])=>{const n=new T.Mesh(geometry,mat);n.name='Atlas_'+name;n.position.set(...position);n.castShadow=n.receiveShadow=true;parent.add(n);parts.push(n);triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;return n;};
 const box=(name,size,mat,parent,position=[0,0,0],radius=.018)=>mesh(name,new RoundedBoxGeometry(...size,3,Math.min(radius,...size.map(v=>v*.25))),mat,parent,position);
 const sphere=(name,size,mat,parent,position)=>{const n=mesh(name,new T.SphereGeometry(1,24,16),mat,parent,position);n.scale.set(...size);return n;};
 const cylinder=(name,radius,length,mat,parent,position,axis='z')=>{const n=mesh(name,new T.CylinderGeometry(radius,radius,length,20),mat,parent,position);if(axis==='z')n.rotation.x=Math.PI/2;if(axis==='x')n.rotation.z=Math.PI/2;return n;};
 const attach=(name,joint,at,rotation)=>{const g=new T.Group();g.name='Atlas_'+name;g.position.copy(at);if(rotation)g.quaternion.copy(rotation);model.add(g);g.updateMatrixWorld(true);bones[joint].attach(g);return g;};
 const segment=(name,joint,end,width,depth)=>{const a=p(joint),b=typeof end==='string'?p(end):end,delta=b.clone().sub(a),g=attach(name,joint,a.clone().add(b).multiplyScalar(.5),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize()));box(name+'Suit',[width*.78,delta.length()*.88,depth*.78],m.dark,g);return {g,length:delta.length()};};
 const bolts=(g,w,h,z)=>{for(const x of [-w/2,w/2])for(const y of [-h/2,h/2]){cylinder('Fastener',.009,.008,m.metal,g,[x,y,z]);box('FastenerSlot',[.010,.002,.003],m.edge,g,[x,y,z+.006],.0005);}};
 // Breastplate, overlapping abdominal lames and a vented power pack.
 const chest=attach('Breastplate','Torso',new T.Vector3(0,1.25,.085));
 box('ChestRim',[.55,.40,.34],m.edge,chest,[0,0,0],.055);box('ChestCeramic',[.51,.36,.34],m.armour,chest,[0,.012,.018],.055);
 for(const x of [-.132,.132]){const plate=box('Pectoral',[.238,.195,.047],m.armour,chest,[x,.075,.196],.022);plate.rotation.z=x>0?-.07:.07;}
 box('ChestInset',[.34,.057,.024],m.dark,chest,[0,-.053,.203]);box('ChestStatus',[.145,.012,.012],m.light,chest,[0,-.053,.22],.003);bolts(chest,.43,.27,.198);
 for(const x of [-.22,.22])box('ShoulderHarness',[.055,.41,.034],m.team,chest,[x,.03,.20],.007);
 const abdomen=attach('AbdominalLames','Abdomen',new T.Vector3(0,.96,.06));
 for(let i=0;i<3;i++)box('AbdominalPlate',[.42-i*.025,.085,.25],i===2?m.edge:m.armour,abdomen,[0,.13-i*.077,.022],.014);
 const belt=attach('UtilityBelt','Body_1',new T.Vector3(0,.85,.02));box('Belt',[.48,.09,.29],m.dark,belt);box('Buckle',[.105,.069,.035],m.edge,belt,[0,0,.166]);
 for(const x of [-.205,.205]){box('AmmoPouch',[.105,.17,.12],m.armour,belt,[x,-.11,.12]);box('PouchLid',[.113,.045,.13],m.edge,belt,[x,-.037,.12]);}
 const pack=attach('PowerPack','Torso',new T.Vector3(0,1.24,-.17));box('PackFrame',[.34,.40,.20],m.edge,pack,[0,0,0],.03);box('PackCasing',[.30,.36,.20],m.armour,pack,[0,0,-.015],.03);
 box('PackStripe',[.085,.35,.025],m.team,pack,[0,0,-.136]);
 for(const x of [-.12,.12])for(let i=0;i<5;i++)box('CoolingFin',[.072,.012,.025],m.dark,pack,[x,-.08+i*.035,-.139],.002);
 cylinder('Antenna',.008,.34,m.metal,pack,[.15,.35,0],'y');sphere('AntennaCap',[.012,.017,.012],m.light,pack,[.15,.53,0]);
 // Smaller fully enclosed helmet, recessed continuous visor, ear mechanisms.
 const head=attach('Helmet','Head',new T.Vector3(0,1.68,.13));
 sphere('HelmetSeal',[.195,.195,.18],m.dark,head,[0,0,0]);sphere('HelmetShell',[.205,.20,.19],m.armour,head,[0,.025,-.012]);
 box('Brow',[.35,.067,.12],m.armour,head,[0,.065,.151],.025);box('VisorRecess',[.335,.10,.09],m.metal,head,[0,.004,.172],.025);
 box('VisorGlass',[.294,.048,.037],m.light,head,[0,.012,.217],.014);box('JawGuard',[.27,.087,.10],m.armour,head,[0,-.10,.166],.025);
 for(const x of [-.118,.118]){const cheek=box('Cheek',[.069,.125,.09],m.armour,head,[x,-.048,.182]);cheek.rotation.z=x>0?.23:-.23;}
 box('HelmetStripe',[.065,.025,.26],m.team,head,[0,.218,-.01],.007);
 for(const x of [-.204,.204]){cylinder('EarMount',.079,.038,m.edge,head,[x,-.005,-.025],'x');cylinder('EarCover',.055,.043,m.armour,head,[x*1.03,-.005,-.025],'x');}
 const neck=attach('NeckSeal','Neck',new T.Vector3(0,1.44,.11));cylinder('Collar',.122,.12,m.dark,neck,[0,0,0],'y');
 // Articulated limbs. Plates are registered to individual joints, not to a sprite.
 for(const side of ['L','R']){
  const upper=segment('UpperArm'+side,'UpperArm'+side,'LowerArm'+side,.175,.18),arm=upper.g;
  const shoulder=box('PauldronRim',[.28,upper.length*.63,.27],m.edge,arm,[0,-upper.length*.12,0],.04);
  box('Pauldron',[.262,upper.length*.60,.26],m.armour,arm,[0,-upper.length*.13,.012],.037);
  box('PauldronBadge',[.19,.12,.023],m.team,arm,[0,-upper.length*.13,.15],.014);
  const wrist=p('Index1'+side),lower=segment('Forearm'+side,'LowerArm'+side,wrist,.16,.17);
  box('Gauntlet',[.18,lower.length*.57,.18],m.edge,lower.g,[0,lower.length*.07,0]);box('ForearmPlate',[.16,lower.length*.55,.066],m.armour,lower.g,[0,lower.length*.07,.105]);
  for(let i=0;i<3;i++)box('WristRib',[.16,.017,.17],m.metal,lower.g,[0,lower.length*(.29+i*.07),0],.004);
  const handEnd=wrist.clone().lerp(p('Index2'+side),.55),handLink=segment('Wrist'+side,'Index1'+side,handEnd,.12,.13);
  const hand=attach('Glove'+side,'Index1'+side,handEnd);box('Glove',[.13,.12,.16],m.dark,hand,[0,0,0],.035);box('KnucklePlate',[.12,.035,.13],m.armour,hand,[0,.07,0],.012);
  for(let finger=0;finger<4;finger++)box('Finger',[.025,.065,.09],m.dark,hand,[-.045+finger*.03,-.02,.077],.012);
  const thigh=segment('Thigh'+side,'UpperLeg'+side,'LowerLeg'+side,.20,.23);
  box('ThighCeramic',[.19,thigh.length*.64,.07],m.armour,thigh.g,[0,-.025,.128],.022);box('ThighStripe',[.052,thigh.length*.48,.012],m.team,thigh.g,[0,-.025,.17],.005);
  const shin=segment('Shin'+side,'LowerLeg'+side,p('Foot'+side).clone().add(new T.Vector3(0,.08,0)),.17,.18);
  box('ShinRim',[.20,shin.length*.74,.11],m.edge,shin.g,[0,.01,.09]);box('ShinCeramic',[.175,shin.length*.70,.083],m.armour,shin.g,[0,.01,.134],.02);bolts(shin.g,.13,shin.length*.53,.181);
  const knee=attach('Knee'+side,'LowerLeg'+side,p('LowerLeg'+side));sphere('KneeJoint',[.104,.102,.10],m.dark,knee,[0,0,0]);box('KneeCap',[.19,.17,.10],m.armour,knee,[0,0,.095],.034);
  const boot=attach('Boot'+side,'Foot'+side,p('Foot'+side).clone().add(new T.Vector3(0,.057,.07)));
  box('BootUpper',[.20,.16,.31],m.edge,boot,[0,.038,.015],.035);box('BootToe',[.205,.105,.19],m.armour,boot,[0,.013,.12],.026);box('Sole',[.218,.038,.34],m.rubber,boot,[0,-.045,.025],.009);
  for(let i=0;i<5;i++)box('Tread',[.221,.025,.023],m.metal,boot,[0,-.059,-.105+i*.065],.003);
 }
 // A coherent Atlas rifle attached to the same hand as the original AK.
 const sourceWeapon=model.getObjectByName('AK');if(!sourceWeapon)throw Error('Source weapon attachment missing');
 const weaponPosition=sourceWeapon.localToWorld(new T.Vector3(.30,.36,0)),rifle=new T.Group();rifle.name='Atlas_Rifle';rifle.position.copy(weaponPosition);
 const forward=new T.Vector3(1,.25,0).normalize(),up=new T.Vector3(-.25,1,0).normalize(),right=up.clone().cross(forward),orientation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,forward));
 rifle.quaternion.copy(sourceWeapon.getWorldQuaternion(new T.Quaternion()).multiply(orientation));model.add(rifle);rifle.updateMatrixWorld(true);sourceWeapon.attach(rifle);sourceWeapon.visible=true;
 // Hide only the source AK geometry; our meshes remain visible under its group.
 sourceWeapon.children.filter(n=>n!==rifle).forEach(n=>n.visible=false);
 box('RifleReceiver',[.12,.15,.38],m.metal,rifle);box('RifleCasing',[.13,.116,.31],m.armour,rifle,[0,.012,.025]);box('Stock',[.105,.12,.19],m.edge,rifle,[0,-.013,-.26]);
 box('Foregrip',[.09,.10,.19],m.metal,rifle,[0,-.03,.25]);box('EnergyStrip',[.014,.036,.25],m.light,rifle,[.073,.018,.025],.003);
 cylinder('Barrel',.028,.28,m.metal,rifle,[0,.018,.35]);cylinder('MuzzleBrake',.045,.08,m.edge,rifle,[0,.018,.51]);cylinder('MuzzleBore',.021,.006,m.rubber,rifle,[0,.018,.552]);
 box('Magazine',[.073,.19,.10],m.dark,rifle,[0,-.14,-.035]);box('Optic',[.055,.059,.11],m.metal,rifle,[0,.11,-.005]);
 for(let i=0;i<5;i++)box('ReceiverVent',[.133,.015,.016],m.dark,rifle,[0,.036,-.08+i*.05],.002);
 model.userData.atlasDesign={name:'Atlas Legion Infantry / detailed armour prototype',version:1,team,parts:parts.length,triangles:Math.round(triangles),geometry:'Original procedural hard-surface armour and rifle',rig:'Quaternius Toon Shooter Game Kit / CC0-1.0'};
 model.updateMatrixWorld(true);return model.userData.atlasDesign;
}
