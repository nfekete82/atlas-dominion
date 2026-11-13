import * as THREE from 'three';
import {buildingFacingAngle} from './webgl-scale.js';
import {rolloutWheelsShouldRoll} from './webgl-wheel-motion.js';
import {prepareBarracksPortal,updateBarracksPortalPlanes,setBarracksDoorOpen,
 barracksExitLane,barracksDeparturePoint,disposeBarracksPortal} from './webgl-barracks-portal.js';

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

// HQ3's uploaded GLB has a baked double front door (no GATE_* pivot).
// The recess/overlay uses the real authored +Z threshold, x=-2.08,
// y=.75..3.68, z=5.54 (GLB-local metres). The dark portal covers the
// unanimated baked panels while the two visible shutters slide aside.
// Production remains owned by Simulation; no duplicate actor is spawned.
export function prepareHeadquartersPortal(entry){
 if(entry?.headquartersPortal)return entry.headquartersPortal;
 const model=entry?.detail;
 if(!model)return null;
 // For the original low-poly headquarters reuse its real sliding doors,
 // metre-space pivot and passage. Old HQ3 still uses the overlay below.
 if(model.userData?.sandforgeStylized&&model.userData?.portal){
  const left=model.getObjectByName('HQ_GATE_LEFT'),right=model.getObjectByName('HQ_GATE_RIGHT');
  if(left&&right){
   const portal={root:model,hall:new THREE.Group(),leaves:[
    {leaf:left,baseX:left.position.x,side:-1},
    {leaf:right,baseX:right.position.x,side:1}
   ],materials:[],open:0,authored:true,travel:model.userData.portal.travel??1.25};
   entry.headquartersPortal=portal;
   return portal;
  }
 }
 const root=new THREE.Group();root.name='HQ3FrontEntrancePortal';
 root.position.set(-2.08,.75,5.58);
 model.add(root);
 const recess=new THREE.MeshStandardMaterial({
  name:'HQ3PortalInterior',color:'#0a1010',roughness:1,metalness:0,
  side:THREE.DoubleSide
 });
 const armor=new THREE.MeshStandardMaterial({
  name:'HQ3SlidingShutter',color:'#353c32',roughness:.83,metalness:.27
 });
 const trim=new THREE.MeshStandardMaterial({
  name:'HQ3DoorTrim',color:'#62685b',roughness:.68,metalness:.42
 });
 const hall=new THREE.Mesh(new THREE.BoxGeometry(2.46,3.05,.09),recess);
 hall.name='HQ3DarkInterior';hall.position.set(0,1.48,.045);root.add(hall);
 const leaves=[];
 for(const side of [-1,1]){
  const leaf=new THREE.Group();
  leaf.name=side<0?'HQ3DoorLeft':'HQ3DoorRight';
  leaf.position.x=side*.59;root.add(leaf);
  const plate=new THREE.Mesh(new THREE.BoxGeometry(1.18,2.92,.10),armor);
  plate.name='HQ3SlidingArmor';plate.position.set(0,1.49,.16);leaf.add(plate);
  const rib=new THREE.Mesh(new THREE.BoxGeometry(.055,2.72,.055),trim);
  rib.position.set(-side*.44,1.49,.24);leaf.add(rib);
  const grip=new THREE.Mesh(new THREE.BoxGeometry(.08,.30,.07),trim);
  grip.position.set(-side*.10,1.49,.255);leaf.add(grip);
  leaves.push({leaf,baseX:side*.59,side});
 }
 const portal={root,hall,leaves,materials:[recess,armor,trim],open:0};
 root.traverse(object=>{
  if(!object.isMesh)return;
  object.castShadow=true;object.receiveShadow=true;
  object.raycast=()=>{};
 });
 entry.headquartersPortal=portal;
 return portal;
}
export function setHeadquartersDoorOpen(portal,amount){
 if(!portal)return;
 const t=smooth(amount);
 portal.open=t;
 for(const {leaf,baseX,side} of portal.leaves)
  leaf.position.x=baseX+side*(portal.travel??1.29)*t;
}
export function disposeHeadquartersPortal(entry){
 const portal=entry?.headquartersPortal;
 if(!portal)return;
 if(portal.authored){
  delete entry.headquartersPortal;
  return;
 }
 portal.root.removeFromParent();
 portal.root.traverse(object=>{
  // The warning bulb uses one shared module geometry across all buildings.
  // Its material is already disposed by SandforgeProductionGates.detach().
  if(object.isMesh&&object.geometry!==bulbGeometry)object.geometry.dispose();
 });
 for(const material of portal.materials)material.dispose();
 delete entry.headquartersPortal;
}

