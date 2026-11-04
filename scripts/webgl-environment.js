import * as THREE from 'three';
import {createGroundDetails} from '/src/reborn/battlefield-atmosphere.js';

// Environmental set dressing mirrors deterministic Canyon sites but has no
// influence on gameplay or collision. Every asset is a true GPU 3D mesh.
export class DesertArtPass {
 constructor({scene,world,terrain,heightAt,pos,loader,lowQuality=false}){
  Object.assign(this,{scene,world,terrain,heightAt,pos,loader,lowQuality});
  this.details=createGroundDetails(world,terrain.sites);
  this.items=[];this.animations=[];
  this.addCraters();
  this.addDebris();
  this.addRuinRubble();
 }
 makeCraterTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(64,64,6,64,64,61);
  g.addColorStop(0,'rgba(72,47,26,.53)');
  g.addColorStop(.46,'rgba(88,57,31,.7)');
  g.addColorStop(.64,'rgba(129,92,51,.58)');
  g.addColorStop(.80,'rgba(239,196,125,.29)');
  g.addColorStop(1,'rgba(232,188,119,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
 }
 addCraters(){
  const crater=this.details.filter(d=>d.kind==='crater').slice(0,this.lowQuality?55:230);
  const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),
   new THREE.MeshBasicMaterial({map:this.makeCraterTexture(),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),crater.length);
  // Detailed authored crater decal takes priority when available, with the
  // procedural crater as an offline-safe fallback.
  const craterMaterial=mesh.material;
  new THREE.TextureLoader().load('/src/assets/reborn/battlefield/crater.png',texture=>{
   texture.colorSpace=THREE.SRGBColorSpace;craterMaterial.map=texture;craterMaterial.needsUpdate=true;
  },undefined,error=>console.warn('Crater art fallback',error));
  const dummy=new THREE.Object3D();
  crater.forEach((d,i)=>{
   dummy.position.copy(this.pos(d.x,d.y));dummy.position.y+=.9;
   dummy.rotation.set(-Math.PI*.5,0,d.rotation);
   dummy.scale.set(d.radius*3.1,d.radius*2.3,1);
   dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;mesh.renderOrder=2;
  this.scene.add(mesh);this.items.push(mesh);
 }
 addDebris(){
  const dust=new THREE.MeshStandardMaterial({color:'#a98259',roughness:1,metalness:0});
  const material=new THREE.MeshStandardMaterial({color:'#bba178',roughness:.97,metalness:0});
  const geometry=new THREE.DodecahedronGeometry(1,0),mesh=new THREE.InstancedMesh(geometry,dust,this.lowQuality?240:850);
  const dummy=new THREE.Object3D();
  let count=0;
  for(const d of this.details) {
   if(d.kind!=='rock'&&d.kind!=='stones')continue;
   if(count>=mesh.instanceMatrix.count)break;
   const p=this.pos(d.x,d.y);dummy.position.copy(p);dummy.position.y+=d.radius*.12;
   dummy.rotation.set(d.rotation*.13,d.rotation,0);
   const r=d.radius*(d.kind==='stones'?.36:.68);
   dummy.scale.set(r,.42*r,.85*r);dummy.updateMatrix();mesh.setMatrixAt(count++,dummy.matrix);
  }
  mesh.count=count;mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=false;mesh.receiveShadow=true;
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
  const count=this.terrain.ruins.length*(this.lowQuality?8:27);
  if(!count)return;
  const geometry=new THREE.DodecahedronGeometry(1,0);
  const materials=[
   new THREE.MeshStandardMaterial({color:'#d8bd98',roughness:1}),
   new THREE.MeshStandardMaterial({color:'#9f8060',roughness:1})
  ];
  const meshes=materials.map(material=>new THREE.InstancedMesh(geometry,material,count));
  const counters=[0,0],dummy=new THREE.Object3D();
  let state=(this.world.seed^0x6ac8b547)>>>0;
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(const ruin of this.terrain.ruins)for(let k=0;k<(this.lowQuality?8:27);k++){
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
  const palms=this.details.filter(d=>d.kind==='palm'&&
   !this.terrain.ridges.some(r=>r.spine.some(p=>Math.hypot(d.x-p.x,d.y-p.y)<140)))
   .slice(0,this.lowQuality?6:28);
  // Border groves also render on seeds with no walkable interior palms.
  const gltf=await this.loader.loadAsync('/src/assets/reborn/props-3d/palm-tree.glb');
  for(const d of palms){
   const palm=this.normalize(gltf.scene.clone(true),d.radius*3);
   const group=new THREE.Group();group.position.copy(this.pos(d.x,d.y));
   group.rotation.y=d.rotation;group.add(palm);
   this.scene.add(group);this.items.push(group);
  }
  // Natural palm clusters at the foot of the OUTER cliffs, not inside the
  // World. Reuse the same authored GLB; all placements are seeded, visual-only
  // and excluded from gameplay collision, pathfinding, saves and raycasts.
  let state=((this.world.seed??0)^0x3ac719d5)>>>0;
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const groves=this.lowQuality?4:9;
  let borderPalms=0;
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
    group.scale.setScalar(.83+rand()*.38);
    group.add(palm);
    this.scene.add(group);this.items.push(group);borderPalms++;
   }
  }
  return palms.length+borderPalms;
 }
 async loadProps(){
  // Place authored PBR supply hardware beside derelict compounds. The old
  // preview placed only plain sandbags at one point for each ruin.
  // These are render-only objects, with no edits to pathfinding or saves.
  const sites=this.terrain.ruins.slice(0,this.lowQuality?3:10);
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
    // Never place decorative supplies in a passable corridor or gameplay
    // building spot; the visual props have deliberately no collision.
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
