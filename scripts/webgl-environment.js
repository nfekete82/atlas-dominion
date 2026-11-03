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
 async loadPalmGroves(){
  const palms=this.details.filter(d=>d.kind==='palm'&&
   !this.terrain.ridges.some(r=>r.spine.some(p=>Math.hypot(d.x-p.x,d.y-p.y)<140)))
   .slice(0,this.lowQuality?6:28);
  if(!palms.length)return 0;
  const gltf=await this.loader.loadAsync('/src/assets/reborn/props-3d/palm-tree.glb');
  for(const d of palms){
   const palm=this.normalize(gltf.scene.clone(true),d.radius*3);
   const group=new THREE.Group();group.position.copy(this.pos(d.x,d.y));
   group.rotation.y=d.rotation;group.add(palm);
   this.scene.add(group);this.items.push(group);
  }
  return palms.length;
 }
 async loadProps(){
  const points=this.terrain.ruins.slice(0,this.lowQuality?1:8).map((r,i)=>({
   x:r.x+(i%2?180:-180),y:r.y+105
  })).filter(p=>this.world.walkable(p));
  if(!points.length)return 0;
  const source=await this.loader.loadAsync('/src/assets/reborn/props-3d/sandbags.glb');
  for(const point of points){
   const mesh=this.normalize(source.scene.clone(true),64);
   const group=new THREE.Group();group.position.copy(this.pos(point.x,point.y));
   group.add(mesh);this.scene.add(group);this.items.push(group);
  }
  return points.length;
 }
 async load(){
  const [palms,props]=await Promise.allSettled([this.loadPalmGroves(),this.loadProps()]);
  return {palms:palms.status==='fulfilled'?palms.value:0,props:props.status==='fulfilled'?props.value:0};
 }
}
