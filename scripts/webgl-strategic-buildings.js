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

/** Baked, repeating desert camouflage for the silo's largest concrete
 * surfaces. Unlike tiny colored boxes, this is genuine albedo detail on the
 * bunker walls and armoured hatch doors. A single GPU texture is shared by
 * all silo meshes and the matching 3D construction-card portrait.
 */
const siloDesertCamo=(()=>{
 const n=256,rgba=new Uint8Array(n*n*4);
 const colors=[[205,184,139],[165,153,116],[117,123,91],[187,167,125]];
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=x*Math.PI*2/n,v=y*Math.PI*2/n;
  // Periodic field: irregular organic sand/khaki/olive patches, seamless
  // at the wrap boundary, with subtle dusty micrograin and worn edges.
  const field=.75*Math.sin(2*u+.82*Math.sin(3*v))+
   .61*Math.cos(3*v-.58*Math.sin(2*u))+
   .35*Math.sin(4*u-3*v+.4)+.17*Math.cos(5*v+4*u);
  const band=field>.73?2:field>.08?1:field<-.75?3:0;
  const hash=(Math.imul(x+97,73856093)^Math.imul(y+31,19349663))>>>0;
  const dust=(hash%23)-11,grain=dust*.48;
  const pos=(y*n+x)*4;
  for(let c=0;c<3;c++)rgba[pos+c]=Math.max(0,Math.min(255,
   Math.round(colors[band][c]+grain)));
  rgba[pos+3]=255;
 }
 const t=new THREE.DataTexture(rgba,n,n,THREE.RGBAFormat);
 t.name='Sandforge silo desert khaki olive camouflage';
 t.colorSpace=THREE.SRGBColorSpace;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;
 t.repeat.set(3,3);
 t.magFilter=THREE.LinearFilter;
 t.minFilter=THREE.LinearMipmapLinearFilter;
 t.generateMipmaps=true;
 t.needsUpdate=true;
 return t;
})();

