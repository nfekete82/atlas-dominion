import {distance,clamp,type Point} from './config.js';
import {unitSpec} from './catalog.js';
import type {Simulation,Unit,Order} from './simulation.js';
export interface TransportState {phase:'approach'|'landing'|'loading'|'unloading'|'takeoff'|'cruise';task:'load'|'unload';site:Point;cargo:number[];pickup:number[];clock:number;transfer:number;resume:Order[]}
export const TRANSPORT_CAPACITY=10;
export const ROVER_CAPACITY=4;
export const transportCapacity=(kind:string):number=>kind==='rover'?ROVER_CAPACITY:kind==='scout'?TRANSPORT_CAPACITY:0;
const isCarrier=(u:Unit):boolean=>u.kind==='scout'||u.kind==='rover';
/** Passengers remain real units, counted once; carrier references suppress their battlefield actions. */
export class Transports {
 constructor(private g:Simulation,private move:(u:Unit,p:Point,dt:number)=>void){}
 private site(p:Point):Point|null{const point={x:p.x,y:p.y},site=this.g.world.clearSite(point,38);return site&&distance(site,p)<300&&!this.g.obstacles().some(b=>distance(b,site)<b.radius+48)?site:this.g.world.nearest(point,this.g.obstacles(),[],undefined,42);}
 board(id:number,ids:number[]):number{
  const g=this.g,h=g.units.find(u=>u.id===id&&isCarrier(u)&&u.hp>0&&!u.carrier);if(!h)return 0;
  const existing=h.transport,cargo=existing?.cargo??[],room=transportCapacity(h.kind)-cargo.length-(existing?.pickup.length??0);if(room<=0)return 0;
  const site=existing&&existing.task==='load'&&['approach','landing','loading'].includes(existing.phase)?existing.site:h.kind==='rover'?{x:h.x,y:h.y}:this.site(h);if(!site||distance(site,h)>300)return 0;
  const accepted=g.units.filter(u=>ids.includes(u.id)&&u.owner===h.owner&&u.hp>0&&!u.carrier&&unitSpec(u).group==='Infanterie'&&!existing?.pickup.includes(u.id)&&distance(u,site)<900&&g.world.path(u,site,g.obstacles()).length).slice(0,room);
  if(!accepted.length)return 0;
  if(!existing||existing.phase==='cruise'||existing.phase==='takeoff'||existing.task!=='load'){
   h.transport={phase:h.kind==='rover'?'loading':distance(h,site)>12?'approach':'landing',task:'load',site:{...site},cargo:[...cargo],pickup:[],clock:0,transfer:0,resume:structuredClone(h.orders)};h.orders=[];h.path=[];h.repath=0;if(h.kind==='scout')h.flightHeight??=1;
  }
  const t=h.transport!;t.pickup.push(...accepted.map(u=>u.id));t.task='load';
  for(const u of accepted){u.orders=[{...site,kind:'board',target:h.id}];u.path=[];u.repath=0;u.hold=false;u.workingTarget=null;delete u.burst;}
  return accepted.length;
 }
 unload(id:number,p:Point):boolean{
  const h=this.g.units.find(u=>u.id===id&&isCarrier(u)&&u.hp>0);if(!h?.transport?.cargo.length)return false;
  const site=this.site(p);if(!site||distance(site,p)>300)return false;
  this.cancel(h);h.transport={phase:'approach',task:'unload',site,cargo:[...h.transport.cargo],pickup:[],clock:0,transfer:0,resume:[]};h.orders=[];h.path=[];h.repath=0;h.hold=false;return true;
 }
 cancel(h:Unit):void{
  const t=h.transport;if(!t)return;for(const id of t.pickup){const u=this.g.units.find(u=>u.id===id);if(u?.orders[0]?.kind==='board'&&u.orders[0].target===h.id){u.orders.shift();u.path=[];}}
  t.pickup=[];t.resume=[];if(t.phase!=='cruise'){t.phase=h.kind==='rover'?'cruise':'takeoff';t.clock=0;}
 }
 boarding(u:Unit,dt:number):boolean{
  const order=u.orders[0];if(order?.kind!=='board')return false;
  const h=this.g.units.find(h=>h.id===order.target&&h.hp>0&&h.owner===u.owner),t=h?.transport;
  if(!h||!t||!t.pickup.includes(u.id)||t.task!=='load'){u.orders.shift();u.path=[];return true;}
  const index=t.pickup.indexOf(u.id),door=h.kind==='rover'?{x:t.site.x+26+(index%2)*19,y:t.site.y+25+Math.floor(index/2)*19}:{x:t.site.x+38+(index%2)*24,y:t.site.y+38+Math.floor(index/2)*25};
  if(distance(u,door)>10){if(u.path.length&&u.repath<=0)u.path=[];this.move(u,door,dt);}else{u.path=[];u.angle=Math.atan2(h.y-u.y,h.x-u.x);}
  return true;
 }
 step(h:Unit,dt:number):boolean{
  if(!isCarrier(h)||!h.transport||h.transport.phase==='cruise')return false;
  const g=this.g,t=h.transport;t.clock+=dt;t.transfer+=dt;
  t.pickup=t.pickup.filter(id=>g.units.some(u=>u.id===id&&u.hp>0&&!u.carrier&&u.orders[0]?.kind==='board'&&u.orders[0]?.target===h.id));
  if(t.phase==='approach'){
   if(distance(h,t.site)>13)this.move(h,t.site,dt);else {h.x=t.site.x;h.y=t.site.y;h.path=[];h.driveSpeed=0;t.phase=h.kind==='rover'?(t.task==='load'?'loading':'unloading'):'landing';t.clock=0;t.transfer=0;}
  }else if(t.phase==='landing'){
   h.flightHeight=Math.max(0,(h.flightHeight??1)-dt/1.2);if(h.flightHeight<=.001){h.flightHeight=0;t.phase=t.task==='load'?'loading':'unloading';t.clock=0;t.transfer=0;}
  }else if(t.phase==='loading'){
   if(t.transfer>=.3){const u=g.units.find(u=>t.pickup.includes(u.id)&&u.hp>0&&distance(u,h)<=65);if(u&&t.cargo.length<transportCapacity(h.kind)){t.cargo.push(u.id);t.pickup=t.pickup.filter(id=>id!==u.id);u.carrier=h.id;u.orders=[];u.path=[];u.workingTarget=null;u.combatTarget=null;delete u.burst;t.transfer=0;}}
   if(!t.pickup.length||t.clock>=12||t.cargo.length===transportCapacity(h.kind)){const resume=t.resume;this.cancel(h);t.resume=resume;t.phase=h.kind==='rover'?'cruise':'takeoff';t.clock=0;if(h.kind==='rover'){h.orders=resume;t.resume=[];h.path=[];h.repath=0;}}
  }else if(t.phase==='unloading'){
   if(t.transfer>=.3&&t.cargo.length){const u=g.units.find(u=>u.id===t.cargo[0]);let at:Point|null=null;
    for(let i=0;i<20&&!at;i++){const a=i*Math.PI*2/20,probe={x:h.x+Math.cos(a)*62,y:h.y+Math.sin(a)*62};if(g.world.walkable(probe,g.obstacles(),Math.max(0,unitSpec(u??{}).radius-10))&&g.units.every(v=>v.carrier||v.id===h.id||unitSpec(v).flying||distance(v,probe)>unitSpec(v).radius+16))at=probe;}
    if(u&&at){delete u.carrier;u.x=u.previousX=at.x;u.y=u.previousY=at.y;u.orders=[];u.path=[];u.repath=0;u.hold=false;u.moving=false;t.cargo.shift();t.transfer=0;}
   }
   if(!t.cargo.length||(h.kind==='scout'&&t.clock>=12)){t.phase=h.kind==='rover'?'cruise':'takeoff';t.clock=0;}
  }else if(t.phase==='takeoff'){
   h.flightHeight=Math.min(1,(h.flightHeight??0)+dt/1.2);if(h.flightHeight>=.999){h.flightHeight=1;t.phase='cruise';h.orders=t.resume;t.resume=[];h.path=[];h.repath=0;}
  }
  return true;
 }
 cleanup():void{
  for(const u of this.g.units)if(u.carrier){const h=this.g.units.find(h=>h.id===u.carrier&&h.hp>0);if(!h)u.hp=0;else {u.x=u.previousX=h.x;u.y=u.previousY=h.y;u.moving=false;}}
 }
 static valid(g:Simulation):boolean{
  const unique=(ids:number[])=>new Set(ids).size===ids.length;
  for(const h of g.units){if(h.flightHeight!==undefined&&(!Number.isFinite(h.flightHeight)||h.flightHeight<0||h.flightHeight>1))return false;
   const t=h.transport;if(t){if(!isCarrier(h)||!['approach','landing','loading','unloading','takeoff','cruise'].includes(t.phase)||!['load','unload'].includes(t.task)||!t.site||![t.site.x,t.site.y].every(v=>Number.isFinite(v)&&v>=0&&v<=g.world.size)||!Array.isArray(t.cargo)||!Array.isArray(t.pickup)||t.cargo.length+t.pickup.length>transportCapacity(h.kind)||!unique([...t.cargo,...t.pickup])||![t.clock,t.transfer].every(v=>Number.isFinite(v)&&v>=0)||!Array.isArray(t.resume)||t.resume.length>32||t.resume.some(o=>!Number.isFinite(o.x)||!Number.isFinite(o.y)||!['move','attackMove','attack'].includes(o.kind)))return false;
    if(t.cargo.some(id=>!g.units.some(u=>u.id===id&&u.carrier===h.id&&u.owner===h.owner&&unitSpec(u).group==='Infanterie'))||t.pickup.some(id=>!g.units.some(u=>u.id===id&&u.owner===h.owner&&!u.carrier&&unitSpec(u).group==='Infanterie')))return false;
   }
   if(h.carrier!==undefined&&!g.units.some(c=>c.id===h.carrier&&isCarrier(c)&&c.owner===h.owner&&c.transport?.cargo.includes(h.id)))return false;
  }return true;
 }
}
