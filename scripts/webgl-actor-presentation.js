import * as THREE from 'three';
import {UNITS,BUILDINGS} from '/src/reborn/catalog.js';

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const infantry=new Set(['infantry','medic','engineer','heavy']);
const air=new Set(['scout','bomber']);
const barGeo=new THREE.PlaneGeometry(1,1);
const bgMat=new THREE.MeshBasicMaterial({
 color:'#101c21',transparent:true,opacity:.93,depthTest:true,depthWrite:false,side:THREE.DoubleSide
});
const outlineMat=new THREE.MeshBasicMaterial({
 color:'#d8c6a3',transparent:true,opacity:.84,depthTest:true,depthWrite:false,side:THREE.DoubleSide
});

function muzzleTexture(){
 const canvas=document.createElement('canvas');
 canvas.width=canvas.height=64;
 const ctx=canvas.getContext('2d');
 const grad=ctx.createRadialGradient(32,32,0,32,32,31);
 grad.addColorStop(0,'rgba(255,255,237,1)');
 grad.addColorStop(.17,'rgba(255,238,151,1)');
 grad.addColorStop(.4,'rgba(255,172,46,.85)');
 grad.addColorStop(.67,'rgba(235,97,26,.35)');
 grad.addColorStop(1,'rgba(204,70,21,0)');
 ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 return texture;
}
const flashTex=muzzleTexture();
const ownerColor=owner=>owner===0?'#68ddf5':'#ff8a69';
const pulseSize=kind=>infantry.has(kind)?21:air.has(kind)?36:kind==='tank'?40:35;
const barWidth=(kind,type)=>type==='building'
 ?Math.max(52,Math.min(110,(BUILDINGS[kind]?.width??115)*.48)):
 infantry.has(kind)?39:air.has(kind)?69:62;
const barAltitude=(kind,type)=>type==='building'
 ?Math.max(60,Math.min(150,(BUILDINGS[kind]?.width??130)*.64)):
 infantry.has(kind)?75:air.has(kind)?48:70;

