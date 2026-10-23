import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Small seeded, tileable maps shared by every part. No downloads or runtime shaders.
function desertMaterials(team){
 let seed=74;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const size=256,canvas=()=>{const c=document.createElement('canvas');c.width=c.height=size;return c;};
 const texture=(c,color=false)=>{const t=new T.CanvasTexture(c);if(color)t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;return t;};
 function surface(kind){
  const color=canvas(),ctx=color.getContext('2d'),height=new Float32Array(size*size),rough=canvas(),rctx=rough.getContext('2d'),rdata=rctx.createImageData(size,size);
  ctx.fillStyle=kind==='cloth'?'#c4b48f':'#d4c19a';ctx.fillRect(0,0,size,size);
  if(kind==='cloth')for(let i=0;i<34;i++){
   const x=rand()*size,y=rand()*size,rx=10+rand()*31,ry=7+rand()*17,points=Array.from({length:10},(_,j)=>{const a=j*Math.PI/5,r=.7+rand()*.45;return [Math.cos(a)*rx*r,Math.sin(a)*ry*r];});
   ctx.fillStyle=i%3===0?'#968061':'#dfd0af';
   for(const dx of [-size,0,size])for(const dy of [-size,0,size]){ctx.beginPath();for(let j=0;j<points.length;j++){const p=points[j],q=points[(j+1)%points.length];if(j===0)ctx.moveTo(x+dx+p[0],y+dy+p[1]);ctx.quadraticCurveTo(x+dx+p[0],y+dy+p[1],x+dx+(p[0]+q[0])*.5,y+dy+(p[1]+q[1])*.5);}ctx.closePath();ctx.fill();}
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const noise=rand(),weave=kind==='cloth'?((x%4<2?1:-1)*(y%4<2?1:-1))*.12:0;
   height[y*size+x]=.5+(noise-.5)*(kind==='cloth'?.16:.10)+weave;
   const r=Math.round(255*((kind==='cloth'?.9:.73)+(noise-.5)*.10));const k=(y*size+x)*4;rdata.data.set([r,r,r,255],k);
  }
  // Restrained dust grain and shallow chips keep the ceramic predominantly sand.
  for(let i=0;i<1800;i++){ctx.fillStyle=i%3?'rgba(255,244,211,.07)':'rgba(64,49,32,.07)';ctx.fillRect(rand()*size,rand()*size,.5+rand(),.5+rand());}
  if(kind==='ceramic')for(let i=0;i<32;i++){ctx.strokeStyle='rgba(91,72,47,.15)';ctx.lineWidth=.55;const x=rand()*size,y=rand()*size;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+2+rand()*5,y+rand()*2);ctx.stroke();}
  rctx.putImageData(rdata,0,0);const normal=canvas(),nctx=normal.getContext('2d'),ndata=nctx.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const at=(a,b)=>height[((b+size)%size)*size+(a+size)%size],v=new T.Vector3((at(x-1,y)-at(x+1,y))*.6,(at(x,y-1)-at(x,y+1))*.6,1).normalize();ndata.data.set([Math.round((v.x*.5+.5)*255),Math.round((v.y*.5+.5)*255),Math.round((v.z*.5+.5)*255),255],(y*size+x)*4);}
  nctx.putImageData(ndata,0,0);return {map:texture(color,true),roughnessMap:texture(rough),normalMap:texture(normal)};
 }
 const cloth=surface('cloth'),ceramic=surface('ceramic');
 const mat=(name,color,roughness,metalness,extra={})=>new T.MeshStandardMaterial({name,color,roughness,metalness,...extra});
 return {
  armour:mat('Atlas sand ceramic','#ffffff',1,.06,{...ceramic,normalScale:new T.Vector2(.3,.3)}),
  cloth:mat('Atlas three-tone desert fabric','#ffffff',1,0,{...cloth,normalScale:new T.Vector2(.55,.55)}),
  seam:mat('Atlas sand stitching','#938568',.94,0),
  edge:mat('Atlas worn ceramic bevels','#94815e',.72,.25,{normalMap:ceramic.normalMap,roughnessMap:ceramic.roughnessMap}),
  dark:mat('Atlas charcoal webbing','#38362d',.94,0,{normalMap:cloth.normalMap,normalScale:new T.Vector2(.4,.4)}),
  metal:mat('Atlas phosphate steel','#303331',.55,.78,{roughnessMap:ceramic.roughnessMap,normalMap:ceramic.normalMap,normalScale:new T.Vector2(.15,.15)}),
  worn:mat('Atlas brushed edge steel','#6a6b61',.46,.82),
  team:mat('Atlas faction enamel',team?'#9f4034':'#365d8a',.63,.18),
  light:mat('Atlas amber optics','#aa8951',.25,.35,{emissive:'#d8ab59',emissiveIntensity:.16}),
  rubber:mat('Atlas dark boot rubber','#242520',.96,0),
 };
}