/** Static destructible base wall, rendered once and shared by preview and game. */
function createDefensiveWall(owner){
 const root=new THREE.Group();root.name='Strategic_wall';
 root.userData={visualOnly:true,defensiveWall:true};
 const concrete=new THREE.MeshStandardMaterial({
  color:'#b5a887',roughness:.99,metalness:.01,map:materialGrain,
  bumpMap:materialGrain,bumpScale:.82});
 const camo=new THREE.MeshStandardMaterial({
  color:'#f4efe2',roughness:.96,metalness:.025,map:siloDesertCamo,
  bumpMap:materialGrain,bumpScale:.38});
 const cap=new THREE.MeshStandardMaterial({color:'#777562',roughness:.92,
  metalness:.10,map:materialGrain,bumpMap:materialGrain,bumpScale:.36});
 const stripe=new THREE.MeshStandardMaterial({
  color:owner===0?'#277fbe':'#c65043',roughness:.85,metalness:.05});
 const add=(w,h,d,x,y,z,mat,name)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.name=name;m.castShadow=true;m.receiveShadow=true;
  root.add(m);
 };
 // Three visible concrete blocks, separated by mortar joints. The large
 // facing plates use the real textured khaki/olive camouflage atlas.
 add(110,6.5,30,0,3.25,0,cap,'WallFooting');
 for(const x of [-35,0,35]){
  add(33,34,22,x,24,0,concrete,'WallArmoredPanel');
  add(30,27,1.7,x,25,11.6,camo,'WallCamoStoneFace');
  add(30,27,1.7,x,25,-11.6,camo,'WallCamoStoneRear');
  add(32,5.5,25,x,44,0,cap,'WallCoping');
  add(27,2.1,21,x,48.2,0,stripe,'WallFactionBand');
  // Rough mortar lines and minor chips are static, not GPU particles.
  for(const z of [-12.7,12.7]){
   add(27,.9,1.1,x,22,z,concrete,'WallStoneMortar');
   add(6,2,1.3,x+8,34,z,cap,'WallStoneChip');
  }
 }
 for(const x of [-52,52]){
  add(8,48,27,x,26,0,cap,'WallPillar');
  add(10,5,28,x,51,0,concrete,'WallPillarTop');
 }
 return root;
}
export const STRATEGIC_BUILDING_KINDS=Object.freeze(['research','silo','interceptor','wall']);
export const isStrategicBuilding=kind=>STRATEGIC_BUILDING_KINDS.includes(kind);
export function createStrategicBuilding(kind,owner=0){
 if(!isStrategicBuilding(kind))return null;
 if(kind==='wall')return createDefensiveWall(owner);
 const root=new THREE.Group();
 root.name='Strategic_'+kind;
 root.userData.visualOnly=true;
 const faction=owner===0?'#487488':'#91594b';
 const researchCamo=kind==='research';
 const siloCamo=kind==='silo';
 const structuralCamo=researchCamo||siloCamo;
 const mats={
  base:new THREE.MeshStandardMaterial({color:structuralCamo?'#bba882':'#968b73',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.32,roughness:.84,metalness:.11}),
  panel:new THREE.MeshStandardMaterial({color:researchCamo?'#999477':faction,map:materialGrain,
   bumpMap:materialGrain,bumpScale:.14,roughness:.56,metalness:.39}),
  metal:new THREE.MeshStandardMaterial({color:researchCamo?'#766f5b':'#626b69',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.09,roughness:.48,metalness:.57}),
  stone:new THREE.MeshStandardMaterial({color:structuralCamo?'#d5c297':'#c0ab89',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.48,roughness:.91,metalness:.02}),
  black:new THREE.MeshStandardMaterial({color:researchCamo?'#585345':'#252b29',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.07,roughness:.68,metalness:.38}),
  glow:new THREE.MeshStandardMaterial({color:owner===0?'#63b9de':'#ffab79',
   emissive:owner===0?'#2d95c4':'#e96436',emissiveIntensity:.74,metalness:.25,roughness:.4}),
  trim:new THREE.MeshStandardMaterial({color:structuralCamo?'#d3bd91':'#c2ac84',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.12,roughness:.62,metalness:.36}),
  vent:new THREE.MeshStandardMaterial({color:researchCamo?'#505249':'#343c3b',roughness:.77,metalness:.35}),
  glass:new THREE.MeshStandardMaterial({color:owner===0?'#33677c':'#844e43',
   emissive:owner===0?'#184c64':'#61352d',emissiveIntensity:.4,metalness:.26,roughness:.34})
 };
 // Shared khaki/sand/olive PBR camouflage for research and missile silo.
 // Interceptor, dark metal, windows and faction signal beacons are untouched.
 if(structuralCamo){
  mats.steel=new THREE.MeshStandardMaterial({color:'#aaa082',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.12,roughness:.75,metalness:.18});
  mats.camoOlive=new THREE.MeshStandardMaterial({color:'#7f846b',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.14,roughness:.9,metalness:.04});
  // Silo sand-tone panels reuse its three-tone armoured albedo.
  // Research retains an independent sand highlight; this saves the silo
  // one draw call and maintains the original <=20 mesh budget.
  if(researchCamo){
   mats.camoSand=new THREE.MeshStandardMaterial({color:'#d1bd93',map:materialGrain,
    bumpMap:materialGrain,bumpScale:.16,roughness:.88,metalness:.05});
   // Actual baked albedo across the LAB WALLS and ROOF, not just painted
   // accessory boxes. Reuse the shared 256px, seam-free desert texture.
   // Own material but no extra texture allocation or frame-time shader cost.
   mats.researchArmor=new THREE.MeshStandardMaterial({
    color:'#f3efe3',map:siloDesertCamo,bumpMap:materialGrain,bumpScale:.22,
    roughness:.88,metalness:.07});
   mats.researchArmor.userData={sandforgeColorMapCamo:true};
  }
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
  // Give the large bunker and hatch faces a real tiled camouflage albedo.
  // Keep fine concrete grain as bump; rocket, hatches' dark iron, metallic
  // machinery and team-colored glass keep their own original materials.
  for(const role of ['base','armor']){
   mats[role].map=siloDesertCamo;
   // Near-white warm binder keeps the albedo colors true while remaining
   // eligible for the same subtle blue/red ownership tint as other walls.
   mats[role].color.set('#f3efe3');
   mats[role].userData={...mats[role].userData,sandforgeColorMapCamo:true};
  }
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
  // Eight-sided desert science bunker: curved reading from tactical zoom,
  // but faceted masonry keeps the same low-cost PBR batching.
  cyl(92,94,7,'black',0,4,0,8);
  cyl(85,87,6,'stone',0,10,0,8);
  cyl(77,80,4,'base',0,16,0,8); // retain original khaki PBR material in the round bunker
  cyl(79,83,68,'researchArmor',0,48,0,8);
  cyl(85,85,6,'black',0,81,0,8);
  cyl(81,81,3,'camoOlive',0,85,0,8);
  cyl(68,70,5,'metal',0,90,0,8);
  // Independent armored wall modules and genuinely textured camouflage.
  // Large windows are recessed onto the facets, not translucent billboards.
  for(let i=0;i<8;i++){
   const angle=i*Math.PI/4;
   const nx=Math.sin(angle),nz=Math.cos(angle);
   const x=nx*78,z=nz*78;
   const glass=add(new THREE.BoxGeometry(34,22,2.5),'glass',
    x,56,z,0,angle,0);
   glass.name='';
   add(new THREE.BoxGeometry(38,3,4),'trim',nx*79,69,nz*79,0,angle,0);
   add(new THREE.BoxGeometry(38,3,4),'black',nx*79,42,nz*79,0,angle,0);
   for(const side of [-1,1])
    add(new THREE.BoxGeometry(3,27,5),'metal',
     x+side*Math.cos(angle)*18,55,z-side*Math.sin(angle)*18,0,angle,0);
   add(new THREE.BoxGeometry(36,5,3),'camoSand',
    nx*81,31,nz*81,0,angle,0);
  }
  // A visible door with warning stripes on the camera-facing front facet.
  box(34,39,8,'black',0,29,83);
  box(29,34,9,'metal',0,28,86);
  box(24,25,10,'vent',0,28,90);
  for(const x of [-10,10])box(3,38,11,'trim',x,29,89);
  for(let i=0;i<5;i++)box(24,1.5,10,'camoSand',0,14+i*5,94);
  // Layered roof-ring, exposed instrument panel and compact HVAC towers.
  cyl(60,65,9,'metal',0,96,0,12);
  cyl(56,60,3,'researchArmor',0,102,0,12);
  for(let i=0;i<8;i++){
   const angle=i*Math.PI/4;
   const x=Math.sin(angle)*69,z=Math.cos(angle)*69;
   box(17,8,14,'camoOlive',x,93,z);
   box(14,2.2,11,'steel',x,98,z);
  }
  for(const x of [-45,45]){
   box(22,13,21,'vent',x,94,-21);
   box(24,2.6,23,'trim',x,102,-21);
   for(const z of [-27,-21,-15])
    box(17,.9,2,'steel',x,99,z);
  }
  const array=add(new THREE.BoxGeometry(31,3,24),'panel',50,112,4,-.38);
  array.name='Research_SensorArray';
  for(let i=0;i<3;i++)box(2.2,13,25,'trim',39+i*11,113,4);
  for(const x of [-47,45]){
   cyl(3,3,28,'steel',x,107,34);
   cyl(4.5,4.5,3,'glow',x,123,34);
  }
  // Persistent roof radar: separate group survives static mesh batching and
  // spins smoothly while the authoritative simulation remains untouched.
  const pivot=new THREE.Group();
  pivot.name='ResearchDishPivot';pivot.position.set(0,113,0);
  pivot.userData={visualOnly:true,animatedDish:true};
  root.add(pivot);
  const dishMat=mats.stone,metalMat=mats.metal;
  const dishMesh=new THREE.Mesh(
   new THREE.SphereGeometry(32,28,13,0,Math.PI*2,0,Math.PI*.42),dishMat);
  dishMesh.name='Research_Radar';
  dishMesh.position.set(0,17,0);dishMesh.rotation.x=-.55;
  dishMesh.castShadow=true;pivot.add(dishMesh);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(30,1.8,9,32),mats.trim);
  rim.position.set(0,26,10);rim.rotation.x=-.55;pivot.add(rim);
  const yoke=new THREE.Mesh(new THREE.CylinderGeometry(4,7,22,12),metalMat);
  yoke.position.set(0,7,0);pivot.add(yoke);
  const feed=new THREE.Mesh(new THREE.CylinderGeometry(1.9,2.5,31,8),metalMat);
  feed.rotation.x=.62;feed.position.set(0,28,12);pivot.add(feed);
  const receiver=new THREE.Mesh(new THREE.SphereGeometry(4,9,7),mats.glow);
  receiver.position.set(0,37,22);pivot.add(receiver);
  for(const part of pivot.children)if(part.isMesh)
   {part.castShadow=false;part.receiveShadow=true;part.raycast=()=>{};}
 }else if(kind==='silo'){
  // Round, compact Zero-Hour-style launch silo. The armored circular bay,
  // exposed missile and attached service cabin form its RTS silhouette.
  // The old enormous rectangular warehouse and cross-runway are removed.
  cyl(101,102,7,'black',0,4,0,28);
  cyl(95,97,33,'base',0,24,0,28);
  cyl(94,94,6,'armor',0,43,0,28);
  // Reinforced annular rim around a visibly dark recessed launch shaft.
  cyl(83,84,10,'metal',-17,51,0,32);
  cyl(62,62,4,'black',-17,58,0,32);
  const ring=add(new THREE.TorusGeometry(73,9,14,48),'armor',
   -17,62,0,-Math.PI/2);
  ring.name='Silo_ArmoredLaunchRing';
  add(new THREE.TorusGeometry(82,2.4,8,44),'trim',-17,60,0,-Math.PI/2);
  for(let i=0;i<12;i++){
   const angle=i*Math.PI/6;
   const x=-17+Math.cos(angle)*85,z=Math.sin(angle)*85;
   box(11,15,14,'camoOlive',x,62,z);
   box(9,3,15,'steel',x,70,z);
  }
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4,x=-17+Math.cos(a)*96,z=Math.sin(a)*96;
   box(13,3,19,'armor',x,43,z);
   box(10,1.5,14,'warning',x,46,z);
  }
  // Two sand-painted segmented hydraulic shutters are parked outside
  // the open ring; their edges are visible, not a giant garage roof.
  for(const side of [-1,1]){
   const x=-17+side*87;
   box(17,7,81,'armor',x,72,0);
   box(18,2,72,'steel',x,76,0);
   for(const z of [-31,0,31])box(14,2.4,4,'black',x,78,z);
  }
  // A two-stage rocket remains visible in the launch well.
  // No gameplay alteration: timing and projectile simulation are unchanged.
  const rx=-17;
  const body=cyl(19,20,65,'rocketBody',rx,112,0,24);
  body.name='Silo_RocketBody';
  cyl(18,18,32,'rocketPanel',rx,159,0,24);
  cyl(18,19,7,'rocketNose',rx,180,0,24);
  const nose=add(new THREE.ConeGeometry(17,38,24),
   'rocketNose',rx,202,0);
  nose.name='Silo_RocketNose';
  for(const [y,r,paint] of [[84,20,'rocketAccent'],[146,19,'trim'],
    [179,19,'rocketAccent'],[187,17,'rocketPanel']]){
   const seam=add(new THREE.TorusGeometry(r,2.2,8,28),paint,
    rx,y,0,-Math.PI/2);
   if(y===146)seam.name='Silo_RocketStageSeam';
  }
  for(let i=0;i<4;i++){
   const angle=i*Math.PI/2;
   box(12,25,4,'rocketBody',rx+Math.cos(angle)*20,105,
    Math.sin(angle)*20);
  }
  cyl(11,13,5,'rocketNose',rx,78,0,18);
  // Small offset control house and signal electronics, never a whole annex.
  const cabin=box(53,39,48,'base',81,27,-41);
  cabin.name='Silo_ControlHut';
  box(58,6,53,'metal',81,50,-41);
  box(61,3,56,'armor',81,55,-41);
  box(23,22,3,'black',81,30,-16);
  box(19,17,4,'steel',81,31,-14);
  for(const xx of [61,101]){
   box(12,16,3,'glass',xx,35,-16);
   box(15,2,4,'trim',xx,45,-16);
  }
  for(const side of [-1,1]){
   box(1.8,26,36,'camoOlive',81+side*27,29,-42);
   box(3,26,7,'armor',81+side*29,30,-24);
  }
  cyl(2.3,2.3,43,'metal',92,77,-56);
  cyl(4.5,5,3,'glow',92,100,-56);
  cyl(1.8,2.3,35,'metal',69,72,-57);
  // External struts, vent panels and faded desert warning stripes.
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3;
   box(9,32,14,'armor',Math.cos(a)*96,33,Math.sin(a)*96);
   box(9,2,13,'camoOlive',Math.cos(a)*96,51,Math.sin(a)*96);
  }
  for(const x of [62,81,100]){
   box(13,7,16,'vent',x,60,-45);
   box(11,2,13,'steel',x,65,-45);
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
 const batched=batchStaticParts(root,kind);
 // Compact lab: ~27% smaller horizontally and ~24% shorter. These scale
 // factors are for the STRATEGIC model only, not hit points or research.
 if(kind==='silo'){
  batched.scale.set(.72,.69,.72);
  batched.userData.compactRoundSilo=true;
 }
 if(kind==='research'){
  batched.scale.set(.73,.76,.73);
  batched.userData.compactResearch=true;
  batched.userData.referenceInspiredCamo=true;
 }
 return batched;
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
