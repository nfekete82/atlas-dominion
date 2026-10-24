import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Authored material treatment for the existing turret rig. Everything is baked
 * into the 64 registered views; none of this work runs in the game loop. */
export function refineTurret(model,m,team){
 let seed=0x74a51;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const surface=(metal=false)=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');
  c.fillStyle=metal?'#c6c0b2':'#e7dfcd';c.fillRect(0,0,512,512);
  // Fine mineral paint and brushed tool marks, with dirt collecting at seams.
  for(let i=0;i<16000;i++){const v=150+Math.floor(random()*90);c.fillStyle=`rgba(${v},${v-3},${v-9},${.08+random()*.16})`;c.fillRect(random()*512,random()*512,metal?2+random()*17:.5+random()*2,.5+random()*1.2);}
  for(const x of [9,250,502]){
   const shadow=c.createLinearGradient(x-10,0,x+10,0);shadow.addColorStop(0,'#554a3500');shadow.addColorStop(.5,'#51463165');shadow.addColorStop(1,'#ede4d020');c.fillStyle=shadow;c.fillRect(x-10,0,20,512);
   c.fillStyle='#fff1ce65';c.fillRect(x+1,0,1,512);
  }
  for(let i=0;i<170;i++){
   const x=random()*512,y=random()*512,w=1+random()*14;c.strokeStyle=random()<.45?'#65594775':'#fff4d679';c.lineWidth=.45+random()*.7;c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y+random()*3);c.stroke();
  }
  const dust=c.createLinearGradient(0,340,0,512);dust.addColorStop(0,'#9b794100');dust.addColorStop(1,'#9b794148');c.fillStyle=dust;c.fillRect(0,340,512,172);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;return texture;
 };
 const rough=document.createElement('canvas');rough.width=rough.height=256;const rc=rough.getContext('2d');rc.fillStyle='#d8d8d8';rc.fillRect(0,0,256,256);
 for(let i=0;i<4000;i++){const v=145+Math.floor(random()*105);rc.fillStyle=`rgb(${v},${v},${v})`;rc.fillRect(random()*256,random()*256,1+random()*10,1);}
 const roughness=new T.CanvasTexture(rough);roughness.colorSpace=T.NoColorSpace;
 m.sand.map=surface();m.sand.roughnessMap=roughness;m.sand.roughness=.82;m.sand.metalness=.18;
 m.edge.map=surface(true);m.edge.roughnessMap=roughness;m.edge.color.set('#8a7452');m.edge.metalness=.72;m.edge.roughness=.53;
 m.dark.map=surface(true);m.dark.color.set('#303d46');m.dark.roughness=.62;m.dark.metalness=.7;
 m.team.map=surface();m.team.roughnessMap=roughness;m.team.roughness=.59;
 const brass=new T.MeshStandardMaterial({name:'Atlas turret | Brushed champagne trim',color:'#b69b6e',metalness:.73,roughness:.48,map:m.edge.map,roughnessMap:roughness});
 const recess=new T.MeshStandardMaterial({name:'Atlas turret | Machined graphite recess',color:'#18242b',metalness:.58,roughness:.66});
 const head=model.getObjectByName('TurretHead');let parts=0,triangles=0;
 const plate=(name,size,material,at,parent=head,r=.008)=>{
  const geometry=new RoundedBoxGeometry(...size,2,Math.min(r,...size.map(v=>v*.22))),mesh=new T.Mesh(geometry,material);mesh.name='AtlasRefinedTurret_'+name+'_'+parts++;mesh.position.set(...at);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;return mesh;
 };
 model.traverse(n=>{if(n.isMesh&&n.name.includes('FactionWeaponArmour'))n.material=m.sand;});
 for(const x of [-.36,.36]){
  plate('EnamelInlay',[.13,.018,.48],m.team,[x,.326,.015]);
  for(const dx of [-.085,.085])plate('InlayBeading',[.014,.022,.56],brass,[x+dx,.331,.015]);
  for(const z of [-.23,.25])plate('EndCap',[.17,.018,.023],brass,[x,.336,z]);
  plate('SideAccess',[.026,.18,.37],recess,[Math.sign(x)*.506,.08,-.015]);
  for(let i=0;i<4;i++)plate('CoolingSlat',[.036,.012,.28],brass,[Math.sign(x)*.522,.025+i*.034,-.015]);
  plate('ArmourSkirt',[.20,.035,.73],brass,[x,-.09,-.005]);
 }
 for(const x of [-.16,.16])plate('CrownRail',[.016,.022,.60],brass,[x,.36,-.035]);
 for(const z of [-.27,.15])plate('CrownSeam',[.28,.012,.014],recess,[0,.356,z]);
 plate('RearHeatShield',[.55,.20,.036],recess,[0,.02,-.449]);
 for(let i=0;i<7;i++)plate('RearFin',[.025,.16,.055],brass,[-.225+i*.075,.025,-.47]);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,g=new T.Group();g.position.set(Math.sin(a)*.475,.49,Math.cos(a)*.475);g.rotation.y=a;model.add(g);
  plate('FoundationStrap',[.06,.35,.035],brass,[0,0,0],g);
  plate('StrapFastener',[.028,.028,.012],m.dark,[0,.10,.022],g,.003);
 }
 return {parts,triangles:Math.round(triangles)};
}
