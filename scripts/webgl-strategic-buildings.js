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
 const researchCamo=kind==='research';
 const mats={
  base:new THREE.MeshStandardMaterial({color:researchCamo?'#bba882':'#968b73',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.32,roughness:.84,metalness:.11}),
  panel:new THREE.MeshStandardMaterial({color:researchCamo?'#999477':faction,map:materialGrain,
   bumpMap:materialGrain,bumpScale:.14,roughness:.56,metalness:.39}),
  metal:new THREE.MeshStandardMaterial({color:researchCamo?'#766f5b':'#626b69',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.09,roughness:.48,metalness:.57}),
  stone:new THREE.MeshStandardMaterial({color:researchCamo?'#d5c297':'#c0ab89',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.48,roughness:.91,metalness:.02}),
  black:new THREE.MeshStandardMaterial({color:researchCamo?'#585345':'#252b29',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.07,roughness:.68,metalness:.38}),
  glow:new THREE.MeshStandardMaterial({color:owner===0?'#63b9de':'#ffab79',
   emissive:owner===0?'#2d95c4':'#e96436',emissiveIntensity:.74,metalness:.25,roughness:.4}),
  trim:new THREE.MeshStandardMaterial({color:researchCamo?'#d3bd91':'#c2ac84',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.12,roughness:.62,metalness:.36}),
  vent:new THREE.MeshStandardMaterial({color:researchCamo?'#505249':'#343c3b',roughness:.77,metalness:.35}),
  glass:new THREE.MeshStandardMaterial({color:owner===0?'#33677c':'#844e43',
   emissive:owner===0?'#184c64':'#61352d',emissiveIntensity:.4,metalness:.26,roughness:.34})
 };
 // Only the research lab receives the warm desert camouflage palette.
 // Silo and interceptor keep their established materials and faction colors.
 if(researchCamo){
  mats.steel=new THREE.MeshStandardMaterial({color:'#aaa082',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.12,roughness:.75,metalness:.18});
  mats.camoOlive=new THREE.MeshStandardMaterial({color:'#7f846b',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.14,roughness:.9,metalness:.04});
  mats.camoSand=new THREE.MeshStandardMaterial({color:'#d1bd93',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.16,roughness:.88,metalness:.05});
 }
 // The silo should be a recognisable armoured launch complex, not a
 // generic box with a lone tower. Both skins share faction ID colours.
 if(kind==='silo'){
  mats.armor=new THREE.MeshStandardMaterial({color:'#b3a581',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.23,roughness:.72,metalness:.22});
  mats.steel=new THREE.MeshStandardMaterial({color:'#8d8770',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.1,roughness:.6,metalness:.4});
  mats.warning=new THREE.MeshStandardMaterial({color:'#cda956',roughness:.62,metalness:.18});
  mats.rocketBody=new THREE.MeshStandardMaterial({color:'#787b66',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.09,roughness:.71,metalness:.25});
  mats.rocketPanel=new THREE.MeshStandardMaterial({color:'#bab497',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.08,roughness:.66,metalness:.27});
  mats.rocketNose=new THREE.MeshStandardMaterial({color:'#363e3c',roughness:.51,metalness:.44});
  mats.rocketAccent=new THREE.MeshStandardMaterial({color:'#b38a4e',roughness:.66,metalness:.2});
 }
 // Names allow one shared camouflage pass while leaving service glass,
 // signal beacons and recessed dark vents in their original PBR material.
 for(const [name,material] of Object.entries(mats))material.name='SF_'+name;
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
  // Purposeful three-tone desert camouflage on large structural surfaces,
  // not on the radar dish, glass, signal beacons or service vents.
  // Thin raised plates stay outside the collision footprint and are batched
  // with the other static PBR details (no per-frame geometry or draw calls).
  for(const side of [-1,1]){
   for(const [z,y,length,height,paint] of [
    [-38,36,21,17,'camoOlive'],
    [-8,56,24,13,'camoSand'],
    [27,39,19,21,'camoOlive']
   ])box(1.2,height,length,paint,side*80.4,y,z);
  }
  for(const [x,width,paint] of [
   [-65,20,'camoOlive'],[-20,27,'camoSand'],
   [28,23,'camoOlive'],[66,15,'camoSand']
  ])box(width,7,1.2,paint,x,66,62.8);
  for(const [x,z,width,depth,paint] of [
   [-62,-41,20,19,'camoOlive'],
   [-64,39,27,16,'camoSand'],
   [58,48,24,16,'camoOlive'],
   [70,-39,14,23,'camoSand']
  ])box(width,1.2,depth,paint,x,84.4,z);
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
  // Reference-inspired field laboratory: raised segmented observation deck,
  // protected data centre, slanted sensor modules and rooftop service rails.
  // Every static piece is merged by material below into a few PBR batches.
  box(47,26,39,'camoSand',-49,29,-38);
  box(50,4,42,'trim',-49,44,-38);
  for(const z of [-54,-38,-22])grille(-73,29,z,22);
  for(const x of [-56,-20,18,55]){
   box(21,4,16,'steel',x,86,43);
   box(18,2.8,13,'camoOlive',x,89,43);
  }
  // Large articulated side array signals scientific purpose at RTS zoom.
  const array=add(new THREE.BoxGeometry(44,3,29),'panel',
   45,108,-11,-.40,0,.08);
  array.name='Research_SensorArray';
  for(const x of [28,42,56,70])box(3.2,7,26,'trim',x,109,-11);
  for(const z of [-47,43]){
   box(68,2.2,2.5,'trim',38,112,z);
   for(const x of [6,40,71])box(2.5,20,2.5,'metal',x,102,z);
  }
  // Exterior pipes and roof access ladder: depth and believable engineering.
  for(const y of [28,37,46,55])box(3,1.7,54,'steel',81,y,-3);
  for(const z of [-47,-12,23]){
   box(5,6,3,'metal',82,56,z);
   box(3.1,3,3,'glow',82,59,z);
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
  // Purpose-built stylized strategic missile, designed to read clearly at
  // RTS camera distance: muted olive lower stage, warm-sand upper shroud,
  // dark faceted ogive, sectional seams, canards and tail fins. It remains
  // *render-only* and static; the authoritative strategic launch is unchanged.
  const rocketX=-17;
  const hull=cyl(22.5,23.5,72,'rocketBody',rocketX,128,0,24);
  hull.name='Silo_RocketBody';
  cyl(21.5,22.5,31,'rocketPanel',rocketX,179,0,24);
  cyl(22,22.5,8,'rocketNose',rocketX,164.5,0,24);
  cyl(18.8,21.5,9,'rocketPanel',rocketX,201,0,24);
  const ogive=add(new THREE.ConeGeometry(18.8,42,24),'rocketNose',
   rocketX,226,0);
  ogive.name='Silo_RocketNose';
  // High-contrast stage boundaries stay visible from a distant zoom.
  for(const [y,radius,width,material] of [
   [94,22.5,3.2,'rocketNose'],[106,23.2,1.6,'rocketAccent'],
   [148,22.6,1.8,'trim'],[162,23.1,2.5,'rocketNose'],
   [194,21.4,2.2,'rocketAccent'],[206,18.8,1.8,'rocketNose']
  ]){
   const seam=add(new THREE.TorusGeometry(radius,width,8,32),
    material,rocketX,y,0,-Math.PI/2);
   if(y===162)seam.name='Silo_RocketStageSeam';
  }
  // Small raised thermal-panel details; intentionally restrained rather
  // than an oversized toy checkerboard or bright candy stripes.
  for(let n=0;n<8;n++){
   const angle=n*Math.PI/4;
   const x=rocketX+Math.cos(angle)*22.8,z=Math.sin(angle)*22.8;
   const p=add(new THREE.BoxGeometry(3,21,1.8),'rocketPanel',
    x,133,z,0,-angle,0);
   p.castShadow=false;
  }
  // Wedge-shaped stabilizing fins, grouped by material and GPU-batched.
  for(let n=0;n<4;n++){
   const angle=n*Math.PI/2;
   const shape=new THREE.Shape();
   shape.moveTo(18,-18);
   shape.lineTo(36,-19);
   shape.lineTo(32,-10);
   shape.lineTo(22,16);
   shape.lineTo(18,16);
   shape.closePath();
   const fin=add(new THREE.ExtrudeGeometry(shape,{
    depth:3,bevelEnabled:false,curveSegments:2
   }),'rocketBody',rocketX,112,0,0,-angle);
   fin.position.z-=1.5;
  }
  // Matching service clamps and a recessed nozzle silhouette.
  cyl(14,18,8,'rocketNose',rocketX,87.5,0,20);
  cyl(12.5,12.5,2,'rocketAccent',rocketX,83,0,20);
  for(const n of [-1,1])for(const side of [-1,1]){
   box(5,12,9,'steel',rocketX+n*23,111,side*7);
   box(8,3,11,'trim',rocketX+n*26,115,side*7);
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
  // Sand-worn maintenance galleries, hatch slide machinery and hazard
  // guides make the giant strategic launch site read like a functional silo.
  for(const z of [-84,84]){
   for(const x of [-80,-53,-26,1,28]){
    box(17,4,19,'armor',x,94,z);
    box(16,1,2,'warning',x,97,z);
   }
  }
  for(const x of [-83,37]){
   box(5,23,5,'steel',x,106,-61);
   box(11,7,14,'metal',x,120,-61);
   box(8,2,12,'glow',x,125,-61);
  }
  // Two thick retracting bay doors park on both flanks of the open shaft.
  for(const x of [-89,53]){
   box(29,7,117,'armor',x,102,0);
   box(24,2,110,'steel',x,107,0);
   for(const z of [-45,0,45])box(27,3,5,'black',x,110,z);
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
