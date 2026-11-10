import * as THREE from 'three';
import {stoneMaterial,weatheredStoneGeometry} from './webgl-rock-materials.js';
// Browser production serves this file from /dist, alongside compiled /src.
// The Node geometry tests import its source directly from /scripts, where
// absolute browser import paths are invalid. Resolve the *same* compiled
// atmosphere implementation relative to each environment, not a stub.
const {createGroundDetails}=await import(
 typeof window==='undefined'?
 '../dist/src/reborn/battlefield-atmosphere.js':
 './src/reborn/battlefield-atmosphere.js'
);

/** Reproduce the exact heights of the 4x4 × 56-segment rendered terrain.
 * Sampling the mathematical heightfield alone is insufficient: the ground
 * GPU mesh linearly interpolates between vertices, and decals can clip into
 * steep dunes if that interpolation is ignored. Cache sampled grid corners.
 */
export function renderGroundHeightSampler(heightAt,size,segments=224){
 const spacing=size/segments,cache=new Map();
 const corner=(i,j)=>{
  const key=j*(segments+1)+i;
  if(!cache.has(key))cache.set(key,heightAt(i*spacing,j*spacing));
  return cache.get(key);
 };
 return (x,z)=>{
  const gx=Math.max(0,Math.min(segments,x/spacing));
  const gz=Math.max(0,Math.min(segments,z/spacing));
  const i=Math.min(segments-1,Math.floor(gx));
  const j=Math.min(segments-1,Math.floor(gz));
  const tx=gx-i,tz=gz-j;
  const a=corner(i,j),b=corner(i+1,j),
   c=corner(i,j+1),d=corner(i+1,j+1);
  // Same diagonal and barycentric weights as buildTerrain() in preview.
  return tx+tz<=1?
   a*(1-tx-tz)+b*tx+c*tz:
   b*(1-tz)+c*(1-tx)+d*(tx+tz-1);
 };
}

/** Pre-bake every crater into one terrain-following, textured decal mesh.
 * Each vertex samples the *existing* render heightfield, so no part of a
 * crater punches through a dune or floats as a bright geometric tire ring.
 * The only geometry is a flat surface offset above terrain: zero collision,
 * zero per-frame height samples, no changes to saves or simulation.
 */
