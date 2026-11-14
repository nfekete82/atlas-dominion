import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {protectAuthoredGlbMaterials,glbMaterialAudit} from '/webgl-glb-quality.js';
import {applyStrategicGlbFinish} from '/webgl-strategic-glb.js';
import {tintFactionMaterials} from '/webgl-faction-accents.js';

const el=id=>document.getElementById(id);
const query=new URLSearchParams(location.search);
const defaultAsset='/src/assets/reborn/buildings-3d/sandforge_feldkommando_mk2.glb';
el('asset').value=query.get('asset')??defaultAsset;
if(query.has('kind'))el('kind').value=query.get('kind');
if(query.get('mode')==='legacy')el('mode').value='legacy';
const stage=el('stage');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
stage.append(renderer.domElement);

const pmrem=new THREE.PMREMGenerator(renderer);
const environment=new RoomEnvironment();
const env=pmrem.fromScene(environment,.04);
environment.dispose();pmrem.dispose();

function sceneForComparison(){
 const scene=new THREE.Scene();
 scene.background=new THREE.Color('#8f795e');
 scene.environment=env.texture;scene.environmentIntensity=.38;
 scene.add(new THREE.HemisphereLight('#f9e9d7','#756c5a',1.20));
 const sun=new THREE.DirectionalLight('#fff0dd',3.05);
 sun.position.set(-4,8,5);sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-8;
 sun.shadow.camera.right=8;sun.shadow.camera.top=8;
 sun.shadow.camera.bottom=-8;sun.shadow.normalBias=.01;
 scene.add(sun,sun.target);
 const fill=new THREE.DirectionalLight('#d6e6ff',.4);
 fill.position.set(4,5,-3);scene.add(fill);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),
  new THREE.MeshStandardMaterial({color:'#b68f5a',roughness:1}));
 ground.rotation.x=-Math.PI/2;ground.position.y=-.015;ground.receiveShadow=true;
 scene.add(ground);
 return scene;
}
const scenes=[sceneForComparison(),sceneForComparison()];
const camera=new THREE.OrthographicCamera(-5,5,5,-5,.05,250);
camera.position.set(6.4,5,7.8);
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(0,1.4,0);controls.enableDamping=true;
controls.minZoom=.35;controls.maxZoom=4.5;camera.zoom=1;
controls.update();

const loader=new GLTFLoader();
const ktx2=new KTX2Loader().setTranscoderPath('/vendor/three/addons/libs/basis/')
 .detectSupport(renderer);
loader.setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
let active=[],mixers=[],requestId=0,last=performance.now();
function validAsset(asset){
 // The browser inspector may only load in-repository local assets.
 return /^\/src\/assets\/(?:meshy|reborn|stylized)\/[\w./-]+\.glb$/.test(asset)&&
  !asset.includes('..');
}
function fit(root){
 const box=new THREE.Box3().setFromObject(root);
 const size=box.getSize(new THREE.Vector3());
 const extent=Math.max(size.x,size.y,size.z);
 if(!Number.isFinite(extent)||extent<=0)throw Error('GLB ohne gültige 3D-Geometrie');
 const scale=4.8/extent;
 root.scale.multiplyScalar(scale);
 const scaled=new THREE.Box3().setFromObject(root),center=scaled.getCenter(new THREE.Vector3());
 root.position.sub(new THREE.Vector3(center.x,scaled.min.y,center.z));
 root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
}
function removeOld(){
 for(const [scene,model] of active.map((model,i)=>[scenes[i],model]))scene.remove(model);
 // Geometries and textures remain owned by the GLTFLoader cache until refresh.
 active=[];mixers=[];
}
async function load(){
 const id=++requestId,asset=el('asset').value.trim(),kind=el('kind').value;
 const mode=el('mode').value,type=['headquarters','barracks','factory'].includes(kind)?'building':'unit';
 el('error').textContent='';
 if(!validAsset(asset)){el('error').textContent='Nur lokale GLB-Pfade unter /src/assets/ sind erlaubt.';return;}
 el('status').textContent='Lade: '+asset;
 try{
  const data=await loader.loadAsync(asset);
  if(id!==requestId)return;
  removeOld();
  const original=cloneSkeleton(data.scene),game=cloneSkeleton(data.scene);
  if(mode==='legacy'){
   if(type==='building')applyStrategicGlbFinish(game);
   tintFactionMaterials(game,0,kind,type);
  }else protectAuthoredGlbMaterials(game,{maxAnisotropy:renderer.capabilities.getMaxAnisotropy()});
  for(const [i,root] of [original,game].entries()){
   fit(root);scenes[i].add(root);active.push(root);
   if(data.animations.length){
    const mixer=new THREE.AnimationMixer(root);
    const preferred=data.animations.find(clip=>/idle|stand|operation|radar/i.test(clip.name))??data.animations[0];
    mixer.clipAction(preferred).play();mixers.push(mixer);
   }
  }
  el('right-label').textContent=mode==='legacy'?'RECHTS · bisherige Sandforge-Färbung':'RECHTS · originale PBR-Materialien';
  const audit=glbMaterialAudit(original);
  el('status').textContent=asset+' · '+audit.meshes+' Meshes · '+
   audit.triangles.toLocaleString('de-DE')+' Dreiecke · '+
   audit.materials+' Materialien · '+audit.textures+' Texturen · '+
   data.animations.length+' Animationsclips';
  const next=new URL(location.href);next.searchParams.set('asset',asset);
  next.searchParams.set('kind',kind);next.searchParams.set('mode',mode);
  history.replaceState({},'',next.pathname+next.search);
 }catch(e){el('error').textContent='Modell konnte nicht geladen werden: '+String(e.message||e);}
}
el('load').addEventListener('click',load);
el('mode').addEventListener('change',load);
el('asset').addEventListener('keydown',event=>{if(event.key==='Enter')load();});
function resize(){
 const w=Math.max(2,stage.clientWidth),h=Math.max(2,stage.clientHeight);
 renderer.setSize(w,h,false);
 const paneAspect=(w/2)/h;
 camera.left=-4.1*paneAspect;camera.right=4.1*paneAspect;
 camera.top=4.1;camera.bottom=-4.1;camera.updateProjectionMatrix();
}
addEventListener('resize',resize);resize();
function frame(now){
 const delta=Math.min(.05,(now-last)/1000);last=now;
 for(const mixer of mixers)mixer.update(delta);
 controls.update();
 const w=stage.clientWidth,h=stage.clientHeight,half=Math.floor(w/2);
 renderer.setScissorTest(true);
 for(let i=0;i<2;i++){
  const left=i===0?0:half,width=i===0?half:w-half;
  renderer.setViewport(left,0,width,h);renderer.setScissor(left,0,width,h);
  renderer.render(scenes[i],camera);
 }
 renderer.setScissorTest(false);
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
load();
