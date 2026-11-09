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
  this.shared={
   cone:new THREE.ConeGeometry(13,34,14),
   hull:new THREE.CylinderGeometry(13,14,76,14),
   ring:new THREE.RingGeometry(34,41,48),
   crater:new THREE.CircleGeometry(STRATEGIC_BLAST_RADIUS*.72,48),
   sphere:new THREE.SphereGeometry(1,16,12),
   metal:new THREE.MeshStandardMaterial({color:'#c1c7be',metalness:.63,roughness:.4}),
   stripeBlue:new THREE.MeshStandardMaterial({color:'#458aac',metalness:.5,roughness:.5}),
   stripeRed:new THREE.MeshStandardMaterial({color:'#bc6449',metalness:.5,roughness:.5}),
   flame:new THREE.MeshBasicMaterial({color:'#ffb34b',transparent:true,opacity:.85,depthWrite:false})
  };
  this.banner=document.createElement('div');
  this.banner.id='sf3d-strategic-warning';
  this.banner.hidden=true;
  this.banner.setAttribute('role','status');
  this.banner.setAttribute('aria-live','polite');
  document.body.append(this.banner);
 }
 createRocket(m){
  const root=new THREE.Group();
  root.name='Strategic_Missile_'+m.id;
  const s=this.shared,warhead=new THREE.Mesh(s.cone,s.metal);
  warhead.position.y=55;root.add(warhead);
  const hull=new THREE.Mesh(s.hull,s.metal);
  root.add(hull);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(14,14,9,12),
   m.owner===0?s.stripeBlue:s.stripeRed);
  band.name='Strategic_Band';band.position.y=-18;root.add(band);
  const flame=new THREE.Mesh(new THREE.ConeGeometry(11,36,10),s.flame);
  flame.name='Strategic_Engine';flame.rotation.z=Math.PI;
  flame.position.y=-56;root.add(flame);
  for(let i=0;i<4;i++){
   const fin=new THREE.Mesh(new THREE.BoxGeometry(4,29,28),s.metal);
   fin.rotation.y=i*Math.PI/2;fin.position.y=-34;root.add(fin);
  }
  root.scale.setScalar(.8);
  root.userData={visualOnly:true,nonPlayable:true,strategicMissile:true,flame,band};
  this.scene.add(root);
  this.rockets.set(m.id,root);
  return root;
 }
 removeRocket(id){
  const mesh=this.rockets.get(id);
  if(!mesh)return;
  // Only the two per-instance primitives are owned here. Shared material and
  // geometry allocations stay until global dispose.
  mesh.userData.flame.geometry.dispose();
  mesh.userData.band.geometry.dispose();
  for(const item of mesh.children)if(item.geometry&&
   item!==mesh.userData.flame&&item!==mesh.userData.band&&
   item.geometry!==this.shared.cone&&item.geometry!==this.shared.hull)
    item.geometry.dispose();
  mesh.removeFromParent();
  this.rockets.delete(id);
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
   const velocity=new THREE.Vector3(p.dx,p.vertical,p.dz).normalize();
   rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),velocity);
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
