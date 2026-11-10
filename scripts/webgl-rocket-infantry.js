import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Lightweight authored procedural anti-vehicle / anti-air infantry.
 * Distinct visible shoulder launcher, goggles, webbing, boots and three-tone
 * desert camouflage. Static geometry is batched by PBR material so each
 * fighter costs ~7 draw calls instead of >30. +Z is the muzzle direction.
 */
const camoTexture=(()=>{
 const w=96,h=96,a=new Uint8Array(w*h*4);
 const palette=[[180,168,129],[133,140,108],[106,101,79],[211,190,146]];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const hx=(x>>3),hy=(y>>3);
  const n=((Math.imul(hx+31,73856093)^Math.imul(hy+19,19349663))>>>0);
  const p=palette[(n>>>5)%palette.length],grain=(n&7)-3;
  const i=(y*w+x)*4;
  a[i]=p[0]+grain;a[i+1]=p[1]+grain;a[i+2]=p[2]+grain;a[i+3]=255;
 }
 const tex=new THREE.DataTexture(a,w,h,THREE.RGBAFormat);
 tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;
 tex.generateMipmaps=true;tex.needsUpdate=true;return tex;
})();
export function createRocketInfantry(owner=0){
 const root=new THREE.Group();root.name='RocketInfantry';
 root.userData={visualOnly:true,role:'antiArmorAntiAir',nonPlayable:true};
 const faction=owner===0?'#396f84':'#9d604a';
 const mats={
  uniform:new THREE.MeshStandardMaterial({color:'#ffffff',map:camoTexture,roughness:.96,metalness:.015}),
  vest:new THREE.MeshStandardMaterial({color:'#9f9976',roughness:.88,metalness:.035}),
  trim:new THREE.MeshStandardMaterial({color:faction,roughness:.78,metalness:.12}),
  tube:new THREE.MeshStandardMaterial({color:'#464b42',roughness:.61,metalness:.37}),
  dark:new THREE.MeshStandardMaterial({color:'#282c28',roughness:.77,metalness:.14}),
  glass:new THREE.MeshStandardMaterial({color:'#4b6968',roughness:.3,metalness:.45}),
  skin:new THREE.MeshStandardMaterial({color:'#b58e71',roughness:.9,metalness:0}),
  warhead:new THREE.MeshStandardMaterial({color:'#c1b186',roughness:.64,metalness:.23})
 };
 for(const [name,m] of Object.entries(mats))m.name='RocketInfantry_'+name;
 const add=(geo,material,x,y,z,rx=0,ry=0,rz=0)=>{
  const m=new THREE.Mesh(geo,mats[material]);m.position.set(x,y,z);
  m.rotation.set(rx,ry,rz);m.castShadow=true;m.receiveShadow=true;
  root.add(m);return m;
 };
 const box=(w,h,d,mat,x,y,z,rx=0,ry=0,rz=0)=>
  add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,rx,ry,rz);
 const cyl=(r0,r1,h,mat,x,y,z,rx=0,ry=0,rz=0)=>
  add(new THREE.CylinderGeometry(r0,r1,h,10),mat,x,y,z,rx,ry,rz);
 // Combat boots, jointed camouflaged trousers and kneepads.
 for(const x of [-4.8,4.8]){
  box(6.3,4.6,10,'dark',x,2.5,2.8);
  box(6,15,6.8,'uniform',x,11,0);
  box(6.5,4.2,6.9,'vest',x,18.5,1);
  box(6.7,3.8,7.3,'dark',x,15,2.3);
 }
 box(17.5,18,10,'uniform',0,29,-.8);
 box(20,15,12,'vest',0,30,1);
 // Tactical vest front plates and straps, strong recognisable silhouette.
 box(14,10,1.8,'trim',0,31,7.7);
 for(const x of [-7,7]){
  box(2.4,20,2,'dark',x,30,5.6);
  box(5.3,7,8,'uniform',x*1.55,29,.5,0,0,x*.035);
  box(4.2,6.3,5,'vest',x*1.55,24,3);
 }
 box(17,11,8,'vest',0,28,-8); // pack and rocket reserve
 box(13,3,11,'dark',0,37,-8);
 for(const x of [-5,5])box(5,8,4.4,'vest',x,27,-14);
 box(17,3.5,10.5,'dark',0,22,0);
 for(const x of [-6.2,0,6.2])box(4.7,7,4.4,'vest',x,21,6.3);
 // Head, camouflage helmet, face protection and blue/red identification.
 cyl(5.2,5.2,6.5,'skin',0,43,0);
 add(new THREE.SphereGeometry(7.3,12,8),'uniform',0,49,0);
 box(14,2.9,12,'vest',0,49.5,0);
 box(12.5,3.8,2.3,'dark',0,45.5,5.2);
 for(const x of [-3,3])box(5.4,3.2,1,'glass',x,45.4,6.5);
 box(5,2.4,1.8,'trim',0,52.9,0);
 // Large shoulder-mounted rocket launcher, visibly distinct at RTS zoom.
 // Tube axis is the unit's local +Z direction; muzzle socket is named for VFX.
 cyl(4.9,5.1,36,'tube',7.8,38.7,7.3,Math.PI/2);
 cyl(6.2,6.2,3.2,'warhead',7.8,38.7,26.5,Math.PI/2);
 cyl(5.5,5.5,3,'dark',7.8,38.7,-12,Math.PI/2);
 cyl(3.2,3.2,4,'warhead',7.8,38.7,30,Math.PI/2);
 box(6.5,3,5,'trim',7.8,34,8);
 box(4.5,13,3.5,'dark',7.8,29,12);
 box(7,2,3,'glass',7.8,44,18);
 // The soldier actually braces and holds the launcher.
 box(5,13,5,'uniform',13.5,31,6,0,0,-.16);
 box(5,5.5,5,'dark',12.2,34,12);
 box(5,12,5,'uniform',-12,30,1,0,0,.2);
 box(5,5.7,5,'dark',-12,23,4);
 const muzzle=new THREE.Object3D();
 muzzle.name='RocketMuzzle_0';muzzle.position.set(7.8,38.7,31);
 root.add(muzzle);
 // Batch by material; named muzzle survives with no per-frame allocations.
 const batches=new Map();
 for(const m of [...root.children]){
  if(!m.isMesh)continue;
  const list=batches.get(m.material)??[];list.push(m);batches.set(m.material,list);
 }
 for(const [material,items] of batches){
  const geometries=items.map(m=>{
   m.updateMatrix();const geo=m.geometry.clone();
   geo.applyMatrix4(m.matrix);return geo;
  });
  let merged=null;
  try{merged=mergeGeometries(geometries,false);}finally{
   for(const geo of geometries)geo.dispose();
  }
  if(!merged)continue;
  const combined=new THREE.Mesh(merged,material);
  combined.name='RocketInfantryBatch_'+material.name;
  combined.castShadow=true;combined.receiveShadow=true;
  for(const part of items){root.remove(part);part.geometry.dispose();}
  root.add(combined);
 }
 return root;
}