/** Operates on the real actor node, never creates an actor or modifies Simulation.
 * State is ephemeral: loading a save creates a fresh presenter and closed gates.
 */
export function applyProductionGatePose(gate,pose){
 if(gate.kind==='barracks'){
  updateBarracksPortalPlanes(gate.portal);
  // Authored pivots use 1=closed and 0=open.
  setBarracksDoorOpen(gate.portal,gate.portal.authored?1-pose.open:pose.open);
 }else if(gate.kind==='headquarters'){
  setHeadquartersDoorOpen(gate.portal,pose.open);
 }else{
  gate.door.scale.y=1-pose.open*.96;
  gate.door.position.y=1.48*pose.open*.96;
 }
}

export class SandforgeProductionGates {
 constructor(battlefield){
  this.battlefield=battlefield;this.game=battlefield.game;
  this.seen=new WeakSet(this.game.productionReleases);this.active=new Map();
  this.lastTime=this.game.time;
 }
 prepare(entry){
  if(entry.gate||!entry.detail)return entry.gate;
  if(entry.kind==='headquarters'){
   const portal=prepareHeadquartersPortal(entry);
   if(!portal)return null;
   const lampMaterial=new THREE.MeshStandardMaterial({color:'#725638',
    emissive:'#ffa333',emissiveIntensity:0});
   const lamp=new THREE.Mesh(bulbGeometry,lampMaterial);
   lamp.position.set(...(portal.authored?
     (portal.root.userData.portal?.lamp??[0,2.9,4.4]):[-1.2,3.26,.26]));
   lamp.visible=false;portal.root.add(lamp);
   entry.gate={kind:'headquarters',root:portal.root,portal,door:null,
    hall:portal.hall,lamp,dust:null,ramp:null};
   return entry.gate;
  }
  if(entry.kind==='barracks'){
   const portal=prepareBarracksPortal(entry,this.battlefield.renderer);
   if(!portal)return null;
   const root=portal.root;
   const lampMaterial=new THREE.MeshStandardMaterial({color:'#7d3913',emissive:'#ff9f2a',emissiveIntensity:0});
   const lamp=new THREE.Mesh(bulbGeometry,lampMaterial);
   lamp.position.set(...(root.userData?.portal?.lamp??(portal.authored?[0,3.9,-4.25]:[-.18,1.42,1.65])));lamp.visible=false;root.add(lamp);
   entry.gate={kind:'barracks',root,portal,door:null,hall:portal.hall,lamp,dust:null,ramp:null};
   setBarracksDoorOpen(portal,portal.authored?1:0);
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
  if(gate.kind==='barracks')setBarracksDoorOpen(gate.portal,gate.portal.authored?1:0);
  else if(gate.kind==='headquarters')setHeadquartersDoorOpen(gate.portal,0);
  else {gate.door.position.y=0;gate.door.scale.y=1;}
  gate.hall.visible=gate.kind==='headquarters';gate.lamp.visible=false;
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
   if(this.seen.has(event))continue;
   const base=bases.get(event.baseId),entry=bf.bases.get(event.baseId),unit=entities.get(event.unitId);
   const actor=bf.units.get(event.unitId);
   const age=time-event.at;
   // A factory GLB can finish streaming after the real unit was produced.
   // Briefly hold that single authoritative unit while its actual shutter
   // loads, rather than letting it materialize outside the closed door.
   const eligible=Boolean(base&&['factory','barracks','headquarters'].includes(base.kind)&&
    unit&&unit.hp>0&&entry?.node.visible&&actor);
   const ready=eligible&&this.prepare(entry)&&!this.active.has(base.id);
   if(!ready){
    if(eligible&&game.stageWebGLProduction===true&&age>=0&&age<5.5){
     game.extendProductionDeparture?.(event.unitId,game.time+.2);
     actor.node.visible=false;
     continue;
    }
    this.seen.add(event);
    game.cancelProductionDeparture?.(event.unitId);
    if(actor)actor.node.visible=true;
    continue;
   }
   // The classic presentation still ignores events that arrive late.
   if(age>.15&&game.stageWebGLProduction!==true){
    this.seen.add(event);game.cancelProductionDeparture?.(event.unitId);
    continue;
   }
   this.seen.add(event);
   entry.node.updateWorldMatrix(true,true);
   const hq=base.kind==='headquarters',barracks=base.kind==='barracks',root=entry.gate.root;
   const lane=barracks?barracksExitLane(entry.gate.portal):null;
   const hqLane=hq&&root.userData?.portal?root.userData.portal:null;
   const exit=root.localToWorld(hq?(hqLane?new THREE.Vector3(...hqLane.outside):new THREE.Vector3(0,-.40,2.85)):
    barracks?lane.outside:new THREE.Vector3(.18,0,2.9));
   const start=root.localToWorld(hq?(hqLane?new THREE.Vector3(...hqLane.inside):new THREE.Vector3(0,.60,-.48)):
    barracks?lane.inside:new THREE.Vector3(.18,.265,-.03));
   const target=bf.entityPosition(unit),center=entry.node.position;
   const exitAngle=Math.atan2(exit.x-center.x,exit.z-center.z);
   const targetAngle=Math.atan2(target.x-center.x,target.z-center.z);
   const turn=Math.abs(Math.atan2(Math.sin(targetAngle-exitAngle),Math.cos(targetAngle-exitAngle)));
   const radius=Math.max(barracks||hq?90:160,Math.hypot(exit.x-center.x,exit.z-center.z));
   const length=start.distanceTo(exit)+turn*radius+Math.abs(radius-Math.hypot(target.x-center.x,target.z-center.z));
   // Rear-facing exits need more travel time around the footprint, rather
   // than accelerating a tank to Humvee speed to meet a fixed deadline.
   const duration=Math.max(barracks||hq?2.8:GATE_TIMING.drive,length/(barracks||hq?105:95));
   // Freeze only the real simulation actor's departure, NOT production or
   // its paid rally order. At the exact portal hand-off it resumes ordinary
   // 20 Hz movement from the same lawful spawn with no visual teleport.
   const visualAt=age>.15&&game.stageWebGLProduction===true?game.time:event.at;
   game.extendProductionDeparture?.(unit.id,visualAt+GATE_TIMING.warning+GATE_TIMING.opening+duration+.05);
   this.active.set(base.id,{event,visualAt,duration,orders:orderKey(unit),hp:unit.hp,baseHp:base.hp});
  }
  for(const [id,state] of this.active){
   const {event}=state,base=bases.get(id),entry=bf.bases.get(id),u=entities.get(event.unitId),actor=bf.units.get(event.unitId);
   const age=Math.max(0,time-(state.visualAt??event.at)),pose=productionGatePose(age,state.duration);
   // Hide a troop until its shutter opens, but do not cancel its rollout
   // merely because the visual actor was temporarily hidden.
   if(!base||base.hp<=0||!u||u.hp<=0||!actor||!entry?.node.visible||
      u.hp<state.hp||base.hp<state.baseHp||u.fire>0||u.combatTarget||orderKey(u)!==state.orders||pose.done){
    this.reset(entry);if(actor){actor.productionMotion=null;actor.node.visible=true;}
    game.cancelProductionDeparture?.(event.unitId);
    this.active.delete(id);continue;
   }
   const gate=entry.gate;
   applyProductionGatePose(gate,pose);
   gate.hall.visible=gate.kind==='headquarters'||
    age>=GATE_TIMING.warning&&pose.open>.01;
   gate.lamp.visible=true;
   gate.lamp.material.emissiveIntensity=(Math.sin(age*22)>0?3:.25);
   if(gate.dust){gate.dust.visible=pose.moving;gate.dust.scale.x=1.2+pose.drive*.4;}
   if(!state.sounded&&age>=GATE_TIMING.warning){
    if(entry.node.visible)bf.sound?.productionGate?.(
     gate.kind==='headquarters'?'barracks':gate.kind);
    state.sounded=true;
   }
   const driveStart=GATE_TIMING.warning+GATE_TIMING.opening;
   const fraction=clamp((age-driveStart)/state.duration);
   if(fraction>=1){actor.productionMotion=null;actor.node.visible=true;continue;}
   entry.node.updateWorldMatrix(true,true);
   // First clear the entire hull and barrel past the real threshold. Only
   // outside the gate may the actor turn toward Simulation's actual exit.
   const hq=gate.kind==='headquarters';
   const infantry=gate.kind==='barracks'||hq;
   const authored=!hq&&infantry&&gate.portal.authored;
   const lane=!hq&&infantry?barracksExitLane(gate.portal):null;
   const outside=hq?(root.userData?.portal?
    new THREE.Vector3(...root.userData.portal.outside):new THREE.Vector3(0,-.40,2.85)):
    infantry?lane.outside:new THREE.Vector3(.18,0,2.9);
   const root=gate.root;
   root.localToWorld(outside);
   const target=actor.node.position.clone();
   const clearFraction=(infantry?1.65:GATE_TIMING.drive*.62)/state.duration;
   let p,yaw;
   const facing=buildingFacingAngle(base.facing);
   if(fraction<clearFraction){
    const t=smooth(fraction/clearFraction);
    if(hq){
     const lane=root.userData?.portal;
     p=lane?root.localToWorld(new THREE.Vector3(...lane.inside).lerp(new THREE.Vector3(...lane.outside),t)):
      root.localToWorld(new THREE.Vector3(0,.60-t,-.48+3.33*t));
    }
    else if(infantry)p=root.localToWorld(barracksDeparturePoint(gate.portal,t));
    else{
     const z=-.03+2.93*t;
     const y=z<=1.5?.265:Math.max(0,.265*(2.9-z)/1.4);
     p=root.localToWorld(new THREE.Vector3(.18,y,z));
    }
    yaw=facing+(authored?Math.PI:0);
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
   // The door starts INSIDE its own collision footprint. Check ordinary
   // walkability only after the unit's hull clears the threshold; player
   // actors blocking the visible route remain genuine abort conditions.
   let blocked=pose.moving&&fraction>=clearFraction&&
    bf.world.walkable?.(worldPoint,obstacles,24)===false;
   if(pose.moving)for(const [otherId,other] of bf.units){
    if(otherId===u.id||!other.node.visible)continue;
    if(Math.hypot(p.x-other.node.position.x,p.z-other.node.position.z)<48){blocked=true;break;}
   }
   if(blocked){
    this.reset(entry);actor.productionMotion=null;actor.node.visible=true;
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
   // The one authoritative actor appears only after the door is open.
   actor.node.visible=age>=GATE_TIMING.warning+GATE_TIMING.opening;
  }
 }
 detach(entry){
  this.reset(entry);
  if(entry?.gate){
   entry.gate.lamp.material.dispose();entry.gate.lamp.removeFromParent();
   entry.gate.ramp?.removeFromParent();
   if(entry.gate.kind==='barracks')disposeBarracksPortal(entry);
   else if(entry.gate.kind==='headquarters')disposeHeadquartersPortal(entry);
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
