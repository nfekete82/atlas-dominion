import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Original four-seat reconnaissance carrier, inspired by the supplied military 4x4.
 * Detailed 3D geometry and self-contained procedural glTF PBR textures.
 * +Z: front of vehicle, +Y: up. Not a licensed Humvee model.
 */
function paintMaps(){
 const size=1024,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const c=canvas.getContext('2d');let seed=0x4824a93;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 c.fillStyle='#b7a178';c.fillRect(0,0,size,size);
 const patches=['#3e4739','#615044','#8a775c','#4c5540','#c3ac82'];
 for(let i=0;i<240;i++){
  const x=rnd()*size,y=rnd()*size,rx=25+rnd()*145,ry=18+rnd()*85;
  c.fillStyle=patches[Math.floor(rnd()*patches.length)];
  c.beginPath();
  for(let j=0;j<9;j++){
   const a=j*Math.PI*2/9,r=.64+rnd()*.68;
   const px=x+Math.cos(a)*rx*r,py=y+Math.sin(a)*ry*r;
   if(!j)c.moveTo(px,py);else c.lineTo(px,py);
  }c.closePath();c.fill();
 }
 const overlay=c.getImageData(0,0,size,size),a=overlay.data;
 for(let i=0;i<a.length;i+=4){const grain=(rnd()-.5)*21,dust=rnd()<.10?11:0;
  a[i]=Math.max(0,Math.min(255,a[i]+grain+dust));
  a[i+1]=Math.max(0,Math.min(255,a[i+1]+grain+dust*.8));
  a[i+2]=Math.max(0,Math.min(255,a[i+2]+grain+dust*.5));
 }c.putImageData(overlay,0,0);
 for(let i=0;i<1450;i++){
  c.fillStyle=rnd()<.66?'rgba(222,201,154,.24)':'rgba(36,34,30,.24)';
  const x=rnd()*size,y=rnd()*size;c.fillRect(x,y,2+rnd()*15,.6+rnd()*2);
 }
 const make=(size,callback)=>{
  const t=document.createElement('canvas');t.width=t.height=size;
  const ctx=t.getContext('2d'),data=ctx.createImageData(size,size);
  let rng=0x253a57;const random=()=>{rng=(Math.imul(rng,22695477)+1)>>>0;return rng/4294967296;};
  for(let i=0;i<data.data.length;i+=4){const pixel=callback(random);data.data[i]=pixel[0];data.data[i+1]=pixel[1];data.data[i+2]=pixel[2];data.data[i+3]=255;}
  ctx.putImageData(data,0,0);return t;
 };
 const maps=[
  canvas,
  make(512,r=>{const n=(r()-.5)*23;return [128+n,128+n,249];}),
  make(512,r=>{const n=(r()-.5)*33;const v=214+n;return [v,v,v];})
 ];
 return maps.map((item,i)=>{const map=new T.CanvasTexture(item);
  map.colorSpace=i?T.NoColorSpace:T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;
  map.repeat.set(i?3:1.25,i?3:1.25);map.anisotropy=8;return map;});
}
let nextMaterialId=0;
export function buildHumvee(team=0){
 const [camo,normal,roughness]=paintMaps();
 const mat=(name,color,metalness=.16,rough=.76,extra={})=>new T.MeshStandardMaterial({
  name:'Humvee '+name,color,metalness,roughness:rough,...extra
 });
 const m={
  armor:mat('weathered woodland camouflage','#ffffff',.24,.82,{map:camo,normalMap:normal,normalScale:new T.Vector2(.19,.19),roughnessMap:roughness}),
  sand:mat('sunfaded sand paint','#b7a178',.18,.86,{normalMap:normal,roughnessMap:roughness}),
  steel:mat('worn gunmetal','#353a38',.66,.64,{normalMap:normal,roughnessMap:roughness}),
  dark:mat('black powder coated steel','#202624',.54,.79,{normalMap:normal,roughnessMap:roughness}),
  rubber:mat('matte tread rubber','#181c1c',.02,.98),
  glass:mat('armoured smoked glass','#263f3c',.05,.20,{transparent:false}),
  trim:mat('rubber seals','#292d28',.09,.91),
  emblem:mat('team identification enamel',team?'#b82c27':'#2069d8',.22,.42),
  headlight:mat('glass headlamp','#e5dcba',.05,.25,{emissive:'#b5ac7a',emissiveIntensity:.2}),
  tail:mat('taillight','#ba3f28',.07,.4,{emissive:'#8b150b',emissiveIntensity:.15})
 };
 const model=new T.Group();model.name='Atlas_Humvee_ReconCarrier';
 let count=0,triangles=0;const wheels=[];
 const add=(name,geometry,material,xyz=[0,0,0],parent=model)=>{
  const n=new T.Mesh(geometry,material);n.name=name+'_'+(++count);n.position.set(...xyz);
  n.castShadow=n.receiveShadow=true;parent.add(n);
  triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;return n;
 };
 const box=(name,size,material,xyz,parent=model,round=.025)=>{
  const radius=Math.max(0,Math.min(round,...size.map(x=>x*.19)));
  return add(name,new RoundedBoxGeometry(...size,2,radius),material,xyz,parent);
 };
 const cyl=(name,radius,length,material,xyz,parent=model,axis='y',segments=16)=>{
  const object=add(name,new T.CylinderGeometry(radius,radius,length,segments),material,xyz,parent);
  if(axis==='x')object.rotation.z=Math.PI/2;
  if(axis==='z')object.rotation.x=Math.PI/2;
  return object;
 };
 const group=(name,xyz=[0,0,0],parent=model)=>{const g=new T.Group();g.name=name;g.position.set(...xyz);parent.add(g);return g;};
 const rod=(name,start,end,r,material,parent=model)=>{
  const a=new T.Vector3(...start),b=new T.Vector3(...end),d=b.clone().sub(a);
  const n=cyl(name,r,d.length(),material,a.add(b).multiplyScalar(.5).toArray(),parent,'y',10);
  n.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return n;
 };
 // Full-length boxed underbody; the hood slopes toward the aggressive front grille.
 box('LadderFrame',[1.84,.24,4.16],m.dark,[0,.62,0]);
 box('ArmoredLowerBody',[2.09,.48,3.77],m.armor,[0,.88,-.05],model,.08);
 box('ArmoredHood',[2.07,.30,1.34],m.armor,[0,1.18,1.33],model,.07);
 box('HoodUpperSlope',[1.92,.13,1.10],m.armor,[0,1.39,1.28],model,.08).rotation.x=-.11;
 box('CabinCore',[1.93,.68,2.05],m.armor,[0,1.50,-.39],model,.08);
 box('WindshieldHeader',[2.08,.20,.13],m.armor,[0,1.98,.61]);
 box('ArmoredRoof',[2.12,.14,2.07],m.armor,[0,2.04,-.41],model,.08);
 box('CargoTail',[2.02,.68,.87],m.armor,[0,1.51,-1.80],model,.07);
 box('TailUpperSloped',[2.00,.08,.85],m.armor,[0,1.92,-1.78],model,.035).rotation.x=.13;
 box('HoodVent',[.83,.018,.67],m.dark,[0,1.49,1.48]);
 for(let k=0;k<13;k++)box('HoodGrille',[.74,.018,.020],m.trim,[0,1.505,1.20+k*.044]);
 // Front armour and grille with real perforation shadows.
 box('FrontGrillePanel',[1.67,.44,.08],m.steel,[0,1.02,2.04]);
 for(let k=0;k<9;k++)box('FrontGrilleSlot',[.065,.29,.012],m.rubber,[-.60+k*.15,1.02,2.089],model,.008);
 for(const x of [-.79,.79]){
  box('HeadlampHousing',[.28,.23,.09],m.dark,[x,1.12,2.12]);
  cyl('Headlamp',.079,.03,m.headlight,[x,1.13,2.18],model,'z');
  box('TurnIndicator',[.15,.06,.020],m.tail,[x,1.0,2.19]);
 }
 // Heavy brush-guard cage on the front, tow eyes, chassis protection.
 for(const x of [-1.12,1.12])rod('FrontBrushVertical',[x,.67,2.30],[x,1.48,2.31],.043,m.dark);
 for(const y of [.67,1.45])rod('FrontBrushHorizontal',[-1.15,y,2.31],[1.15,y,2.31],.041,m.steel);
 for(const x of [-.85,.85])rod('BrushCrossBar',[x,.68,2.31],[x*.83,1.42,2.31],.030,m.dark);
 box('FrontBumper',[2.42,.20,.26],m.dark,[0,.61,2.22]);
 box('RearBumper',[2.24,.17,.19],m.dark,[0,.62,-2.25]);
 // Angled windshield, interior division, four side windows and doors.
 for(const x of [-.54,.54]){
  box('WindshieldPane',[.87,.48,.044],m.glass,[x,1.74,.666],model,.033).rotation.x=-.12;
  box('WindshieldWiper',[.75,.018,.03],m.dark,[x,1.51,.703],model,.005);
 }
 rod('WindscreenCenter',[0,1.48,.72],[0,1.99,.61],.033,m.armor);
 for(const side of [-1,1]){
  const x=side*1.02;
  for(const [index,z] of [[0,.09],[1,-.88]]){
   box('DoorOuter',[.062,.65,.86],m.armor,[x,1.18,z]);
   box('ArmoredWindow',[.073,.40,.70],m.glass,[x+side*.012,1.76,z],model,.025);
   box('WindowTopRail',[.08,.046,.82],m.armor,[x,2.0,z]);
   box('DoorSeam',[.08,.59,.018],m.dark,[x+side*.014,1.16,z+.43]);
   box('DoorHandle',[.087,.045,.18],m.dark,[x+side*.048,1.40,z+.20]);
   box('DoorHinge',[.11,.08,.075],m.steel,[x+side*.02,1.30,z+.42]);
  }
  box('RunningBoard',[.26,.07,2.16],m.dark,[side*1.21,.66,-.28]);
  box('RearFender',[.33,.13,1.08],m.armor,[side*1.09,1.03,-1.49]);
  box('FrontFender',[.36,.13,1.08],m.armor,[side*1.09,1.05,1.38]);
  box('MirrorHousing',[.16,.23,.26],m.dark,[side*1.27,1.75,.60]);
  rod('MirrorArm',[side*1.00,1.73,.63],[side*1.25,1.73,.63],.025,m.steel);
  box('SideFactionBadge',[.018,.14,.32],m.emblem,[side*1.063,1.37,-1.12]);
  box('RearTaillight',[.075,.20,.15],m.tail,[side*.93,1.16,-2.28]);
 }
 // Four true big-diameter wheel assemblies with independently rotatable pivots.
 for(const side of [-1,1])for(const [position,z] of [['Front',1.44],['Rear',-1.50]]){
  const pivot=group('RoverWheel_'+(side>0?'R':'L')+'_'+position,[side*1.12,.47,z]);
  const tire=cyl('AllTerrainWheel',.48,.32,m.rubber,[0,0,0],pivot,'x',28);
  cyl('RimDisc',.27,.335,m.dark,[0,0,0],pivot,'x',20);
  cyl('WheelHub',.18,.348,m.steel,[0,0,0],pivot,'x',20);
  for(let i=0;i<18;i++){
   const a=i*Math.PI*2/18;
   const tread=box('TreadBlock',[.35,.085,.21],m.trim,[0,.48*Math.cos(a),.48*Math.sin(a)],pivot,.014);
   tread.rotation.x=-a;
  }
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4;const bolt=cyl('RimBolt',.017,.015,m.sand,[side*.181,.125*Math.cos(a),.125*Math.sin(a)],pivot,'x',8);
   bolt.rotation.x=a;
  }
  wheels.push(pivot);
 }
 // The independently yawing heavy MG is mounted above the four-passenger cab.
 const turret=group('RoverMG_Turret',[0,2.19,-.27]);
 cyl('BearingRing',.36,.085,m.dark,[0,0,0],turret);
 cyl('RotatingPedestal',.20,.21,m.steel,[0,.16,0],turret);
 box('HeavyGunReceiver',[.29,.24,.56],m.dark,[0,.38,.28],turret,.04);
 box('MGAmmoBox',[.26,.25,.30],m.sand,[-.33,.30,.25],turret);
 box('ReceiverTopCover',[.34,.045,.44],m.steel,[0,.53,.27],turret);
 cyl('HeavyMGBarrel',.065,.76,m.steel,[0,.37,.85],turret,'z',14);
 cyl('CoolingJacket',.092,.42,m.dark,[0,.37,.72],turret,'z',18);
 for(let i=0;i<6;i++)cyl('CoolingVent',.094,.021,m.trim,[0,.37,.57+i*.065],turret,'z',12);
 box('MuzzleBrake',[.18,.16,.20],m.dark,[0,.37,1.26],turret,.025);
 box('MGShield',[.94,.51,.09],m.armor,[0,.40,.06],turret,.06);
 box('MGShieldSlit',[.29,.075,.021],m.dark,[0,.55,.117],turret,.005);
 rod('MGRearHandle',[-.14,.35,-.13],[.14,.35,-.13],.025,m.steel,turret);
 const muzzle=new T.Object3D();muzzle.name='RoverMG_Muzzle';muzzle.position.set(0,.37,1.39);turret.add(muzzle);
 // Comms gear and the two clear team variations.
 rod('LongRadioAntenna',[.81,2.10,-1.44],[.88,3.08,-1.54],.014,m.dark);
 cyl('AntennaTip',.030,.035,m.emblem,[.88,3.08,-1.54]);
 box('TeamRoofMarker',[.33,.03,.29],m.emblem,[-.66,2.123,-1.19]);
 model.userData.atlasDesign={kind:'rover',team,seats:4,weapon:'heavy roof mounted machine gun',
  role:'fast reconnaissance and infantry transport',geometry:'Humvee-inspired original armoured 4x4 with embedded 1K PBR camouflage',parts:count,triangles:Math.round(triangles)};
 function animate(tag,phase){
  for(const w of wheels)w.rotation.x=tag==='idle'?0:phase*Math.PI*2;
 }
 animate('idle',0);
 return {model,muzzle,rotor:null,animate};
}
