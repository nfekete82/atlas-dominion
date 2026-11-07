import * as THREE from 'three';
import {buildingFacingAngle} from './webgl-scale.js';
import {rolloutWheelsShouldRoll} from './webgl-wheel-motion.js';
import {prepareBarracksPortal,updateBarracksPortalPlanes,setBarracksDoorOpen,disposeBarracksPortal} from './webgl-barracks-portal.js';

export const GATE_TIMING=Object.freeze({warning:.25,opening:1,drive:3.6,closing:1});
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
export function productionGatePose(age,driveDuration=GATE_TIMING.drive){
 const {warning:w,opening:o,closing:c}=GATE_TIMING,d=driveDuration;
 const start=w+o,end=start+d;
 return {open:age<w?0:age<start?smooth((age-w)/o):age<end?1:1-smooth((age-end)/c),
  drive:smooth((age-start)/d),moving:age>start&&age<end,done:age+1e-8>=end+c};
}
const box=new THREE.BoxGeometry(1,1,1);
const hallMaterial=new THREE.MeshStandardMaterial({color:'#242b29',roughness:.94,side:THREE.DoubleSide});
const floorMaterial=new THREE.MeshStandardMaterial({color:'#635e4e',roughness:.96});
const dustMaterial=new THREE.MeshBasicMaterial({color:'#bda984',transparent:true,opacity:.12,depthWrite:false});
const bulbGeometry=new THREE.SphereGeometry(.047,8,6);
const orderKey=u=>JSON.stringify(u.orders??[]);

/** Operates on the real actor node, never creates an actor or modifies Simulation.
 * State is ephemeral: loading a save creates a fresh presenter and closed gates.
 */