/**
 * Promote the static shoulder gunner to the existing Atlas infantry skeleton.
 * The parent rifle socket is already part of all five authored GLB clips
 * (Idle, Run_Gun, Idle_Shoot, HitReact, Death). Hide only the rifle graphics:
 * keep the wrist socket, grip frames and skeleton completely intact.
 *
 * Geometries use the rig's native metre scale, BEFORE battlefield scaling.
 * +Z remains muzzle-forward. The projectile socket follows the animation.
 */
export function attachRocketLauncherToInfantry(model,owner=0){
 const rifle=model.getObjectByName('Atlas_Rifle');
 if(!rifle||!model.getObjectByName('Atlas_WeaponSocket'))
  throw new Error('Rocket infantry requires the authored Atlas weapon rig');
 // The GLB must remain alive for SkeletonUtils + AnimationMixer. Never
 // suppress the rifle group itself: its wrist-driven transform is essential.
 rifle.traverse(node=>{if(node.isMesh)node.visible=false;});
 const launcher=new THREE.Group();
 launcher.name='Atlas_ShoulderLauncher';
 // Slightly above the forearms: the tube reads over the shoulder instead
 // of looking like an oversized rifle or a floating vehicle weapon.
 const tubeMat=new THREE.MeshStandardMaterial({
  color:'#4e5349',metalness:.48,roughness:.62
 });
 const oliveMat=new THREE.MeshStandardMaterial({
  color:'#8c9275',metalness:.19,roughness:.83
 });
 const rimMat=new THREE.MeshStandardMaterial({
  color:'#282e2c',metalness:.57,roughness:.48
 });
 const camoMat=new THREE.MeshStandardMaterial({
  color:'#ffffff',map:camoTexture,roughness:.92,metalness:.05
 });
 const make=(geo,material,x,y,z,rx=0)=>{
  const node=new THREE.Mesh(geo,material);
  node.position.set(x,y,z);
  node.rotation.x=rx;
  node.castShadow=true;node.receiveShadow=true;
  launcher.add(node);return node;
 };
 // 1.05 m launcher, correctly sized for the original Atlas soldier.
 make(new THREE.CylinderGeometry(.072,.078,.94,12),tubeMat,
  .025,.145,.13,Math.PI/2);
 make(new THREE.CylinderGeometry(.090,.090,.10,12),rimMat,
  .025,.145,.605,Math.PI/2);
 make(new THREE.CylinderGeometry(.086,.086,.075,12),rimMat,
  .025,.145,-.345,Math.PI/2);
 make(new THREE.CylinderGeometry(.079,.079,.42,12),camoMat,
  .025,.145,.012,Math.PI/2);
 // Angular field optics and sling: camo, steel, dark visor and a shoulder
 // support. Coherent with the other detailed military infantry.
 make(new THREE.BoxGeometry(.15,.072,.18),oliveMat,-.075,.235,.19);
 make(new THREE.BoxGeometry(.11,.046,.10),rimMat,-.075,.282,.20);
 make(new THREE.BoxGeometry(.10,.035,.25),oliveMat,.026,.040,-.03);
 make(new THREE.BoxGeometry(.050,.16,.08),tubeMat,.026,-.075,-.13);
 const muzzle=new THREE.Object3D();
 muzzle.name='RocketMuzzle_0';
 muzzle.position.set(.025,.145,.67);
 launcher.add(muzzle);
 rifle.add(launcher);
 model.userData={...model.userData,animatedRocketInfantry:true,
  launcherUsesAtlasRig:true,role:'antiArmorAntiAir'};
 return model;
}
