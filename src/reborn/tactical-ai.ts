import { profiler } from './performance.js';
import type { SectorChoice, StrategicBrief } from './qwen-plan.js';
import {RULES,distance,clamp,type Point} from './config.js';
import {UNITS,unitSpec,buildingSpec,canAttack,type UnitKind} from './catalog.js';
import {developArmy,validEconomy,type EconomyState} from './army-economy.js';
import {segmentDistance} from './world-generation.js';
import type {Simulation,Unit,Memory} from './simulation.js';
export type TacticalPhase='gather'|'attack'|'regroup'|'defend';
export interface KnownTurret extends Point {id:number;hp:number;seenAt:number;range:number}
export interface Loss extends Point {id:number;at:number;strength:number}
export interface Attempt {sector:number;losses:number;until:number}
export interface TacticalOrder {group:number;mode:'safe'|'assault'|'defend'}
export interface TacticalState {
 economy?:EconomyState;recovering?:number[];version:1;phase:TacticalPhase;phaseAt:number;lastPlan:number;target:number|null;rally:Point|null;route:Point[];
 savingSince:number|null;savingFor:UnitKind|null;group:number[];groupId:number;launchSize:number;launchedAt:number;objective:number|null;
 knownTurrets:KnownTurret[];losses:Loss[];attempts:Attempt[];productionSerial:number;lastProgress:number;progressAt:number;
 airliftAt?:number;airlift?:{heli:number;target:Point;phase:'pickup'|'delivery';since:number};
}
const combat=(u:Unit)=>u.hp>0&&!u.carrier&&!['medic','engineer','scout'].includes(u.kind);
const frontRole=(u:Unit)=>combat(u)&&u.kind!=='artillery'&&!unitSpec(u).flying;
export const combatStrength=(u:Unit)=>u.hp/100*Math.pow((unitSpec(u).damage/unitSpec(u).cooldown)/(17/.85),.35);
const fresh=():TacticalState=>({version:1,phase:'gather',phaseAt:0,lastPlan:-3,target:null,rally:null,route:[],savingSince:null,savingFor:null,group:[],groupId:0,launchSize:0,launchedAt:0,objective:null,knownTurrets:[],losses:[],attempts:[],productionSerial:0,lastProgress:0,progressAt:0});
/** Knowledge, plans and production use simulated time and the red faction's own observations. */
export class TacticalAI {
 state=fresh();private risk:Float32Array|undefined;private riskAt=-1;private routeCache=new Map<string,Point[]>();private routeSignature='';
 private strategyOptions: SectorChoice[]=[];
 private sectorPreference: {sectorId:number;until:number}|null=null;
 constructor(private readonly g:Simulation){}
 /** Only known front-line choices are shown to the optional language model. */
 strategicBrief():StrategicBrief|null{
  if(!this.strategyOptions.length)return null;
  const army=this.g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier);
  return {time:this.g.time,credits:this.g.credits[1],fighters:army.filter(combat).length,artillery:army.filter(u=>u.kind==='artillery').length,
   medics:army.filter(u=>u.kind==='medic').length,phase:this.state.phase,options:this.strategyOptions.map(o=>({...o}))};
 }
 /** Advice influences at most a safe top-four target selection; TacticalAI makes the final decision. */
 preferSector(sectorId:number):boolean{
  if(!Number.isSafeInteger(sectorId)||!this.strategyOptions.some(o=>o.sectorId===sectorId))return false;
  this.sectorPreference={sectorId,until:this.g.time+35};return true;
 }
 restore(state:TacticalState|undefined):void{
  this.state=state?structuredClone(state):fresh();this.risk=undefined;this.riskAt=-1;this.routeCache.clear();this.strategyOptions=[];this.sectorPreference=null;
  // Legacy memories contain only previously seen buildings; no live hidden bases are consulted.
  if(!state)for(const m of this.g.memories[1])if(m.owner===0&&m.kind==='turret'&&m.hp>0)this.remember(m,Math.max(0,this.g.time-45));
 }
 private remember(b:Pick<Memory,'id'|'x'|'y'|'hp'>,seenAt:number):void{
  const item=this.state.knownTurrets.find(t=>t.id===b.id),record={id:b.id,x:b.x,y:b.y,hp:b.hp,range:RULES.turret.range,seenAt};
  if(item)Object.assign(item,record);else if(this.state.knownTurrets.length<64)this.state.knownTurrets.push(record);
 }
 observe():void{
  const g=this.g,s=this.state;
  for(const b of g.bases)if(b.owner===0&&b.kind==='turret'&&b.hp>0&&g.canSee(1,b))this.remember(b,g.time);
  s.knownTurrets=s.knownTurrets.filter(t=>g.time-t.seenAt<240&&(!g.canSee(1,t)||g.bases.some(b=>b.id===t.id&&b.owner===0&&b.hp>0)));
 }
 loss(u:Unit):void{
  if(u.owner!==1||this.state.losses.some(l=>l.id===u.id))return;
  const g=this.g,s=this.state;s.losses.push({id:u.id,x:u.x,y:u.y,at:g.time,strength:combatStrength({...u,hp:unitSpec(u).hp})});
  if(s.losses.length>96)s.losses.shift();
  if(s.group.includes(u.id)&&s.target!==null){let a=s.attempts.find(a=>a.sector===s.target);if(!a){a={sector:s.target,losses:0,until:0};s.attempts.push(a);}a.losses++;a.until=g.time+Math.min(150,25*a.losses);}
  this.riskAt=-1;
 }
 private zones():{x:number;y:number;radius:number;cost:number}[]{
  const g=this.g,s=this.state,zones:{x:number;y:number;radius:number;cost:number}[]=s.knownTurrets.map(t=>({...t,radius:t.range+85,cost:36*clamp(1-Math.floor((g.time-t.seenAt)/30)*30/250,.25,1)}));
  for(const l of s.losses)if(g.time-l.at<60&&s.losses.filter(v=>g.time-v.at<60&&distance(v,l)<320).length>=2)zones.push({...l,radius:300,cost:22*(1-Math.floor((g.time-l.at)/15)*15/75)});
  for(const u of g.units)if(u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u))zones.push({...u,radius:unitSpec(u).range+70,cost:Math.min(12,combatStrength(u)*3)});
  return zones;
 }
 private field():Float32Array{
  if(this.risk&&this.riskAt===this.g.time)return this.risk;
  const g=this.g,w=g.world,field=new Float32Array(RULES.grid**2);
  for(const z of this.zones())for(let y=Math.max(0,Math.floor((z.y-z.radius)/w.cell));y<=Math.min(RULES.grid-1,Math.floor((z.y+z.radius)/w.cell));y++)for(let x=Math.max(0,Math.floor((z.x-z.radius)/w.cell));x<=Math.min(RULES.grid-1,Math.floor((z.x+z.radius)/w.cell));x++){
   const i=y*RULES.grid+x,p=w.center(i),d=distance(p,z);if(d<=z.radius)field[i]+=z.cost*(.65+.35*(1-d/z.radius));
  }
  this.risk=field;this.riskAt=g.time;return field;
 }
 costs(u:Unit):Float32Array|undefined{return u.owner===1&&u.orders[0]?.tactical?.mode==='safe'?(this.risk??this.field()):undefined;}
 navigationObstacles():{x:number;y:number;radius:number}[]{return this.obstacles();}
 private obstacles():{x:number;y:number;radius:number}[]{
  const g=this.g,known=g.memories[1].filter(m=>m.owner===0&&m.hp>0).map(m=>({...m,radius:buildingSpec(m).radius}));
  return [...g.bases.filter(b=>b.owner===1&&b.hp>0),...known];
 }
 private danger(p:Point):number{return this.risk?.[this.g.world.index(p)]??0;}
 private route(from:Point,to:Point):Point[]{
  const key=`${from.x.toFixed(3)},${from.y.toFixed(3)}/${to.x.toFixed(3)},${to.y.toFixed(3)}`;let route=this.routeCache.get(key);
  if(!route){route=this.g.world.path(from,to,this.obstacles(),5,this.field());this.routeCache.set(key,route);}return route;
 }
 private sampleRoute(route:Point[],from:Point):{risk:number;length:number}{
  let peak=0,length=0,previous=from;
  for(const p of route){const d=distance(previous,p),steps=Math.max(1,Math.ceil(d/25));length+=d;for(let i=0;i<=steps;i++)peak=Math.max(peak,this.danger({x:previous.x+(p.x-previous.x)*i/steps,y:previous.y+(p.y-previous.y)*i/steps}));previous=p;}
  return {risk:peak,length};
 }
 private setPhase(phase:TacticalPhase):void{if(this.state.phase!==phase){this.state.phase=phase;this.state.phaseAt=this.g.time;}}
 private rally(army:Unit[],home:Point):Point{
  const g=this.g,origin=army.length?army.reduce((p,u)=>({x:p.x+u.x/army.length,y:p.y+u.y/army.length}),{x:0,y:0}):home;
  const candidates:Point[]=[...(this.state.rally?[this.state.rally]:[]),origin,...g.territories.filter(t=>t.owner===1).map(t=>t.point)];
  for(const center of [home,origin])for(const radius of [160,300,500,750])for(let i=0;i<12;i++)candidates.push({x:center.x+Math.cos(i*Math.PI/6)*radius,y:center.y+Math.sin(i*Math.PI/6)*radius});
  const valid=candidates.filter(p=>p.x>40&&p.y>40&&p.x<g.world.size-40&&p.y<g.world.size-40&&g.world.walkable(p,this.obstacles(),12)&&this.danger(p)<2);
  valid.sort((a,b)=>distance(origin,a)+distance(home,a)*.15-(distance(origin,b)+distance(home,b)*.15));
  for(const p of valid.slice(0,8))if(this.route(origin,p).length)return {...p};
  return g.world.nearest({x:home.x-150,y:home.y+120},this.obstacles())??{...home};
 }
 private issue(units:Unit[],point:Point,mode:TacticalOrder['mode'],target?:number,append=false,coordinated=mode!=='safe'||this.state.phase==='attack'):void{
  if(!units.length)return;const g=this.g,s=this.state,ids=units.map(u=>u.id),front=units.filter(frontRole).sort((a,b)=>(b.kind==='tank'?5:b.kind==='heavy'?3:1)-(a.kind==='tank'?5:a.kind==='heavy'?3:1)||a.id-b.id);
  const same=!append&&units.every(u=>{const o=u.orders[0];return o?.tactical?.group===s.groupId&&o.tactical.mode===mode&&o.target===target&&distance(o,point)<45&&(coordinated||!o.march);});if(same)return;
  g.command(ids,{x:point.x,y:point.y,kind:target!==undefined?'attack':mode==='safe'?'move':'attackMove',...(target===undefined?{}:{target})},append);
  const origin=front.length?front.reduce((p,u)=>({x:p.x+u.x/front.length,y:p.y+u.y/front.length}),{x:0,y:0}):point,dist=distance(origin,point)||1,h={x:(point.x-origin.x)/dist,y:(point.y-origin.y)/dist};
  for(const u of units){const o=append?u.orders.at(-1):u.orders[0];if(!o)continue;o.tactical={group:s.groupId,mode};if(combat(u)){
    if(coordinated&&front.length)o.march=front.map(v=>v.id);else delete o.march;if(u.kind==='artillery')o.rear=150;
    if(target===undefined&&front.includes(u)&&front.length>1){const i=front.indexOf(u),lane=(i%2-.5)*30,depth=-Math.floor(i/2)*30,p={x:point.x+h.x*depth-h.y*lane,y:point.y+h.y*depth+h.x*lane};
     const at=unitSpec(u).flying?p:g.world.nearest(p,this.obstacles(),[],u,Math.max(0,unitSpec(u).radius-10));if(at){o.x=at.x;o.y=at.y;}
    }
   }
   if(u.kind==='medic'&&o.formation)o.formation.front=front.map(v=>v.id);
  }
 }
 /** Bring paid reinforcements to the active front without stopping the column
  * to wait for units still leaving the base. Join the battle only on arrival. */
 private reinforce(fighters:Unit[],home:Point):void{
  const g=this.g,s=this.state,front=fighters.filter(u=>s.group.includes(u.id));
  if(!front.length||front.length>=10||s.target===null)return;
  const available=fighters.filter(u=>!s.group.includes(u.id)&&!(g.world.mapVersion>=3&&u.orders[0]?.tactical?.mode==='assault')),reserve=fighters.length>=8?2:fighters.length>=5?1:0;
  const guard=new Set(available.slice().sort((a,b)=>distance(a,home)-distance(b,home)||a.id-b.id).slice(0,reserve).map(u=>u.id));
  const anchor=front.reduce((p,u)=>({x:p.x+u.x/front.length,y:p.y+u.y/front.length}),{x:0,y:0});
  const next=available.filter(u=>!guard.has(u.id)).sort((a,b)=>distance(a,anchor)-distance(b,anchor)||a.id-b.id).slice(0,10-front.length);
  const target=g.territories[s.target],objective=s.objective===null?undefined:g.memories[1].find(b=>b.id===s.objective&&b.hp>0);
  const approaching:Unit[]=[];
  for(const u of next){
   if(distance(u,anchor)>280){approaching.push(u);continue;}
   s.group.push(u.id);s.launchSize++;this.issue([u],objective??target.point,objective?'assault':'safe',objective?.id);
  }
  // Keep moving reinforcements on a stable route. Rewriting the waypoint every
  // three seconds used to reset their path before they reached the frontline.
  const dispatched=approaching.filter(u=>!u.orders.length||u.orders[0].tactical?.mode!=='safe'||distance(u.orders[0],anchor)>180);
  if(dispatched.length)this.issue(dispatched,anchor,'safe',undefined,false,false);
 }
 /** Physically transport paid infantry from home to a held forward sector. */
 private airlift(army:Unit[],home:Point):void{
  const g=this.g,s=this.state;
  if(g.world.mapVersion<3)return;
  const op=s.airlift,heli=op?army.find(u=>u.id===op.heli):army.find(u=>u.kind==='scout'&&u.hp>0&&!u.carrier);
  if(op){
   if(!heli){s.airlift=undefined;return;}
   const transport=heli.transport;
   if(op.phase==='pickup'){
    if(g.time-op.since>45){s.airlift=undefined;s.airliftAt=g.time;return;}
    if(distance(heli,home)>230){
     if(!heli.orders.length||distance(heli.orders[0],home)>140)this.issue([heli],home,'safe',undefined,false,false);
     return;
    }
    const riders=army.filter(u=>['infantry','heavy','medic'].includes(u.kind)&&!s.group.includes(u.id)
     &&distance(u,heli)<550&&!u.carrier&&!(s.recovering??[]).includes(u.id)).slice(0,5);
    if(riders.length>=2&&g.transports.board(heli.id,riders.map(u=>u.id))>=2)op.phase='delivery';
    return;
   }
   if(transport?.phase==='cruise'&&transport.cargo.length)g.transports.unload(heli.id,op.target);
   else if(transport?.phase==='cruise'&&!transport.cargo.length){s.airlift=undefined;s.airliftAt=g.time;}
   else if(g.time-op.since>110&&!transport?.cargo.length){s.airlift=undefined;s.airliftAt=g.time;}
   return;
  }
  if(s.phase==='defend'||g.time<80||g.time-(s.airliftAt??-200)<40||!heli
    ||army.filter(combat).length<7||(heli.transport&&heli.transport.phase!=='cruise'))return;
  const forward=g.territories.filter(t=>t.owner===1&&t.neighbors.some(i=>g.territories[i].owner!==1)
   &&distance(t.point,home)>650&&this.danger(t.point)<6)
   .sort((a,b)=>distance(home,b.point)-distance(home,a.point))[0];
  if(!forward)return;
  const waiting=army.filter(u=>['infantry','heavy','medic'].includes(u.kind)&&!s.group.includes(u.id)
   &&distance(u,home)<600&&!u.carrier).length;
  if(waiting<2)return;
  const length=distance(home,forward.point)||1;
  const target={x:clamp(forward.point.x+(home.x-forward.point.x)/length*140,80,g.world.size-80),
   y:clamp(forward.point.y+(home.y-forward.point.y)/length*140,80,g.world.size-80)};
  s.airlift={heli:heli.id,target,phase:'pickup',since:g.time};
 }
 private recon(army:Unit[],home:Point):Set<number>{
  const g=this.g,s=this.state,frontiers=g.territories.filter(t=>t.owner!==1&&t.neighbors.some(i=>g.territories[i].owner===1));
  const defending=g.units.some(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)&&g.bases.some(b=>b.owner===1&&b.hp>0&&distance(u,b)<560));
  // On the new maps, rovers are combat vehicles first, not perpetual scouts.
  const rover=g.world.mapVersion<=2&&!defending&&army.filter(combat).length>=6?army.find(u=>u.kind==='rover'&&!s.group.includes(u.id)):undefined,explorers=army.filter(u=>(u.kind==='scout'&&u.id!==s.airlift?.heli)||u===rover);
  for(const [index,u] of explorers.entries()){
   if(u.transport&&u.transport.phase!=='cruise')continue;
   const threat=s.knownTurrets.slice().sort((a,b)=>a.seenAt-b.seenAt||a.id-b.id)[index%s.knownTurrets.length];
   let goal:Point=frontiers[index%frontiers.length]?.point??home;
   if(threat){const d=distance(home,threat)||1,standOff=u.kind==='scout'?720:780;goal={x:threat.x+(home.x-threat.x)/d*standOff,y:threat.y+(home.y-threat.y)/d*standOff};}
   if(u.hp<unitSpec(u).hp*.55&&u.defendUntil>g.time)goal=s.rally??home;
   if(!u.orders.length||distance(u.orders.at(-1)!,goal)>120)this.issue([u],goal,'safe');
  }return new Set(explorers.map(u=>u.id));
 }
 /** Wounded infantry recover at a safe rally instead of being sent straight into the next assault. */
 private recovery(army:Unit[],home:Point):Set<number>{
  const g=this.g,s=this.state,ids=new Set(s.recovering??[]);
  for(const u of army)if(['infantry','heavy'].includes(u.kind)&&u.hp<unitSpec(u).hp*.3)ids.add(u.id);
  s.recovering=army.filter(u=>ids.has(u.id)&&u.hp<unitSpec(u).hp*.8).map(u=>u.id);
  const resting=army.filter(u=>s.recovering!.includes(u.id)),reserved=new Set(s.recovering);
  const goal=s.rally&&this.danger(s.rally)<2?s.rally:g.world.nearest({x:home.x-140,y:home.y+140},this.obstacles())??home;
  for(const u of resting)if(distance(u,goal)>45)this.issue([u],goal,'safe');else if(u.orders[0]?.tactical?.mode!=='safe')g.stop([u.id]);
  const medic=resting.length?army.filter(u=>u.kind==='medic').sort((a,b)=>distance(a,goal)-distance(b,goal)||a.id-b.id)[0]:undefined;
  if(medic){reserved.add(medic.id);const patient=resting.filter(u=>distance(u,goal)<120).sort((a,b)=>a.hp/unitSpec(a).hp-b.hp/unitSpec(b).hp)[0];
   if(patient){if(medic.orders[0]?.kind!=='heal'||medic.orders[0].target!==patient.id)g.command([medic.id],{x:patient.x,y:patient.y,kind:'heal',target:patient.id});}
   else this.issue([medic],goal,'safe');
  }
  for(const u of army.filter(u=>u.kind==='medic'&&u.hp<unitSpec(u).hp*.45&&u.defendUntil>g.time)){reserved.add(u.id);this.issue([u],goal,'safe');}
  return reserved;
 }
 private siege(members:Unit[],target:Point&{id:number}):boolean{
  const g=this.g,s=this.state,artillery=members.filter(u=>u.kind==='artillery'&&u.hp>0);if(!artillery.length)return false;
  const anchor=s.rally??members[0],d=distance(anchor,target)||1,h={x:(anchor.x-target.x)/d,y:(anchor.y-target.y)/d},cover={x:target.x+h.x*(RULES.turret.range+30),y:target.y+h.y*(RULES.turret.range+30)};
  const at=g.world.nearest(cover,this.obstacles(),[],undefined,12);if(!at)return false;
  const screen=members.filter(frontRole),waiting=screen.filter(u=>distance(u,at)>55||u.orders[0]?.target!==undefined);
  if(waiting.length){this.issue(waiting,at,'assault');for(const u of waiting)if(u.orders[0])u.orders[0].kind='move';}
  for(const u of artillery)this.issue([u],target,'assault',target.id);
  for(const u of members.filter(u=>unitSpec(u).flying))if(!u.orders.length||u.orders[0]?.target!==undefined)this.issue([u],s.rally??at,'safe');
  return true;
 }
 private airSupport(members:Unit[],goal:Point,targetId:number|null):void{
  const g=this.g,s=this.state,front=members.filter(frontRole),anchor=s.rally??members[0],d=distance(anchor,goal)||1,h={x:(goal.x-anchor.x)/d,y:(goal.y-anchor.y)/d};
  for(const [index,u] of members.filter(u=>u.kind==='gunship'||u.kind==='bomber').entries()){
   const target=targetId===null?undefined:g.bases.find(b=>b.id===targetId&&b.hp>0&&g.canSee(1,b))??g.memories[1].find(b=>b.id===targetId&&b.hp>0)??g.units.find(v=>v.id===targetId&&v.hp>0&&!v.carrier&&g.canSee(1,v));
   if(u.kind==='bomber'&&!target){this.issue([u],anchor,'safe');continue;}
   if(u.orders.length>1)continue;
   if(u.orders[0]?.target===targetId&&target)continue;
   const flank={x:clamp(goal.x-h.y*(index%2?-340:340)-h.x*220,30,g.world.size-30),y:clamp(goal.y+h.x*(index%2?-340:340)-h.y*220,30,g.world.size-30)};
   g.command([u.id],{...flank,kind:'move'});g.command([u.id],{x:goal.x,y:goal.y,kind:target?'attack':'attackMove',target:target?.id},true);
   for(const o of u.orders){o.tactical={group:s.groupId,mode:'assault'};if(front.length)o.march=front.map(v=>v.id);}
  }
 }
 /** A cheap second axis of pressure: mobile reserves capture an unguarded adjacent
  * bastion while the main army fights. No unknown enemies are inspected. */
 private raid(fighters:Unit[]):void{
  const g=this.g,s=this.state;
  if(g.world.mapVersion<3||s.phase!=='attack'||fighters.length<10||s.target===null)return;
  const raiders=fighters.filter(u=>!s.group.includes(u.id)&&['rover','gunship','tank'].includes(u.kind)
   &&(!u.orders.length||u.orders[0].tactical?.mode==='assault')).slice(0,2);
  if(raiders.length<2)return;
  const frontiers=g.territories.filter(t=>t.owner!==1&&t.id!==s.target&&t.neighbors.some(i=>g.territories[i].owner===1));
  const viable=frontiers.filter(t=>!s.knownTurrets.some(turret=>distance(turret,t.point)<turret.range+80)
   &&!g.memories[1].some(m=>m.owner===0&&m.hp>0&&m.territory===t.id&&['headquarters','turret'].includes(m.kind??''))
   &&!g.units.some(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)&&distance(u,t.point)<300));
  if(!viable.length)return;
  const centroid=raiders.reduce((p,u)=>({x:p.x+u.x/raiders.length,y:p.y+u.y/raiders.length}),{x:0,y:0});
  viable.sort((a,b)=>distance(centroid,a.point)-distance(centroid,b.point)||a.id-b.id);
  const target=viable[0],need=raiders.filter(u=>!u.orders[0]||distance(u.orders[0],target.point)>120);
  if(need.length)this.issue(need,target.point,'assault',undefined,false,false);
 }
 plan():void{
  if(!profiler)return this.planMeasured();const at=performance.now();try{this.planMeasured();}finally{profiler.record('ai',performance.now()-at);}
 }
 private planMeasured():void{
  const g=this.g,s=this.state;this.observe();s.lastPlan=g.time;s.losses=s.losses.filter(l=>g.time-l.at<90);s.attempts=s.attempts.filter(a=>a.until>g.time||a.losses>0).slice(-30);const signature=JSON.stringify([s.knownTurrets.map(t=>[t.id,t.x,t.y,Math.floor((g.time-t.seenAt)/30)]),s.losses.map(l=>[l.id,Math.floor((g.time-l.at)/15)]),g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)).map(u=>[u.id,u.kind,u.x,u.y,u.hp]),this.obstacles().map(o=>[o.x,o.y,o.radius])]);
  if(signature!==this.routeSignature||this.routeCache.size>128){this.routeCache.clear();this.routeSignature=signature;}this.field();
  const army=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier),home=g.bases.filter(b=>b.owner===1&&b.hp>0).sort((a,b)=>(a.kind==='headquarters'?0:1)-(b.kind==='headquarters'?0:1)||a.id-b.id)[0]??g.territories.find(t=>t.owner===1)?.point??army[0];
  if(!home)return;
  const recovering=this.recovery(army,home);this.airlift(army,home);const explorers=this.recon(army,home),boarding=new Set(army.filter(u=>u.orders[0]?.kind==='board').map(u=>u.id)),fighters=army.filter(u=>combat(u)&&!recovering.has(u.id)&&!explorers.has(u.id)&&!boarding.has(u.id)),medics=army.filter(u=>u.kind==='medic'&&!recovering.has(u.id)&&!boarding.has(u.id)).slice(0,2);
  developArmy(g,s,army,p=>this.danger(p));
  for(const w of army.filter(u=>u.kind==='engineer'&&!u.orders.length)){const b=g.bases.filter(b=>b.owner===1&&b.hp>0&&b.hp<buildingSpec(b).hp&&b.buildRemaining<=0).sort((a,b)=>distance(w,a)-distance(w,b))[0];if(b)g.command([w.id],{...b,kind:'repair',target:b.id});}
  const intruders=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)&&g.bases.some(b=>b.owner===1&&b.hp>0&&distance(u,b)<(b.kind==='headquarters'?560:420)));
  if(intruders.length){
   // Anti-siege defence: a rocket launcher or aircraft threatening the HQ is
   // more urgent than a slightly closer infantryman. Never use unseen threats.
   const urgency=(u:Unit)=>distance(u,home)-(u.kind==='artillery'?260:u.kind==='bomber'?220:u.kind==='gunship'?150:0);
   const entering=s.phase!=='defend';this.setPhase('defend');const nearest=intruders.sort((a,b)=>urgency(a)-urgency(b)||a.id-b.id)[0];
   if(entering||s.objective!==nearest.id)s.groupId++;s.group=fighters.map(u=>u.id);s.objective=nearest.id;this.issue([...fighters,...medics],nearest,'defend',nearest.id);return;
  }
  if(s.phase==='defend'){g.stop(s.group);this.setPhase('regroup');s.group=[];s.objective=null;s.rally=null;}
  if(s.phase==='attack'){this.reinforce(fighters,home);this.raid(fighters);}
  const members=army.filter(u=>s.group.includes(u.id)&&!recovering.has(u.id)),survivors=members.filter(combat);
  const recentLosses=s.losses.filter(l=>g.time-l.at<24&&s.group.includes(l.id));
  const cluster=s.losses.some(l=>g.time-l.at<90&&s.losses.filter(v=>g.time-v.at<90&&distance(l,v)<320).length>=2);
  if(s.phase==='attack'){
   const target=s.target===null?undefined:g.territories[s.target],progress=target&&survivors.length?Math.min(...survivors.map(u=>distance(u,target.point))):0;
   if(progress<s.lastProgress-60){s.lastProgress=progress;s.progressAt=g.time;}
   const objective=s.objective===null?undefined:g.bases.find(b=>b.id===s.objective&&g.canSee(1,b));
   const objectiveGone=s.objective!==null&&(!s.knownTurrets.some(t=>t.id===s.objective)&&!g.memories[1].some(m=>m.id===s.objective&&m.hp>0));
   if(objectiveGone&&target){s.objective=null;this.issue(members,target.point,'assault');s.progressAt=g.time;return;}
   const safeBroken=members.some(u=>u.orders[0]?.tactical?.mode==='safe'&&(this.danger(u.orders[0])>5||this.sampleRoute(u.path,u).risk>8));
   if(!target||target.owner===1||survivors.length===0||recentLosses.length>=2||survivors.length<s.launchSize*.6||g.time-s.progressAt>(g.world.mapVersion>=3?85:38)||safeBroken){
    g.stop(members.map(u=>u.id));this.setPhase('regroup');s.group=[];s.objective=null;s.rally=null;
   }else{
    // A revealed tower along a previously safe approach triggers reevaluation before further marching.
    const next=members.find(u=>u.orders[0]?.tactical?.mode==='safe')?.orders[0];
    if(next&&s.knownTurrets.some(t=>distance(t,next)<t.range+65)){g.stop(members.map(u=>u.id));this.setPhase('regroup');s.group=[];s.rally=null;}
    else if(objective?.kind==='turret'&&this.siege(members,objective))return;
    else if(members.some(u=>!u.orders.length)){this.issue(members,target.point,s.knownTurrets.some(t=>distance(t,target.point)<t.range+80)?'assault':'safe',objective?.id);return;}
    else return;
   }
  }
  if(!s.rally||this.danger(s.rally)>2)s.rally=this.rally(fighters,home);
  const reserve=fighters.length>=8?2:fighters.length>=5?1:0;
  const available=fighters.slice().sort((a,b)=>distance(b,home)-distance(a,home)||a.id-b.id).slice(0,fighters.length-reserve);
  const selected=available.sort((a,b)=>distance(a,s.rally!)-distance(b,s.rally!)||a.id-b.id).slice(0,10);
  const targets=g.territories.filter(t=>t.owner!==1&&t.neighbors.some(i=>g.territories[i].owner===1));
  // Once real paid long-range siege weapons are available, towers should be
  // objectives rather than near-absolute forbidden zones. The risk field still
  // applies, but the score reflects the weapon's standoff advantage.
  const siegeAvailable=selected.some(u=>u.kind==='artillery'&&u.hp>0);
  const candidates=targets.map(t=>{
   const loss=s.attempts.find(a=>a.sector===t.id),route=this.route(s.rally!,t.point),travel=this.sampleRoute(route,s.rally!);
   const towers=s.knownTurrets.filter(b=>distance(b,t.point)<b.range+85||route.some((p,i)=>segmentDistance(b,i?route[i-1]:s.rally!,p)<b.range+40));
   const defenders=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)&&distance(u,t.point)<420).reduce((n,u)=>n+combatStrength(u),0);
   const knownHQ=g.memories[1].find(m=>m.owner===0&&m.kind==='headquarters'&&m.territory===t.id&&m.hp>0);
   const knownIndustry=g.memories[1].find(m=>m.owner===0&&['factory','airfield','barracks'].includes(m.kind??'')&&m.territory===t.id&&m.hp>0);
   // Sector ownership is already part of strategic target selection. Press
   // toward the opposing front instead of clearing every remote neutral first;
   // hidden units/buildings still contribute no strength or threat information.
   const owned=g.territories.filter(t=>t.owner===1).length;
   const pressure=owned>=(g.world.mapVersion>=3?Math.max(1,Math.floor(g.territories.length/4)):4)?(t.owner===0?2000:t.neighbors.some(i=>g.territories[i].owner===0)?1200:0):0;
   const siegeRoute=siegeAvailable&&towers.length>0;
   return {t,route,...travel,towers,knownHQ,knownIndustry,defenders,score:travel.length+travel.risk*(siegeRoute?40:75)+towers.length*(siegeRoute?260:700)+defenders*130+(loss&&loss.until>g.time?900+loss.losses*180:0)-t.income*16-t.neighbors.filter(i=>g.territories[i].owner!==1).length*45-pressure-(knownIndustry?300:0)};
  }).filter(c=>c.route.length).sort((a,b)=>a.score-b.score||a.t.id-b.t.id);
  if(!candidates.length){this.strategyOptions=[];this.setPhase('regroup');this.issue([...selected,...medics],s.rally,'safe');return;}
  this.strategyOptions=candidates.slice(0,4).map(c=>({sectorId:c.t.id,owner:c.t.owner===0?'enemy':'neutral',
   score:c.score,travel:c.length,routeRisk:c.risk,defenders:c.defenders,turrets:c.towers.length,income:c.t.income}));
  const advised=this.sectorPreference&&this.sectorPreference.until>=g.time
   ?candidates.slice(0,4).find(c=>c.t.id===this.sectorPreference!.sectorId&&c.score-candidates[0].score<=700):undefined;
  const c=advised??candidates[0];s.target=c.t.id;s.route=c.route.slice(0,64);
  const defended=c.towers.length>0||c.defenders>2||c.knownHQ!==undefined||c.knownIndustry!==undefined||c.risk>12;
  // A late reserve may be taking a long route out of newly built facilities.
  // Three ready fighters can take an unguarded sector after a bounded wait;
  // defended objectives retain their full assault-strength requirements.
  const ready=selected.filter(u=>distance(u,s.rally!)<200),need=defended?(ready.some(u=>u.kind==='artillery')&&c.towers.length?4:6):g.time-s.phaseAt>=18?3:4,power=ready.reduce((n,u)=>n+combatStrength(u),0);
  const scoutAllowed=!defended&&!cluster&&fighters.length<4&&(g.time<40||g.time-s.phaseAt>35);
  const enough=!(s.phase==='regroup'&&g.time-s.phaseAt<9)&&((ready.length>=need&&power>=(defended?Math.max(6,c.towers.length*4.5+c.defenders*.8):3))||(scoutAllowed&&ready.length>0));
  if(!enough){
   if(s.phase!=='regroup')this.setPhase('gather');
   const waiting=selected.filter(u=>distance(u,s.rally!)>60||!u.orders.length||u.orders[0]?.tactical?.mode!=='safe');this.issue([...waiting,...medics],s.rally,'safe');
   // A weak force can investigate the safe perimeter rather than wait forever or rush a gun.
   if(defended&&g.time-s.phaseAt>40){
    let vantage:Point|undefined,from=s.rally;
    for(const to of c.route){const d=distance(from,to),steps=Math.max(1,Math.ceil(d/70));for(let i=1;i<=steps;i++){const p={x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps};if(this.danger(p)<2&&g.world.walkable(p,this.obstacles(),15))vantage=p;else break;}if(this.danger(to)>=2)break;from=to;}
    if(vantage&&distance(vantage,s.rally)>120){s.rally=vantage;this.setPhase('regroup');s.phaseAt=g.time;this.issue([...selected,...medics],vantage,'safe');}
   }
   return;
  }
  const frontline=g.world.mapVersion>=3?ready.slice().sort((a,b)=>(b.kind==='tank'?5:b.kind==='artillery'?4:b.kind==='heavy'?3:b.kind==='gunship'?2:1)-(a.kind==='tank'?5:a.kind==='artillery'?4:a.kind==='heavy'?3:a.kind==='gunship'?2:1)||a.id-b.id):ready;
  const group=[...frontline.slice(0,defended?10:6),...medics.filter(u=>distance(u,s.rally!)<240)];s.group=group.map(u=>u.id);s.groupId++;s.launchSize=group.filter(combat).length;s.launchedAt=g.time;s.lastProgress=distance(s.rally,c.t.point);s.progressAt=g.time;this.setPhase('attack');
  const obstacle=defended?c.towers.slice().sort((a,b)=>distance(s.rally!,a)-distance(s.rally!,b))[0]??c.knownHQ??c.knownIndustry:undefined;
  s.objective=obstacle?.id??null;
  if(obstacle){this.issue(group,obstacle,'assault',obstacle.id);if(c.towers.some(t=>t.id===obstacle.id)&&this.siege(group,obstacle))return;this.airSupport(group,obstacle,obstacle.id);}
  else {this.issue(group,c.t.point,'safe');this.airSupport(group,c.t.point,null);}
 }
 static valid(raw:unknown,time:number,point:(p:Point)=>boolean,sectors:number):raw is TacticalState{
  if(raw===undefined)return true;const s=raw as TacticalState,finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v),ids=(v:unknown)=>Array.isArray(v)&&v.length<=96&&v.every(Number.isInteger);
  return !!s&&(s.airliftAt===undefined||(finite(s.airliftAt)&&s.airliftAt>=0&&s.airliftAt<=time+.001))&&(s.airlift===undefined||(!!s.airlift&&Number.isInteger(s.airlift.heli)&&s.airlift.heli>=0&&point(s.airlift.target)&&['pickup','delivery'].includes(s.airlift.phase)&&finite(s.airlift.since)&&s.airlift.since>=0&&s.airlift.since<=time+.001))&&(s.recovering===undefined||ids(s.recovering))&&validEconomy(s.economy,time)&&s.version===1&&['gather','attack','regroup','defend'].includes(s.phase)&&[s.phaseAt,s.launchedAt,s.progressAt].every(v=>finite(v)&&v>=0&&v<=time+.001)&&finite(s.lastPlan)&&s.lastPlan>=-3&&s.lastPlan<=time+.001&&finite(s.lastProgress)&&s.lastProgress>=0&&[s.groupId,s.launchSize,s.productionSerial].every(v=>Number.isInteger(v)&&v>=0)&&ids(s.group)&&(s.savingSince===null||(finite(s.savingSince)&&s.savingSince>=0&&s.savingSince<=time+.001))&&(s.savingFor===null||Object.hasOwn(UNITS,s.savingFor))&&(s.target===null||(Number.isInteger(s.target)&&s.target>=0&&s.target<sectors))&&(s.objective===null||Number.isInteger(s.objective))&&(s.rally===null||point(s.rally))&&Array.isArray(s.route)&&s.route.length<=64&&s.route.every(point)&&Array.isArray(s.knownTurrets)&&s.knownTurrets.length<=64&&s.knownTurrets.every(t=>point(t)&&Number.isInteger(t.id)&&finite(t.hp)&&t.hp>0&&finite(t.range)&&t.range===RULES.turret.range&&finite(t.seenAt)&&t.seenAt>=0&&t.seenAt<=time+.001)&&Array.isArray(s.losses)&&s.losses.length<=96&&s.losses.every(l=>point(l)&&Number.isInteger(l.id)&&finite(l.at)&&l.at>=0&&l.at<=time+.001&&finite(l.strength)&&l.strength>=0)&&Array.isArray(s.attempts)&&s.attempts.length<=sectors&&s.attempts.every(a=>Number.isInteger(a.sector)&&a.sector>=0&&a.sector<sectors&&Number.isInteger(a.losses)&&a.losses>=0&&finite(a.until)&&a.until>=0);
 }
}
