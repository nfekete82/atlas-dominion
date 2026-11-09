import * as THREE from 'three';
import {GENERAL_ABILITIES} from '/src/reborn/general-powers.js';

/** Render-only original general-powers art. Deterministic fixed simulation
 * events drive all effects: no network assets, no gameplay or RAF timers.
 * A few shared primitive GPU buffers are reused and disposed at teardown.
 */
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export class SandforgeGeneralPowerEffects{
 constructor({scene,game,pos,heightAt}){
  Object.assign(this,{scene,game,pos,heightAt});
  this.visibleBeacons=new Map();
  this.activeEvents=new Map();
  this.seenEvents=new Set();
  this.geometries=[
   new THREE.BoxGeometry(1,1,1),
   new THREE.CylinderGeometry(1,1,1,12),
   new THREE.SphereGeometry(1,12,8),
   new THREE.RingGeometry(1,1.022,96),
   new THREE.ConeGeometry(1,1,12)
  ];
 }
 piece(root,shape,color,loc,size,options={}){
  const geometry=this.geometries[shape];
  const material=new THREE.MeshStandardMaterial({
   color,metalness:options.metalness??0,
   roughness:options.roughness??.65,
   transparent:options.transparent??false,opacity:options.opacity??1,
   depthWrite:!options.transparent,side:THREE.DoubleSide,
   emissive:options.emissive??'#000000',
   emissiveIntensity:options.emissiveIntensity??0
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(...loc);mesh.scale.set(...size);
  mesh.castShadow=false;mesh.receiveShadow=false;
  mesh.userData.visualOnly=true;root.add(mesh);
  return mesh;
 }
 ring(root,color,radius,opacity=.3){
  const mesh=this.piece(root,3,color,[0,4,0],[radius,radius,radius],
   {transparent:true,opacity,emissive:color,emissiveIntensity:.3});
  mesh.rotation.x=-Math.PI/2;
  mesh.renderOrder=13;mesh.material.depthWrite=false;
  return mesh;
 }
 buildDrone(beacon){
  const root=new THREE.Group();
  root.name='General_Recon_Drone_'+beacon.id;
  root.position.copy(this.pos(beacon.x,beacon.y,this.heightAt(beacon.x,beacon.y)));
  const drone=new THREE.Group();
  drone.position.y=145;root.add(drone);
  this.piece(drone,0,'#556b74',[0,0,0],[24,8,34],{metalness:.45});
  this.piece(drone,0,'#b2c6c6',[0,2,0],[82,4,16],{metalness:.56});
  this.piece(drone,0,'#475a5c',[0,1,-22],[23,5,22],{metalness:.4});
  for(const x of [-26,26]){
   this.piece(drone,1,'#33494d',[x,5,0],[7,7,7],{metalness:.7});
   const prop=this.piece(drone,0,'#adb7b4',[x,9,0],[22,1.6,3],{metalness:.6});
   prop.name='Recon_Rotor';prop.userData.rotor=true;
  }
  const scan=this.ring(root,beacon.owner===0?'#65cbfa':'#ed9a6f',
   GENERAL_ABILITIES.recon.radius,.16);
  root.userData={visualOnly:true,nonPlayable:true,drone,scan};
  this.scene.add(root);return root;
 }
 createEvent(e){
  const root=new THREE.Group();
  root.name='GeneralPower_'+e.kind+'_'+e.id;
  root.position.copy(this.pos(e.x,e.y,this.heightAt(e.x,e.y)));
  root.userData={visualOnly:true,nonPlayable:true};
  const color=e.owner===0?'#66c1e4':'#ed9366';
  let ring=null,crate=null;
  if(e.kind==='repair'){
   ring=this.ring(root,color,GENERAL_ABILITIES.repair.radius,.38);
   crate=new THREE.Group();crate.position.y=165;root.add(crate);
   this.piece(crate,0,'#7a936d',[0,0,0],[27,25,27],{metalness:.12});
   this.piece(crate,0,'#e6d0a2',[0,2,13],[22,4,2]);
   this.piece(crate,0,'#e6d0a2',[0,2,-13],[22,4,2]);
   this.piece(crate,0,'#d7e1ce',[0,32,0],[45,2,45],
    {transparent:true,opacity:.67});
  }else if(e.kind==='artillery'){
   ring=this.ring(root,'#ffa968',GENERAL_ABILITIES.artillery.radius,.38);
   // An unmistakable, tactically readable bombardment target.
   for(const rot of [0,Math.PI/2]){
    const line=this.piece(root,0,'#eab27b',[0,4,0],
     [GENERAL_ABILITIES.artillery.radius*1.7,2,3],{transparent:true,opacity:.44});
    line.rotation.y=rot;
   }
  }
  this.scene.add(root);
  const item={event:e,root,ring,crate,until:e.at+(e.kind==='repair'?4.2:5.3)};
  this.activeEvents.set(e.id,item);
  return item;
 }
 release(root){
  root.traverse(obj=>{
   if(!obj.isMesh)return;
   obj.material?.dispose?.();
  });
  root.removeFromParent();
 }
 update(active=true){
  if(!active)return;
  const game=this.game;
  if(!game.generalBeacons.length&&!game.generalEvents.length&&
     !this.visibleBeacons.size&&!this.activeEvents.size)return;
  const current=new Set();
  for(const b of game.generalBeacons){
   current.add(b.id);
   const node=this.visibleBeacons.get(b.id)??this.buildDrone(b);
   this.visibleBeacons.set(b.id,node);
   const duration=Math.max(0,b.until-game.time);
   node.visible=b.owner===0||game.canSee(0,b);
   node.userData.drone.position.y=145+3*Math.sin(game.time*2.6);
   const scan=node.userData.scan;
   scan.material.opacity=.08+.08*(.5+.5*Math.sin(game.time*2));
   for(const obj of node.userData.drone.children)
    if(obj.userData.rotor)obj.rotation.y+=.35;
   if(duration<3)node.traverse(obj=>{
    if(obj.isMesh&&obj!==scan&&obj.material?.transparent)
     obj.material.opacity=clamp(duration/3);
   });
  }
  for(const [id,node] of this.visibleBeacons)
   if(!current.has(id)){this.release(node);this.visibleBeacons.delete(id);}
  for(const e of game.generalEvents){
   if(this.seenEvents.has(e.id))continue;
   this.seenEvents.add(e.id);
   if(e.kind!=='recon')this.createEvent(e);
  }
  if(this.seenEvents.size>100)this.seenEvents=new Set([...this.seenEvents].slice(-50));
  for(const [id,item] of this.activeEvents){
   const age=game.time-item.event.at;
   if(game.time>=item.until){
    this.release(item.root);this.activeEvents.delete(id);continue;
   }
   item.root.visible=item.event.owner===0||game.canSee(0,item.event);
   if(item.crate)item.crate.position.y=Math.max(9,165-age*145);
   if(item.ring){
    const duration=item.until-item.event.at;
    item.ring.material.opacity=.38*clamp((duration-age)/Math.min(2.5,duration));
    item.ring.rotation.z=age*.12;
   }
  }
 }
 dispose(){
  for(const node of this.visibleBeacons.values())this.release(node);
  for(const item of this.activeEvents.values())this.release(item.root);
  this.visibleBeacons.clear();this.activeEvents.clear();
  for(const geometry of this.geometries)geometry.dispose();
 }
}
