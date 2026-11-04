import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Simulation} from '/src/reborn/simulation.js';
import {canyonGroundSampler,rampAtX,ridgeCenterY} from '/src/reborn/canyon-height.js';
import {SandforgeBattlefield} from '/webgl-battlefield.js';
import {DesertArtPass} from '/webgl-environment.js';
import {SandforgeCombatEffects} from '/webgl-combat-vfx.js';
import {addVisualPerimeter} from '/webgl-perimeter.js';
import {Soundscape} from '/src/reborn/audio.js';
import {fineSandPattern} from '/src/reborn/fine-sand.js';

/** Opt-in WebGL scene using the real authoritative Sandforge map and simulation.
 * This page is isolated from the production Canvas renderer, save format and AI
 * benchmarks. The 3D camera never changes the simulation's map coordinates. */
const $=id=>document.getElementById(id);
const query=new URLSearchParams(location.search);
const sizes={4:15,8:16,12:17,16:18};
const bastions=Object.hasOwn(sizes,query.get('bastions'))?Number(query.get('bastions')):8;
const inputSeed=query.get('seed');
const seed=inputSeed!==null&&Number.isSafeInteger(Number(inputSeed))&&Number(inputSeed)>=0
  ?Number(inputSeed)>>>0:2026;
$('bastions').value=String(bastions);$('seed').value=String(seed);
// Preview uses the same authoritative save/load envelope as the 2D game.
const session=query.get('resume')==='1'?(()=>{
 try{
  const saved=localStorage.getItem('sandforge:webgl:v1');
  if(!saved)return null;
  const restored=Simulation.load(JSON.parse(saved));
  return restored.seed===seed&&restored.world.mapVersion===sizes[bastions]?restored:null;
 }catch(error){console.warn('Saved 3D game could not be loaded:',error);return null;}
})():null;
const game=session??new Simulation(seed,sizes[bastions]);
const world=game.world,terrain=world.generated,size=world.size,half=size/2;
const status=$('status'),errorNode=$('error'),stage=$('stage');
$('simulation').textContent=query.get('pause')==='1'?'Simulation starten':'Simulation pausieren';
$('simulation').setAttribute('aria-pressed',String(query.get('pause')!=='1'));
const setStatus=value=>{status.textContent=value;};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const rnd=seed=>{let s=seed>>>0;return ()=>{s=(s+0x6d2b79f5)>>>0;let n=s;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};};
const random=rnd(seed^0xb6aa3371),ridge=terrain.ridges[0];
const heightAt=canyonGroundSampler(seed,terrain.ridges);
const rampAt=x=>ridge?rampAtX(ridge,x):false;
const pos=(x,z,y=heightAt(x,z))=>new THREE.Vector3(x-half,y,z-half);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.17;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));
stage.append(renderer.domElement);
const scene=new THREE.Scene();
scene.background=new THREE.Color('#bea17b');
scene.fog=new THREE.FogExp2('#bea17b',.00011);
scene.add(new THREE.HemisphereLight('#fff0d6','#6c4c33',2.05));
const sun=new THREE.DirectionalLight('#ffe6bd',3.3);
sun.position.set(-700,1100,420);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-1250;sun.shadow.camera.right=1250;
sun.shadow.camera.top=1250;sun.shadow.camera.bottom=-1250;
sun.shadow.camera.near=1;sun.shadow.camera.far=3000;
sun.shadow.bias=-.00006;sun.shadow.normalBias=.038;
sun.target.position.set(0,0,0);scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight('#b9d6dc',.65);
fill.position.set(650,500,-450);scene.add(fill);
const camera=new THREE.OrthographicCamera(-680,680,410,-410,10,12000);
// Initial framing presents a real ruin and the adjacent ridge in one view,
 // rather than an empty central section of sand.
 const feature=terrain.ruins.slice().sort((a,b)=>
  Math.hypot(a.x-half,a.y-half)-Math.hypot(b.x-half,b.y-half))[0];
 const focalX=feature?.x??half;
 const focalZ=feature&&ridge?(feature.y+ridgeCenterY(ridge,feature.x))*.5:half;
 const cameraTarget=new THREE.Vector3(focalX-half,heightAt(focalX,focalZ)+42,focalZ-half);