export class SandforgeProductionGates {
 constructor(battlefield){
  this.battlefield=battlefield;this.game=battlefield.game;
  this.seen=new WeakSet(this.game.productionReleases);this.active=new Map();
  this.lastTime=this.game.time;
 }
 prepare(entry){
  if(entry.gate||!entry.detail)return entry.gate;
  if(entry.kind==='barracks'){
   const portal=prepareBarracksPortal(entry,this.battlefield.renderer);
   if(!portal)return null;
   const root=portal.root;
   const lampMaterial=new THREE.MeshStandardMaterial({color:'#7d3913',emissive:'#ff9f2a',emissiveIntensity:0});
   const lamp=new THREE.Mesh(bulbGeometry,lampMaterial);
   lamp.position.set(-.18,1.42,1.65);lamp.visible=false;root.add(lamp);
   entry.gate={kind:'barracks',root,portal,door:null,hall:portal.hall,lamp,dust:null,ramp:null};
   setBarracksDoorOpen(portal,0);
   return entry.gate;
  }
  const door=entry.detail.getObjectByName('FactoryRollupDoor');
  if(!door)return null;
  const root=door.parent,hall=new THREE.Group();hall.name='FactoryInterior';root.add(hall);
  const piece=(name,size,at,material=hallMaterial)=>{
   const mesh=new THREE.Mesh(box,material);mesh.name=name;mesh.scale.set(...size);mesh.position.set(...at);
   mesh.castShadow=true;mesh.receiveShadow=true;hall.add(mesh);return mesh;
  };
  piece('HallFloor',[1.52,.03,2.50],[.18,.245,.30],floorMaterial);
  piece('HallBack',[1.52,1.21,.025],[.18,.855,-.94]);
  for(const x of [-.58,.94])piece('HallSide',[.025,1.21,2.52],[x,.855,.32]);
  piece('HallCeiling',[1.52,.025,2.52],[.18,1.46,.32]);
  const ramp=piece('ThresholdRamp',[1.52,.035,1.35],[.18,.14,2.16],floorMaterial);ramp.rotation.x=.18;root.add(ramp);
  const dust=piece('RolloutDust',[1.2,.025,.55],[.18,.035,2.3],dustMaterial);dust.castShadow=false;dust.receiveShadow=false;
  const lampMaterial=new THREE.MeshStandardMaterial({color:'#6a2d0c',emissive:'#ff6a13',emissiveIntensity:0});
  const lamp=new THREE.Mesh(bulbGeometry,lampMaterial);lamp.position.set(.18,1.53,1.67);root.add(lamp);lamp.visible=false;
  hall.visible=false;
  entry.gate={kind:'factory',root,door,hall,lamp,dust,ramp};return entry.gate;
 }
 reset(entry){
  const gate=entry?.gate;if(!gate)return;
  if(gate.kind==='barracks')setBarracksDoorOpen(gate.portal,0);
  else {gate.door.position.y=0;gate.door.scale.y=1;}
  gate.hall.visible=false;gate.lamp.visible=false;
 }
 update(active=true,alpha=1){
  const bf=this.battlefield,game=this.game;
  // Match the actor renderer's interpolation between 20 Hz snapshots.
  const time=game.time-(active?.05*(1-clamp(alpha)):0);
  if(game.time<this.lastTime){for(const e of bf.bases.values())this.reset(e);this.active.clear();this.seen=new WeakSet(game.productionReleases);}
  this.lastTime=game.time;
  if(!this.active.size&&game.productionReleases.every(event=>this.seen.has(event)))return;
  const entities=new Map(game.units.map(u=>[u.id,u]));
  const bases=new Map(game.bases.map(b=>[b.id,b]));
  for(const event of game.productionReleases){
   if(this.seen.has(event))continue;this.seen.add(event);
   const base=bases.get(event.baseId),entry=bf.bases.get(event.baseId),unit=entities.get(event.unitId);
   // No delayed replay when streaming or loading; the authoritative actor
   // remains visible if its building asset is unavailable or hidden.
   if(!base||!['factory','barracks'].includes(base.kind)||!unit||time-event.at>.15||!entry?.node.visible||!this.prepare(entry)){
    game.cancelProductionDeparture?.(event.unitId);
    continue;
   }
   if(this.active.has(base.id)){
    game.cancelProductionDeparture?.(event.unitId);
    continue;
   }
   entry.node.updateWorldMatrix(true,true);
   const barracks=base.kind==='barracks',root=entry.gate.root;
   const exit=root.localToWorld(barracks?new THREE.Vector3(-.18,0,2.10):new THREE.Vector3(.18,0,2.9));
   const start=root.localToWorld(barracks?new THREE.Vector3(-.18,.275,.9):new THREE.Vector3(.18,.265,-.03));
   const target=bf.entityPosition(unit),center=entry.node.position;
   const exitAngle=Math.atan2(exit.x-center.x,exit.z-center.z);
   const targetAngle=Math.atan2(target.x-center.x,target.z-center.z);
   const turn=Math.abs(Math.atan2(Math.sin(targetAngle-exitAngle),Math.cos(targetAngle-exitAngle)));
   const radius=Math.max(barracks?90:160,Math.hypot(exit.x-center.x,exit.z-center.z));
   const length=start.distanceTo(exit)+turn*radius+Math.abs(radius-Math.hypot(target.x-center.x,target.z-center.z));
   // Rear-facing exits need more travel time around the footprint, rather
   // than accelerating a tank to Humvee speed to meet a fixed deadline.
   const duration=Math.max(barracks?2.8:GATE_TIMING.drive,length/(barracks?105:95));
   // Freeze only the real simulation actor's departure, NOT production or
   // its paid rally order. At the exact portal hand-off it resumes ordinary
   // 20 Hz movement from the same lawful spawn with no visual teleport.
   game.extendProductionDeparture?.(unit.id,event.at+GATE_TIMING.warning+GATE_TIMING.opening+duration+.05);
   this.active.set(base.id,{event,duration,orders:orderKey(unit),hp:unit.hp,baseHp:base.hp});
  }
  for(const [id,state] of this.active){
   const {event}=state,base=bases.get(id),entry=bf.bases.get(id),u=entities.get(event.unitId),actor=bf.units.get(event.unitId);
   const age=Math.max(0,time-event.at),pose=productionGatePose(age,state.duration);
   if(!base||base.hp<=0||!u||u.hp<=0||!actor||!entry?.node.visible||!actor.node.visible||
      u.hp<state.hp||base.hp<state.baseHp||u.fire>0||u.combatTarget||orderKey(u)!==state.orders||pose.done){
    this.reset(entry);if(actor)actor.productionMotion=null;
    game.cancelProductionDeparture?.(event.unitId);
    this.active.delete(id);continue;
   }
   const gate=entry.gate;
   if(gate.kind==='barracks'){
    updateBarracksPortalPlanes(gate.portal);
    setBarracksDoorOpen(gate.portal,pose.open);
   }else{
    gate.door.scale.y=1-pose.open*.96;
    gate.door.position.y=1.48*pose.open*.96;
   }
   gate.hall.visible=age>=GATE_TIMING.warning&&pose.open>.01;
   gate.lamp.visible=true;
   gate.lamp.material.emissiveIntensity=(Math.sin(age*22)>0?3:.25);
   if(gate.dust){gate.dust.visible=pose.moving;gate.dust.scale.x=1.2+pose.drive*.4;}
   if(!state.sounded&&age>=GATE_TIMING.warning){
    if(entry.node.visible)bf.sound?.productionGate?.();state.sounded=true;
   }
   const driveStart=GATE_TIMING.warning+GATE_TIMING.opening;
   const fraction=clamp((age-driveStart)/state.duration);
   if(fraction>=1){actor.productionMotion=null;continue;}
   entry.node.updateWorldMatrix(true,true);
   // First clear the entire hull and barrel past the real threshold. Only
   // outside the gate may the actor turn toward Simulation's actual exit.
   const infantry=gate.kind==='barracks';
   const outside=infantry?new THREE.Vector3(-.18,0,2.10):new THREE.Vector3(.18,0,2.9);
   const root=gate.root;
   root.localToWorld(outside);
   const target=actor.node.position.clone();
   const clearFraction=(infantry?1.65:GATE_TIMING.drive*.62)/state.duration;
   let p,yaw;
   const facing=buildingFacingAngle(base.facing);
   if(fraction<clearFraction){
    const t=smooth(fraction/clearFraction);
    const z=infantry ? .9+1.20*t : -.03+2.93*t;
    const y=infantry ? .275*(1-t) : z<=1.5 ? .265 : Math.max(0,.265*(2.9-z)/1.4);
    p=root.localToWorld(new THREE.Vector3(infantry?-.18:.18,y,z));yaw=facing;
   }else{
    // Route around the footprint for every cardinal facing. The simulation's
    // legacy spawn search is independent of building rotation, so a direct
    // chord to its destination could otherwise cross the hall a second time.
    const t=clamp((fraction-clearFraction)/(1-clearFraction));
    const center=entry.node.position;
    const startAngle=Math.atan2(outside.x-center.x,outside.z-center.z);
    const endAngle=Math.atan2(target.x-center.x,target.z-center.z);
    const turn=Math.atan2(Math.sin(endAngle-startAngle),Math.cos(endAngle-startAngle));
    const startRadius=Math.hypot(outside.x-center.x,outside.z-center.z);
    const endRadius=Math.hypot(target.x-center.x,target.z-center.z);
    const radius=Math.max(startRadius,infantry?90:160);
    const path=q=>{
     const angle=startAngle+turn*smooth(q/.76);
     const r=q<.76?startRadius+(radius-startRadius)*smooth(q/.22):radius+(endRadius-radius)*smooth((q-.76)/.24);
     return new THREE.Vector3(center.x+Math.sin(angle)*r,target.y,center.z+Math.cos(angle)*r);
    };
    p=path(t);
    const tangent=path(Math.min(1,t+.001)).sub(path(Math.max(0,t-.001)));
    yaw=tangent.lengthSq()>.00001?Math.atan2(tangent.x,tangent.z):facing;
    const heading=Math.PI/2-(u.hullAngle??u.angle);
    const blend=smooth((t-.90)/.10);
    yaw+=Math.atan2(Math.sin(heading-yaw),Math.cos(heading-yaw))*blend;
   }
   p.y=Math.max(p.y,bf.heightAt(p.x+bf.world.size/2,p.z+bf.world.size/2));
   // Avoid a purely visual collision with an authoritative neighboring actor.
   // An interrupted rollout reveals the real node at its real position.
   const worldPoint={x:p.x+bf.world.size/2,y:p.z+bf.world.size/2};
   const obstacles=game.obstacles?.().filter(b=>b.id!==id)??[];
   let blocked=pose.moving&&bf.world.walkable?.(worldPoint,obstacles,24)===false;
   if(pose.moving)for(const [otherId,other] of bf.units){
    if(otherId===u.id||!other.node.visible)continue;
    if(Math.hypot(p.x-other.node.position.x,p.z-other.node.position.z)<48){blocked=true;break;}
   }
   if(blocked){
    this.reset(entry);actor.productionMotion=null;
    game.cancelProductionDeparture?.(event.unitId);
    this.active.delete(id);continue;
   }
   actor.node.position.copy(p);actor.node.rotation.y=yaw;
   const moving=pose.moving;
   const distance=(state.distance??0)+(state.position?p.distanceTo(state.position):0);
   const elapsed=time-(state.motionTime??time);
   const speed=elapsed>0&&state.position?p.distanceTo(state.position)/elapsed:0;
   state.distance=distance;state.position=p;state.motionTime=time;
   // The shutter may still be animating while the vehicle is motionless.
   // Gate state does not imply physical wheel rotation.
   const actuallyRolling=infantry?moving&&speed>.25:rolloutWheelsShouldRoll(moving,speed);
   actor.productionMotion={moving:actuallyRolling,hideHealth:fraction<clearFraction*.64,driveSpeed:speed,walkDistance:distance,angle:Math.PI/2-yaw,hullAngle:Math.PI/2-yaw};
   if(age<GATE_TIMING.warning)actor.node.visible=false; // hidden by the closed shutter
  }
 }
 detach(entry){
  this.reset(entry);
  if(entry?.gate){
   entry.gate.lamp.material.dispose();entry.gate.lamp.removeFromParent();
   entry.gate.ramp?.removeFromParent();
   if(entry.gate.kind==='barracks')disposeBarracksPortal(entry);
   else entry.gate.hall.removeFromParent();
   delete entry.gate;
  }
 }
 dispose(){
  for(const entry of this.battlefield.bases.values()){
   this.detach(entry);
  }
  this.active.clear();
 }
}