// Original hard-surface armour built around the CC0 Quaternius skeleton.
// Every plate follows a real animated joint; there are no screen-space limb tricks.
export function buildDetailedInfantry(model,team=0){
 const bones={};model.traverse(n=>{if(n.isBone)bones[n.name]=n;});model.updateMatrixWorld(true);
 const p=name=>{if(!bones[name])throw Error('Missing rig joint '+name);return bones[name].getWorldPosition(new T.Vector3());};
 const oldMeshes=[];model.traverse(n=>{if(n.isMesh)oldMeshes.push(n);});oldMeshes.forEach(n=>n.visible=false);
 const m=desertMaterials(team);
 const parts=[];let triangles=0;
 const mesh=(name,geometry,mat,parent,position=[0,0,0])=>{const n=new T.Mesh(geometry,mat);n.name='Atlas_'+name;n.position.set(...position);n.castShadow=n.receiveShadow=true;parent.add(n);parts.push(n);triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;return n;};
 const box=(name,size,mat,parent,position=[0,0,0],radius=.018)=>mesh(name,new RoundedBoxGeometry(...size,Math.min(...size)<.03?1:3,Math.min(radius,...size.map(v=>v*.25))),mat,parent,position);
 const sphere=(name,size,mat,parent,position)=>{const n=mesh(name,new T.SphereGeometry(1,24,16),mat,parent,position);n.scale.set(...size);return n;};
 const cylinder=(name,radius,length,mat,parent,position,axis='z')=>{const n=mesh(name,new T.CylinderGeometry(radius,radius,length,20),mat,parent,position);if(axis==='z')n.rotation.x=Math.PI/2;if(axis==='x')n.rotation.z=Math.PI/2;return n;};
 const attach=(name,joint,at,rotation)=>{const g=new T.Group();g.name='Atlas_'+name;g.position.copy(at);if(rotation)g.quaternion.copy(rotation);model.add(g);g.updateMatrixWorld(true);bones[joint].attach(g);return g;};
 const segment=(name,joint,end,width,depth)=>{const a=p(joint),b=typeof end==='string'?p(end):end,delta=b.clone().sub(a),g=attach(name,joint,a.clone().add(b).multiplyScalar(.5),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize()));box(name+'Suit',[width*.78,delta.length()*.88,depth*.78],m.cloth,g);box(name+'Seam',[.008,delta.length()*.79,.007],m.seam,g,[width*.29,0,depth*.40],.001);for(let i=0;i<4;i++)box(name+'Stitch',[.017,.004,.008],m.seam,g,[width*.29,delta.length()*(i/5-.3),depth*.41],.001);return {g,length:delta.length()};};
 const bolts=(g,w,h,z)=>{for(const x of [-w/2,w/2])for(const y of [-h/2,h/2]){cylinder('Fastener',.009,.008,m.metal,g,[x,y,z]);box('FastenerSlot',[.010,.002,.003],m.edge,g,[x,y,z+.006],.0005);}};
 // Breastplate, overlapping abdominal lames and a vented power pack.
 const chest=attach('Breastplate','Torso',new T.Vector3(0,1.25,.085));
 box('ChestRim',[.55,.40,.34],m.edge,chest,[0,0,0],.055);box('ChestCeramic',[.51,.36,.34],m.armour,chest,[0,.012,.018],.055);
 for(const x of [-.132,.132]){const plate=box('Pectoral',[.238,.195,.047],m.armour,chest,[x,.075,.196],.022);plate.rotation.z=x>0?-.07:.07;}
 box('ChestInset',[.34,.057,.024],m.dark,chest,[0,-.053,.203]);box('ChestStatus',[.145,.012,.012],m.light,chest,[0,-.053,.22],.003);bolts(chest,.43,.27,.198);
 for(const x of [-.22,.22])box('ShoulderHarness',[.045,.41,.034],m.dark,chest,[x,.03,.20],.007);
 const abdomen=attach('AbdominalLames','Abdomen',new T.Vector3(0,.96,.06));
 for(let i=0;i<3;i++)box('AbdominalPlate',[.42-i*.025,.085,.25],i===2?m.edge:m.armour,abdomen,[0,.13-i*.077,.022],.014);
 const belt=attach('UtilityBelt','Body_1',new T.Vector3(0,.85,.02));box('Belt',[.48,.09,.29],m.dark,belt);box('Buckle',[.105,.069,.035],m.edge,belt,[0,0,.166]);
 for(const x of [-.205,.205]){box('AmmoPouch',[.105,.17,.12],m.armour,belt,[x,-.11,.12]);box('PouchLid',[.113,.045,.13],m.edge,belt,[x,-.037,.12]);}
 const pack=attach('PowerPack','Torso',new T.Vector3(0,1.24,-.17));box('PackFrame',[.34,.40,.20],m.edge,pack,[0,0,0],.03);box('PackCasing',[.30,.36,.20],m.armour,pack,[0,0,-.015],.03);
 box('PackStripe',[.045,.16,.025],m.team,pack,[0,0,-.136]);
 for(const x of [-.12,.12])for(let i=0;i<5;i++)box('CoolingFin',[.072,.012,.025],m.dark,pack,[x,-.08+i*.035,-.139],.002);
 cylinder('Antenna',.008,.34,m.metal,pack,[.15,.35,0],'y');sphere('AntennaCap',[.012,.017,.012],m.light,pack,[.15,.53,0]);
 // Smaller fully enclosed helmet, recessed continuous visor, ear mechanisms.
 const head=attach('Helmet','Head',new T.Vector3(0,1.68,.13));
 sphere('HelmetSeal',[.195,.195,.18],m.dark,head,[0,0,0]);sphere('HelmetShell',[.205,.20,.19],m.armour,head,[0,.025,-.012]);
 box('Brow',[.35,.067,.12],m.armour,head,[0,.065,.151],.025);box('VisorRecess',[.335,.10,.09],m.metal,head,[0,.004,.172],.025);
 box('VisorGlass',[.294,.048,.037],m.light,head,[0,.012,.217],.014);box('JawGuard',[.27,.087,.10],m.armour,head,[0,-.10,.166],.025);
 for(const x of [-.118,.118]){const cheek=box('Cheek',[.069,.125,.09],m.armour,head,[x,-.048,.182]);cheek.rotation.z=x>0?.23:-.23;}
 box('HelmetStripe',[.04,.018,.16],m.team,head,[0,.218,-.01],.007);
 for(const x of [-.204,.204]){cylinder('EarMount',.079,.038,m.edge,head,[x,-.005,-.025],'x');cylinder('EarCover',.055,.043,m.armour,head,[x*1.03,-.005,-.025],'x');}
 const neck=attach('NeckSeal','Neck',new T.Vector3(0,1.44,.11));cylinder('Collar',.122,.12,m.dark,neck,[0,0,0],'y');
 // Articulated limbs. Plates are registered to individual joints, not to a sprite.
 for(const side of ['L','R']){
  const upper=segment('UpperArm'+side,'UpperArm'+side,'LowerArm'+side,.175,.18),arm=upper.g;
  const shoulder=box('PauldronRim',[.28,upper.length*.63,.27],m.edge,arm,[0,-upper.length*.12,0],.04);
  box('Pauldron',[.262,upper.length*.60,.26],m.armour,arm,[0,-upper.length*.13,.012],.037);
  box('PauldronBadge',[.10,.045,.012],m.team,arm,[0,-upper.length*.13,.15],.014);
  const wrist=p('Index1'+side),lower=segment('Forearm'+side,'LowerArm'+side,wrist,.16,.17);
  box('Gauntlet',[.18,lower.length*.57,.18],m.edge,lower.g,[0,lower.length*.07,0]);box('ForearmPlate',[.16,lower.length*.55,.066],m.armour,lower.g,[0,lower.length*.07,.105]);
  for(let i=0;i<3;i++)box('WristRib',[.16,.017,.17],m.metal,lower.g,[0,lower.length*(.29+i*.07),0],.004);
  // Glove axes match the named weapon grip sockets; the wrist is oriented in the bake.
  const hand=new T.Group();hand.name='Atlas_Glove'+side;bones['Index1'+side].add(hand);const sign=side==='R'?1:-1;
  box('GlovePalm'+side,[.046,.086,.090],m.dark,hand,[sign*.021,0,.019],.018);
  box('GloveCuff'+side,[.073,.069,.05],m.rubber,hand,[0,-.006,-.047],.014);
  box('KnucklePlate'+side,[.016,.075,.065],m.edge,hand,[-sign*.004,.005,.024],.007);
  for(let finger=0;finger<4;finger++){
   box('Finger'+side+finger,[.063,.017,.025],m.dark,hand,[sign*.047,.030-finger*.021,.064],.007);
   box('Fingertip'+side+finger,[.018,.017,.036],m.dark,hand,[sign*.077,.030-finger*.021,.048],.007);
  }
  box('Thumb'+side,[.023,.029,.063],m.dark,hand,[sign*.060,.041,.003],.010);
  const thigh=segment('Thigh'+side,'UpperLeg'+side,'LowerLeg'+side,.20,.23);
  box('ThighCeramic',[.19,thigh.length*.64,.07],m.armour,thigh.g,[0,-.025,.128],.022);box('ThighStripe',[.032,.065,.012],m.team,thigh.g,[0,-.025,.17],.005);
  const shin=segment('Shin'+side,'LowerLeg'+side,p('Foot'+side).clone().add(new T.Vector3(0,.08,0)),.17,.18);
  box('ShinRim',[.20,shin.length*.74,.11],m.edge,shin.g,[0,.01,.09]);box('ShinCeramic',[.175,shin.length*.70,.083],m.armour,shin.g,[0,.01,.134],.02);bolts(shin.g,.13,shin.length*.53,.181);
  const knee=attach('Knee'+side,'LowerLeg'+side,p('LowerLeg'+side));sphere('KneeJoint',[.104,.102,.10],m.dark,knee,[0,0,0]);box('KneeCap',[.19,.17,.10],m.armour,knee,[0,0,.095],.034);
  const boot=attach('Boot'+side,'Foot'+side,p('Foot'+side).clone().add(new T.Vector3(0,.057,.07)));
  box('BootUpper',[.20,.16,.31],m.dark,boot,[0,.038,.015],.035);box('BootToe',[.205,.105,.19],m.rubber,boot,[0,.013,.12],.026);box('Sole',[.218,.038,.34],m.rubber,boot,[0,-.045,.025],.009);
  for(let i=0;i<5;i++)box('Tread',[.221,.025,.023],m.metal,boot,[0,-.059,-.105+i*.065],.003);
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
 model.userData.atlasDesign={name:'Atlas Legion Infantry / desert ceramic armour',version:2,team,parts:parts.length,triangles:Math.round(triangles),materials:'Seeded 256px desert fabric, ceramic PBR and phosphate steel',weaponBinding:'Right wrist socket / two-hand grip frames',geometry:'Original procedural hard-surface armour and rifle',rig:'Quaternius Toon Shooter Game Kit / CC0-1.0'};
 model.updateMatrixWorld(true);return model.userData.atlasDesign;
}
