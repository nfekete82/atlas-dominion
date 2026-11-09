import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Zero-Hour-style recognizable strategic structures. Procedural originals,
 * avoiding missing GLB placeholders. Created ONCE per building, NOT per frame.
 * Geometry and material lifetime belongs to the existing fallback disposal.
 */
/** A single shared, deterministic sandstone/paint grain provides subtle PBR
 * surface detail instead of the old flat-color primitives. The same texture is
 * used for world models and their 3D roster snapshots; no external asset fetch.
 * Kept for the lifetime of the WebGL module (material disposal doesn't own it).
 */
const materialGrain=(()=>{
 const width=128,height=128,rgba=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const hash=Math.imul(x+117,374761393)^Math.imul(y+61,668265263);
  const fine=((hash^(hash>>>13))&31)-15;
  const broad=5*Math.sin(x*.17+y*.09)+5*Math.cos(y*.11-x*.07);
  const tone=Math.max(204,Math.min(254,237+fine*.54+broad));
  const index=(y*width+x)*4;
  rgba[index]=tone;rgba[index+1]=tone-2;rgba[index+2]=tone-4;rgba[index+3]=255;
 }
 const texture=new THREE.DataTexture(rgba,width,height,THREE.RGBAFormat);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.repeat.set(2,2);
 texture.magFilter=THREE.LinearFilter;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;
 texture.needsUpdate=true;
 return texture;
})();

