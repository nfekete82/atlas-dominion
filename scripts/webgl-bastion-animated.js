import * as THREE from 'three';

// Visual-only controller for the reference Bastion GLB.
// Simulation (territory.owner, capturing, progress) remains authoritative.
export const ANIMATED_BASTION_GLB_URL =
 '/src/assets/reborn/buildings-3d/sandforge_bastion_animated.glb';
const owners=['neutral','blue','red'];
const faction=owner=>owner===0?'blue':owner===1?'red':'neutral';
const title=s=>s[0].toUpperCase()+s.slice(1);

/** A fresh model clone is required for EACH territory; geometry/textures are shared. */
export function createAnimatedBastionController(root,animations,initialOwner=-1){
 const core=root.getObjectByName('Bastion_ROOT');
 if(!core)throw new Error('Animated Bastion: Bastion_ROOT missing');
 const required=name=>{
  const part=core.getObjectByName(name);
  if(!part)throw new Error('Animated Bastion: '+name+' missing');
  return part;
 };
 const flags=Object.fromEntries(owners.map(k=>[k,required('Flag_'+title(k))]));
 const emblems=Object.fromEntries(owners.map(k=>[k,required('Emblem_'+title(k))]));
 const rings=Object.fromEntries([...owners,'capturing'].map(k=>[k,required('CaptureRing_'+title(k))]));
 const segments=Array.from({length:16},(_,i)=>required('CaptureSegment_'+String(i).padStart(2,'0')));
 const mixer=new THREE.AnimationMixer(root);
 const actions=Object.fromEntries((animations??[]).map(clip=>[clip.name,mixer.clipAction(clip)]));
 for(const name of ['FlagWave','RadarRotate','CapturePulse','FlagRaise','FlagLower'])
  if(!actions[name])throw new Error('Animated Bastion: animation '+name+' missing');
 // Never mutate cached GLTF materials: even independent clones share source materials.
 const owned=new Set();
 const accents=new Set();
 root.traverse(part=>{
  if(!part.isMesh)return;
  part.castShadow=true;part.receiveShadow=true;
  const clone=mat=>{
   if(!mat)return mat;
   const material=mat.clone();owned.add(material);
   if(['OrangeWindow','LampGlass','BeaconAmber'].includes(material.name))accents.add(material);
   return material;
  };
  part.material=Array.isArray(part.material)?part.material.map(clone):clone(part.material);
 });
 let owner='neutral',progress=0,capturer='blue',elapsed=0,closed=false;
 let finishedListener=null;
 function show(group,visible){
  group.visible=visible;
  if(!visible)return;
  group.traverse(part=>{
   if(!part.isMesh)return;
   for(const mat of (Array.isArray(part.material)?part.material:[part.material])){
    if(!mat)continue;
    // Authored inactive variants have alpha 0 so restore them on activation.
    mat.opacity=1;mat.transparent=false;mat.depthWrite=true;mat.needsUpdate=true;
   }
  });
 }
 function showState(){
  for(const k of owners){show(flags[k],k===owner);show(emblems[k],k===owner);}
  for(const k of [...owners,'capturing'])
   show(rings[k],k===(progress>0?'capturing':owner));
  const visibleCount=Math.ceil(progress*segments.length);
  for(let i=0;i<segments.length;i++)segments[i].visible=i<visibleCount;
  const accent=progress>0?0xff9a24:owner==='blue'?0x397cf7:owner==='red'?0xf43d48:0xffa94c;
  for(const mat of accents){mat.emissive?.setHex(accent);mat.needsUpdate=true;}
 }
 function loop(name){
  actions[name]?.reset().setLoop(THREE.LoopRepeat,Infinity).play();
 }
 for(const name of ['FlagWave','RadarRotate','CapturePulse','Idle'])loop(name);
 function cancelTransition(){
  if(finishedListener){mixer.removeEventListener('finished',finishedListener);finishedListener=null;}
  actions.FlagLower?.stop();actions.FlagRaise?.stop();
 }
 function playOne(name){
  const action=actions[name];
  if(!action)return;
  action.stop().reset().setLoop(THREE.LoopOnce,1);
  action.clampWhenFinished=true;action.play();
 }
 function setOwner(value,{animate=false}={}){
  if(closed)return;
  const next=faction(value);
  if(next===owner){progress=0;showState();return;}
  cancelTransition();
  progress=0;
  if(animate){
   playOne('FlagLower');
   finishedListener=e=>{
    if(e.action!==actions.FlagLower)return;
    mixer.removeEventListener('finished',finishedListener);finishedListener=null;
    if(closed)return;
    actions.FlagLower.stop();
    owner=next;showState();
    playOne('FlagRaise');
   };
   mixer.addEventListener('finished',finishedListener);
  }else{owner=next;showState();}
 }
 function setCaptureProgress(value,team){
  if(closed)return;
  capturer=faction(team);
  progress=Math.max(0,Math.min(1,Number(value)||0));
  if(capturer==='neutral')progress=0;
  showState();
 }
 function update(dt){
  if(closed)return;
  dt=Math.max(0,Math.min(.15,Number(dt)||0));
  mixer.update(dt);elapsed+=dt;
  const pulse=.86+.14*Math.sin(elapsed*(progress>0?7:2));
  for(const mat of accents)mat.emissiveIntensity=(progress>0?1.5:.9)*pulse;
 }
 function dispose(){
  if(closed)return;
  closed=true;cancelTransition();
  mixer.stopAllAction();mixer.uncacheRoot(root);
  for(const mat of owned)mat.dispose();
 }
 showState();
 setOwner(initialOwner);
 return {update,setOwner,setCaptureProgress,dispose,
  get owner(){return owner;},get progress(){return progress;},get capturer(){return capturer;}};
}
