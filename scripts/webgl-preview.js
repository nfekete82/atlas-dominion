import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Simulation} from '/src/reborn/simulation.js';
import {canyonGroundSampler,rampAtX,ridgeCenterY} from '/src/reborn/canyon-height.js';

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
const game=new Simulation(seed,sizes[bastions]);
const world=game.world,terrain=world.generated,size=world.size,half=size/2;
const status=$('status'),errorNode=$('error'),stage=$('stage');
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
const models=new Map(),ruinMeshes=[],unitModels=new Map(),baseModels=new Map();
let groundMeshes=[],running=false,selected=[],frameTimes=[],last=performance.now(),accumulator=0,elapsed=0;
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
 const texture=sandTexture(),material=new THREE.MeshStandardMaterial({color:'#d7b17d',map:texture,vertexColors:true,roughness:1,metalness:0});
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
   const col=new THREE.Color('#e9c48b').lerp(new THREE.Color('#ab7950'),rocky*.75);
   col.multiplyScalar(nval);
   colors[n]=col.r;colors[n+1]=col.g;colors[n+2]=col.b;
   uv[k*2]=x/135;uv[k*2+1]=z/135;
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
 return chunks*chunks;
}
const pbr=(color,roughness=1,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:true});
function instancedStone(){
 const geometry=new THREE.IcosahedronGeometry(1,1),materials=[pbr('#b99168'),pbr('#9f7351'),pbr('#d4af7b')];
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
async function addRuins(){
 // Every ruin instance is a real glTF triangle mesh with PBR materials.
 const data=await Promise.all([
  tryModel('/src/assets/reborn/canyon-3d/ruin-house.gltf'),
  tryModel('/src/assets/reborn/canyon-3d/ruin-depot.gltf')]);
 for(const [i,ruin] of terrain.ruins.entries()){
  const source=data[ruin.variant===1?1:0].scene.clone(true);
  normalized(source,ruin.width*.98);
  const anchor=new THREE.Group();
  anchor.position.copy(pos(ruin.x,ruin.y));
  anchor.rotation.y=ruin.rotation;
  anchor.add(source);scene.add(anchor);ruinMeshes.push(anchor);
 }
 return ruinMeshes.length;
}
async function addBases(highDetail=true){
 const bases=game.bases.filter(b=>b.hp>0&&b.kind==='headquarters');
 for(const b of bases){baseModels.set(b.id,primitiveBase(b));marker(pos(b.x,b.y),b.owner===0?'#6ce1ff':'#ff8765',112);}
 if(!highDetail)return 0;
 const load=await Promise.allSettled([0,1].map(owner=>tryModel('/src/assets/reborn/buildings-3d/headquarters-'+owner+'.glb')));
 for(const b of bases){
  const data=load[b.owner];if(data.status!=='fulfilled')continue;
  const old=baseModels.get(b.id),model=normalized(data.value.scene.clone(true),170),anchor=new THREE.Group();
  anchor.position.copy(pos(b.x,b.y));anchor.add(model);
  scene.add(anchor);scene.remove(old);baseModels.set(b.id,anchor);
 }
 return load.filter(v=>v.status==='fulfilled').length;
}
function addBastions(){
 const disk=new THREE.CylinderGeometry(39,42,6,10),post=new THREE.CylinderGeometry(12,19,55,8),
  mat=pbr('#baa078'),mast=pbr('#485961',.55,.35);
 for(const t of game.territories){
  const spot=pos(t.point.x,t.point.y);
  const group=new THREE.Group();group.position.copy(spot);
  const base=new THREE.Mesh(disk,mat);base.position.y=3;base.receiveShadow=true;group.add(base);
  const core=new THREE.Mesh(post,mast);core.position.y=30;core.castShadow=true;group.add(core);
  const beacon=new THREE.Mesh(new THREE.ConeGeometry(9,22,8),
   new THREE.MeshStandardMaterial({color:t.owner===0?'#74cefa':t.owner===1?'#ff9876':'#d8c9a4',emissive:t.owner===0?'#074564':'#66301c',emissiveIntensity:.3}));
  beacon.position.y=67;group.add(beacon);scene.add(group);
  marker(spot,t.owner===0?'#68cbef':t.owner===1?'#ec9075':'#c6c6a8',55);
 }
}
const displayUnits=new Map();
function fallbackSoldier(unit){
 const group=new THREE.Group(),team=pbr(unit.owner===0?'#277c9e':'#a15d47',.7,.35);
 const steel=pbr('#3f4143',.73,.38);
 const chest=new THREE.Mesh(new THREE.CapsuleGeometry(8,12,4,8),team);chest.position.y=22;chest.castShadow=true;group.add(chest);
 const helmet=new THREE.Mesh(new THREE.SphereGeometry(10,10,8),steel);helmet.position.y=39;helmet.castShadow=true;group.add(helmet);
 const weapon=new THREE.Mesh(new THREE.BoxGeometry(4,4,28),steel);weapon.position.set(8,24,-12);group.add(weapon);
 group.position.copy(pos(unit.x,unit.y));scene.add(group);return group;
}
async function loadUnits(highDetail=true){
 for(const u of game.units.filter(u=>u.hp>0&&!u.carrier))displayUnits.set(u.id,fallbackSoldier(u));
 if(!highDetail)return 0;
 const data=await Promise.allSettled([0,1].map(owner=>tryModel('/src/assets/reborn/prototype/infantry-'+owner+'.glb')));
 for(const u of game.units.filter(u=>u.hp>0&&!u.carrier)){
  const d=data[u.owner];if(d.status!=='fulfilled')continue;
  const node=normalized(d.value.scene.clone(true),23),anchor=new THREE.Group();
  anchor.position.copy(pos(u.x,u.y));anchor.add(node);
  scene.add(anchor);scene.remove(displayUnits.get(u.id));displayUnits.set(u.id,anchor);
 }
 return data.filter(v=>v.status==='fulfilled').length;
}
function syncUnits(){
 const active=new Set();
 for(const u of game.units.filter(u=>u.hp>0&&!u.carrier)){
  active.add(u.id);
  let group=displayUnits.get(u.id);
  if(!group){group=fallbackSoldier(u);displayUnits.set(u.id,group);}
  group.position.copy(pos(u.x,u.y));
  group.rotation.y=-u.angle+Math.PI*.5;
 }
 for(const [id,group] of displayUnits)if(!active.has(id)){scene.remove(group);displayUnits.delete(id);}
}
const groundRay=new THREE.Raycaster(),pointer=new THREE.Vector2();
function terrainHit(event){
 const rect=renderer.domElement.getBoundingClientRect();
 pointer.x=(event.clientX-rect.left)/rect.width*2-1;
 pointer.y=1-(event.clientY-rect.top)/rect.height*2;
 groundRay.setFromCamera(pointer,camera);
 const hits=groundRay.intersectObjects(groundMeshes,false);
 if(!hits.length)return null;
 const p=hits[0].point;return {x:p.x+half,y:p.z+half};
}
function pointDown(e){renderer.domElement.dataset.downX=String(e.clientX);renderer.domElement.dataset.downY=String(e.clientY);}
function pointUp(e){
 const x=Number(renderer.domElement.dataset.downX),y=Number(renderer.domElement.dataset.downY);
 if(!Number.isFinite(x)||Math.hypot(e.clientX-x,e.clientY-y)>6)return;
 const hit=terrainHit(e);if(!hit)return;
 if(e.button===0){
  const nearest=game.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier)
   .map(u=>({u,d:Math.hypot(u.x-hit.x,u.y-hit.y)})).sort((a,b)=>a.d-b.d)[0];
  selected=nearest&&nearest.d<65?[nearest.u.id]:[];
  $('selection').textContent=selected.length?'Einheit '+selected[0]+' gewählt · Rechtsklick: bewegen':'Keine Einheit gewählt';
 }else if(e.button===2&&selected.length){
  const count=game.command(selected,{x:hit.x,y:hit.y,kind:'attackMove'});
  $('selection').textContent=count?count+' Einheit(en) unterwegs':'Ziel nicht erreichbar';
 }
}
renderer.domElement.addEventListener('pointerdown',pointDown);
renderer.domElement.addEventListener('pointerup',pointUp);
renderer.domElement.addEventListener('contextmenu',event=>event.preventDefault());
$('simulation').onclick=()=>{
 running=!running;$('simulation').textContent=running?'Simulation pausieren':'Simulation starten';
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
addEventListener('keydown',event=>{
 if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
 if(event.code==='KeyQ')spin(-Math.PI/8);
 if(event.code==='KeyE')spin(Math.PI/8);
 if(event.code==='Space'){event.preventDefault();$('simulation').click();}
});
function resize(){
 const w=Math.max(320,stage.clientWidth),h=Math.max(280,stage.clientHeight);
 camera.left=-w/h*480;camera.right=w/h*480;camera.top=480;camera.bottom=-480;
 camera.updateProjectionMatrix();renderer.setSize(w,h,false);
}
new ResizeObserver(resize).observe(stage);resize();
const chunks=buildTerrain(),stones=instancedStone();sandRoads();addBastions();
let lastFrame=performance.now(),frames=0;
function animate(now){
 const dt=Math.min(.08,(now-lastFrame)/1000);lastFrame=now;
 if(running){
  accumulator=Math.min(accumulator+dt,.20);
  let steps=0;while(accumulator>=.05&&steps<4){game.step(.05);accumulator-=.05;steps++;}
  syncUnits();
 }
 controls.update();
 renderer.render(scene,camera);
 frames++;elapsed+=dt;
 if(elapsed>=.5){
  $('fps').textContent=String(Math.round(frames/elapsed));frames=0;elapsed=0;
  $('clock').textContent=Math.floor(game.time)+' s';
 }
}
renderer.setAnimationLoop(animate);
window.__sandforgeWebGL={renderer,scene,camera,controls,game,terrain,heightAt,
 get ruinsLoaded(){return ruinMeshes.length;},
 get loaded(){return status.dataset.ready==='true';},
 get simulationRunning(){return running;},
 sampleGround:(x,z)=>heightAt(x,z)};
async function main(){
 try{
  setStatus('Lade echte 3D-Ruinen …');
  const ruins=await addRuins();
  setStatus('3D-Ruinen geladen. Lade Hauptquartiere und Einheiten …');
  // These large original PBR GLBs are optional, and do not block the terrain.
  status.dataset.ready='true';
  const lightweight=query.get('lite')==='1';
  const [bases,units]=await Promise.allSettled([addBases(!lightweight),loadUnits(!lightweight)]);
  const loadedBases=bases.status==='fulfilled'?bases.value:0;
  const loadedUnits=units.status==='fulfilled'?units.value:0;
  if(bases.status==='rejected')console.warn('HQ model fallback',bases.reason);
  if(units.status==='rejected')console.warn('Unit model fallback',units.reason);
  status.dataset.ready='true';
  setStatus('WebGL2 aktiv · '+chunks+' Terrain-Chunks · '+stones+' Felsen · '+ruins+' echte glTF-Ruinen · '+loadedBases+' HQ-Assetvarianten · '+loadedUnits+' Einheitenvarianten');
 }catch(error){
  console.error(error);errorNode.textContent='3D-Assets konnten nicht geladen werden: '+String(error);
  status.dataset.ready='false';setStatus('WebGL-Szene verfügbar; Asset-Ladevorgang fehlgeschlagen');
 }
}
main();