camera.position.copy(cameraTarget).add(new THREE.Vector3(1050,1200,1450));
camera.lookAt(cameraTarget);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.10;
controls.screenSpacePanning=true;
controls.minZoom=.25;controls.maxZoom=5;
controls.minPolarAngle=.34;controls.maxPolarAngle=1.22;
controls.mouseButtons={LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.ROTATE};
controls.target.copy(cameraTarget);
const loader=new GLTFLoader();
const models=new Map(),ruinMeshes=[];
// A player campaign starts LIVE, as in the original Canvas RTS. Orders must
// never appear accepted while an unannounced preview-level pause blocks ticks.
game.paused=false;
let groundMeshes=[],running=query.get('pause')!=='1',accumulator=0,elapsed=0;
let visualPerimeter=null;
function sandTexture(){
 const c=document.createElement('canvas');c.width=c.height=256;
 const ctx=c.getContext('2d'),pixels=ctx.createImageData(256,256),r=rnd(seed^0x192cb110);
 for(let i=0;i<256*256;i++){
  const grain=r(),v=208+grain*42,off=i*4;
  pixels.data[off]=v+7;pixels.data[off+1]=v+3;pixels.data[off+2]=v-4;pixels.data[off+3]=255;
 }
 ctx.putImageData(pixels,0,0);
 for(let i=0;i<450;i++){
  const x=r()*256,y=r()*256,rad=.25+r()*1.6;
  ctx.fillStyle=r()>.50?'rgba(79,57,34,.17)':'rgba(255,242,201,.28)';
  ctx.beginPath();ctx.ellipse(x,y,rad,rad*.65,0,0,Math.PI*2);ctx.fill();
 }
 for(let i=0;i<36;i++){
  const x=r()*256,y=r()*256;
  ctx.strokeStyle='rgba(255,240,210,.12)';ctx.lineWidth=.5+r();
  ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+20,y-3,x+44,y+2,x+75,y-2);ctx.stroke();
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
 return t;
}
function buildTerrain(){
 const texture=sandTexture(),material=new THREE.MeshStandardMaterial({color:'#f5eadb',map:texture,vertexColors:true,roughness:.99,metalness:0});
 // The buildings-3d/desert-basecolor.png is a *model material atlas*,
 // with hazard stripes, blue and red panels! Tiling it over the world caused
 // the obvious checkerboard terrain. Reuse the original Sandforge 2K sand
 // artwork, edge-blended with the SAME fineSandPattern as the Canvas RTS.
 const source=new Image();
 source.onload=()=>{
  try{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=2048;
   const context=canvas.getContext('2d');
   context.fillStyle=fineSandPattern(context,source);
   context.fillRect(0,0,canvas.width,canvas.height);
   const sand=new THREE.CanvasTexture(canvas);
   sand.colorSpace=THREE.SRGBColorSpace;
   sand.wrapS=sand.wrapT=THREE.RepeatWrapping;
   sand.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
   material.map=sand;
   // The model's normal atlas must NOT be applied to the landscape either.
   material.normalMap=null;
   material.needsUpdate=true;
   texture.dispose();
   console.info('Sandforge 3D terrain: seamless original sand artwork loaded');
  }catch(error){console.warn('Original sand unavailable; keeping procedural sand',error);}
 };
 source.onerror=()=>console.warn('Sand source unavailable; keeping procedural sand');
 source.src='/src/assets/reborn/sand-ripples-v2.png';
 const chunks=4,segments=56,patch=size/chunks;
 for(let cy=0;cy<chunks;cy++)for(let cx=0;cx<chunks;cx++){
  const count=(segments+1)**2,vertices=new Float32Array(count*3),
   colors=new Float32Array(count*3),uv=new Float32Array(count*2),indices=[];
  for(let j=0;j<=segments;j++)for(let i=0;i<=segments;i++){
   const x=(cx+i/segments)*patch,z=(cy+j/segments)*patch;
   const h=heightAt(x,z),k=j*(segments+1)+i,n=k*3;
   vertices[n]=x-half;vertices[n+1]=h;vertices[n+2]=z-half;
   const slope=Math.abs(heightAt(x,z-24)-heightAt(x,z+24))/48;
   const rocky=smooth((slope-.20)/.9);
   const nval=.96+.055*Math.sin(x*.013+z*.009)+.025*Math.cos(x*.071-z*.032);
   const bands=(Math.sin(h*.19+x*.003+z*.002)*.5+.5)*rocky;
   const col=new THREE.Color('#faf1e0').lerp(new THREE.Color('#b58b63'),rocky*.65+bands*.12);
   col.multiplyScalar(nval);
   colors[n]=col.r;colors[n+1]=col.g;colors[n+2]=col.b;
   uv[k*2]=x/1500;uv[k*2+1]=z/1500;
  }
  for(let j=0;j<segments;j++)for(let i=0;i<segments;i++){
   const a=j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;
   indices.push(a,c,b,b,c,d);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);
  mesh.receiveShadow=true;mesh.userData.terrain=true;
  scene.add(mesh);groundMeshes.push(mesh);
 }
 // A ring of lower-detail sand continues beyond all four visible edges.
 // Only the 16 central tiles feed fog, unit movement or clicking. The extra
 // 48 tiles are decorative and share the same texture and height sampler.
 visualPerimeter=addVisualPerimeter({scene,size,heightAt,material,ringTiles:2,segments:24});
 return chunks*chunks;
}
const pbr=(color,roughness=1,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:true});
function instancedStone(){
 const geometry=new THREE.IcosahedronGeometry(1,2),materials=[pbr('#bd9a72'),pbr('#9f7758'),pbr('#d6ad77')];
 // Irregular weathering breaks the obvious smooth polygon-egg silhouettes.
 // It operates once on the shared instanced mesh, not per boulder or frame.
 const positions=geometry.getAttribute('position');
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
  const noise=Math.sin(x*11.1+z*7.7)*Math.cos(y*8.9-z*3.4)*.065+
   Math.sin(x*23.2-y*5.6+z*13.3)*.024;
  const width=1+noise;
  positions.setXYZ(i,x*width,y*(1+noise*.57),z*width);
 }
 positions.needsUpdate=true;geometry.computeVertexNormals();
 const sandstone=new THREE.TextureLoader();
 sandstone.load('/src/assets/reborn/sandstone-detail.png',image=>{
  image.wrapS=image.wrapT=THREE.RepeatWrapping;
  image.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  image.colorSpace=THREE.SRGBColorSpace;
  for(const mat of materials){mat.map=image;mat.needsUpdate=true;}
 },undefined,error=>console.warn('Rock detail unavailable; solid sandstone fallback',error));
 const dummy=new THREE.Object3D(),groups=materials.map(mat=>new THREE.InstancedMesh(geometry,mat,1100));
 const counts=[0,0,0],r=rnd(seed^0x73c02f4b);
 const put=(x,z,wide,tall,depth)=>{
  const k=Math.floor(r()*3);if(counts[k]>=1100)return;
  dummy.position.set(x-half,heightAt(x,z)+tall*.43,z-half);
  dummy.scale.set(wide,tall,depth);
  dummy.rotation.set((r()-.5)*.18,r()*6.28,(r()-.5)*.20);
  dummy.updateMatrix();groups[k].setMatrixAt(counts[k]++,dummy.matrix);
 };
 // Rough cliff faces and weathered sandstone ledges, skipping real ramps.
 for(const ridge of terrain.ridges)for(let i=1;i<ridge.spine.length;i++){
  const a=ridge.spine[i-1],b=ridge.spine[i],length=Math.hypot(b.x-a.x,b.y-a.y);
  for(let k=0;k<Math.ceil(length/26);k++){
   const t=(k+r()*.7)/Math.ceil(length/26),x=a.x+(b.x-a.x)*t,z=a.y+(b.y-a.y)*t;
   if(rampAt(x))continue;
   for(let j=0;j<2;j++){
    const dz=(r()-.5)*68,wide=9+r()*22,tall=16+r()*26;
    put(x+(r()-.5)*17,z+dz,wide,tall,11+r()*20);
   }
  }
 }
 for(const mesa of terrain.mesas)for(const col of mesa.columns){
  const x=col.base.reduce((n,p)=>n+p.x,0)/col.base.length;
  const z=col.base.reduce((n,p)=>n+p.y,0)/col.base.length;
  put(x,z,20+r()*28,30+r()*55,18+r()*25);
  for(let i=0;i<2;i++)put(x+(r()-.5)*55,z+(r()-.5)*55,8+r()*16,8+r()*26,8+r()*15);
 }
 for(let i=0;i<1600;i++){
  const x=75+r()*(size-150),z=75+r()*(size-150),index=world.index({x,y:z});
  if(index<0||world.blocked[index]||terrain.sites.some(p=>Math.hypot(x-p.x,z-p.y)<160))continue;
  put(x,z,2+r()*5,1+r()*4,2+r()*6);
 }
 for(let i=0;i<groups.length;i++){
  groups[i].count=counts[i];groups[i].instanceMatrix.needsUpdate=true;
  groups[i].castShadow=false;groups[i].receiveShadow=true;scene.add(groups[i]);
 }
 return counts.reduce((a,b)=>a+b,0);
}
function sandRoads(){
 // Discontinuous sandy tire marks share one GPU draw call, not thousands of
 // individual meshes. Gaps and imperfect widths imply old worn tracks.
 const material=pbr('#99704b'),geometry=new THREE.PlaneGeometry(1,1);
 geometry.rotateX(-Math.PI/2);
 const r=rnd(seed^0x2023cb47),dummy=new THREE.Object3D();
 const tracks=new THREE.InstancedMesh(geometry,material,5000);
 let count=0;
 for(const [a,b] of terrain.corridors){
  if(r()>.7)continue;
  const dx=b.x-a.x,dz=b.y-a.y,d=Math.hypot(dx,dz),steps=Math.floor(d/36);
  const heading=Math.atan2(dx,dz);
  for(let i=0;i<steps;i++){
   if(i%9===0||r()>.72||count>=4998)continue;
   const t=(i+.5)/steps,x=a.x+dx*t,z=a.y+dz*t;
   const index=world.index({x,y:z});
   if(index<0||world.blocked[index])continue;
   for(const offset of [-14,14]){
    const px=x+offset*Math.cos(heading),pz=z-offset*Math.sin(heading);
    dummy.position.set(px-half,heightAt(px,pz)+.46,pz-half);
    dummy.scale.set(4+r()*3,1,16+r()*7);
    dummy.rotation.set(0,heading,0);dummy.updateMatrix();
    tracks.setMatrixAt(count++,dummy.matrix);
   }
  }
 }
 tracks.count=count;
 tracks.instanceMatrix.needsUpdate=true;
 tracks.frustumCulled=false;
 scene.add(tracks);
}
function marker(position,color,radius=37){
 const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,2.3,6,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.86}));
 ring.rotation.x=-Math.PI/2;ring.position.copy(position);ring.position.y+=2.1;
 scene.add(ring);return ring;
}
function primitiveBase(base){
 const group=new THREE.Group();const owner=base.owner;
 const wall=pbr(owner===0?'#5c91a8':'#a57753',.75,.33),roof=pbr('#bda884'),detail=pbr('#41494a',.62,.54);
 const add=(geo,mat,x,y,z)=>{const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);};
 add(new THREE.CylinderGeometry(89,98,7,8),pbr('#665d4a'),0,3,0);
 add(new THREE.BoxGeometry(128,55,110),wall,0,34,0);
 add(new THREE.BoxGeometry(138,12,118),roof,0,67,0);
 add(new THREE.BoxGeometry(52,28,48),detail,0,84,-12);
 for(const x of [-48,48])add(new THREE.CylinderGeometry(7,11,59,8),detail,x,104,-22);
 group.position.copy(pos(base.x,base.y));scene.add(group);return group;
}
function normalized(node,width){
 node.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(node),extent=box.getSize(new THREE.Vector3());
 if(extent.x<.0001||extent.z<.0001)return node;
 const factor=width/Math.max(extent.x,extent.z);
 node.scale.multiplyScalar(factor);
 node.position.set(-box.getCenter(new THREE.Vector3()).x*factor,-box.min.y*factor,-box.getCenter(new THREE.Vector3()).z*factor);
 node.traverse(obj=>{if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;}});
 return node;
}
async function tryModel(url){
 if(!models.has(url))models.set(url,loader.loadAsync(url).catch(err=>{models.delete(url);throw err;}));
 return models.get(url);
}
// Rough plaster material and cracks are shared across every imported real
// ruin mesh. Original glTF triangles have normals but no UVs, so assign
// face-oriented UV coordinates before adding textured masonry weathering.
function makeRuinGrit(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const c=canvas.getContext('2d'),image=c.createImageData(512,512),random=rnd(seed^0x8174c2aa);
 for(let i=0;i<512*512;i++){
  const j=i*4,noise=(random()-.5)*31,shade=226+noise;
  image.data[j]=shade+7;image.data[j+1]=shade+2;image.data[j+2]=shade-5;image.data[j+3]=255;
 }
 c.putImageData(image,0,0);
 for(let i=0;i<130;i++){
  const x=random()*512,y=random()*512,size=3+random()*44;
  c.fillStyle='rgba(72,54,38,'+(.015+random()*.085)+')';
  c.beginPath();c.ellipse(x,y,size*.95,size*.4,random()*Math.PI,0,Math.PI*2);c.fill();
 }
 for(let i=0;i<35;i++){
  const x=random()*512,y=random()*512;
  c.strokeStyle='rgba(87,69,53,'+(.07+random()*.11)+')';c.lineWidth=.5+random()*1.3;
  c.beginPath();c.moveTo(x,y);
  c.lineTo(x+(random()-.5)*48,y+random()*70);
  c.lineTo(x+(random()-.5)*100,y+random()*96);c.stroke();
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;
 texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
 return texture;
}
const ruinGrit=makeRuinGrit();
function weatherRuinMeshes(node){
 node.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const geometry=mesh.geometry,positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
  if(positions&&!geometry.getAttribute('uv')){
   const uv=new Float32Array(positions.count*2);
   for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const nx=Math.abs(normals?.getX(i)??0),ny=Math.abs(normals?.getY(i)??0),nz=Math.abs(normals?.getZ(i)??0);
    const u=ny>nx&&ny>nz?x:nx>nz?z:x;
    const v=ny>nx&&ny>nz?z:y;
    uv[i*2]=u*.9;uv[i*2+1]=v*.9;
   }
   geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  }
  const upgrade=m=>{
   const value=m.clone();
   if(/plaster|sandstone|concrete|roof|rubble|dust/i.test(value.name||'')){
    value.map=ruinGrit;value.bumpMap=ruinGrit;value.bumpScale=.09;
    value.roughness=1;value.metalness=0;value.needsUpdate=true;
   }
   return value;
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(upgrade):upgrade(mesh.material);
  mesh.castShadow=mesh.receiveShadow=true;
 });
}
async function addRuins(){
 // Every ruin instance is a real glTF triangle mesh with PBR materials.
 const data=await Promise.all([
  tryModel('/src/assets/reborn/canyon-3d/ruin-house.gltf'),
  tryModel('/src/assets/reborn/canyon-3d/ruin-depot.gltf')]);
 for(const [i,ruin] of terrain.ruins.entries()){
  const source=data[ruin.variant===1?1:0].scene.clone(true);
  weatherRuinMeshes(source);
  normalized(source,ruin.width*.98);
  const anchor=new THREE.Group();
  anchor.position.copy(pos(ruin.x,ruin.y));
  anchor.rotation.y=ruin.rotation;
  anchor.add(source);scene.add(anchor);ruinMeshes.push(anchor);
 }
 return ruinMeshes.length;
}
$('simulation').onclick=()=>{
 running=!running;$('simulation').textContent=running?'Simulation pausieren':'Simulation starten';
 if(!running)sound.pause();
 $('simulation').setAttribute('aria-pressed',String(running));
};
$('rotate-left').onclick=()=>spin(-Math.PI/4);
$('rotate-right').onclick=()=>spin(Math.PI/4);
function spin(angle){
 const offset=camera.position.clone().sub(controls.target);
 offset.applyAxisAngle(new THREE.Vector3(0,1,0),angle);
 camera.position.copy(controls.target).add(offset);
 camera.lookAt(controls.target);controls.update();
}
$('home').onclick=()=>{
 controls.target.copy(cameraTarget);camera.position.copy(cameraTarget).add(new THREE.Vector3(1050,1200,1450));
 camera.zoom=1;camera.updateProjectionMatrix();controls.update();
};
$('load').onclick=()=>{
 const q=new URLSearchParams({bastions:$('bastions').value,seed:String(Number($('seed').value)>>>0)});
 location.href='/webgl-preview.html?'+q;
};
// Camera navigation is independent of the simulation. WASD and cursor keys
// work during pause; F becomes attack-move so A remains free for panning.
const panKeys=new Set();
const panControls=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight']);
const forward=new THREE.Vector3(),right=new THREE.Vector3(),deltaPan=new THREE.Vector3();
const typing=()=>['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)||
 document.activeElement?.isContentEditable===true;
addEventListener('keydown',event=>{
 if(typing()||event.ctrlKey||event.metaKey||event.altKey)return;
 if(panControls.has(event.code)){
  event.preventDefault();panKeys.add(event.code);return;
 }
 if(event.repeat)return;
 if(event.code==='KeyQ'){event.preventDefault();spin(-Math.PI/8);}
 if(event.code==='KeyE'){event.preventDefault();spin(Math.PI/8);}
 if(event.code==='Space'){event.preventDefault();$('simulation').click();}
});
addEventListener('keyup',event=>panKeys.delete(event.code));
addEventListener('blur',()=>panKeys.clear());
function stepCamera(dt){
 let horizontal=Number(panKeys.has('KeyD')||panKeys.has('ArrowRight'))-
  Number(panKeys.has('KeyA')||panKeys.has('ArrowLeft'));
 let vertical=Number(panKeys.has('KeyW')||panKeys.has('ArrowUp'))-
  Number(panKeys.has('KeyS')||panKeys.has('ArrowDown'));
 const magnitude=Math.hypot(horizontal,vertical);
 if(magnitude){
  camera.updateMatrixWorld();
  right.setFromMatrixColumn(camera.matrixWorld,0).setY(0).normalize();
  camera.getWorldDirection(forward);forward.y=0;forward.normalize();
  const speed=(770/Math.max(.25,camera.zoom))*Math.min(.08,dt)/magnitude;
  deltaPan.copy(right).multiplyScalar(horizontal*speed).addScaledVector(forward,vertical*speed);
  camera.position.add(deltaPan);controls.target.add(deltaPan);
 }
 // Keep the camera looking over the drawn desert. Units still cannot leave
 // World.indexXY 0..size and the 3D perimeter is never a raycast target.
 const cameraLimit=Math.max(200,visualPerimeter?.margin??size*.5)*.80;
 const edge=half+cameraLimit;
 const x=Math.max(-edge,Math.min(edge,controls.target.x));
 const z=Math.max(-edge,Math.min(edge,controls.target.z));
 const fixX=x-controls.target.x,fixZ=z-controls.target.z;
 if(fixX||fixZ){camera.position.x+=fixX;camera.position.z+=fixZ;controls.target.x=x;controls.target.z=z;}
}
function resize(){
 const w=Math.max(320,stage.clientWidth),h=Math.max(280,stage.clientHeight);
 camera.left=-w/h*480;camera.right=w/h*480;camera.top=480;camera.bottom=-480;
 camera.updateProjectionMatrix();renderer.setSize(w,h,false);
}
new ResizeObserver(resize).observe(stage);resize();
const chunks=buildTerrain(),stones=instancedStone();sandRoads();
const battlefield=new SandforgeBattlefield({
 game,world,terrain,scene,renderer,camera,controls,loader,groundMeshes,heightAt,pos,
 lite:query.get('lite')==='1'
});
const desertArt=new DesertArtPass({scene,world,terrain,heightAt,pos,loader,lowQuality:query.get('lite')==='1'});
const effects=new SandforgeCombatEffects({scene,camera,game,world,heightAt,pos,lowQuality:query.get('lite')==='1'});
const sound=new Soundscape();
sound.setEnabled(false);
const soundView={
 get width(){return renderer.domElement.clientWidth;},
 get height(){return renderer.domElement.clientHeight;},
 get camera(){return {x:controls.target.x+half,y:controls.target.z+half,zoom:camera.zoom};},
 screen(p){
  const v=new THREE.Vector3(p.x-half,heightAt(p.x,p.y)+22,p.y-half).project(camera);
  return {x:(v.x*.5+.5)*renderer.domElement.clientWidth,
          y:(.5-v.y*.5)*renderer.domElement.clientHeight};
 }
};
battlefield.sound=sound;
$('sound').onclick=async()=>{
 const enabled=!sound.enabled;
 sound.setEnabled(enabled);
 try{
  if(enabled)await sound.unlock();
  else sound.silenceScene();
  $('sound').textContent=enabled?'Sound ausschalten':'Sound einschalten';
  $('sound').setAttribute('aria-pressed',String(enabled));
 }catch(error){
  sound.setEnabled(false);
  $('sound').textContent='Sound einschalten';
  $('sound').setAttribute('aria-pressed','false');
  console.warn('WebAudio unavailable',error);
 }
};

let lastFrame=performance.now(),frames=0;
function animate(now){
 const dt=Math.min(.08,(now-lastFrame)/1000);lastFrame=now;
 if(running){
  accumulator=Math.min(accumulator+dt,.20);
  let steps=0;while(accumulator>=.05&&steps<4){game.step(.05);accumulator-=.05;steps++;}
  battlefield.sync(false,dt);
 }
 if(!running)battlefield.sync(false,dt);
 effects.update(dt,running);
 if(running&&sound.enabled)sound.update(game,soundView);
 stepCamera(dt);
 controls.update();
 renderer.render(scene,camera);
 frames++;elapsed+=dt;
 if(elapsed>=.5){
  $('fps').textContent=String(Math.round(frames/elapsed));frames=0;elapsed=0;
  $('clock').textContent=Math.floor(game.time)+' s';
 }
}
renderer.setAnimationLoop(animate);
window.__sandforgeWebGL={renderer,scene,camera,controls,game,terrain,heightAt,battlefield,effects,sound,visualPerimeter,panKeys,
 get ruinsLoaded(){return ruinMeshes.length;},
 get loaded(){return status.dataset.ready==='true';},
 get simulationRunning(){return running;},
 sampleGround:(x,z)=>heightAt(x,z)};
async function main(){
 try{
  setStatus('Lade echte 3D-Ruinen …');
  const ruins=await addRuins();
  desertArt.load().then(count=>{console.info('3D environment props',count);}).catch(error=>console.warn('Desert detail fallback',error));
  // The 3D battlefield is live immediately; heavyweight PBR assets stream in.
  battlefield.sync(true);
  status.dataset.ready='true';
  setStatus('WebGL2 aktiv · '+chunks+' Terrain-Chunks · '+stones+' Felsen · '+ruins+' glTF-Ruinen · 3D-Spielmechanik aktiv.');
 }catch(error){
  console.error(error);errorNode.textContent='3D-Assets konnten nicht geladen werden: '+String(error);
  status.dataset.ready='false';setStatus('WebGL-Szene verfügbar; Asset-Ladevorgang fehlgeschlagen');
 }
}
main();