export const STRATEGIC_BUILDING_KINDS=Object.freeze(['research','silo','interceptor']);
export const isStrategicBuilding=kind=>STRATEGIC_BUILDING_KINDS.includes(kind);
export function createStrategicBuilding(kind,owner=0){
 if(!isStrategicBuilding(kind))return null;
 const root=new THREE.Group();
 root.name='Strategic_'+kind;
 root.userData.visualOnly=true;
 const faction=owner===0?'#487488':'#91594b';
 const mats={
  base:new THREE.MeshStandardMaterial({color:'#968b73',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.32,roughness:.84,metalness:.11}),
  panel:new THREE.MeshStandardMaterial({color:faction,map:materialGrain,
   bumpMap:materialGrain,bumpScale:.14,roughness:.56,metalness:.39}),
  metal:new THREE.MeshStandardMaterial({color:'#626b69',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.09,roughness:.48,metalness:.57}),
  stone:new THREE.MeshStandardMaterial({color:'#c0ab89',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.48,roughness:.91,metalness:.02}),
  black:new THREE.MeshStandardMaterial({color:'#252b29',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.07,roughness:.68,metalness:.38}),
  glow:new THREE.MeshStandardMaterial({color:owner===0?'#63b9de':'#ffab79',
   emissive:owner===0?'#2d95c4':'#e96436',emissiveIntensity:.74,metalness:.25,roughness:.4}),
  trim:new THREE.MeshStandardMaterial({color:'#c2ac84',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.12,roughness:.62,metalness:.36}),
  vent:new THREE.MeshStandardMaterial({color:'#343c3b',roughness:.77,metalness:.35}),
  glass:new THREE.MeshStandardMaterial({color:owner===0?'#33677c':'#844e43',
   emissive:owner===0?'#184c64':'#61352d',emissiveIntensity:.4,metalness:.26,roughness:.34})
 };
 function add(geometry,material,x,y,z,rx=0,ry=0,rz=0){
  const mesh=new THREE.Mesh(geometry,typeof material==='string'?mats[material]??mats.metal:material);
  mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,rz);
  mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  return mesh;
 }
 const box=(w,h,d,m,x,y,z)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z);
 const cyl=(top,bottom,h,m,x,y,z,n=12)=>add(new THREE.CylinderGeometry(top,bottom,h,n),m,x,y,z);
 const foundation=(w,d)=>{
  box(w,8,d,'black',0,4,0);
  box(w*.91,5,d*.90,'stone',0,10,0);
 };
 // All new strategic structures share the authored HQ's sand-concrete base,
 // heavy metal roof, corner buttresses, dark gaskets, blue service glass,
 // industrial roof equipment and small mechanically believable details.
 const support=(x,z,height=68)=>{
  box(13,height,13,'metal',x,height/2+11,z);
  box(16,4,16,'trim',x,height+10,z);
  box(10,2,10,'black',x,height+13,z);
 };
 const grille=(x,y,z,w=20)=>{
  box(w,17,2.5,'vent',x,y,z);
  for(let i=0;i<5;i++)box(w-3,.85,2.8,'trim',x,y-6+i*3,z+.3);
 };
 if(kind==='research'){
  foundation(178,149);
  box(159,60,124,'base',0,43,0);
  box(164,5,130,'metal',0,15,0);
  box(170,9,136,'black',0,77,0);
  box(159,2,129,'trim',0,82,0);
  // Heavy sidewalls and distinct structural columns like the original HQ.
  for(const x of [-72,72])for(const z of [-55,55])support(x,z,65);
  for(const z of [-50,0,50]){
   box(5,50,8,'metal',-82,42,z);
   box(5,50,8,'metal',82,42,z);
  }
  // The facade is not a blank box: entrance, framed windows and shutters.
  box(41,49,5,'black',0,42,65);
  box(34,42,5.8,'metal',0,40,68);
  box(27,30,6,'vent',0,39,71);
  for(let i=0;i<6;i++)box(28,2.4,6.2,'steel',0,25+i*5.1,72);
  for(const x of [-53,53]){
   box(37,28,4,'metal',x,48,65);
   box(31,20,4.4,'glass',x,48,67.4);
   box(34,3,5,'trim',x,60,68);
   box(3.2,24,5,'black',x,48,69);
   box(37,3,5,'black',x,35,68);
   for(let i=0;i<3;i++)box(8,2.3,4,'steel',x-12+i*12,32,67);
  }
  for(const x of [-52,0,52]){
   box(30,20,4,'vent',x,45,-64);
   for(let j=0;j<5;j++)box(27,1.7,5,'trim',x,38+j*3.6,-66);
  }
  // Louver and edge framing exposes the same crafted metalwork as the factory.
  for(const x of [-71,71])for(const z of [-42,0,42]){
   box(3.5,26,6,'trim',x,49,z);
  }
  box(168,3,135,'trim',0,73,0);
  for(const x of [-63,-42,-21,0,21,42,63]){
   box(1.7,3,132,'metal',x,82,0);
  }
  // Central instrument room; its stepped roof replaces the old flat roof.
  box(70,22,69,'metal',-21,96,-11);
  box(66,17,65,'panel',-21,97,-11);
  box(76,5,75,'black',-21,109,-11);
  box(73,2,72,'trim',-21,112,-11);
  for(const x of [-45,-22,1]){
   box(17,9,3,'glass',x,101,24);
   box(18,2,4,'trim',x,106,25);
  }
  // Large convincing parabolic dish, mast and signal instrument pods.
  cyl(8,11,20,'metal',-21,121,-12);
  cyl(18,22,6,'black',-21,135,-12,20);
  const dish=add(new THREE.SphereGeometry(29,28,14,0,Math.PI*2,0,Math.PI*.43),
   'stone',-21,146,-11,-.54);
  dish.name='Research_Radar';
  add(new THREE.TorusGeometry(27,2,12,32),'trim',-21,157,3,-.54);
  const arm=add(new THREE.CylinderGeometry(2.1,2.1,31,10),'metal',-21,161,1,.47);
  arm.name='Research_ReceiverArm';
  cyl(6,7,5,'glow',-21,172,12,12);
  // An identifiable roof HVAC bank, shielded server stacks, cabling and ducts.
  for(const z of [-30,-5,20]){
   box(26,14,18,'metal',43,91,z);
   grille(43,94,z+9.9,21);
   box(28,2,20,'trim',43,99,z);
  }
  for(const x of [18,60]){
   cyl(4.5,4.5,40,'metal',x,107,-52);
   cyl(6,6,3,'glow',x,128,-52);
  }
  box(30,3,52,'black',40,83,-5);
  for(let i=0;i<5;i++)box(3,3.2,52,'trim',26+i*7,86,-5);
  for(const x of [-73,73])for(const z of [-55,55]){
   cyl(3,4,8,'black',x,85,z);
   cyl(4,4,2,'glow',x,89.5,z);
  }
 }else if(kind==='silo'){
  foundation(230,207);
  box(205,43,184,'base',0,37,0);
  box(222,5,195,'black',0,15,0);
  for(const x of [-100,100])for(const z of [-83,83])support(x,z,45);
  // Heavy ring assembly and the large, obvious open rocket bay.
  cyl(74,83,24,'metal',-17,64,0,24);
  cyl(64,69,7,'black',-17,80,0,26);
  cyl(57,61,5,'steel',-17,87,0,24);
  add(new THREE.TorusGeometry(70,3,12,36),'trim',-17,86,0,-Math.PI/2);
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6;
   box(10,22,12,'black',-17+Math.cos(a)*76,80,Math.sin(a)*76,0,-a);
   box(8,3,9,'trim',-17+Math.cos(a)*77,92,Math.sin(a)*77,0,-a);
  }
  // Full-size missile with pressure vessel, aerodynamic ogive and clamps.
  cyl(20,22,80,'armor',-17,130,0,24);
  cyl(21,21,10,'panel',-17,151,0,24);
  cyl(22,22,7,'metal',-17,102,0,24);
  cyl(21,21,5,'black',-17,179,0,24);
  add(new THREE.ConeGeometry(21,35,24),'stone',-17,200,0);
  cyl(5,5,6,'trim',-17,221,0,16);
  for(const y of [112,160,176]){
   add(new THREE.TorusGeometry(21,2.1,10,32),'trim',-17,y,0,-Math.PI/2);
  }
  for(const x of [-1,1])for(const z of [-1,1]){
   box(6,8,21,'steel',-17+x*21,116,z*10,0,0,z*.18);
  }
  // Distinct service block: matching HQ windows, roof and shaded entrance.
  box(67,46,81,'base',74,42,-2);
  box(76,5,90,'metal',74,67,-2);
  box(81,8,95,'black',74,73,-2);
  box(77,2,92,'trim',74,77,-2);
  for(const z of [-27,-4,19]){
   box(4,22,3,'panel',109,46,z);
   box(3.2,13,15,'glass',109,46,z+7.6);
   box(4,2,16,'trim',110,55,z+7.6);
  }
  box(27,30,5,'black',74,39,41);
  box(22,24,5.4,'metal',74,39,44);
  for(let i=0;i<4;i++)box(23,1.8,5.6,'trim',74,31+i*5,46);
  // Retractable hatch rails, protected pipe gallery, and engineering braces.
  for(const x of [-67,33]){
   box(9,9,110,'metal',x,87,0);
   box(7,3,113,'trim',x,93,0);
   for(const z of [-43,-21,0,21,43])box(8,3,2,'black',x,96,z);
  }
  for(const z of [-78,78]){
   box(115,6,8,'metal',-17,91,z);
   for(let i=0;i<6;i++)box(3.8,5,9,'trim',-62+i*18,95,z);
  }
  for(const x of [-90,-75,72,88]){
   cyl(4,5,38,'metal',x,94,72,12);
   cyl(6,6,4,'glow',x,115,72);
  }
  // Small service vents and fueling junctions along the industrial annex.
  for(const x of [55,72,89]){
   box(13,7,16,'vent',x,81,-13);
   for(let i=0;i<3;i++)box(11,1.1,14,'steel',x,78+i*3,-13);
  }
  for(const x of [-93,97])box(8,4,25,'panel',x,18,0);
  for(const z of [-63,0,63])box(9,4,18,'trim',-101,17,z);
 }else{
  foundation(170,150);
  box(142,35,127,'base',0,32,0);
  box(153,5,136,'metal',0,52,0);
  for(const x of [-42,42]){
   box(45,22,85,'panel',x,68,0);
   for(const z of [-28,0,28]){
    const tube=add(new THREE.CylinderGeometry(11,11,49,12),mats.metal,
     x,85,z,.68,0,0);
    tube.name='Interceptor_Tube';
    const cap=add(new THREE.ConeGeometry(10,16,12),mats.stone,
     x,119,z,.68,0,0);
    cap.name='Interceptor_Rocket';
   }
  }
  cyl(6,8,67,'metal',0,91,-49,12);
  const radar=add(new THREE.CylinderGeometry(31,15,8,22),mats.panel,
   0,131,-47,.33,0,0);
  radar.name='Interceptor_Radar';
  cyl(5,5,11,'glow',0,145,-47);
  for(const x of [-67,67])for(const z of [-55,55])
   box(10,11,10,'glow',x,66,z);
 }
 return batchStaticParts(root,kind);
}

