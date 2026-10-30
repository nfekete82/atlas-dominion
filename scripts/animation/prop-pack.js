/** Sandforge Prop Pack V1. Original, reproducible mesh authoring; no billboards. */
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mapSurfaceUV} from './building-pbr.js';

import {applyPropPBR} from './prop-pbr.js';

export const PROP_KINDS=['military-crate','military-crate-stack','service-lamp','service-terminal','fuel-barrels','sandbags','desert-skull','palm-tree'];
export function buildProp(kind){
 if(!PROP_KINDS.includes(kind))throw Error('Unknown prop '+kind);
 const model=new T.Group();model.name='Sandforge_'+kind;
 const pool=new Map();
 function material(role){
  if(!pool.has(role))pool.set(role,new T.MeshStandardMaterial({name:role,side:role==='leaf'||role==='dry'?T.DoubleSide:T.FrontSide}));
  return pool.get(role);
 }
 function mesh(name,geometry,role,at=[0,0,0],parent=model){
  const n=new T.Mesh(['bone','bark','leaf','dry','cloth','light'].includes(role)?geometry:mapSurfaceUV(geometry,role),material(role));n.name=name;n.userData.propSurface=role;n.position.set(...at);n.castShadow=n.receiveShadow=true;parent.add(n);return n;
 }
 const box=(name,size,role,at,parent=model,r=.018)=>mesh(name,new RoundedBoxGeometry(...size,3,Math.min(r,...size.map(v=>v*.2))),role,at,parent);
 const cyl=(name,r1,r2,height,role,at,parent=model)=>mesh(name,new T.CylinderGeometry(r1,r2,height,24),role,at,parent);
 const ellipsoid=(name,scale,role,at,parent=model)=>{const n=mesh(name,new T.SphereGeometry(1,28,18),role,at,parent);n.scale.set(...scale);return n;};
 function tube(name,points,r,role,parent=model){return mesh(name,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),24,r,7,false),role,[0,0,0],parent);}
 const bolt=(at,parent)=>cyl('Hex anchor bolt',.016,.016,.018,'steel',at,parent);
 function crate(at=[0,0,0],angle=0,scale=1){
  const g=new T.Group();g.position.set(...at);g.rotation.y=angle;g.scale.setScalar(scale);model.add(g);
  box('Recessed armored case',[.80,.43,.52],'sand',[0,.25,0],g,.045);
  box('Lid rubber gasket',[.82,.025,.54],'rubber',[0,.439,0],g,.008);
  box('Beveled overlapping lid',[.84,.075,.56],'sand',[0,.487,0],g,.035);
  for(const x of [-.28,.28]){
   box('Steel wrap band',[.045,.43,.535],'steel',[x,.25,0],g,.008);
   box('Lid wrap',[.048,.082,.57],'steel',[x,.488,0],g,.008);
   for(const z of [-.275,.275]){
    box('Latch foot',[.064,.085,.025],'steel',[x,.40,z],g,.006);
    box('Latch lever',[.027,.055,.032],'sand',[x,.408,z*1.03],g,.005);
   }
   for(const z of [-.20,.20])box('Impact corner',[.10,.095,.10],'steel',[x*1.21,.10,z],g);
  }
  box('Handle recess',[.23,.10,.015],'rubber',[0,.28,.269],g);
  tube('Recessed carrying handle',[[-.085,.28,.286],[-.085,.31,.31],[.085,.31,.31],[.085,.28,.286]],.014,'steel',g);
  box('Inventory plate',[.105,.063,.012],'neutral',[.10,.16,.274],g,.003);
  for(let i=0;i<4;i++)box('Stamped serial',[.008,.032,.014],'steel',[.066+i*.021,.16,.28],g,.001);
  for(const x of [-.37,.37])for(const z of [-.21,.21])bolt([x,.535,z],g);
 }
 if(kind==='military-crate')crate();
 if(kind==='military-crate-stack'){
  for(const x of [-.52,.52])box('Pallet bearer',[.12,.09,1.05],'steel',[x,.045,0]);
  for(let i=0;i<5;i++)box('Dusty pallet slat',[1.18,.055,.16],'sand',[0,.11,-.41+i*.20]);
  crate([-.23,.14,.10],.05,.92);crate([.37,.14,-.08],Math.PI/2,.78);crate([-.21,.65,.08],-.10,.79);
 }
 if(kind==='service-lamp'){
  box('Heavy base flange',[.42,.065,.42],'steel',[0,.033,0],model,.03);
  box('Raised mast socket',[.19,.16,.19],'sand',[0,.13,0]);
  for(const x of [-.15,.15])for(const z of [-.15,.15])bolt([x,.078,z]);
  cyl('Tapered galvanized mast',.037,.061,1.98,'steel',[0,1.10,0]);
  cyl('Lower protective collar',.067,.067,.28,'sand',[0,.34,0]);
  box('Service access panel',[.065,.17,.025],'sand',[0,.70,.047]);
  tube('Bent lamp arm',[[0,2.04,0],[0,2.16,0],[.15,2.20,0],[.40,2.20,0]],.038,'steel');
  box('Cast luminaire housing',[.42,.10,.21],'sand',[.43,2.20,0],model,.04);
  box('Recessed LED diffuser',[.32,.022,.14],'light',[.43,2.143,0]);
  for(let i=0;i<6;i++)box('Cooling fin',[.015,.036,.16],'steel',[.28+i*.055,2.26,0],model,.003);
 }
 if(kind==='service-terminal'){
  box('Concrete footing',[.64,.10,.44],'concrete',[0,.05,0]);
  box('Service enclosure',[.50,.70,.32],'sand',[0,.45,0],model,.04);
  box('Weatherproof top lip',[.58,.065,.39],'steel',[0,.825,0]);
  box('Door gasket',[.43,.58,.025],'rubber',[0,.46,.168]);
  box('Inset hinged door',[.40,.55,.027],'sand',[0,.46,.187]);
  box('Dark status recess',[.27,.12,.018],'rubber',[0,.61,.208]);
  box('Unlit protective glass',[.23,.075,.018],'glass',[0,.615,.222]);
  for(let i=0;i<5;i++)box('Vent louver',[.23,.016,.027],'steel',[-.035,.28+i*.035,.213],model,.003);
  box('Lockable door handle',[.023,.09,.026],'steel',[.15,.44,.218]);
  cyl('Conduit inlet',.035,.035,.15,'rubber',[-.19,.12,-.14]);
  tube('Armored supply conduit',[[-.19,.12,-.14],[-.33,.07,-.23],[-.38,.025,-.28]],.026,'rubber');
 }
 if(kind==='fuel-barrels')for(let i=0;i<2;i++){
  const g=new T.Group();g.position.set(i*.46-.23,0,i*.16-.08);g.rotation.y=i*.5;model.add(g);
  cyl('Pressed fuel drum',.205,.203,.62,i?'sand':'camo',[0,.33,0],g);
  for(const y of [.035,.20,.47,.642])cyl('Rolled reinforcing hoop',.216,.216,.027,'steel',[0,y,0],g);
  cyl('Inset top lid',.194,.194,.016,'sand',[0,.65,0],g);
  cyl('Threaded fill bung',.033,.033,.016,'steel',[.11,.665,.035],g);
  box('Fuel identification plate',[.11,.13,.016],'neutral',[0,.35,.204],g,.002);
  for(let j=0;j<2;j++)box('Label stencil',[.06,.012,.018],'steel',[0,.33+j*.035,.215],g,.001);
 }
 if(kind==='sandbags')for(let row=0;row<2;row++)for(let i=0;i<3-row;i++){
  const g=new T.Group();g.position.set((i-(2-row)/2)*.40,.13+row*.20,row*.04);g.rotation.y=(i%2?1:-1)*.10;model.add(g);
  const n=ellipsoid('Irregular filled hessian sack',[.25,.14,.18],'cloth',[0,0,0],g);
  const p=n.geometry.attributes.position;
  for(let j=0;j<p.count;j++){const x=p.getX(j),y=p.getY(j),z=p.getZ(j);p.setXYZ(j,x*(1+.045*Math.sin(z*17+y*9)),y*(1+.055*Math.cos(x*13)),z);}
  n.geometry.computeVertexNormals();
  tube('Stitched folded seam',[[-.21,.01,.09],[-.12,.025,.15],[.12,.025,.15],[.22,.01,.08]],.006,'dry',g);
  tube('Tied sack end',[[.21,0,0],[.26,.015,0],[.28,-.03,.018]],.016,'cloth',g);
 }
 if(kind==='desert-skull'){
  // Bovid dorsal skull shell with genuine openings; bevelled bone, no painted eyes.
  const s=new T.Shape();s.moveTo(-.25,-.25);s.bezierCurveTo(-.34,-.10,-.29,.19,-.17,.25);s.lineTo(-.10,.62);s.quadraticCurveTo(0,.73,.10,.62);s.lineTo(.17,.25);s.bezierCurveTo(.29,.19,.34,-.10,.25,-.25);s.quadraticCurveTo(0,-.37,-.25,-.25);
  for(const x of [-.19,.19]){const hole=new T.Path();hole.absellipse(x,.07,.070,.10,0,Math.PI*2,false,x<0?-.3:.3);s.holes.push(hole);}
  const nasal=new T.Path();nasal.moveTo(-.046,.43);nasal.lineTo(-.035,.60);nasal.quadraticCurveTo(0,.65,.035,.60);nasal.lineTo(.046,.43);nasal.closePath();s.holes.push(nasal);
  const shell=mesh('Bleached skull shell with orbital and nasal cavities',new T.ExtrudeGeometry(s,{depth:.075,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:.026,bevelThickness:.035,curveSegments:24}),'bone',[0,.16,0]);shell.rotation.x=-Math.PI/2;
  // Low cranium behind the brow; sockets remain open through both surfaces.
  ellipsoid('Occipital cranium',[.21,.12,.17],'bone',[0,.15,.20]);
  for(const sign of [-1,1]){
   tube('Zygomatic arch',[[sign*.12,.12,-.24],[sign*.27,.10,-.16],[sign*.28,.11,.04],[sign*.22,.18,.17]],.026,'bone');
   const points=[];for(let j=0;j<=22;j++){const t=j/22;points.push(new T.Vector3(sign*(.22+t*.40),.19+Math.sin(t*1.7)*.20,.21+t*.11));}
   const curve=new T.CatmullRomCurve3(points),geo=new T.TubeGeometry(curve,30,.075,10,false),p=geo.attributes.position;
   for(let j=0;j<p.count;j++){const t=Math.floor(j/11)/30,center=curve.getPointAt(t);const v=new T.Vector3().fromBufferAttribute(p,j).sub(center).multiplyScalar(1-t*.96).add(center);p.setXYZ(j,v.x,v.y,v.z);}geo.computeVertexNormals();mesh('Weather-eroded tapered horn core',geo,'bone');
   tube('Detached jaw ramus',[[sign*.12,.045,-.50],[sign*.18,.035,-.25],[sign*.23,.06,-.05]],.025,'bone');
   for(let j=0;j<5;j++)box('Worn molar',[.041,.055,.040],'bone',[sign*.135,.074,-.30-j*.045],model,.009);
  }
  tube('Fine cranial suture',[[0,.277,.29],[.008,.275,.20],[-.008,.259,.08],[0,.237,-.12]],.0028,'dry');
  for(let i=0;i<2;i++){
   const x=.38+i*.15,z=-.29-i*.20;
   tube('Scattered dry long bone',[[x,.025,z],[x+.10,.030,z-.04],[x+.21,.025,z-.11]],.021,'bone');
   for(const end of [[x,.027,z],[x+.21,.027,z-.11]])ellipsoid('Weathered bone epiphysis',[.031,.027,.035],'bone',end);
  }
 }
 if(kind==='palm-tree'){
  const trunkCurve=new T.CatmullRomCurve3([new T.Vector3(0,.03,0),new T.Vector3(-.10,1.05,.015),new T.Vector3(.04,2.12,-.02),new T.Vector3(.23,2.94,-.04)]);
  const geo=new T.TubeGeometry(trunkCurve,48,.105,14,false),pos=geo.attributes.position;
  for(let j=0;j<pos.count;j++){const t=Math.floor(j/15)/48,c=trunkCurve.getPointAt(t),v=new T.Vector3().fromBufferAttribute(pos,j).sub(c).multiplyScalar(1.25-t*.48).add(c);pos.setXYZ(j,v.x,v.y,v.z);}geo.computeVertexNormals();mesh('Naturally curved date palm trunk',geo,'bark');
  for(let i=0;i<40;i++){
   const t=(i+.5)/41,p=trunkCurve.getPointAt(t),tangent=trunkCurve.getTangentAt(t);
   const ring=mesh('Persistent leaf-base scar',new T.TorusGeometry(.105*(1.25-t*.48),.011,5,14),'dry',p.toArray());ring.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),tangent);ring.scale.set(1,1,.65);
  }
  ellipsoid('Crownshaft leaf bases',[.16,.25,.15],'bark',[.23,2.84,-.04]);
  // Individual curved pinnae are actual double-sided, UV-mapped meshes. A
  // shallow ridge down each blade catches the same desert sunlight as armor.
  for(let f=0;f<20;f++){
   const angle=f*2.39996,length=1.13+(f%4)*.13,up=f<5?.56:f<15?.27:-.08,dry=f>=17;
   const root=new T.Vector3(.23,2.94,-.04),radial=new T.Vector3(Math.cos(angle),0,Math.sin(angle)),side=new T.Vector3(-Math.sin(angle),0,Math.cos(angle));
   const center=t=>root.clone().addScaledVector(radial,t*length).add(new T.Vector3(0,Math.sin(t*Math.PI*.78)*up-t*t*(dry?.88:.55),0));
   tube('Arched frond rachis',Array.from({length:9},(_,i)=>center(i/8).toArray()),.009,dry?'dry':'leaf');
   const vertices=[],uvs=[];
   for(let k=1;k<=25;k++)for(const sign of [-1,1]){
    const t=k/27,start=center(t),leafLength=(.10+.30*Math.sin(Math.PI*t))*(dry?.85:1),dir=side.clone().multiplyScalar(sign).addScaledVector(radial,.48).normalize();
    const point=(u,v)=>start.clone().addScaledVector(dir,leafLength*u).addScaledVector(radial,v*.020*Math.sin(Math.PI*u)).add(new T.Vector3(0,.027*Math.sin(Math.PI*u)-.10*u*u,0));
    for(let seg=0;seg<4;seg++){
     const a=seg/4,b=(seg+1)/4;
     for(const half of [-1,1]){
      const ps=[point(a,0),point(b,0),point(b,half),point(a,0),point(b,half),point(a,half)];
      for(let j=0;j<6;j++){vertices.push(...ps[j].toArray());uvs.push(j===0||j===3||j===5?a:b,j===2||j===4||j===5?half*.45+.5:.5);}
     }
    }
   }
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.computeVertexNormals();mesh('Individually folded pinnate leaflets '+f,g,dry?'dry':'leaf');
  }
  for(let i=0;i<7;i++){const a=i*2.4;ellipsoid('Dusty fibrous root flare',[.045,.055,.17],'bark',[Math.cos(a)*.07,.025,Math.sin(a)*.08]).rotation.y=-a;}
 }
 let triangles=0,parts=0;model.traverse(n=>{if(n.isMesh){triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;parts++;}});
 model.userData.propPack={version:1,kind,parts,triangles,visualOnly:true,style:'Sandforge desert / CARC sand / worn steel / bleached bone / date palm',embeddedPBR:true};
 return applyPropPBR(model,kind);
}
