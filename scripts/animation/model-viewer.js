import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
const stage=document.getElementById('stage'),renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;stage.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#9e7448');scene.fog=new T.Fog('#9e7448',12,28);
const pmrem=new T.PMREMGenerator(renderer),environment=new RoomEnvironment();scene.environment=pmrem.fromScene(environment,.04).texture;scene.environmentIntensity=.35;environment.dispose();pmrem.dispose();
const camera=new T.PerspectiveCamera(32,1,.01,100);camera.position.set(2.4,2.1,3.7);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1,.1);controls.enableDamping=true;controls.minDistance=1.7;controls.maxDistance=8;controls.maxPolarAngle=Math.PI*.51;
scene.add(new T.HemisphereLight('#dfecff','#6c482b',1.7));const sun=new T.DirectionalLight('#ffe8cd',3.4);sun.position.set(-3,7,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=sun.shadow.camera.bottom=-3;sun.shadow.camera.right=sun.shadow.camera.top=3;sun.shadow.normalBias=.005;sun.shadow.radius=2;scene.add(sun);
const fill=new T.DirectionalLight('#b5d9fa',1.1);fill.position.set(4,3,-4);scene.add(fill);
const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#b8915a',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.03;ground.receiveShadow=true;scene.add(ground);
const grid=new T.GridHelper(8,40,'#a67f52','#b08a57');grid.position.y=-.025;scene.add(grid);
const loader=new GLTFLoader(),cache=new Map();
// Each download is self-contained, but the gallery must not allocate three
// new 2K GPU textures for every cached faction/model. Match embedded bytes,
// rather than names, so edited GLBs can safely coexist with the current atlas.
const sharedBuildingTextures=new Map();
async function reuseBuildingTextures(data){
 const hashes=new Map();
 for(const texture of data.parser.json.textures??[]){
  if(!texture.name?.startsWith('Atlas desert |')&&!['Desert camouflage / scratches','Sandblasted metal normal','Packed occlusion roughness metallic'].includes(texture.name))continue;
  const image=data.parser.json.images[texture.source],bytes=await data.parser.getDependency('bufferView',image.bufferView);
  let hash;
  if(globalThis.crypto?.subtle){const digest=await crypto.subtle.digest('SHA-256',bytes);hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');}
  else{
   // LAN previews may use HTTP without Web Crypto. Compare exact embedded
   // bytes in that case; the cache key is only an allocation optimization.
   const candidates=reuseBuildingTextures.bytes??=new Map(),entries=candidates.get(texture.name)??[],array=new Uint8Array(bytes);
   let entry=entries.find(e=>e.bytes.length===array.length&&e.bytes.every((v,i)=>v===array[i]));
   if(!entry){entry={bytes:array,id:texture.name+':'+entries.length};entries.push(entry);candidates.set(texture.name,entries);}hash=entry.id;
  }
  hashes.set(texture.name,hash);
 }
 const replaced=new Set(),activeSources=new Set();
 data.scene.traverse(n=>{if(!n.isMesh)return;for(const m of Array.isArray(n.material)?n.material:[n.material])for(const field of ['map','normalMap','roughnessMap','metalnessMap','aoMap']){
  const texture=m[field],hash=texture&&hashes.get(texture.name);if(!hash)continue;
  const key=[hash,texture.colorSpace,texture.channel,texture.flipY,texture.wrapS,texture.wrapT,texture.minFilter,texture.magFilter].join(':');
  if(!sharedBuildingTextures.has(key))sharedBuildingTextures.set(key,texture);
  const shared=sharedBuildingTextures.get(key);m[field]=shared;activeSources.add(shared.source);if(texture!==shared)replaced.add(texture);
 }});
 const closed=new Set();for(const texture of replaced){texture.dispose();if(!activeSources.has(texture.source)&&!closed.has(texture.source)){texture.source.data.close?.();closed.add(texture.source);}}
}
const vehicleNames={rover:'Humvee',tank:'Panzer',artillery:'Artillerie',scout:'Transporthelikopter',bomber:'Bomber'};
const isVehicle=model=>Object.hasOwn(vehicleNames,model);
const modelPath=(model,faction)=>model==='infantry'?'/src/assets/reborn/prototype/infantry-'+faction+'.glb':isVehicle(model)?'/src/assets/reborn/animation/'+model+'-'+faction+'.glb':'/src/assets/reborn/buildings-3d/'+model+'-'+faction+'.glb';
/** The authored PBR bomber uses full-size aircraft coordinates (19.5 units
 * wingtip-to-wingtip); the model gallery uses a compact 8-unit ground grid.
 * Fit only the gallery instance, not the source GLB or the baked battle sprites.
 * Safe for cached models: a second call preserves the target dimensions. */
function fitBomberPreview(model){
 const box=new T.Box3().setFromObject(model);
 const size=box.getSize(new T.Vector3());
 const maxExtent=Math.max(size.x,size.y,size.z);
 if(!(Number.isFinite(maxExtent)&&maxExtent>0))throw Error('Invalid Bomber GLB bounds');
 model.scale.multiplyScalar(3.4/maxExtent);
 model.updateMatrixWorld(true);
 const fitted=new T.Box3().setFromObject(model);
 model.position.y-=fitted.min.y;
 model.updateMatrixWorld(true);
}
let kind='infantry',team=0,current=null,currentData=null,mixer=null,action=null,clip='Idle',paused=false,request=0;
async function faction(value){team=value;const token=++request,key=kind+':'+value,url=modelPath(kind,value);document.getElementById('status').textContent='Modell wird geladen …';document.getElementById('error').textContent='';let data=cache.get(key);if(!data){data=await loader.loadAsync(url);await reuseBuildingTextures(data);delete data.parser;cache.set(key,data);}if(token!==request)return;
 if(current){mixer?.stopAllAction();mixer?.uncacheRoot(current);scene.remove(current);}current=data.scene;if(kind==='bomber')fitBomberPreview(current);if(kind==='scout'&&!current.userData.previewFitted){fitBomberPreview(current);current.userData.previewFitted=true;}currentData=data;scene.add(current);let design;current.traverse(n=>{if(n.isMesh)n.castShadow=n.receiveShadow=true;if(n.userData.atlasDesign)design=n.userData.atlasDesign;});mixer=new T.AnimationMixer(current);action=null;if(data.animations.length)play(kind==='infantry'?(clip==='Operation'||!data.animations.some(c=>c.name===clip)?'Idle':clip):'Operation');else clip='';
 const bounds=new T.Box3().setFromObject(current),extent=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),distance=Math.max(.6,extent.x,extent.y,extent.z)*(kind==='infantry'?1.8:2.3);controls.target.copy(center);camera.position.set(center.x+distance*.60,center.y+distance*.43,center.z+distance*.98);controls.minDistance=Math.max(.7,extent.length()*.35);controls.maxDistance=kind==='bomber'?Math.min(distance*3,14):kind==='scout'?Math.min(distance*3,10):distance*3;controls.update();
 for(const [id,t] of [['blue',0],['red',1],['neutral',-1]])document.getElementById(id).setAttribute('aria-pressed',String(t===team));document.getElementById('neutral').hidden=kind!=='bastion';
 for(const b of document.querySelectorAll('[data-clip]'))b.hidden=data.animations.length===0|| (kind==='infantry'?b.dataset.clip==='Operation':b.dataset.clip!=='Operation');document.getElementById('pause').hidden=data.animations.length===0;
 document.getElementById('download').href=url;
 const label=kind==='infantry'?'Legionär':vehicleNames[kind]??design?.name??kind;
 stage.setAttribute('aria-label','Drehbare 3D-Ansicht: '+label);
 document.getElementById('model-title').textContent=label+' · '+(data.animations.length?'animiertes 3D-Modell':'3D-Modell');
 let meshCount=0,triangleCount=0;current.traverse(n=>{if(n.isMesh){meshCount++;triangleCount+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;}});
 const parts=design?.parts??meshCount,triangles=design?.triangles??triangleCount;
 document.getElementById('status').textContent=`${parts} Bauteile · ${Math.round(triangles).toLocaleString('de-DE')} Dreiecke · ${data.animations.length?data.animations.length+' echte Clips':isVehicle(kind)?'Bewegungsphasen im Spriteatlas':'Keine Animationsclips'} · Modell mit der Maus drehen`;
}
function play(name){clip=name;if(!mixer)return;mixer.stopAllAction();if(name==='Operation'){for(const c of currentData.animations)mixer.clipAction(c).reset().setLoop(T.LoopRepeat,Infinity).play();}else{action=mixer.clipAction(currentData.animations.find(c=>c.name===name));action.reset();action.setLoop(['Death','HitReact','Idle_Shoot'].includes(name)?T.LoopOnce:T.LoopRepeat,Infinity);action.clampWhenFinished=true;action.play();}mixer.update(0);for(const b of document.querySelectorAll('[data-clip]'))b.setAttribute('aria-pressed',String(b.dataset.clip===name));}
for(const b of document.querySelectorAll('[data-clip]'))b.onclick=()=>play(b.dataset.clip);for(const [id,t] of [['blue',0],['red',1],['neutral',-1]])document.getElementById(id).onclick=()=>faction(t).catch(fail);
document.getElementById('model').onchange=event=>{kind=event.target.value;faction(team===-1&&kind!=='bastion'?0:team).catch(fail);};
document.getElementById('pause').onclick=()=>{paused=!paused;document.getElementById('pause').textContent=paused?'Fortsetzen':'Pause';};
function fail(error){document.getElementById('error').textContent=String(error);}
new ResizeObserver(()=>{renderer.setSize(stage.clientWidth,stage.clientHeight,false);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();}).observe(stage);
let last=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-last)/1000);last=now;if(!paused)mixer?.update(dt);controls.update();renderer.render(scene,camera);});
window.__model3D={get current(){return current;},get mixer(){return mixer;},get clip(){return clip;},get team(){return team;},get kind(){return kind;},get data(){return currentData;},camera,controls,renderer,render(){renderer.render(scene,camera);},pause(){paused=true;},play};
const requested=new URL(location.href).searchParams.get('model');if(requested&&Array.from(document.getElementById('model').options).some(o=>o.value===requested)){kind=requested;document.getElementById('model').value=kind;}
faction(0).catch(fail);
