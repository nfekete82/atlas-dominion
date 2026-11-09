import * as THREE from 'three';

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
   emissive:owner===0?'#2d95c4':'#e96436',emissiveIntensity:.74,metalness:.25,roughness:.4})
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
 if(kind==='research'){
  foundation(175,142);
  box(144,48,106,'base',0,36,0);
  box(158,7,118,'metal',0,62,0);
  for(const x of [-57,-19,19,57])for(const z of [-54,54]){
   box(21,24,3,'panel',x,36,z);
   box(14,5,3.5,'glow',x,43,z+Math.sign(z)*.4);
  }
  for(const [x,z] of [[-59,-35],[59,-35],[-59,35],[59,35]]){
   cyl(10,14,13,'metal',x,68,z);
   box(17,5,17,'glow',x,76,z);
  }
  cyl(26,33,32,'panel',0,79,-1);
  cyl(34,29,5,'metal',0,97,-1);
  const dish=add(new THREE.CylinderGeometry(28,17,6,18),mats.stone,0,112,-1,.37,0,0);
  dish.name='Research_Radar';
  cyl(3,3,29,'metal',0,126,-1);
  cyl(8,8,5,'glow',0,143,-1);
 }else if(kind==='silo'){
  foundation(234,210);
  box(205,24,184,'base',0,25,0);
  for(const x of [-86,86])for(const z of [-66,66]){
   box(29,46,36,'stone',x,53,z);
   box(22,9,23,'panel',x,80,z);
  }
  cyl(72,78,23,'metal',0,52,0,16);
  cyl(61,65,7,'black',0,67,0,20);
  cyl(54,57,6,'panel',0,74,0,20);
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4;
   box(9,14,19,'metal',Math.cos(a)*68,68,Math.sin(a)*68);
  }
  // Large upright launch canister and two-part blast hatch.
  cyl(19,22,92,'metal',0,121,0,18);
  cyl(19,23,14,'panel',0,176,0,18);
  cyl(6,20,26,'stone',0,196,0,16);
  for(const x of [-39,39]){
   box(27,5,75,'panel',x,76,0);
   box(14,6,52,'glow',x,82,0);
  }
  for(const x of [-92,92])for(const z of [-47,47]){
   cyl(3,5,36,'metal',x,70,z);
   cyl(5,5,4,'glow',x,91,z);
  }
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
 return root;
}
