import * as THREE from 'three';
import {STRATEGIC_WARNING_SECONDS,STRATEGIC_BLAST_RADIUS}
 from '/src/reborn/strategic-tech.js';

/** Visible strategic flight, launch warning, ground shock and scorched crater.
 * Pure rendering: damage/interception belong to Simulation. The single shared
 * geometries survive all launches; individual scene nodes are reclaimed.
 * Enemy missile coordinates remain hidden outside current player fog.
 */
const MAX_SCARS=8,CRATER_SECONDS=48;
export function strategicFlightPosition(m,time){
 const t=Math.max(0,Math.min(1,(time-m.at)/Math.max(.01,m.impactAt-m.at)));
 const x=m.from.x+(m.to.x-m.from.x)*t;
 const y=m.from.y+(m.to.y-m.from.y)*t;
 const altitude=70+520*Math.sin(t*Math.PI);
 const dx=(m.to.x-m.from.x)/Math.max(.01,m.impactAt-m.at);
 const dz=(m.to.y-m.from.y)/Math.max(.01,m.impactAt-m.at);
 const vertical=520*Math.PI/Math.max(.01,m.impactAt-m.at)*Math.cos(t*Math.PI);
 return {x,y,altitude,dx,dz,vertical,t};
}
export class SandforgeStrategicEffects{
 constructor({scene,game,heightAt,pos,battlefield,sound}){
  Object.assign(this,{scene,game,heightAt,pos,battlefield,sound});
  this.rockets=new Map();this.seenEvents=new Set();this.scars=[];
  this.flightVelocity=new THREE.Vector3();this.flightUp=new THREE.Vector3(0,1,0);
  this.shared={
   cone:new THREE.ConeGeometry(13,34,14),
   hull:new THREE.CylinderGeometry(13,14,76,14),
   ring:new THREE.RingGeometry(34,41,48),
   crater:new THREE.CircleGeometry(STRATEGIC_BLAST_RADIUS*.72,48),
   sphere:new THREE.SphereGeometry(1,16,12),
   metal:new THREE.MeshStandardMaterial({color:'#c1c7be',metalness:.63,roughness:.4}),
   stripeBlue:new THREE.MeshStandardMaterial({color:'#458aac',metalness:.5,roughness:.5}),
   stripeRed:new THREE.MeshStandardMaterial({color:'#bc6449',metalness:.5,roughness:.5}),
   flame:new THREE.MeshBasicMaterial({color:'#ffb34b',transparent:true,opacity:.85,depthWrite:false}),
   stage:new THREE.CylinderGeometry(12,13,27,16),
   nozzle:new THREE.CylinderGeometry(8,12,8,12),
   fin:new THREE.BoxGeometry(3,23,17),
   bandGeometry:new THREE.CylinderGeometry(13.3,13.3,3.8,16),
   upperHull:new THREE.CylinderGeometry(12,13,69,16),
   rocketNose:new THREE.ConeGeometry(12,30,16),
   sharedFlame:new THREE.ConeGeometry(10,34,12),
   olive:new THREE.MeshStandardMaterial({color:'#7b816a',metalness:.34,roughness:.65}),
   sand:new THREE.MeshStandardMaterial({color:'#beb49a',metalness:.29,roughness:.68}),
   graphite:new THREE.MeshStandardMaterial({color:'#343c3b',metalness:.49,roughness:.48}),
   accent:new THREE.MeshStandardMaterial({color:'#c5a15e',metalness:.22,roughness:.62})
  };
  this.banner=document.createElement('div');
  this.banner.id='sf3d-strategic-warning';
  this.banner.hidden=true;
  this.banner.setAttribute('role','status');
  this.banner.setAttribute('aria-live','polite');
  document.body.append(this.banner);
 }
 createRocket(m){
  // Same muted, layered strategic missile silhouette as the facility model.
  // All geometries/materials are shared. No per-flight GPU allocations,
  // even if strategic missiles are launched repeatedly in a long match.
  const root=new THREE.Group();root.name='Strategic_Missile_'+m.id;
  const s=this.shared;
  const add=(geometry,material,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{
   const mesh=new THREE.Mesh(geometry,material);
   mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,rz);
   mesh.castShadow=true;mesh.receiveShadow=true;
   root.add(mesh);return mesh;
  };
  add(s.upperHull,s.olive,0,-1,0);
  add(s.stage,s.sand,0,46,0);
  const nose=add(s.rocketNose,s.graphite,0,74,0);
  nose.name='Strategic_Nose';
  add(s.nozzle,s.graphite,0,-40,0);
  for(const y of [-26,17,32,58])
   add(s.bandGeometry,y===17?s.accent:s.graphite,0,y,0);
  const band=add(s.bandGeometry,m.owner===0?s.stripeBlue:s.stripeRed,0,39,0);
  band.name='Strategic_Band';
  for(let i=0;i<4;i++){
   const angle=i*Math.PI/2;
   add(s.fin,s.olive,Math.cos(angle)*14,-27,Math.sin(angle)*14,
    0,-angle,-.23);
  }
  const flame=add(s.sharedFlame,s.flame,0,-60,0,0,0,Math.PI);
  flame.name='Strategic_Engine';
  root.scale.setScalar(.8);
  root.userData={visualOnly:true,nonPlayable:true,strategicMissile:true,flame,band};
  this.scene.add(root);this.rockets.set(m.id,root);
  return root;
 }
 removeRocket(id){
  const rocket=this.rockets.get(id);
  if(!rocket)return;
  rocket.removeFromParent();this.rockets.delete(id);
 }
 createImpact(event,intercept=false){
  if(!this.game.canSee(0,event.to))return;
  const s=this.shared;
  const base=this.pos(event.to.x,event.to.y,this.heightAt(event.to.x,event.to.y)+4);
  const shock=new THREE.Mesh(s.ring,new THREE.MeshBasicMaterial({
   color:intercept?'#88dafa':'#f7a849',transparent:true,opacity:.9,
   depthWrite:false,side:THREE.DoubleSide
  }));
  shock.rotation.x=-Math.PI/2;shock.position.copy(base);
  shock.scale.setScalar(intercept?.8:1.3);shock.renderOrder=12;
  this.scene.add(shock);
  const flash=new THREE.Mesh(s.sphere,new THREE.MeshBasicMaterial({
   color:intercept?'#9ee7ff':'#ffba6b',transparent:true,opacity:.58,depthWrite:false
  }));
  flash.position.copy(base);flash.position.y+=intercept?95:37;
  flash.scale.setScalar(intercept?20:48);
  this.scene.add(flash);
  const item={time:this.game.time,shock,flash,intercept};
  this.scars.push(item);
  if(!intercept){
   this.battlefield?.message?.('EINSCHLAG · Langstreckenrakete');
   const crater=new THREE.Mesh(s.crater,new THREE.MeshBasicMaterial({
    color:'#412a1f',transparent:true,opacity:.43,
    depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2
   }));
   crater.name='Strategic_Scorched_Ground';
   crater.rotation.x=-Math.PI/2;crater.position.copy(base);
   crater.position.y+=.1;crater.scale.setScalar(1);
   this.scene.add(crater);item.crater=crater;
   // Reuse existing particle pools, don't create expensive new systems.
   for(let j=0;j<3;j++)this.battlefield?.effects?.blastAt?.(
    event.to.x+(j-1)*40,event.to.y+(j%2?36:-28),false);
  }
  while(this.scars.length>MAX_SCARS){
   const old=this.scars.shift();this.removeImpact(old);
  }
 }
 removeImpact(item){
  for(const mesh of [item.shock,item.flash,item.crater]){
   if(!mesh)continue;
   mesh.material.dispose();mesh.removeFromParent();
  }
 }
 update(active=true){
  const g=this.game;
  if(!active)return;
  const ids=new Set();
  for(const m of g.strategicMissiles){
   ids.add(m.id);
   const p=strategicFlightPosition(m,g.time);
   const rocket=this.rockets.get(m.id)??this.createRocket(m);
   rocket.position.copy(this.pos(p.x,p.y,this.heightAt(p.x,p.y)+p.altitude));
   // The projectile points along the actual ascending/parabolic trajectory.
   this.flightVelocity.set(p.dx,p.vertical,p.dz).normalize();
   rocket.quaternion.setFromUnitVectors(this.flightUp,this.flightVelocity);
   rocket.visible=g.canSee(0,{x:p.x,y:p.y});
   rocket.userData.flame.scale.y=.80+.22*Math.sin(g.time*18);
  }
  for(const id of this.rockets.keys())if(!ids.has(id))this.removeRocket(id);
  for(const event of g.strategicEvents){
   if(this.seenEvents.has(event.id+':'+event.kind))continue;
   this.seenEvents.add(event.id+':'+event.kind);
   if(event.kind==='launch'&&event.owner===1){
    this.battlefield?.message?.('ACHTUNG: Feindlicher Raketenstart erkannt!');
    this.sound?.announceStrategicLaunch?.();
   }
   if(event.kind==='intercept')this.createImpact(event,true);
   if(event.kind==='impact')this.createImpact(event,false);
  }
  // Bound event memory independently of long-running matches.
  if(this.seenEvents.size>100)this.seenEvents=new Set([...this.seenEvents].slice(-40));
  const incoming=g.strategicMissiles.filter(m=>m.owner===1)
   .sort((a,b)=>a.impactAt-b.impactAt)[0];
  this.banner.hidden=!incoming;
  if(incoming){
   const seconds=Math.max(0,Math.ceil(incoming.impactAt-g.time));
   const copy='⚠ FEINDLICHER RAKETENSTART · EINSCHLAG IN '+seconds+' S';
   if(this.banner.textContent!==copy)this.banner.textContent=copy;
  }
  for(let i=this.scars.length-1;i>=0;i--){
   const s=this.scars[i],age=g.time-s.time;
   if(age>CRATER_SECONDS){this.removeImpact(s);this.scars.splice(i,1);continue;}
   s.shock.visible=age<1.35;
   s.flash.visible=age<1.65;
   if(s.shock.visible){
    s.shock.scale.setScalar((s.intercept?.8:1.3)+age*(s.intercept?2:6));
    s.shock.material.opacity=.9*Math.max(0,1-age/1.35);
   }
   if(s.flash.visible){
    s.flash.scale.setScalar((s.intercept?20:48)+age*(s.intercept?40:110));
    s.flash.material.opacity=.58*Math.max(0,1-age/1.65);
   }
   if(s.crater)s.crater.material.opacity=.43*
    Math.min(1,(CRATER_SECONDS-age)/13);
  }
 }
 dispose(){
  for(const id of this.rockets.keys())this.removeRocket(id);
  for(const item of this.scars)this.removeImpact(item);
  this.scars=[];
  for(const mat of Object.values(this.shared))
   if(mat?.isMaterial||mat?.isBufferGeometry)mat.dispose();
  this.banner.remove();
 }
}
