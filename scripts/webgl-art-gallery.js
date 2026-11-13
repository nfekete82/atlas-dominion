import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {stylizedProfile} from './webgl-stylized-pack.js';

const stage=document.querySelector('#stage'),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
stage.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#b8bca2');scene.fog=new T.Fog('#b8bca2',48,100);
scene.add(new T.HemisphereLight('#d5e9e0','#897348',2.1));
const sun=new T.DirectionalLight('#fff0c8',3.2);sun.position.set(-9,18,13);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-17,right:17,top:15,bottom:-15,near:1,far:60});sun.shadow.bias=-.0003;sun.shadow.normalBias=.035;scene.add(sun);
const ground=new T.Mesh(new T.PlaneGeometry(180,180),new T.MeshStandardMaterial({color:'#bca06a',roughness:1}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.025;ground.receiveShadow=true;scene.add(ground);
const camera=new T.OrthographicCamera(-12,12,7,-7,.1,200);camera.position.set(17,14,-23);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.5,0);controls.update();
const entries=[],errors=[],loader=new GLTFLoader(),cache=new Map();let owner=0,opened=false,playing='Idle',rts=false,paused=false;
async function template(kind,team){const key=kind+team;if(!cache.has(key))cache.set(key,loader.loadAsync('/src/assets/stylized/'+kind+'-'+team+'.glb'));return cache.get(key);}
async function load(team){
 for(const e of entries){scene.remove(e.node);e.mixer.stopAllAction();e.mixer.uncacheRoot(e.node);}entries.length=0;
 const positions={barracks:[3.25,0,2],rover:[-4.1,0,-.7],infantry:[-1.4,0,-4.2]};
 for(const kind of ['barracks','rover','infantry']){
  const data=await template(kind,team),node=clone(data.scene);Object.assign(node.userData,stylizedProfile(node));
  node.position.set(...positions[kind]);if(kind==='rover')node.rotation.y=Math.PI-.35;if(kind==='infantry')node.rotation.y=Math.PI-.22;
  node.traverse(m=>{if(m.isMesh)m.castShadow=m.receiveShadow=true;});scene.add(node);
  const e={kind,node,clips:data.animations,mixer:new T.AnimationMixer(node)};entries.push(e);
 }
 setClip(playing);setDoor(opened?1:0);
 document.querySelector('#status').textContent='6 eigene GLBs · 3 Referenzmodelle · blaue und rote Variante · Materialien eingebettet';
}
function setClip(name){playing=name;for(const e of entries){
 if(e.kind==='barracks')continue;
 e.mixer.stopAllAction();const wanted=e.kind==='rover'?(['Walk','Run'].includes(name)?'Drive':name):name;
 const clip=e.clips.find(c=>c.name===wanted)??e.clips.find(c=>c.name==='Idle');
 const a=e.mixer.clipAction(clip);if(name==='Death'){a.setLoop(T.LoopOnce,1);a.clampWhenFinished=true;}a.play();
}}
function setDoor(amount){const e=entries.find(e=>e.kind==='barracks');if(!e)return;
 for(const [name,s] of [['GATE_LEFT_PIVOT',-1],['GATE_RIGHT_PIVOT',1]])e.node.getObjectByName(name).position.x=s*(.47+amount*1.04);
}
function setRTS(value){rts=value;camera.zoom=value?.34:1;camera.updateProjectionMatrix();}
function render(){renderer.render(scene,camera);}
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.left=-8.3*w/h;camera.right=8.3*w/h;camera.top=8.3;camera.bottom=-8.3;camera.updateProjectionMatrix();render();}
document.querySelector('#clip').onchange=e=>setClip(e.target.value);
document.querySelector('#doors').onclick=()=>{opened=!opened;setDoor(opened?1:0);};
document.querySelector('#team').onclick=async()=>{owner=1-owner;await load(owner);document.querySelector('#team').textContent='Team: '+(owner?'Rot':'Blau');};
document.querySelector('#zoom').onclick=()=>setRTS(!rts);
window.addEventListener('resize',resize);
let last=performance.now();function tick(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(!paused)for(const e of entries)e.mixer.update(dt);controls.update();render();requestAnimationFrame(tick);}
window.__sandforgeArt={scene,camera,controls,renderer,entries,errors,setClip,setDoor,setRTS,load,render,pause:()=>{paused=true;},ready:false};
try{await load(owner);resize();window.__sandforgeArt.ready=true;requestAnimationFrame(tick);}catch(e){errors.push(e.message);document.querySelector('#status').textContent=e.stack;document.querySelector('#status').className='error';throw e;}