/** Static roof details, window ribs and facade panels are aggressively merged
 * by PBR material after placement, so the more detailed facilities do not
 * cost hundreds of WebGL draw calls. Named mechanical/animation parts remain
 * individually addressable. If a geometry cannot be combined, retain it.
 */
function batchStaticParts(root,kind){
 const groups=new Map();
 for(const mesh of [...root.children]){
  if(!mesh.isMesh||mesh.name)continue;
  const items=groups.get(mesh.material)??[];
  items.push(mesh);
  groups.set(mesh.material,items);
 }
 let batch=0;
 for(const [material,items] of groups){
  if(items.length<2)continue;
  const geometries=items.map(mesh=>{
   mesh.updateMatrix();
   const geometry=mesh.geometry.clone();
   geometry.applyMatrix4(mesh.matrix);
   return geometry;
  });
  let merged=null;
  try{merged=mergeGeometries(geometries,false);}
  catch(error){console.warn('Strategic static mesh batch fallback',kind,error);}
  finally{for(const geometry of geometries)geometry.dispose();}
  if(!merged)continue;
  const combined=new THREE.Mesh(merged,material);
  combined.name='SF_StaticBatch_'+kind+'_'+batch++;
  combined.castShadow=true;combined.receiveShadow=true;
  for(const mesh of items){
   root.remove(mesh);
   mesh.geometry.dispose();
  }
  root.add(combined);
 }
 return root;
}
