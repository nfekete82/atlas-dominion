import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {generateOases,oasisRandom,oasisContour,oasisPoint} from './webgl-oasis-generation.js';
import {blendOasisTerrain,waterMaterial} from './webgl-oasis-materials.js';
import {stoneMaterial,weatheredStoneGeometry} from './webgl-rock-materials.js';

// Triangular, tapered, curved leaf ribbons; no rectangular foliage cards.
function ribbon(points,width){
 const vertices=[],indices=[];
 points.forEach((p,i)=>{
  const t=i/(points.length-1),w=width*Math.pow(Math.sin(Math.PI*t),.7)+.015;
  vertices.push(p.x-w,p.y,p.z,p.x+w,p.y+.12,p.z);
  if(i){const a=(i-1)*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
 });
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 g.setIndex(indices);g.computeVertexNormals();return g;
}
function join(parts){const merged=mergeGeometries(parts.map(g=>g.index?g.toNonIndexed():g));
 for(const g of parts)g.dispose();return merged;}
function palmGeometry(variant){
 const r=oasisRandom(0xe173b27^variant),height=85+variant*12,bend=8+variant*3;
 const curve=new THREE.CatmullRomCurve3(Array.from({length:9},(_,i)=>{
  const t=i/8;return new THREE.Vector3(bend*t*t,height*t,Math.sin(t*2)*variant*2);
 }));
 const trunkParts=[new THREE.TubeGeometry(curve,24,2.25,8,false)];
 // Raised old leaf scars, subtly tilted and broken by the curved trunk.
 for(let i=2;i<31;i++){
  const t=i/33,ring=new THREE.TorusGeometry(2.26*(1-t*.12),.34,3,8);
  ring.rotateX(Math.PI/2);ring.translate(...curve.getPoint(t).toArray());trunkParts.push(ring);
 }
 const leaves=[],top=curve.getPoint(1);
 for(let f=0;f<11;f++){
  const angle=f*2.39996+r()*.25,length=30+r()*16,lift=10+r()*9;
  const point=t=>new THREE.Vector3(top.x+Math.sin(angle)*length*t,
   top.y+Math.sin(t*Math.PI*.83)*lift-16*t*t,top.z+Math.cos(angle)*length*t);
  const spine=ribbon(Array.from({length:13},(_,i)=>point(i/12)),.55);leaves.push(spine);
  // Individual lanceolate leaflets grow alternately from the curved rachis.
  for(let k=2;k<19;k++)for(const side of [-1,1]){
   const t=k/20,base=point(t),span=(3+7*Math.sin(t*Math.PI))*(1-t*.35),a=angle+side*1.02;
   leaves.push(ribbon(Array.from({length:5},(_,i)=>{
    const u=i/4;return new THREE.Vector3(base.x+Math.sin(a)*span*u,
     base.y-3.5*u*u+Math.sin(u*Math.PI)*.7,base.z+Math.cos(a)*span*u);
   }),1.30*(1-t*.45)));
  }
 }
 return {trunk:join(trunkParts),leaves:join(leaves)};
}
function tuftGeometry(reed=false){
 const parts=[];
 for(let i=0;i<(reed?9:13);i++){
  const a=i*2.39996,l=reed?12+(i%4)*2:5+(i%4)*1.6;
  const g=ribbon(Array.from({length:6},(_,j)=>{
   const t=j/5;return new THREE.Vector3(Math.sin(a)*t*t*l*.38,t*l,Math.cos(a)*t*t*l*.38);
  }),reed?.25:.48);parts.push(g);
 }
 return join(parts);
}
export class DesertOases {
 constructor({scene,game,heightAt,groundMeshes,lowQuality=false,enabled=true}){
  Object.assign(this,{scene,game,heightAt,groundMeshes});
  this.root=new THREE.Group();this.root.name='premium-desert-oases';
  this.root.userData={visualOnly:true,nonPlayable:true,shallowPassable:true};
  this.resources=new Set();this.water=[];this.batches=[];this.hidden=new Set();this.occupancyTime=-Infinity;this.disposed=false;
  this.layout=enabled?generateOases({world:game.world,seed:game.seed,startRegions:game.startRegions,heightAt}):[];
  this.half=game.world.size/2;
  this.restoreTerrain=this.layout.length?blendOasisTerrain(groundMeshes[0].material,this.layout,this.half):()=>{};
  if(this.layout.length)this.build(lowQuality);
  this.update(0);
  scene.add(this.root);
 }
 own(resource){this.resources.add(resource);return resource;}
 batch(name,geometry,material,items){
  this.own(geometry);this.own(material);
  const mesh=new THREE.InstancedMesh(geometry,material,items.length),dummy=new THREE.Object3D();
  mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;
  for(const [i,p] of items.entries()){
   dummy.position.set(p.x-this.half,this.heightAt(p.x,p.y)-.5,p.y-this.half);
   dummy.rotation.set(p.tilt??0,p.rotation,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   mesh.setColorAt(i,new THREE.Color().setRGB(p.tint??1,(p.tint??1)*.99,(p.tint??1)*.94));
  }
  mesh.userData={visualOnly:true,nonPlayable:true};this.root.add(mesh);this.batches.push({mesh,items,matrices:mesh.instanceMatrix.array.slice()});return mesh;
 }
 // Match the rendered terrain's actual barycentric triangle height, rather
 // than approximating it with the analytic heightfield between its vertices.
 renderedHeight(x,z){
  const step=this.game.world.size/224,gx=x/step,gz=z/step,i=Math.floor(gx),j=Math.floor(gz),u=gx-i,v=gz-j;
  const a=this.heightAt(i*step,j*step),b=this.heightAt((i+1)*step,j*step),c=this.heightAt(i*step,(j+1)*step),d=this.heightAt((i+1)*step,(j+1)*step);
  return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
 }
 pool(o,material){
  // A few centimetres of water over rippled sand: deliberately fordable,
  // with no opaque deep centre or visible bank implying a blocked route.
  const step=this.game.world.size/224,r=o.radius*.61;
  const x0=Math.floor((o.x-r)/step),z0=Math.floor((o.y-r)/step);
  const nx=Math.ceil((o.x+r)/step)-x0,nz=Math.ceil((o.y+r)/step)-z0;
  const vertices=[],indices=[];
  // Use exactly the same lattice and triangle diagonals as the ground.
  // Both surfaces interpolate identically at EVERY point, including slopes.
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
   const x=(x0+i)*step,z=(z0+j)*step;
   vertices.push(x-this.half,this.heightAt(x,z)+.20,z-this.half);
   if(j<nz&&i<nx){const a=j*(nx+1)+i;indices.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
  }
  const g=this.own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setIndex(indices);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,material);mesh.name='oasis-water-'+o.id;mesh.renderOrder=3;
  mesh.userData={shallowPassable:true,oasisId:o.id,maximumDepth:.20};this.root.add(mesh);this.water.push(mesh);
 }
 build(lite){
  const trunks=this.own(new THREE.MeshStandardMaterial({color:'#8d7353',roughness:.95}));
  const foliage=this.own(new THREE.MeshStandardMaterial({color:'#727c43',roughness:.85,side:THREE.DoubleSide}));
  
  const palms=[[],[],[]],grasses=[],reeds=[],shrubs=[],stones=[];
  for(const o of this.layout){
   const r=oasisRandom(o.seed),count=o.type==='water'?3+Math.floor(r()*4):o.type==='dry'?2+Math.floor(r()*4):2+Math.floor(r()*3);
   const start=r()*Math.PI*2;
   for(let i=0;i<count;i++){
    // Irregular clustered arc leaves one open, muddy approach to the pool.
    const angle=start+i*.85+r()*.6,p=oasisPoint(o,angle,o.radius*(.54+r()*.29));
    palms[i%3].push({...p,oasisId:o.id,rotation:r()*6.283,scale:.80+r()*.35,tilt:(r()-.5)*.1,tint:.85+r()*.24});
   }
   for(let i=0;i<(lite?34:65);i++){
    const angle=r()*6.283,rad=.34+r()*.68,p=oasisPoint(o,angle,o.radius*rad*oasisContour(angle,o.phase));
    const list=i%7===0?shrubs:o.type!=='dry'&&rad<.57?reeds:grasses;
    list.push({...p,oasisId:o.id,rotation:r()*6.283,scale:.55+r()*.80,tint:.78+r()*.3});
   }
   for(let i=0;i<16;i++){
    const p=oasisPoint(o,r()*6.283,o.radius*(.5+r()*.56));
    stones.push({...p,oasisId:o.id,rotation:r()*6.283,scale:1.4+r()*3.5,tint:.8+r()*.3});
   }
   if(o.type!=='dry')this.pool(o,this.own(waterMaterial(o,this.half)));
  }
  for(let i=0;i<3;i++){
   const g=palmGeometry(i);this.batch('oasis-palm-trunks-'+i,g.trunk,trunks,palms[i]);
   this.batch('oasis-palm-fronds-'+i,g.leaves,foliage,palms[i]);
  }
  this.batch('oasis-dry-grasses',tuftGeometry(),this.own(new THREE.MeshStandardMaterial({color:'#9d925e',roughness:1,side:THREE.DoubleSide})),grasses);
  this.batch('oasis-shore-reeds',tuftGeometry(true),foliage,reeds);
  const shrub=tuftGeometry();shrub.scale(1.7,.65,1.7);this.batch('oasis-sparse-shrubs',shrub,foliage,shrubs);
  const rock=weatheredStoneGeometry(lowQuality);rock.scale(1.4,.65,1);
  this.batch('oasis-weathered-stones',rock,this.own(stoneMaterial('#b8a184',{lowQuality,normalScale:.56})),stones);
 }
 update(time){
  if(this.disposed)return;
  for(const mesh of this.water)mesh.material.userData.time.value=time;
  if(time-this.occupancyTime<.75)return;this.occupancyTime=time;
  // Construction remains unrestricted. Reclaim decoration underneath newly
  // built structures and restored saves instead of obstructing their yards.
  const hidden=new Set(this.layout.filter(o=>this.game.bases.some(b=>b.hp>0&&
   Math.hypot(b.x-o.x,b.y-o.y)<o.radius*1.35+(b.radius??100)+80)).map(o=>o.id));
  if([...hidden].join(',')===[...this.hidden].join(','))return;
  this.hidden=hidden;this.restoreTerrain.setHidden?.(hidden);
  for(const {mesh,items,matrices} of this.batches){
   mesh.instanceMatrix.array.set(matrices);
   items.forEach((p,i)=>{if(hidden.has(p.oasisId)){
    const offset=i*16;mesh.instanceMatrix.array[offset]=0;mesh.instanceMatrix.array[offset+5]=0;mesh.instanceMatrix.array[offset+10]=0;
   }});mesh.instanceMatrix.needsUpdate=true;
  }
  for(const mesh of this.water)mesh.visible=!hidden.has(mesh.userData.oasisId);
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;this.root.removeFromParent();
  this.root.traverse(n=>{if(n.isInstancedMesh)n.dispose();});
  for(const resource of this.resources)resource.dispose();this.resources.clear();
  this.restoreTerrain();this.root.clear();this.water.length=0;this.batches.length=0;
 }
}