function statusBar(scene,entity,type){
 const width=barWidth(entity.kind,type);
 const root=new THREE.Group();
 root.name='hp-'+type+'-'+entity.id;
 root.userData={type,id:entity.id,healthBar:true};
 const surround=new THREE.Mesh(barGeo,outlineMat);
 surround.scale.set(width+3,9,1);surround.position.z=0;
 root.add(surround);
 const back=new THREE.Mesh(barGeo,bgMat);
 back.scale.set(width,6.5,1);back.position.z=.28;
 root.add(back);
 const fillMaterial=new THREE.MeshBasicMaterial({color:'#7ad389',depthTest:true,
  depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const fill=new THREE.Mesh(barGeo,fillMaterial);
 fill.scale.set(width-3,4.5,1);fill.position.z=.58;root.add(fill);
 root.renderOrder=17;
 scene.add(root);
 return {root,fill,fillMaterial,width:width-3,altitude:barAltitude(entity.kind,type),
   previousHp:entity.hp,hitPulse:0,healPulse:0};
}

function flashSprite(entry,entity,type){
 const mat=new THREE.SpriteMaterial({map:flashTex,color:'#fff3bd',
  blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,depthTest:true,
  opacity:0,toneMapped:false});
 const flash=new THREE.Sprite(mat);
 flash.name='weapon-flash';
 const kind=entity.kind,wide=type==='unit'?(UNITS[kind]?.width??38):Math.min(60,(BUILDINGS[kind]?.width??120)*.32);
 flash.position.set(wide*.10,type==='unit'?(infantry.has(kind)?34:38):60,wide*.42);
 flash.scale.setScalar(pulseSize(kind));
 flash.visible=false;
 entry.node.add(flash);
 return flash;
}

/** Presentation owns ONLY graphics. HP, visibility, combat and movement remain
 * authoritative in Simulation and the existing unit/structure collections.
 */
export class SandforgeActorPresentation {
 constructor(scene,camera,game){
  Object.assign(this,{scene,camera,game});
  this.seenShots=new WeakSet();
  this.status=new Map();
  this.stats={shots:0,hits:0,heals:0,visibleBars:0,walking:0,shooting:0};
  this.time=0;
 }
 attach(entry,entity,type){
  const bar=statusBar(this.scene,entity,type);
  const flash=flashSprite(entry,entity,type);
  const state={bar,flash,shotPulse:0,shotTrigger:0,type,unitId:entity.id};
  entry.presentation=state;
  this.status.set(type+':'+entity.id,state);
  return state;
 }
 remove(entry){
  const state=entry?.presentation;
  if(!state)return;
  this.scene.remove(state.bar.root);
  state.bar.fillMaterial.dispose();
  state.flash.material.dispose();
  entry.node.remove(state.flash);
  this.status.delete(state.type+':'+state.unitId);
  entry.presentation=null;
 }
 consumeShots(units,bases){
  for(const shot of this.game.shots){
   if(this.seenShots.has(shot))continue;
   this.seenShots.add(shot);
   if(!shot.source)continue;
   const entry=units.get(shot.source)??bases.get(shot.source);
   if(!entry||!entry.node.visible)continue;
   const state=entry.presentation;
   if(!state)continue;
   state.shotPulse=.23;
   state.shotTrigger++;
   this.stats.shots++;
  }
 }
 update(entry,entity,type,dt=0,selected=false,active=true){
  const state=entry.presentation??this.attach(entry,entity,type);
  const bar=state.bar;
  const hp=Math.max(0,entity.hp);
  const maxHp=(type==='unit'?UNITS[entity.kind]:BUILDINGS[entity.kind])?.hp??hp;
  const pct=clamp(hp/Math.max(1,maxHp),0,1);
  if(hp<bar.previousHp-.001){bar.hitPulse=.26;this.stats.hits++;}
  if(hp>bar.previousHp+.001){bar.healPulse=.22;this.stats.heals++;}
  bar.previousHp=hp;
  bar.hitPulse=Math.max(0,bar.hitPulse-dt);
  bar.healPulse=Math.max(0,bar.healPulse-dt);
  const visible=entry.node.visible&&hp>0;
  bar.root.visible=visible;
  if(visible){
   bar.root.position.copy(entry.node.position);
   bar.root.position.y+=bar.altitude;
   bar.root.quaternion.copy(this.camera.quaternion);
   bar.fill.scale.x=bar.width*pct;
   bar.fill.position.x=-(bar.width*(1-pct))/2;
   const color=bar.hitPulse>0?'#ffe2b5':bar.healPulse>0?'#71ecde':
    pct>.64?'#85d994':pct>.3?'#eed276':'#f1786d';
   if(bar.lastColor!==color){bar.fillMaterial.color.set(color);bar.lastColor=color;}
   if(selected)bar.root.scale.setScalar(1.20);
   else bar.root.scale.setScalar(1);
  }
  // A brief additive muzzle flash is driven only by real Shot events.
  state.shotPulse=Math.max(0,state.shotPulse-dt);
  state.flash.visible=visible&&state.shotPulse>0;
  if(state.flash.visible){
   const strength=clamp(state.shotPulse/.23,0,1);
   state.flash.material.opacity=.94*Math.min(1,strength*3.1);
   const scale=pulseSize(entity.kind)*(.5+(1-strength)*.7);
   state.flash.scale.set(scale,scale,1);
  }
  if(type!=='unit')return;
  // Built-in glTF clips are preferred. The procedural pose is used only if
  // clips are absent/incomplete (or during asynchronous model loading).
  const moving=entity.moving===true;
  const shooting=state.shotPulse>0||entity.fire>0;
  if(moving&&visible)this.stats.walking++;
  if(shooting&&visible)this.stats.shooting++;
  if(entry.animation){
   const clips=entry.animation;
   const desired=shooting&&clips.attack?clips.attack:
    moving?clips.walk:clips.idle;
   const retrigger=shooting&&state.shotTrigger!==(state.lastClipTrigger??-1);
   if(desired&&typeof entry.playAnimation==='function')
    entry.playAnimation(desired,retrigger);
   if(retrigger)state.lastClipTrigger=state.shotTrigger;
   if(visible&&active&&dt>0)clips.mixer.update(Math.min(.08,dt));
  }
  const body=entry.detail??entry.placeholder;
  if(!body)return;
  const base=entry.visualBaseY??body.position.y;
  if(!Number.isFinite(entry.visualBaseY))entry.visualBaseY=base;
  if(!Number.isFinite(entry.visualBaseZ))entry.visualBaseZ=body.position.z;
  // Keep the glTF transform immutable: only a tiny relative suspension/bob.
  // Fallback models have no clips, so this also makes their motion readable.
  if(active&&dt>0){
   state.motionDistance=(state.motionDistance??0)+
    (moving?Math.min(1.5,dt*7):0);
  }
  const animated=Boolean(entry.animation?.walk&&entry.animation.walk!==entry.animation.idle);
  const bob=moving&&!animated&&infantry.has(entity.kind)?
   Math.sin((entity.walkDistance??state.motionDistance)*.18)*1.4:0;
  const recoil=shooting?Math.sin((1-clamp(state.shotPulse/.23,0,1))*Math.PI)*2.4:0;
  body.position.y=base+bob;
  if(!air.has(entity.kind))body.position.z=entry.visualBaseZ+recoil;
 }
 refreshStats(){
  this.stats.visibleBars=0;this.stats.walking=0;this.stats.shooting=0;
 }
}