export function createConformingCraterGeometry(craters,{
 pos,lowQuality=false,spacious=true,heightAt=null,worldSize=0
}){
 const sampleGround=heightAt&&worldSize>0?
  renderGroundHeightSampler(heightAt,worldSize):null;
 const segments=lowQuality?18:28;
 const radii=[.18,.38,.59,.77,.91,1];
 const positions=[],uvs=[],indices=[];
 const half=spacious?.60:1;
 const emit=(x,z,u,v)=>{
  const point=pos(x,z);
  const ground=sampleGround?sampleGround(x,z):point.y;
  positions.push(point.x,ground+.24,point.z);
  uvs.push(u,v);
  return positions.length/3-1;
 };
 for(const d of craters){
  const center=emit(d.x,d.y,.5,.5);
  const sizeX=d.radius*3.1*half*.5;
  const sizeZ=d.radius*2.3*half*.5;
  const cs=Math.cos(d.rotation),sn=Math.sin(d.rotation);
  const rings=[];
  for(const r of radii){
   const ring=[];
   for(let i=0;i<segments;i++){
    const a=i*Math.PI*2/segments;
    const ux=Math.cos(a)*r,uz=Math.sin(a)*r;
    const dx=ux*sizeX,dz=uz*sizeZ;
    ring.push(emit(d.x+dx*cs-dz*sn,d.y+dx*sn+dz*cs,
     .5+ux*.5,.5+uz*.5));
   }
   rings.push(ring);
  }
  for(let i=0;i<segments;i++){
   const j=(i+1)%segments;
   // Counterclockwise as seen from above (+Y); no back-face holes.
   indices.push(center,rings[0][j],rings[0][i]);
   for(let k=0;k<rings.length-1;k++){
    const inner=rings[k],outer=rings[k+1];
    indices.push(inner[i],inner[j],outer[i],
     inner[j],outer[j],outer[i]);
   }
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geometry.setIndex(indices);
 geometry.computeBoundingSphere();
 geometry.userData={groundConforming:true,visualOnly:true,
  craterCount:craters.length,segments,terrainSampledOnce:true};
 return geometry;
}

// Environmental set dressing mirrors deterministic Canyon sites but has no
// influence on gameplay or collision. Every asset is a true GPU 3D mesh.
export class DesertArtPass {
 constructor({scene,world,terrain,heightAt,pos,loader,lowQuality=false,biome='desert'}){
  Object.assign(this,{scene,world,terrain,heightAt,pos,loader,lowQuality,biome});
  this.details=createGroundDetails(world,terrain.sites);
  this.items=[];this.animations=[];
  this.addCraters();
  this.addDebris();
  this.addRuinRubble();
 }
 makeCraterTexture(){
  // Procedural, biome-aware excavation with an eroded rim and granular
  // ejecta. The old static crater.png was a circular brown stamp (and even
  // appeared on snow maps); this atlas stays local, deterministic and only
  // needs to be generated once per biome, not during gameplay.
  const size=256,canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(size,size);
  const cold=this.biome==='snow',green=this.biome==='jungle';
  const shade=cold?[87,98,109]:green?[56,46,36]:[109,72,45];
  const lip=cold?[173,183,190]:green?[109,96,72]:[184,132,84];
  const dust=cold?[195,205,212]:green?[99,93,70]:[201,148,94];
  const smooth=(a,b,t)=>{
   const v=Math.max(0,Math.min(1,(t-a)/(b-a)));
   return v*v*(3-2*v);
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const dx=(x+0.5-size/2)/110,dy=(y+0.5-size/2)/110;
   const angle=Math.atan2(dy,dx);
   // Different angular frequencies prevent a regular bullseye or ring.
   const edge=1+.095*Math.sin(angle*7+.8)+.053*Math.sin(angle*13-1.5)+
    .025*Math.cos(angle*19+.6);
   const r=Math.hypot(dx,dy*1.065)/edge;
   const coarse=Math.sin(x*.175+y*.081)*Math.cos(y*.139-x*.045);
   const micro=(Math.imul(x+19,73856093)^Math.imul(y+53,19349663))>>>0;
   const grit=(micro%997)/996-.5;
   const depression=Math.exp(-Math.pow(r/.49,4));
   const raised=Math.exp(-Math.pow((r-.69)/.12,2));
   const scattered=Math.exp(-Math.pow((r-.84)/.22,2));
   const fade=1-smooth(.82,1.10,r);
   const inside=(.19+.40*depression+.12*raised+.06*scattered)*fade;
   const k=(y*size+x)*4;
   const scatter=.065*coarse+.08*grit;
   const darkWeight=Math.min(.86,Math.max(0,(.69*depression+.12*raised+scatter)));
   const rimWeight=Math.min(1-darkWeight,Math.max(0,raised*(.58+.17*coarse)));
   const color=[0,1,2].map(i=>
    shade[i]*darkWeight+lip[i]*rimWeight+
    dust[i]*(1-darkWeight-rimWeight)*.94);
   for(let i=0;i<3;i++)
    pixels.data[k+i]=Math.max(0,Math.min(255,Math.round(color[i]+grit*15+coarse*6)));
   // Fade over a wide, irregular apron to merge with surrounding sand.
   pixels.data[k+3]=Math.round(255*Math.max(0,Math.min(.92,inside)));
  }
  ctx.putImageData(pixels,0,0);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.anisotropy=4;
  return texture;
 }
 addCraters(){
  const spacious=this.world.mapVersion>=19;
  const crater=this.details.filter(d=>d.kind==='crater')
   .slice(0,spacious?(this.lowQuality?30:110):(this.lowQuality?55:230));
  // One shared mesh, and one draw call, in both standard and lite modes.
  // Replaces the old unsupported flat instanced quads + raised ring meshes.
  const geometry=createConformingCraterGeometry(crater,{
   pos:this.pos,lowQuality:this.lowQuality,spacious,
   heightAt:this.heightAt,worldSize:this.world.size
  });
  const mesh=new THREE.Mesh(geometry,
   new THREE.MeshBasicMaterial({map:this.makeCraterTexture(),transparent:true,
    opacity:spacious?.76:.86,depthWrite:false,side:THREE.FrontSide,
    polygonOffset:true,polygonOffsetFactor:-1}));
  mesh.renderOrder=2;
  mesh.name='visual-desert-craters';
  mesh.userData={visualOnly:true,nonPlayable:true,craterDecals:true,
   groundConforming:true,craterCount:crater.length};
  mesh.raycast=()=>{};
  this.scene.add(mesh);this.items.push(mesh);
 }
 addDebris(){
  const dust=stoneMaterial(this.biome==='snow'?'#a1abb4':this.biome==='jungle'?'#6f7662':'#b69a7c',
   {lowQuality:this.lowQuality});
  const geometry=weatheredStoneGeometry(this.lowQuality);
  const spacious=this.world.mapVersion>=19;
  const mesh=new THREE.InstancedMesh(geometry,dust,
    spacious?(this.lowQuality?160:500):(this.lowQuality?240:850));
  const dummy=new THREE.Object3D();
  let count=0;
  for(const d of this.details) {
   if(d.kind!=='rock'&&d.kind!=='stones')continue;
   if(count>=mesh.instanceMatrix.count)break;
   const p=this.pos(d.x,d.y);dummy.position.copy(p);dummy.position.y+=d.radius*.12;
   dummy.rotation.set(d.rotation*.13,d.rotation,0);
   const r=d.radius*(d.kind==='stones'?.36:.68)*(spacious?.78:1);
   dummy.scale.set(r,.42*r,.85*r);dummy.updateMatrix();mesh.setMatrixAt(count++,dummy.matrix);
  }
  mesh.count=count;mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=false;mesh.receiveShadow=true;
  mesh.name='visual-desert-debris';
  mesh.userData={visualOnly:true,nonPlayable:true,debris:true};
  this.scene.add(mesh);this.items.push(mesh);
 }
 normalize(model,targetWidth){
  const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
  const width=Math.max(size.x,size.z);
  if(width<=.000001)return model;
  const scale=targetWidth/width,center=box.getCenter(new THREE.Vector3());
  model.scale.multiplyScalar(scale);
  model.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
  model.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
  return model;
 }
 addRuinRubble(){
  // A broken concrete shell needs grounded masonry at its feet, not an
  // immaculate square base. Small fragments deliberately have no collider.
  const spacious=this.world.mapVersion>=19;
  const rubblePerRuin=spacious?(this.lowQuality?5:13):(this.lowQuality?8:27);
  const count=this.terrain.ruins.length*rubblePerRuin;
  if(!count)return;
  const geometry=weatheredStoneGeometry(this.lowQuality);
  const materials=[
   stoneMaterial(this.biome==='snow'?'#c7d0d7':this.biome==='jungle'?'#94947e':'#debe98',{lowQuality:this.lowQuality}),
   stoneMaterial(this.biome==='snow'?'#83919d':this.biome==='jungle'?'#5d6656':'#aa8e70',{lowQuality:this.lowQuality})
  ];
  const meshes=materials.map(material=>new THREE.InstancedMesh(geometry,material,count));
  const counters=[0,0],dummy=new THREE.Object3D();
  let state=(this.world.seed^0x6ac8b547)>>>0;
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(const ruin of this.terrain.ruins)for(let k=0;k<rubblePerRuin;k++){
   const angle=rand()*Math.PI*2,wall=Math.max(ruin.width*.5,ruin.depth*.5);
   const distance=wall*(.78+rand()*.56),x=ruin.x+Math.cos(angle)*distance,z=ruin.y+Math.sin(angle)*distance;
   const radius=1.9+rand()*6,kind=rand()>.55?1:0;
   dummy.position.copy(this.pos(x,z));dummy.position.y+=radius*.42;
   dummy.rotation.set(rand()*.55,rand()*Math.PI*2,rand()*.44);
   dummy.scale.set(radius*1.6,radius*(.2+rand()*.5),radius*(.65+rand()*1.3));
   dummy.updateMatrix();meshes[kind].setMatrixAt(counters[kind]++,dummy.matrix);
  }
  for(let i=0;i<meshes.length;i++){
   const mesh=meshes[i];mesh.count=counters[i];mesh.instanceMatrix.needsUpdate=true;
   mesh.castShadow=false;mesh.receiveShadow=true;this.scene.add(mesh);this.items.push(mesh);
  }
 }
 async loadPalmGroves(){
  // No tropical palms on a snowfield; jungle keeps the existing groves.
  if(this.biome==='snow')return 0;
  const spacious=this.world.mapVersion>=19;
  const palms=this.details.filter(d=>d.kind==='palm'&&
   !this.terrain.ridges.some(r=>r.spine.some(p=>Math.hypot(d.x-p.x,d.y-p.y)<140)))
   .slice(0,spacious?(this.lowQuality?2:6):(this.lowQuality?6:28));
  // Border groves also render on seeds with no walkable interior palms.
  const gltf=await this.loader.loadAsync('/src/assets/reborn/props-3d/palm-tree.glb');
  for(const d of palms){
   const palm=this.normalize(gltf.scene.clone(true),d.radius*3);
   const group=new THREE.Group();group.position.copy(this.pos(d.x,d.y));
   group.rotation.y=d.rotation;
   if(spacious)group.scale.setScalar(1.12);
   group.add(palm);
   this.scene.add(group);this.items.push(group);
  }
  // Small natural palm clusters enhance the original desert art without
  // growing any geometry in the black void or on blocked/strategic tiles.
  // Only extra visual trees: no pathfinding, economy or save schema changes.
  if(spacious){
   let state=((this.world.seed??0)^0x63b98e21)>>>0;
   const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;
    return state/4294967296;};
   const clusters=this.lowQuality?2:4;
   const groups=[];
   for(let attempt=0;attempt<90&&groups.length<clusters;attempt++){
    const x=this.world.size*(.12+rand()*.76);
    const y=this.world.size*(.12+rand()*.76);
    if(this.terrain.sites.some(p=>Math.hypot(p.x-x,p.y-y)<340)||
      this.terrain.ruins.some(p=>Math.hypot(p.x-x,p.y-y)<240)||
      groups.some(p=>Math.hypot(p.x-x,p.y-y)<530)||
      !this.world.walkable({x,y}))continue;
    groups.push({x,y});
   }
   for(const [groupIndex,center] of groups.entries()){
    const stems=this.lowQuality?2:3+groupIndex%2;
    for(let i=0;i<stems;i++){
     const angle=rand()*Math.PI*2,dist=i===0?0:18+rand()*52;
     const x=center.x+Math.cos(angle)*dist,y=center.y+Math.sin(angle)*dist;
     if(x<100||y<100||x>this.world.size-100||y>this.world.size-100||
        !this.world.walkable({x,y}))continue;
     const tree=this.normalize(gltf.scene.clone(true),67+rand()*34);
     const group=new THREE.Group();
     group.name='visual-inland-palm-grove';
     group.userData={visualOnly:true,nonPlayable:true,inlandGrove:true};
     group.position.copy(this.pos(x,y));group.rotation.y=rand()*Math.PI*2;
     group.scale.setScalar(.80+rand()*.32);group.add(tree);
     this.scene.add(group);this.items.push(group);
    }
   }
  }
  // Premium oases now own the safe, deterministic interior groves.
  let borderPalms=0;
  // Zero Hour-style outer void on the spacious 3D maps: NO palm groves
  // outside the playable boundary. Those tall 3D meshes previously poked
  // through the black soil fade when viewed from the low/zoomed-out camera.
  // Keep the classic legacy-map border groves unchanged.
  if(!spacious){
  let state=((this.world.seed??0)^0x3ac719d5)>>>0;
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const groves=this.lowQuality?4:9;
  for(let grove=0;grove<groves;grove++){
   const edge=Math.floor(rand()*4),center=.09+rand()*.82;
   const number=this.lowQuality?3:3+Math.floor(rand()*3);
   for(let i=0;i<number;i++){
    const t=Math.max(.035,Math.min(.965,center+(rand()-.5)*.052));
    const offset=9+rand()*28;
    const along=t*this.world.size;
    const p=edge===0?{x:along,y:-offset}:
     edge===1?{x:this.world.size+offset,y:along}:
     edge===2?{x:along,y:this.world.size+offset}:
      {x:-offset,y:along};
    const palm=this.normalize(gltf.scene.clone(true),64+rand()*40);
    const group=new THREE.Group();
    group.name='visual-boundary-palm';
    group.userData={visualBoundary:true,nonPlayable:true,edge};
    group.position.copy(this.pos(p.x,p.y));
    group.rotation.y=rand()*Math.PI*2;
    group.scale.setScalar((.83+rand()*.38)*(spacious?1.12:1));
    group.add(palm);
    this.scene.add(group);this.items.push(group);borderPalms++;
   }
  }
  }
  return palms.length+borderPalms;
 }
 async loadProps(){
  // Place authored PBR supply hardware beside derelict compounds. The old
  // preview placed only plain sandbags at one point for each ruin.
  // These are render-only objects, with no edits to pathfinding or saves.
  const sites=this.terrain.ruins.slice(0,
   this.world.mapVersion>=19?(this.lowQuality?6:12):(this.lowQuality?3:10));
  if(!sites.length)return 0;
  const sources=this.lowQuality?
   ['sandbags','military-crate-stack']:
   ['sandbags','military-crate-stack','fuel-barrels','service-lamp'];
  const results=await Promise.allSettled(sources.map(kind=>
   this.loader.loadAsync('/src/assets/reborn/props-3d/'+kind+'.glb')));
  const available=sources.flatMap((kind,i)=>results[i].status==='fulfilled'?
    [{kind,scene:results[i].value.scene}]:[]);
  if(!available.length)return 0;
  let count=0,state=((this.world.seed??0)^0x9d3b3a81)>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;
    return state/4294967296;};
  for(const ruin of sites){
   const radius=Math.max(ruin.width??120,ruin.depth??100)*.5;
   const props=this.lowQuality?2:3;
   for(let i=0;i<props;i++){
    const source=available[(i+Math.floor(random()*available.length))%available.length];
    const angle=ruin.rotation+Math.PI*(.2+random()*.6);
    const distance=radius*(1.05+random()*.34);
    const x=ruin.x+Math.cos(angle)*distance;
    const z=ruin.y+Math.sin(angle)*distance;
    if(x<35||z<35||x>this.world.size-35||z>this.world.size-35)continue;
    // Keep props outside the ruin footprint. These visual details have
    // no gameplay collision and never modify the authoritative World.
    const model=this.normalize(source.scene.clone(true),
     source.kind==='service-lamp'?28:source.kind==='sandbags'?38:28+random()*19);
    const group=new THREE.Group();
    group.name='desert-ruin-decor-'+source.kind;
    group.userData={visualOnly:true,nonPlayable:true,ruinDecor:true};
    group.position.copy(this.pos(x,z));
    group.rotation.y=angle+random()*.5;
    group.add(model);
    this.scene.add(group);this.items.push(group);count++;
   }
  }
  return count;
 }
 async load(){
  const [palms,props]=await Promise.allSettled([this.loadPalmGroves(),this.loadProps()]);
  return {palms:palms.status==='fulfilled'?palms.value:0,props:props.status==='fulfilled'?props.value:0};
 }
}
