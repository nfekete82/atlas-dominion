import * as THREE from 'three';
import {UNITS,BUILDINGS} from '/src/reborn/catalog.js';
import {healthFraction,healthColor} from '/webgl-health.js';
import {turretMuzzleOffset} from '/webgl-scale.js';

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
 ?Math.max(42,Math.min(68,(BUILDINGS[kind]?.width??115)*.30)):
 infantry.has(kind)?26:air.has(kind)?44:36;
const barAltitude=(kind,type)=>type==='building'
 ?Math.max(65,Math.min(144,(BUILDINGS[kind]?.width??130)*.55)):
 infantry.has(kind)?62:air.has(kind)?49:56;

function statusBar(scene,entity,type){
 const width=barWidth(entity.kind,type);
 const root=new THREE.Group();
 root.name='hp-'+type+'-'+entity.id;
 root.userData={type,id:entity.id,healthBar:true};
 const surround=new THREE.Mesh(barGeo,outlineMat);
 surround.scale.set(width+1.8,4.8,1);surround.position.z=0;surround.renderOrder=17;
 root.add(surround);
 const back=new THREE.Mesh(barGeo,bgMat);
 back.scale.set(width,3.4,1);back.position.z=.9;back.renderOrder=18;
 root.add(back);
 // All three health pieces must share the transparent rendering pass: an
 // opaque fill drawn before the translucent background appeared BLACK.
 const fillMaterial=new THREE.MeshBasicMaterial({color:'#24e568',transparent:true,opacity:1,depthTest:true,
  depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const fill=new THREE.Mesh(barGeo,fillMaterial);
 fill.scale.set(width-2.1,2.5,1);fill.position.z=1.8;fill.renderOrder=19;root.add(fill);
 root.renderOrder=17;
 scene.add(root);
 return {root,fill,fillMaterial,width:width-2.1,altitude:barAltitude(entity.kind,type),
   previousHp:entity.hp,hitPulse:0,healPulse:0};
}

function flashSprite(entry,entity,type){
 if(type==='building'&&entity.kind==='turret')return null;
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
  // At full HP this is visibly green; combat depletes the width. The icon
  // toggles all/damaged/selected/off (the classic selection policy is damaged).
  this.showHealth='damaged';
  this.remnants=[];
  this.remnantMaterial=new THREE.MeshBasicMaterial({
   color:'#4e4337',transparent:true,opacity:.64,depthWrite:false,side:THREE.DoubleSide
  });
  this.remnantGeometry=new THREE.PlaneGeometry(1,1);
 }
 attach(entry,entity,type){
  const bar=statusBar(this.scene,entity,type);
  const flash=flashSprite(entry,entity,type);
  // Separate emitters track the simulation's actual 0/1 barrel index.
  // Place them in scene/world space so the building's cardinal facing does
  // not introduce a second rotation or move the flashes off the barrels.
  const turretFlashes=type==='building'&&entity.kind==='turret'
   ?[0,1].map(barrel=>{
     const material=new THREE.SpriteMaterial({map:flashTex,color:'#fff1b0',
      blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,depthTest:true,
      opacity:0,toneMapped:false});
     const sprite=new THREE.Sprite(material);
     sprite.name='turret-muzzle-'+barrel;
     sprite.userData={barrel,visualOnly:true};
     sprite.visible=false;this.scene.add(sprite);
     return sprite;
    }):null;
  const state={bar,flash,turretFlashes,turretPulses:[0,0],
   shotPulse:0,shotTrigger:0,type,unitId:entity.id};
  entry.presentation=state;
  this.status.set(type+':'+entity.id,state);
  return state;
 }
 remove(entry,entity=null){
  const state=entry?.presentation;
  if(!state)return;
  // Preserve a short, visually grounded fall/wreck shadow without retaining
  // a skinned model or influencing World collision/pathfinding.
  if(entity?.hp<=0&&entry.node.visible){
   const size=infantry.has(entity.kind)?23:air.has(entity.kind)?43:42;
   const remnant=new THREE.Mesh(this.remnantGeometry,this.remnantMaterial.clone());
   remnant.name='fallen-'+entity.kind+'-'+entity.id;
   remnant.userData={deathEffect:true,nonPlayable:true};
   remnant.rotation.x=-Math.PI/2;
   remnant.scale.set(size,size*.6,1);
   remnant.position.copy(entry.node.position);
   remnant.position.y=Math.max(2,entry.node.position.y-(air.has(entity.kind)?170:0))+2;
   this.scene.add(remnant);this.remnants.push({mesh:remnant,time:2.8,total:2.8});
  }
  this.scene.remove(state.bar.root);
  state.bar.fillMaterial.dispose();
  if(state.flash){
   state.flash.material.dispose();
   entry.node.remove(state.flash);
  }
  for(const sprite of state.turretFlashes??[]){
   this.scene.remove(sprite);sprite.material.dispose();
  }
  this.status.delete(state.type+':'+state.unitId);
  entry.presentation=null;
 }
 stepRemnants(dt=0,active=true){
  if(!active)return;
  for(const r of this.remnants){
   r.time-=dt;
   r.mesh.material.opacity=.64*Math.min(1,Math.max(0,r.time)/.9);
   r.mesh.scale.multiplyScalar(1+.035*dt);
  }
  this.remnants=this.remnants.filter(r=>{
   if(r.time>0)return true;
   this.scene.remove(r.mesh);r.mesh.material.dispose();return false;
  });
 }
 setHealthMode(mode){
  if(['all','selected','damaged','off'].includes(mode))this.showHealth=mode;
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
   if(state.turretFlashes&&shot.weapon==='turret')
    state.turretPulses[shot.barrel===1?1:0]=.17;
   state.shotTrigger++;
   this.stats.shots++;
  }
 }
 update(entry,entity,type,dt=0,selected=false,active=true){
  const state=entry.presentation??this.attach(entry,entity,type);
  const bar=state.bar;
  const hp=Math.max(0,entity.hp);
  const maxHp=(type==='unit'?UNITS[entity.kind]:BUILDINGS[entity.kind])?.hp??hp;
  const pct=healthFraction(hp,maxHp);
  if(hp<bar.previousHp-.001){
   bar.hitPulse=.26;
   state.hurtTime=.25;
   this.stats.hits++;
  }
  if(hp>bar.previousHp+.001){bar.healPulse=.22;this.stats.heals++;}
  bar.previousHp=hp;
  bar.hitPulse=Math.max(0,bar.hitPulse-dt);
  bar.healPulse=Math.max(0,bar.healPulse-dt);
  const visible=entry.node.visible&&hp>0;
  const showBar=visible&&(this.showHealth==='all'||
   this.showHealth==='selected'&&selected||
   this.showHealth==='damaged'&&(selected||pct<.999));
  bar.root.visible=showBar;
  if(showBar)this.stats.visibleBars++;
  if(visible){
   bar.root.position.copy(entry.node.position);
   bar.root.position.y+=entry.modelHeight?Math.max(bar.altitude,entry.modelHeight+5):bar.altitude;
   bar.root.quaternion.copy(this.camera.quaternion);
   bar.fill.scale.x=bar.width*pct;
   bar.fill.position.x=-(bar.width*(1-pct))/2;
   // Health is authoritative: full HP green, depleted HP loses actual width
   // and transitions through yellow/orange/red. Hit flashes never overwrite it.
   const color=healthColor(pct);
   bar.fraction=pct;
   if(bar.lastColor!==color){bar.fillMaterial.color.set(color);bar.lastColor=color;}
   // No selection enlargement: fixed physical size, like the Canvas UI.
   bar.root.scale.setScalar(1);
  }
  // A brief additive muzzle flash is driven only by real Shot events.
  state.shotPulse=Math.max(0,state.shotPulse-dt);
  if(state.flash){
   state.flash.visible=visible&&state.shotPulse>0;
   if(state.flash.visible){
    const strength=clamp(state.shotPulse/.23,0,1);
    state.flash.material.opacity=.94*Math.min(1,strength*3.1);
    const scale=pulseSize(entity.kind)*(.5+(1-strength)*.7);
    state.flash.scale.set(scale,scale,1);
   }
  }
  if(state.turretFlashes){
   const angle=Number.isFinite(entity.turretAngle)?entity.turretAngle:0;
   const muzzles=entry.motion?.muzzles;
   if(muzzles?.every(Boolean))entry.node.updateWorldMatrix(true,true);
   for(let barrel=0;barrel<2;barrel++){
    const sprite=state.turretFlashes[barrel];
    state.turretPulses[barrel]=Math.max(0,state.turretPulses[barrel]-dt);
    const pulse=state.turretPulses[barrel];
    // Read the actual GLB barrel endpoints after target rotation, model
    // normalization and building placement. Never guess world offsets.
    if(muzzles?.[barrel])muzzles[barrel].getWorldPosition(sprite.position);
    else{
     const offset=turretMuzzleOffset(angle,barrel);
     sprite.position.set(entry.node.position.x+offset.x,
      entry.node.position.y+(entry.modelHeight??92)*.83,
      entry.node.position.z+offset.z);
    }
    sprite.visible=visible&&pulse>0;
    if(sprite.visible){
     const strength=clamp(pulse/.17,0,1);
     sprite.material.opacity=.95*Math.min(1,strength*3.5);
     const size=12+12*(1-strength);
     sprite.scale.set(size,size,1);
    }
   }
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
   const hurt=(state.hurtTime??0)>0;
   const desired=hurt&&clips.hit?clips.hit:
    shooting&&clips.attack?clips.attack:
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
  state.hurtTime=Math.max(0,(state.hurtTime??0)-(active?dt:0));
  const recoil=shooting?Math.sin((1-clamp(state.shotPulse/.23,0,1))*Math.PI)*2.4:0;
  const stagger=state.hurtTime>0?Math.sin((1-state.hurtTime/.25)*Math.PI)*1.7:0;
  body.position.y=base+bob;
  if(!air.has(entity.kind))body.position.z=entry.visualBaseZ+recoil-stagger;
 }
 refreshStats(){
  this.stats.visibleBars=0;this.stats.walking=0;this.stats.shooting=0;
 }
}
