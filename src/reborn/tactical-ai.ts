import { profiler } from './performance.js';
import type { SectorChoice, StrategicBrief } from './qwen-plan.js';
import {RULES,distance,clamp,type Point} from './config.js';
import {UNITS,unitSpec,buildingSpec,canAttack,type UnitKind} from './catalog.js';
import {developArmy,validEconomy,type EconomyState} from './army-economy.js';
import {assaultDecision,abortAssault} from './ai-director.js';
import {newCampaign,campaignPhase,refreshIntelligence,chooseMission,reconGoal,validCampaign,knownBuildings,type CampaignState} from './campaign-commander.js';
import {segmentDistance} from './world-generation.js';
import {newBattle,assessBattle,fightingPower,recordFailure,retryFront,validBattle,type BattleState} from './battle-response.js';
import {newAdaptive,updateAdaptive,validAdaptive,type AdaptiveState} from './adaptive-strategy.js';
import {newExperience,validExperience,finishExperience,canOverrun,observeOwnedLosses,lessonScore,type Experience} from './battle-learning.js';
import {rankLegacyFrontiers} from './legacy-campaign.js';
import {chooseTacticalManeuver,flankCandidate,type TacticalChoice} from './tactical-search.js';
import {assignScreen,assignFlank,flankRouteScore,isContinuingFlank} from './battle-squads.js';
import {assaultWaveDecision,reinforcementStagingPoint} from './assault-wave.js';
import {chooseSiegeShot,chooseRaidFront,allowSecondaryPressure,type SiegeShot,type RaidFront} from './ai25-doctrine.js';
import type {Simulation,Unit,Memory} from './simulation.js';
export type TacticalPhase='gather'|'attack'|'regroup'|'defend';
export interface KnownTurret extends Point {id:number;hp:number;seenAt:number;range:number}
export interface Loss extends Point {id:number;at:number;strength:number}
export interface Attempt {sector:number;losses:number;until:number}
export interface TacticalOrder {group:number;mode:'safe'|'assault'|'defend';goal?:Point}
export interface TacticalDiagnostics {
 evaluated:number;choices:Record<'assault'|'flank'|'siege'|'regroup',number>;
 delegatedSieges:number;issuedSieges:number;screenOrders:number;flankGroups:number;flankOrders:number;mainOrders:number;
 flankOpportunities:number;flankNoSquad:number;flankNoRoute:number;
 waveWaits:number;waveLaunches:number;reinforcementStagingOrders:number;
 siegeAngles:number;secondaryRaids:number;secondaryRaidOrders:number;
 last:{at:number;sector:number;allies:number;visible:number;guns:number;choice:string;reason:string}|null;
}
const newDiagnostics=():TacticalDiagnostics=>({evaluated:0,choices:{assault:0,flank:0,siege:0,regroup:0},delegatedSieges:0,issuedSieges:0,screenOrders:0,flankGroups:0,flankOrders:0,mainOrders:0,
 flankOpportunities:0,flankNoSquad:0,flankNoRoute:0,waveWaits:0,waveLaunches:0,reinforcementStagingOrders:0,siegeAngles:0,secondaryRaids:0,secondaryRaidOrders:0,last:null});
export interface TacticalState {
 adaptive?:AdaptiveState;experience?:Experience;
 battle?:BattleState;
 commander?:CampaignState;
 economy?:EconomyState;recovering?:number[];version:1;phase:TacticalPhase;phaseAt:number;lastPlan:number;target:number|null;rally:Point|null;route:Point[];
 savingSince:number|null;savingFor:UnitKind|null;group:number[];groupId:number;launchSize:number;launchedAt:number;objective:number|null;
 knownTurrets:KnownTurret[];losses:Loss[];attempts:Attempt[];productionSerial:number;lastProgress:number;progressAt:number;
 airliftAt?:number;airlift?:{heli:number;target:Point;phase:'pickup'|'delivery';since:number;passengers?:number[]};
}
const combat=(u:Unit)=>u.hp>0&&!u.carrier&&!['medic','engineer','scout'].includes(u.kind);
const frontRole=(u:Unit)=>combat(u)&&u.kind!=='artillery'&&!unitSpec(u).flying;
export const combatStrength=(u:Unit)=>u.hp/100*Math.pow((unitSpec(u).damage/unitSpec(u).cooldown)/(17/.85),.35);
const fresh=():TacticalState=>({version:1,phase:'gather',phaseAt:0,lastPlan:-3,target:null,rally:null,route:[],savingSince:null,savingFor:null,group:[],groupId:0,launchSize:0,launchedAt:0,objective:null,knownTurrets:[],losses:[],attempts:[],productionSerial:0,lastProgress:0,progressAt:0});
/** Knowledge, plans and production use simulated time and the red faction's own observations. */
export class TacticalAI {
 /** Benchmark override; normal gameplay always uses the director. */
 mode:'baseline'|'director'='director';
 /** Benchmark-only A/B switch; classic director remains available. */
 planningMode:'classic'|'tactical'='tactical';
 /** Benchmark-only policy toggle: legacy Tactical AI 2.3 versus coordinated 2.4. */
 waveMode:'legacy'|'coordinated'='coordinated';
 /** 2.4/2.5 paired comparison; affects strategy only, never serialized. */
 doctrineMode:'legacy'|'intelligent'='intelligent';
 /** Runtime-only diagnostics: never influence simulation or serialize in saves. */
 diagnostics:TacticalDiagnostics=newDiagnostics();
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
  this.state=state?structuredClone(state):fresh();this.risk=undefined;this.riskAt=-1;this.routeCache.clear();this.strategyOptions=[];this.sectorPreference=null;this.diagnostics=newDiagnostics();
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
 /** Damage events are observable, even when the firing position is fogged.
  * Never resolve lastAttacker to a hidden tower. Macro reassignment is locked
  * while this short, authoritative withdrawal is in progress. */
 underTowerFire(u:Unit):void{
  const g=this.g,s=this.state;if(this.mode!=='director'||g.world.mapVersion<3||u.owner!==1||u.hp<=0||u.carrier)return;
  const b=s.battle??=newBattle(),old=b.withdrawals.find(w=>w.unit===u.id);
  b.withdrawals=b.withdrawals.filter(w=>g.units.some(v=>v.id===w.unit&&v.owner===1&&v.hp>0&&!v.carrier));
  if(old&&g.time-old.since<5)return;
  const army=g.units.filter(v=>v.owner===1&&v.hp>0&&!v.carrier),near=army.filter(v=>distance(v,u)<450&&!s.recovering?.includes(v.id));
  const towers=s.knownTurrets.filter(t=>distance(t,u)<t.range+220),enemies=g.units.filter(v=>v.owner===0&&v.hp>0&&!v.carrier&&g.canSee(1,v)&&distance(v,u)<600);
  const assessment=assessBattle(near,enemies,towers,g.time,true);
  if(towers.length&&assessment.stance==='attack'&&u.hp>unitSpec(u).hp*.65)return;
  // A rocket already firing from range may continue; a short-range screen
  // under fire must move beyond the guns instead of waiting for 67% HP.
  if(u.kind==='artillery'&&towers.length&&towers.every(t=>distance(t,u)>t.range+15)&&u.hp>unitSpec(u).hp*.75)return;
  const home=g.bases.find(v=>v.owner===1&&v.kind==='headquarters'&&v.hp>0)??g.territories.find(t=>t.owner===1)?.point;
  if(!home)return;
  const goal=this.withdrawPoint(u,home,towers);
  const squad=near.filter(v=>v===u||(s.group.includes(u.id)&&s.group.includes(v.id)&&v.kind!=='artillery'&&towers.some(t=>distance(v,t)<t.range+85)));
  for(const v of squad){
   if(s.recovering?.includes(v.id)||b.withdrawals.some(w=>w.unit===v.id&&g.time-w.since<5))continue;
   this.issue([v],goal,'safe',undefined,false,false);
   b.withdrawals=b.withdrawals.filter(w=>w.unit!==v.id);b.withdrawals.push({...goal,unit:v.id,since:g.time,until:g.time+10});
  }
  b.reactions++;this.riskAt=-1;
  if(s.target!==null&&!b.fronts.some(f=>f.sector===s.target&&g.time-f.at<8))recordFailure(b,s.target,u,assessment.own,towers.length,g.time);
 }
 private withdrawPoint(from:Point,home:Point,towers=this.state.knownTurrets):Point{
  const g=this.g,points:Point[]=[home,...g.territories.filter(t=>t.owner===1).map(t=>t.point)];
  for(const length of [180,350,700])for(const angle of [0,-.6,.6,-1.2,1.2]){
   const heading=Math.atan2(home.y-from.y,home.x-from.x)+angle;
   points.push({x:clamp(from.x+Math.cos(heading)*length,50,g.world.size-50),y:clamp(from.y+Math.sin(heading)*length,50,g.world.size-50)});
  }
  const exposure=(p:Point)=>towers.reduce((n,t)=>n+Math.max(0,t.range+100-distance(t,p)),0);
  points.sort((a,b)=>exposure(a)*20+distance(from,a)-exposure(b)*20-distance(from,b));
  for(const p of points.slice(0,5)){const at=g.world.nearest(p,this.obstacles(),[],undefined,12);if(at&&this.route(from,at).length)return at;}
  return {...home};
 }
 private withdrawals(army:Unit[]):Set<number>{
  const g=this.g,s=this.state,b=s.battle??=newBattle();
  b.withdrawals=b.withdrawals.filter(w=>{const u=army.find(u=>u.id===w.unit);return !!u&&(g.time<w.until||s.knownTurrets.some(t=>distance(t,u)<t.range+70));});
  for(const w of b.withdrawals){const u=army.find(u=>u.id===w.unit)!;
   if(s.recovering?.includes(u.id))continue;
   if(distance(u,w)>60)this.issue([u],w,'safe',undefined,false,false);else if(u.orders.length)g.stop([u.id]);
  }
  return new Set(b.withdrawals.map(w=>w.unit));
 }
 private localDefense(fighters:Unit[],medics:Unit[],intruders:Unit[],home:Point):Set<number>{
  const g=this.g,s=this.state,b=s.battle??=newBattle(),old=b.squads.find(q=>q.role==='defense');
  if(!intruders.length){
   if(old)g.stop(old.ids.filter(id=>!s.recovering?.includes(id)&&!b.withdrawals.some(w=>w.unit===id)));
   b.squads=b.squads.filter(q=>q.role!=='defense');return new Set();
  }
  const target=intruders.slice().sort((a,v)=>distance(a,home)-(a.kind==='artillery'?250:0)-distance(v,home)+(v.kind==='artillery'?250:0)||a.id-v.id)[0];
  const nearby=intruders.filter(u=>distance(u,target)<400),needed=fightingPower(nearby)*1.2;
  const available=fighters.slice().sort((a,v)=>Number(old?.ids.includes(v.id))-Number(old?.ids.includes(a.id))||distance(a,target)-distance(v,target)||a.id-v.id);
  const defenders:Unit[]=[];for(const u of available){defenders.push(u);if(fightingPower(defenders)>=needed)break;}
  const medic=medics.slice().sort((a,v)=>distance(a,target)-distance(v,target))[0];if(medic)defenders.push(medic);
  const ids=new Set(defenders.map(u=>u.id));
  b.squads=[...b.squads.filter(q=>q.role!=='defense').map(q=>({...q,ids:q.ids.filter(id=>!ids.has(id))})),{role:'defense',ids:[...ids],target:target.id,since:old?.target===target.id?old.since:g.time}];
  const enough=fightingPower(defenders)>=fightingPower(nearby)*.85;
  if(enough)this.issue(defenders,target,'defend',target.id,false,false);
  else this.issue(defenders,this.withdrawPoint(target,home),'safe',undefined,false,false);
  return new Set(defenders.map(u=>u.id));
 }
 /** A small, separately owned expansion task finances the siege instead of
  * leaving the entire army idle at an unaffordable fortified objective. */
 private expansionRaid(fighters:Unit[],home:Point):Set<number>{
  const g=this.g,s=this.state,b=s.battle??=newBattle(),old=b.squads.find(q=>q.role==='raid');
  const safe=(id:number)=>{const t=g.territories[id];return t&&t.owner!==1&&!s.knownTurrets.some(k=>distance(k,t.point)<k.range+140)
   &&!g.memories[1].some(m=>m.owner===0&&m.hp>0&&m.territory===id)
   &&!g.units.some(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)&&distance(u,t.point)<350);};
  if(old&&old.target!==null&&safe(old.target)){
   const units=fighters.filter(u=>old.ids.includes(u.id));
   if(units.length){this.issue(units,g.territories[old.target].point,'assault',undefined,false,false);return new Set(units.map(u=>u.id));}
  }
  b.squads=b.squads.filter(q=>q.role!=='raid');
  if(old){const units=fighters.filter(u=>old.ids.includes(u.id));if(old.target!==null&&g.territories[old.target]?.owner!==1)this.issue(units,s.rally??home,'safe',undefined,false,false);}
  if(fighters.length<5||!['reinforce','withdraw'].includes(b.assessment?.stance??'')||b.squads.some(q=>q.role==='defense'&&q.ids.length))return new Set();
  const spare=fighters.filter(u=>!s.group.includes(u.id)&&['infantry','rover'].includes(u.kind));if(spare.length<2)return new Set();
  const targets=g.territories.filter(t=>safe(t.id)&&t.neighbors.some(id=>g.territories[id].owner===1))
   .sort((a,v)=>distance(spare[0],a.point)-distance(spare[0],v.point)||a.id-v.id);
  const target=targets.find(t=>{const route=this.route(spare[0],t.point);return route.length&&this.sampleRoute(route,spare[0]).risk<8;});if(!target)return new Set();
  const units=spare.sort((a,v)=>distance(a,target.point)-distance(v,target.point)||a.id-v.id).slice(0,2);
  b.squads.push({role:'raid',ids:units.map(u=>u.id),target:target.id,since:g.time});this.issue(units,target.point,'assault',undefined,false,false);return new Set(units.map(u=>u.id));
 }
 private rally(army:Unit[],home:Point):Point{
  const g=this.g,origin=army.length?army.reduce((p,u)=>({x:p.x+u.x/army.length,y:p.y+u.y/army.length}),{x:0,y:0}):home;
  if(g.world.mapVersion>=3&&this.mode==='director'){
   const front=g.territories.filter(t=>t.owner===1&&t.neighbors.some(id=>g.territories[id].owner!==1))
    .sort((a,b)=>{
     const danger=(t:typeof a)=>t.neighbors.some(id=>g.territories[id].owner===0)?-340:0;
     return distance(a.point,origin)+distance(a.point,home)*.1+danger(a)
      -(distance(b.point,origin)+distance(b.point,home)*.1+danger(b));
    });
   for(const sector of front){
    const delta=distance(home,sector.point)||1;
    const p=g.world.nearest({x:sector.point.x+(home.x-sector.point.x)/delta*105,
     y:sector.point.y+(home.y-sector.point.y)/delta*105},this.obstacles(),[],undefined,8);
    if(p&&this.danger(p)<2&&this.route(origin,p).length)return p;
   }
  }
  const candidates:Point[]=[...(this.state.rally?[this.state.rally]:[]),origin,...g.territories.filter(t=>t.owner===1).map(t=>t.point)];
  for(const center of [home,origin])for(const radius of [160,300,500,750])for(let i=0;i<12;i++)candidates.push({x:center.x+Math.cos(i*Math.PI/6)*radius,y:center.y+Math.sin(i*Math.PI/6)*radius});
  const valid=candidates.filter(p=>p.x>40&&p.y>40&&p.x<g.world.size-40&&p.y<g.world.size-40&&g.world.walkable(p,this.obstacles(),12)&&this.danger(p)<2);
  valid.sort((a,b)=>distance(origin,a)+distance(home,a)*.15-(distance(origin,b)+distance(home,b)*.15));
  for(const p of valid.slice(0,8))if(this.route(origin,p).length)return {...p};
  return g.world.nearest({x:home.x-150,y:home.y+120},this.obstacles())??{...home};
 }
 private issue(units:Unit[],point:Point,mode:TacticalOrder['mode'],target?:number,append=false,coordinated=mode!=='safe'||this.state.phase==='attack'):boolean{
  if(!units.length)return false;const g=this.g,s=this.state,ids=units.map(u=>u.id),front=units.filter(frontRole).sort((a,b)=>(b.kind==='tank'?5:b.kind==='heavy'?3:1)-(a.kind==='tank'?5:a.kind==='heavy'?3:1)||a.id-b.id);
  const campaign=g.world.mapVersion>=3&&this.mode==='director';
  const same=!append&&units.every(u=>{const o=u.orders[0];return o?.tactical?.group===s.groupId&&o.tactical.mode===mode&&o.target===target&&(campaign?(target!==undefined||distance(o.tactical.goal??o,point)<45):distance(o,point)<45)&&(coordinated||!o.march);});if(same)return false;
  if(!g.command(ids,{x:point.x,y:point.y,kind:target!==undefined?'attack':mode==='safe'?'move':'attackMove',...(target===undefined?{}:{target})},append))return false;
  const origin=front.length?front.reduce((p,u)=>({x:p.x+u.x/front.length,y:p.y+u.y/front.length}),{x:0,y:0}):point,dist=distance(origin,point)||1,h={x:(point.x-origin.x)/dist,y:(point.y-origin.y)/dist};
  for(const u of units){const o=append?u.orders.at(-1):u.orders[0];if(!o)continue;o.tactical={group:s.groupId,mode,...(campaign?{goal:{x:point.x,y:point.y}}:{})};if(combat(u)){
    if(coordinated&&front.length&&(g.world.mapVersion<=2||this.mode==='baseline'||mode!=='assault'))o.march=front.map(v=>v.id);else delete o.march;if(u.kind==='artillery')o.rear=150;
    if(target===undefined&&front.includes(u)&&front.length>1){const i=front.indexOf(u),lane=(i%2-.5)*30,depth=-Math.floor(i/2)*30,p={x:point.x+h.x*depth-h.y*lane,y:point.y+h.y*depth+h.x*lane};
     const at=unitSpec(u).flying?p:g.world.nearest(p,this.obstacles(),[],u,Math.max(0,unitSpec(u).radius-10));if(at){o.x=at.x;o.y=at.y;}
    }
   }
   if(u.kind==='medic'&&o.formation)o.formation.front=front.map(v=>v.id);
  }
  return true;
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
   s.group.push(u.id);s.launchSize++;this.issue([u],objective??target.point,objective||g.world.mapVersion>=3&&this.mode==='director'?'assault':'safe',objective?.id);
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
    if(g.time-op.since>45){g.stop([heli.id]);if(transport?.cargo.length){op.phase='delivery';op.target={x:home.x,y:home.y};op.since=g.time;}else{s.airlift=undefined;s.airliftAt=g.time;}return;}
    if(distance(heli,home)>230){
     if(!heli.orders.length||distance(heli.orders[0],home)>140)this.issue([heli],home,'safe',undefined,false,false);
     return;
    }
    const riders=army.filter(u=>['infantry','heavy','medic'].includes(u.kind)&&(op.passengers?op.passengers.includes(u.id):!s.group.includes(u.id))
     &&distance(u,heli)<550&&!u.carrier&&!(s.recovering??[]).includes(u.id)).slice(0,5);
    if(riders.length>=2&&g.transports.board(heli.id,riders.map(u=>u.id))>0)op.phase='delivery';
    return;
   }
   if(g.time-op.since>110&&transport?.cargo.length){g.stop([heli.id]);op.target={x:home.x,y:home.y};op.since=g.time;return;}
   if(transport?.phase==='cruise'&&transport.cargo.length){
    if(!g.transports.unload(heli.id,op.target)){
     // Failed forward landing must never reserve passengers forever. Return
     // to reachable own ground through the same public transport command.
     op.target={x:home.x,y:home.y};op.since=g.time;
     for(const site of [home,...g.territories.filter(t=>t.owner===1).map(t=>t.point)])if(g.transports.unload(heli.id,site)){op.target={x:site.x,y:site.y};break;}
    }
   }
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
   &&distance(u,home)<600&&!u.carrier);
  if(waiting.length<2)return;
  const length=distance(home,forward.point)||1;
  const target={x:clamp(forward.point.x+(home.x-forward.point.x)/length*140,80,g.world.size-80),
   y:clamp(forward.point.y+(home.y-forward.point.y)/length*140,80,g.world.size-80)};
  if(this.mode==='director'){
   if(!g.memories[1].some(m=>m.owner===0&&m.kind==='headquarters'&&m.hp>0))return;
   const ground=waiting.slice(0,5).map(u=>{const route=this.route(u,target),travel=this.sampleRoute(route,u);return route.length?travel.length/unitSpec(u).speed:Infinity;});
   const air=distance(heli,home)/unitSpec(heli).speed+length/unitSpec(heli).speed+10;
   if(!ground.some(eta=>eta>air+4))return;
  }
  s.airlift={heli:heli.id,target,phase:'pickup',since:g.time,...(this.mode==='director'?{passengers:waiting.slice(0,5).map(u=>u.id)}:{})};
 }
 private recon(army:Unit[],home:Point):Set<number>{
  if(this.mode==='director'&&this.g.world.mapVersion>=3)return this.campaignRecon(army,home);
  const g=this.g,s=this.state,frontiers=g.territories.filter(t=>t.owner!==1&&t.neighbors.some(i=>g.territories[i].owner===1));
  const defending=g.units.some(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)&&g.bases.some(b=>b.owner===1&&b.hp>0&&distance(u,b)<560));
  // On the new maps, rovers are combat vehicles first, not perpetual scouts.
  const rover=g.world.mapVersion<=2&&!defending&&army.filter(combat).length>=6?army.find(u=>u.kind==='rover'&&!s.group.includes(u.id)):undefined,explorers=army.filter(u=>(u.kind==='scout'&&u.id!==s.airlift?.heli)||u===rover);
  for(const [index,u] of explorers.entries()){
   if(u.transport&&u.transport.phase!=='cruise')continue;
   const threat=s.knownTurrets.slice().sort((a,b)=>a.seenAt-b.seenAt||a.id-b.id)[index%s.knownTurrets.length];
   const ranked=g.world.mapVersion<=2?rankLegacyFrontiers(frontiers,u):frontiers;
   let goal:Point=ranked[index%ranked.length]?.point??home;
   if(threat){const d=distance(home,threat)||1,standOff=u.kind==='scout'?720:780;goal={x:threat.x+(home.x-threat.x)/d*standOff,y:threat.y+(home.y-threat.y)/d*standOff};}
   if(u.hp<unitSpec(u).hp*.55&&u.defendUntil>g.time)goal=s.rally??home;
   if(!u.orders.length||distance(u.orders.at(-1)!,goal)>120)this.issue([u],goal,'safe');
  }return new Set(explorers.map(u=>u.id));
 }
 private campaignRecon(army:Unit[],home:Point):Set<number>{
  const g=this.g,s=this.state,c=s.commander??=newCampaign();refreshIntelligence(g,c);
  c.recon=c.recon.filter(t=>army.some(u=>u.id===t.unit));
  const recovering=new Set(s.recovering??[]),explorers=army.filter(u=>u.kind==='scout'&&u.id!==s.airlift?.heli);
  if(!explorers.length&&army.filter(combat).length>=4){
   const rover=army.find(u=>u.kind==='rover'&&!s.group.includes(u.id)&&!recovering.has(u.id));if(rover)explorers.push(rover);
  }
  for(const u of explorers){
   if(recovering.has(u.id)||u.transport&&u.transport.phase!=='cruise')continue;
   if(u.hp<unitSpec(u).hp*.6&&u.defendUntil>g.time){this.issue([u],home,'safe');continue;}
   const goal=reconGoal(g,c,u,p=>this.danger(p));
   if(goal&&(!u.orders.length||distance(u.orders.at(-1)!,goal)>60))this.issue([u],goal,'safe',undefined,false,false);
  }
  return new Set(explorers.map(u=>u.id));
 }
 /** Wounded infantry recover at a safe rally instead of being sent straight into the next assault. */
 /** Fire-and-forget combat extraction at the instant of an actual enemy hit.
  * The 3-second macro tick alone is too slow to save a 220-HP rover.
  * Never affects blue/player units or the legacy strategy. */
 evacuateVehicle(u:Unit):void{
  const g=this.g,s=this.state;
  if(this.mode!=='director'||g.world.mapVersion<3||u.owner!==1||u.hp<=0
    ||!['tank','rover','artillery'].includes(u.kind)||u.hp>=unitSpec(u).hp*.67
    ||s.recovering?.includes(u.id))return;
  const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters'&&b.hp>0);
  if(!hq)return;
  const edge={x:clamp(hq.x+(hq.x>=g.world.size/2?165:-165),85,g.world.size-85),
    y:clamp(hq.y+(hq.y>=g.world.size/2?135:-135),85,g.world.size-85)};
  const dock=g.world.nearest(edge,this.obstacles(),[],u,Math.max(0,unitSpec(u).radius-10));
  if(!dock||!g.command([u.id],{...dock,kind:'move'}))return;
  u.orders[0].tactical={group:s.groupId,mode:'safe'};
  s.recovering??=[];s.recovering.push(u.id);
 }
 private recovery(army:Unit[],home:Point):Set<number>{
  const g=this.g,s=this.state,ids=new Set(s.recovering??[]);
  for(const u of army){
   if(['infantry','heavy'].includes(u.kind)&&u.hp<unitSpec(u).hp*.3)ids.add(u.id);
   // Vehicles survive sustained campaigns when they can break contact,
   // travel back to a real engineer, then return above 80% health.
   if(g.world.mapVersion>=3&&this.mode==='director'
     &&['tank','rover','artillery'].includes(u.kind)&&u.hp<unitSpec(u).hp*.67)ids.add(u.id);
  }
  s.recovering=army.filter(u=>ids.has(u.id)&&u.hp<unitSpec(u).hp*(['tank','rover','artillery'].includes(u.kind)?.9:.8)).map(u=>u.id);
  const resting=army.filter(u=>s.recovering!.includes(u.id)),reserved=new Set(s.recovering);
  const vehiclePatients=resting.filter(u=>['tank','rover','artillery'].includes(u.kind));
  if(vehiclePatients.length){
   // Park behind the HQ, away from the middle of the battlefield.
   const edge={x:clamp(home.x+(home.x>=g.world.size/2?165:-165),85,g.world.size-85),
    y:clamp(home.y+(home.y>=g.world.size/2?135:-135),85,g.world.size-85)};
   const dock=g.world.nearest(edge,this.obstacles())??home;
   for(const v of vehiclePatients){
    if(distance(v,dock)>85){
     if(v.orders[0]?.tactical?.mode!=='safe'||distance(v.orders[0],dock)>60)
      this.issue([v],dock,'safe',undefined,false,false);
    }else if(v.orders.length)g.stop([v.id]);
   }
   const waiting=vehiclePatients.filter(v=>distance(v,dock)<105)
    .sort((a,b)=>a.hp/unitSpec(a).hp-b.hp/unitSpec(b).hp||a.id-b.id);
   const engineer=army.find(u=>u.kind==='engineer'&&!u.orders.some(o=>o.kind==='build')
      &&u.defendUntil<=g.time);
   if(waiting.length&&engineer){
    const damaged=waiting[0];
    if(engineer.orders[0]?.kind!=='repair'||engineer.orders[0]?.target!==damaged.id)
      g.command([engineer.id],{x:damaged.x,y:damaged.y,kind:'repair',target:damaged.id});
   }
   for(const w of army.filter(u=>u.kind==='engineer'&&g.world.mapVersion>=3&&this.mode==='director')){
    const order=w.orders[0],vehicle=order?.kind==='repair'?army.find(u=>u.id===order.target&&['tank','rover','artillery'].includes(u.kind)):undefined;
    if(vehicle&&!ids.has(vehicle.id))g.stop([w.id]);
   }
  }
  const goal=s.rally&&this.danger(s.rally)<2?s.rally:g.world.nearest({x:home.x-140,y:home.y+140},this.obstacles())??home;
  for(const u of resting.filter(u=>!vehiclePatients.includes(u)))if(distance(u,goal)>45)this.issue([u],goal,'safe');else if(u.orders[0]?.tactical?.mode!=='safe')g.stop([u.id]);
  const infantryPatients=resting.filter(u=>['infantry','heavy'].includes(u.kind));
  const medic=infantryPatients.length?army.filter(u=>u.kind==='medic').sort((a,b)=>distance(a,goal)-distance(b,goal)||a.id-b.id)[0]:undefined;
  if(medic){reserved.add(medic.id);const patient=infantryPatients.filter(u=>distance(u,goal)<120).sort((a,b)=>a.hp/unitSpec(a).hp-b.hp/unitSpec(b).hp)[0];
   if(patient){if(medic.orders[0]?.kind!=='heal'||medic.orders[0].target!==patient.id)g.command([medic.id],{x:patient.x,y:patient.y,kind:'heal',target:patient.id});}
   else this.issue([medic],goal,'safe');
  }
  for(const u of army.filter(u=>u.kind==='medic'&&u.hp<unitSpec(u).hp*.45&&u.defendUntil>g.time)){reserved.add(u.id);this.issue([u],goal,'safe');}
  return reserved;
 }
 private siege(members:Unit[],target:Point&{id:number}):boolean{
  const g=this.g,s=this.state,artillery=members.filter(u=>u.kind==='artillery'&&u.hp>0);if(!artillery.length)return false;
  if(g.world.mapVersion>=3&&this.mode==='director'&&s.knownTurrets.filter(t=>distance(t,target)<t.range+200).length>1)return this.standoffSiege(members,target,artillery);
  const anchor=s.rally??members[0],d=distance(anchor,target)||1,h={x:(anchor.x-target.x)/d,y:(anchor.y-target.y)/d},cover={x:target.x+h.x*(RULES.turret.range+30),y:target.y+h.y*(RULES.turret.range+30)};
  const at=g.world.nearest(cover,this.obstacles(),[],undefined,12);if(!at)return false;
  const interceptors=g.world.mapVersion>=3&&this.mode==='director'?this.screenThreats(members,target):new Set<number>();
  const screen=members.filter(u=>frontRole(u)&&!interceptors.has(u.id)),waiting=screen.filter(u=>distance(u,at)>55||u.orders[0]?.target!==undefined);
  const campaign=g.world.mapVersion>=3&&this.mode==='director';
  if(waiting.length){if(campaign)this.issue(waiting,at,'safe',undefined,false,false);else{this.issue(waiting,at,'assault');for(const u of waiting)if(u.orders[0])u.orders[0].kind='move';}}
  // A holding screen fires locally without pursuing through the artillery's
  // standoff line. Marching there remains an authoritative retreat/move.
  if(campaign)for(const u of screen)if(distance(u,at)<65){g.stop([u.id]);u.hold=true;}
  for(const u of artillery)this.issue([u],target,'assault',target.id);
  const medics=campaign?members.filter(u=>u.kind==='medic'):[];
  if(medics.length){this.issue(medics,at,'assault');for(const u of medics)if(u.orders[0]?.formation)u.orders[0].formation.front=screen.map(v=>v.id);}
  for(const u of members.filter(u=>unitSpec(u).flying))if(!u.orders.length||u.orders[0]?.target!==undefined)this.issue([u],s.rally??at,'safe');
  return true;
 }
 /** Explicit building attacks must not make the screen ignore a visible heavy
  * infantryman shooting the artillery. Only intercept from reachable range on
  * the safe side of known guns; emergency withdrawals retain ownership. */
 private screenThreats(members:Unit[],goal:Point):Set<number>{
  const g=this.g,s=this.state,support=members.filter(u=>u.kind==='artillery'||u.kind==='medic');
  const threats=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)&&support.some(v=>distance(u,v)<unitSpec(u).range+100))
   .sort((a,b)=>(unitSpec(b).damage/unitSpec(b).cooldown)-(unitSpec(a).damage/unitSpec(a).cooldown)||a.id-b.id);
  const assigned=new Set<number>(),target=threats[0];if(!target)return assigned;
  for(const u of members.filter(frontRole)){
   if(!canAttack(u,target)||s.battle?.withdrawals.some(w=>w.unit===u.id))continue;
   const d=distance(u,target)||1,range=unitSpec(u).range-15;
   const firing={x:target.x+(u.x-target.x)/d*range,y:target.y+(u.y-target.y)/d*range};
   if(s.knownTurrets.some(t=>distance(t,firing)<t.range+15)||!g.world.walkable(firing,this.obstacles(),10))continue;
   this.issue([u],target,'assault',target.id,false,false);assigned.add(u.id);
  }
  void goal;return assigned;
 }
 /** Check the entire observed battery, not only the selected gun. A firing
  * point is useful only if the real rocket range, LOS and ground route allow it. */
 private standoffSiege(members:Unit[],target:Point&{id:number},artillery:Unit[]):boolean{
  const g=this.g,s=this.state,origin=artillery[0],known=s.knownTurrets,obstacles=this.obstacles();
  // Preserve the stable 2.4 battery objective. The 2.5 improvement is
  // which angle to fire from, NOT switching to a different tower on every
  // three-second macro pulse. Only try another known gun if the first is
  // truly unreachable from any eligible standoff angle.
  const choices=[target,...known.filter(t=>t.id!==target.id&&distance(t,target)<900)]
   .sort((a,b)=>distance(origin,a)-distance(origin,b)||a.id-b.id);
  let selected:typeof target|undefined,at:Point|undefined;
  for(const gun of choices){
   const heading=Math.atan2(origin.y-gun.y,origin.x-gun.x),candidates:Point[]=[];
   for(const radius of [UNITS.artillery.range-15,UNITS.artillery.range-35])for(let i=0;i<24;i++){
    const angle=heading+i*Math.PI/12,p={x:gun.x+Math.cos(angle)*radius,y:gun.y+Math.sin(angle)*radius};
    if(p.x<30||p.y<30||p.x>g.world.size-30||p.y>g.world.size-30||known.some(t=>distance(t,p)<t.range+35))continue;
    if(g.world.walkable(p,obstacles,10)&&g.world.line(p,gun,obstacles.filter(o=>!('id' in o)||o.id!==gun.id),10))candidates.push(p);
   }
   candidates.sort((a,b)=>distance(origin,a)-distance(origin,b)||a.y-b.y||a.x-b.x);
   const shots:SiegeShot[]=[];
   for(const p of candidates.slice(0,this.doctrineMode==='intelligent'?8:3)){
    const route=this.route(origin,p);if(!route.length)continue;
    if(this.doctrineMode==='legacy'){selected=gun;at=p;break;}
    const path=this.sampleRoute(route,origin);
    shots.push({gunId:gun.id,at:p,travel:path.length,risk:path.risk,
      gunHp:'hp' in gun&&typeof gun.hp==='number'?gun.hp:1000,primary:true});
   }
   if(at)break;
   if(this.doctrineMode==='intelligent'&&shots.length){
    // A safer route must be a realistic detour, not a kilometer-long
    // wandering loop that delays an otherwise winnable HQ assault.
    const direct=Math.min(...shots.map(x=>x.travel));
    const best=chooseSiegeShot(shots.filter(x=>x.travel<=direct*1.35+120));
    if(best){selected=gun;at=best.at;this.diagnostics.siegeAngles++;break;}
   }
  }
  if(!at||!selected){this.issue(members,s.rally??origin,'safe');return true;}
  if(selected.id!==target.id&&s.commander?.mission){
   const m=s.commander.mission,seen=knownBuildings(g).find(t=>t.id===selected!.id);
   if(seen)Object.assign(m,{kind:'structure',sector:seen.territory,
     x:selected.x,y:selected.y,objective:selected.id,hp:seen.hp,
     progressAt:g.time,distance:distance(origin,selected)});
   s.objective=selected.id;
  }
  const d=distance(at,selected)||1,h={x:(at.x-selected.x)/d,y:(at.y-selected.y)/d};
  const cover=g.world.nearest({x:at.x+h.x*100,y:at.y+h.y*100},obstacles,[],undefined,12)??at;
  const interceptors=this.screenThreats(members,selected);
  for(const u of artillery){
   if(u.orders.some(o=>o.kind==='attack'&&o.target===selected!.id)&&u.orders.every(o=>o.kind!=='move'||known.every(t=>distance(t,o)>t.range+30)))continue;
   g.command([u.id],{...at,kind:'move'});g.command([u.id],{x:selected.x,y:selected.y,kind:'attack',target:selected.id},true);
   if(u.orders[0])u.orders[0].tactical={group:s.groupId,mode:'safe',goal:{...at}};
   if(u.orders[1])u.orders[1].tactical={group:s.groupId,mode:'assault'};
  }
  for(const u of members.filter(u=>u.kind!=='artillery'&&!interceptors.has(u.id))){
   if(distance(u,cover)>35)this.issue([u],cover,'safe',undefined,false,false);
   else if(u.orders.length)g.stop([u.id],true);
  }
  return true;
 }
 private airSupport(members:Unit[],goal:Point,targetId:number|null):void{
  const g=this.g,s=this.state,front=members.filter(frontRole),anchor=s.rally??members[0],d=distance(anchor,goal)||1,h={x:(goal.x-anchor.x)/d,y:(goal.y-anchor.y)/d};
  for(const [index,u] of members.filter(u=>u.kind==='bomber').entries()){
   const target=targetId===null?undefined:g.bases.find(b=>b.id===targetId&&b.hp>0&&g.canSee(1,b))??g.memories[1].find(b=>b.id===targetId&&b.hp>0)??g.units.find(v=>v.id===targetId&&v.hp>0&&!v.carrier&&g.canSee(1,v));
   if(u.kind==='bomber'&&!target){this.issue([u],anchor,'safe');continue;}
   if(u.orders.length>1)continue;
   if(u.orders[0]?.target===targetId&&target)continue;
   const flank={x:clamp(goal.x-h.y*(index%2?-340:340)-h.x*220,30,g.world.size-30),y:clamp(goal.y+h.x*(index%2?-340:340)-h.y*220,30,g.world.size-30)};
   g.command([u.id],{...flank,kind:'move'});g.command([u.id],{x:goal.x,y:goal.y,kind:target?'attack':'attackMove',target:target?.id},true);
   for(const o of u.orders){o.tactical={group:s.groupId,mode:'assault'};if(front.length&&(g.world.mapVersion<=2||this.mode==='baseline'))o.march=front.map(v=>v.id);}
  }
 }
 /** A cheap second axis of pressure: mobile reserves capture an unguarded adjacent
  * bastion while the main army fights. No unknown enemies are inspected. */
 private raid(fighters:Unit[]):void{
  const g=this.g,s=this.state;
  if(g.world.mapVersion<3||s.phase!=='attack'||fighters.length<10||s.target===null)return;
  const raiders=fighters.filter(u=>!s.group.includes(u.id)&&['rover','tank'].includes(u.kind)
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
 /** 2.5 second operational axis. A two-unit mobile detachment uses ONLY
  * public adjacent sector ownership and real observed threats. It never
  * borrows the main assault group, reserves, medics or siege guns. */
 private secondaryPressure(fighters:Unit[],main:{sector:number},home:Point):Set<number>{
  if(this.doctrineMode!=='intelligent'||this.mode!=='director'||this.planningMode!=='tactical'
    ||this.g.world.mapVersion<3)return new Set();
  const g=this.g,s=this.state,b=s.battle??=newBattle();
  const old=b.squads.find(q=>q.role==='raid');
  const candidates=fighters.filter(u=>!s.group.includes(u.id)&&['rover','infantry'].includes(u.kind)
    &&u.hp>=unitSpec(u).hp*.7&&!b.withdrawals.some(w=>w.unit===u.id));
  // A campaign under pressure keeps a viable primary front and one guard.
  if(!allowSecondaryPressure(fighters.length,fighters.length-2,
    fighters.length-s.group.filter(id=>!fighters.some(u=>u.id===id)).length-2,candidates.length)){
   b.squads=b.squads.filter(q=>q.role!=='raid');return new Set();
  }
  const scout=old?candidates.filter(u=>old.ids.includes(u.id)):candidates.slice()
   .sort((a,v)=>(a.kind==='rover'?0:1)-(v.kind==='rover'?0:1)||a.id-v.id);
  const party=scout.length>=2?scout.slice(0,2):candidates.slice()
   .sort((a,v)=>(a.kind==='rover'?0:1)-(v.kind==='rover'?0:1)||a.id-v.id).slice(0,2);
  if(party.length!==2)return new Set();
  const anchor={x:(party[0].x+party[1].x)/2,y:(party[0].y+party[1].y)/2};
  const frontier=g.territories.filter(t=>t.owner!==1&&t.id!==main.sector
    &&t.neighbors.some(id=>g.territories[id].owner===1));
  const fronts:RaidFront[]=[];
  for(const t of frontier){
   const threatened=s.knownTurrets.some(tower=>distance(tower,t.point)<tower.range+140)
    ||g.memories[1].some(m=>m.owner===0&&m.hp>0&&m.territory===t.id)
    ||g.units.some(enemy=>enemy.owner===0&&enemy.hp>0&&!enemy.carrier&&g.canSee(1,enemy)&&distance(enemy,t.point)<360);
   if(threatened)continue;
   const route=this.route(anchor,t.point);
   if(!route.length)continue;
   const path=this.sampleRoute(route,anchor);
   fronts.push({id:t.id,x:t.point.x,y:t.point.y,owner:t.owner,income:t.income,
     routeLength:path.length,routeRisk:path.risk,observedThreat:threatened});
  }
  // Keep a currently safe raid, rather than oscillating between equally good
  // frontier captures every three seconds. Stop holding stale IDs on capture.
  const continuing=old?.target!==null?fronts.find(t=>t.id===old?.target):undefined;
  const target=continuing??chooseRaidFront(fronts,main.sector);
  if(!target){b.squads=b.squads.filter(q=>q.role!=='raid');return new Set();}
  const changed=old?.target!==target.id||party.some(u=>!old?.ids.includes(u.id));
  b.squads=[...b.squads.filter(q=>q.role!=='raid'),
   {role:'raid' as const,ids:party.map(u=>u.id),target:target.id,since:changed?g.time:old!.since}];
  if(changed)this.diagnostics.secondaryRaids++;
  for(const u of party){
   const order=u.orders[0];
   if(changed||!order||order.kind!=='attackMove'||order.tactical?.mode!=='assault'
     ||distance(order,target)>100){
    if(this.issue([u],target,'assault',undefined,false,false))this.diagnostics.secondaryRaidOrders++;
   }
  }
  void home;
  return new Set(party.map(u=>u.id));
 }
 /** Strategic missions own the operational group. Capture orders, reconnaissance
  * and repair have separate rosters, so a macro pulse cannot erase their work. */
 private campaign(army:Unit[],fighters:Unit[],medics:Unit[],home:Point):void{
  const g=this.g,s=this.state,c=s.commander??=newCampaign();
  // Keep saved roster IDs limited to actual surviving members.
  s.group=s.group.filter(id=>army.some(u=>u.id===id));
  const centroid=(units:Unit[])=>units.length?units.reduce((p,u)=>({x:p.x+u.x/units.length,y:p.y+u.y/units.length}),{x:0,y:0}):home;
  const assigned=fighters.filter(u=>s.group.includes(u.id));
  const previous=c.mission,aborted=c.aborted,origin=centroid(assigned.length?assigned:fighters);
  const experience=s.experience??=newExperience();
  if(experience.active){const a=experience.active,won=g.territories[a.sector]?.owner===1;
   // Count an observed destroyed objective as victory, even before its sector falls.
   const objectiveGone=a.objective!=null&&a.target!==undefined&&g.canSee(1,a.target)
    &&!g.bases.some(b=>b.id===a.objective&&b.hp>0);
   if(won||objectiveGone||g.time-a.at>120)finishExperience(experience,!!(won||objectiveGone),fighters.reduce((n,u)=>n+u.hp,0));}
  const mission=chooseMission(g,c,origin,{strategy:s.adaptive?.strategy??'unknown',force:fighters,losses:s.losses,fronts:s.battle?.fronts??[],intelligent:this.doctrineMode==='intelligent',experience,route:p=>{const route=this.route(origin,p);return route.length?this.sampleRoute(route,origin):undefined;}});
  if(!mission){
   campaignPhase(c,'endgame',g.time);this.setPhase('regroup');s.group=[];s.objective=null;s.target=null;
   // Once the map is captured, ground patrols also search fog for survivors.
   for(const u of fighters.slice(0,2)){const goal=reconGoal(g,c,u,p=>this.danger(p));if(goal)this.issue([u],goal,'assault',undefined,false,false);}
   return;
  }
  const changed=previous!==mission;
  if(c.aborted>aborted){g.stop(s.group.filter(id=>fighters.some(u=>u.id===id)));s.group=[];this.setPhase('regroup');}
  if(changed){s.target=mission.sector;s.objective=mission.objective;s.route=[];s.rally=null;}
  const intel=mission.objective===null?undefined:knownBuildings(g).find(b=>b.id===mission.objective);
  const towers=s.knownTurrets.filter(t=>distance(t,mission)<t.range+200);
  const visible=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)&&distance(u,mission)<450);
  const defended=mission.kind!=='capture'||g.territories[mission.sector].owner===0||towers.length>0||visible.reduce((n,u)=>n+combatStrength(u),0)>3;
  if(!s.rally){
   const rear=g.territories.filter(t=>t.owner===1).sort((a,b)=>distance(a.point,mission)-distance(b.point,mission)||a.id-b.id)[0]?.point??home;
   s.rally=g.world.nearest({x:rear.x+(home.x-rear.x)*.08,y:rear.y+(home.y-rear.y)*.08},this.obstacles(),[],undefined,12)??rear;
   // Stand outside an observed gun's reach; never infer an unseen gun.
   if(towers.some(t=>distance(t,s.rally!)<t.range+50))s.rally=this.rally(fighters,home);
  }
  // Cleanup holds the paid army together rather than sending two fighters to
 // a secondary neutral bastion while enemy production is still standing.
 const raidUnits=c.enemyHQEliminatedAt===undefined?this.secondaryPressure(fighters,mission,home):new Set<number>();
  const mainFighters=fighters.filter(u=>!raidUnits.has(u.id));
  const reserve=c.enemyHQEliminatedAt!==undefined?0:mainFighters.length>=7?1:0;
  const guards=new Set(mainFighters.filter(u=>!s.group.includes(u.id)).sort((a,b)=>distance(a,home)-distance(b,home)||a.id-b.id).slice(0,reserve).map(u=>u.id));
  const selected=mainFighters.filter(u=>!guards.has(u.id)).sort((a,b)=>Number(s.group.includes(b.id))-Number(s.group.includes(a.id))||distance(a,s.rally!)-distance(b,s.rally!)||a.id-b.id).slice(0,18);
  let members=selected.filter(u=>s.group.includes(u.id));
  if(s.phase==='attack'&&members.length<Math.max(1,Math.ceil(s.launchSize*.4))){g.stop(s.group.filter(id=>fighters.some(u=>u.id===id)));s.group=[];members=[];s.launchSize=0;this.setPhase('regroup');c.aborted++;}
  const continuing=s.phase==='attack'&&members.length>0;
  const battle=s.battle??=newBattle(),readyForce=continuing?members:selected.filter(u=>distance(u,s.rally!)<330);
  const assessment=assessBattle(readyForce,visible,towers,g.time,continuing);battle.assessment=assessment;
  const overrun=canOverrun(assessment.own,assessment.enemy,readyForce.length,towers.length,experience)&&!readyForce.some(u=>u.kind==='artillery');
  if(!towers.length&&!retryFront(battle,mission.sector,assessment.own,0,readyForce.filter(u=>u.kind==='artillery').length,g.time)){
   campaignPhase(c,'buildup',g.time);this.issue([...selected,...medics],s.rally,'safe',undefined,false,false);return;
  }
  if(towers.length||visible.length){
   const artillery=readyForce.filter(u=>u.kind==='artillery').length;
   if(assessment.stance==='withdraw'&&!overrun){
    const at=this.withdrawPoint(centroid(members),home,towers);
    recordFailure(battle,mission.sector,mission,assessment.own,towers.length,g.time);battle.retreats++;
    for(const u of members){this.issue([u],at,'safe',undefined,false,false);battle.withdrawals=battle.withdrawals.filter(w=>w.unit!==u.id);battle.withdrawals.push({...at,unit:u.id,since:g.time,until:g.time+10});}
    this.setPhase('regroup');s.group=[];campaignPhase(c,'buildup',g.time);return;
   }
   const allowed=retryFront(battle,mission.sector,assessment.own,towers.length,artillery,g.time);
   if((assessment.stance==='reinforce'||!allowed)&&!overrun){
    campaignPhase(c,'buildup',g.time);if(!continuing)this.setPhase('gather');
    this.issue([...selected,...medics],s.rally,'safe');return;
   }
  }
  if(!continuing){
   const ready=selected.filter(u=>distance(u,s.rally!)<330),power=ready.reduce((n,u)=>n+combatStrength(u),0);
   const armed=ready.some(u=>u.kind==='artillery'||u.kind==='tank');
   const enough=towers.length?(overrun||assessment.stance==='attack'||assessment.stance==='siege'):defended?ready.length>=3&&power>=5&&(armed||!towers.length&&ready.length>=5):ready.length>=(g.time<40?1:2);
   const wave=this.waveMode==='coordinated'
     ?assaultWaveDecision({defended,selectedGround:selected.filter(u=>!unitSpec(u).flying).length,
        readyGround:ready.filter(u=>!unitSpec(u).flying).length,elapsed:g.time-s.phaseAt})
     :{ready:true,required:0,reason:'legacy'};
   if(enough&&!wave.ready)this.diagnostics.waveWaits++;
   if(!enough||!wave.ready){
    campaignPhase(c,g.time<40?'opening':defended?'buildup':'expansion',g.time);this.setPhase('gather');
    this.issue([...selected,...medics],s.rally,'safe');return;
   }
   if(this.waveMode==='coordinated'&&defended)this.diagnostics.waveLaunches++;
   if(!experience.active)experience.active={sector:mission.sector,tactic:overrun?'overrun':towers.length?'siege':'maneuver',guns:towers.length,force:ready.length,at:g.time,initialUnits:ready.length,initialHP:fighters.reduce((n,u)=>n+u.hp,0),progress:0,siegeWeapons:ready.filter(u=>u.kind==='artillery').length,objective:mission.objective,target:{x:mission.x,y:mission.y}};
   s.groupId++;s.group=ready.map(u=>u.id);s.launchSize=ready.length;s.launchedAt=g.time;members=ready;this.setPhase('attack');
  }
  const anchor=centroid(members),joining=selected.filter(u=>!s.group.includes(u.id));
  const staged=this.waveMode==='coordinated'
   ?reinforcementStagingPoint(anchor,mission,home):anchor;
  const rendezvous=this.waveMode==='coordinated'
   ?g.world.nearest(staged,this.obstacles(),[],undefined,12)??anchor:anchor;
  for(const u of joining){
   if(distance(u,anchor)<330){s.group.push(u.id);s.launchSize++;members.push(u);}
   else if(!u.orders.length||u.orders[0].tactical?.mode!=='assault'||distance(u.orders[0],rendezvous)>180){
    if(this.issue([u],rendezvous,'assault',undefined,false,false)&&this.waveMode==='coordinated')
      this.diagnostics.reinforcementStagingOrders++;
   }
  }
  const escorts=medics.filter(u=>distance(u,anchor)<360);
  for(const u of medics.filter(u=>!escorts.includes(u)))if(!u.orders.length||distance(u.orders[0],anchor)>160)this.issue([u],anchor,'safe',undefined,false,false);
  for(const u of escorts)if(!s.group.includes(u.id))s.group.push(u.id);
  const progress=Math.min(...members.map(u=>distance(u,mission)));
  if(progress<mission.distance-45){mission.distance=progress;mission.progressAt=g.time;}
  s.lastProgress=Math.max(0,progress);s.progressAt=mission.progressAt;
  campaignPhase(c,c.enemyHQEliminatedAt!==undefined||intel?.kind==='headquarters'?'endgame':intel?'siege':defended?'offensive':g.territories.filter(t=>t.owner===1).length<3?'expansion':'offensive',g.time);
  const group=[...members,...escorts];
  // Decide before legacy siege dispatch: the previous integration never got
  // here on turret objectives. Diagnosing that gate is as important as acting.
  const tacticalEnabled=g.world.mapVersion>=3&&this.mode==='director'&&this.planningMode==='tactical';
  const tactical:TacticalChoice|null=tacticalEnabled&&group.filter(combat).length>=3&&(visible.length>0||towers.length>0)
    ?chooseTacticalManeuver({allies:group,observedEnemies:visible,knownGuns:towers,storm:g.weather.storm,learned:{flank:lessonScore(experience,'flank',0,group.length),siege:lessonScore(experience,'siege',towers.length,group.length)}}):null;
  if(tactical){
    this.diagnostics.evaluated++;this.diagnostics.choices[tactical.mode]++;
    this.diagnostics.last={at:g.time,sector:mission.sector,allies:group.length,visible:visible.length,
      guns:towers.length,choice:tactical.mode,reason:tactical.reason};
  }
  const previousSquad=battle.squads.find(q=>q.role==='assault');
  battle.squads=[...battle.squads.filter(q=>q.role!=='assault'),{role:'assault',ids:group.map(u=>u.id),target:mission.objective,since:previousSquad?.target===mission.objective?previousSquad.since:g.time}];
  if(intel?.kind==='turret'&&this.siege(group,intel)){
    if(tactical)this.diagnostics.delegatedSieges++;
    return;
  }
  // A known battery can be a better immediate objective than rushing a
  // capture circle. Only previously observed towers enter this candidate set.
  if(tactical?.mode==='siege'&&towers.length>0&&members.some(u=>u.kind==='artillery')){
    const known=towers.slice().sort((a,b)=>distance(anchor,a)-distance(anchor,b)||a.id-b.id)[0];
    if(known&&this.siege(group,known)){this.diagnostics.issuedSieges++;return;}
  }
  // Never let the 4.1 cleanup roster size bypass the siege safety gate.
  // Seven ordinary infantry cannot substitute for a real artillery weapon.
  // Existing withdrawals, repairs and local-defense priorities remain active.
  if(intel?.kind==='turret'&&!overrun&&!members.some(u=>u.kind==='artillery')){
   campaignPhase(c,'buildup',g.time);this.issue(group,s.rally,'safe',undefined,false,false);return;
  }
  const ground=group.filter(u=>!unitSpec(u).flying);for(const u of ground)u.hold=false;
  const closeThreat=visible.filter(v=>members.some(u=>distance(u,v)<unitSpec(v).range+110)&&!['engineer','medic','scout'].includes(v.kind))
   .sort((a,b)=>{
     const danger=(enemy:Unit)=>unitSpec(enemy).damage/unitSpec(enemy).cooldown*
       (1+Math.min(2,group.filter(u=>['artillery','medic'].includes(u.kind)&&
         distance(u,enemy)<unitSpec(enemy).range+80).length)*.65);
     return danger(b)-danger(a)||a.hp-b.hp||a.id-b.id;
   })[0];
  // Stable waypoint queues keep a flank alive across three-second macro pulses.
  // Never redirect recovering units or units already ordered home by defense.
  const continuingFlank=tacticalEnabled?ground.filter(u=>isContinuingFlank(u.orders,s.groupId)):[];
  const activeFlankIds=new Set(continuingFlank.map(u=>u.id));
  const eligibleScreen=ground.filter(u=>!activeFlankIds.has(u.id));
  const screenIds=tacticalEnabled&&closeThreat?assignScreen(eligibleScreen,closeThreat):[];
  const screen=closeThreat?(tacticalEnabled
    ?eligibleScreen.filter(u=>screenIds.includes(u.id))
    :eligibleScreen.filter(u=>canAttack(u,closeThreat))):[];
  const screenSet=new Set(screen.map(u=>u.id));
  const mainUnits=ground.filter(u=>!screenSet.has(u.id)&&!activeFlankIds.has(u.id)
    &&(!tacticalEnabled||u.kind!=='medic'&&u.kind!=='engineer'));
  let newFlank:Unit[]=[];
  if(tactical?.mode==='flank'&&towers.length===0&&!continuingFlank.length){
    this.diagnostics.flankOpportunities++;
    const flankerIds=assignFlank(mainUnits,screenIds);
    if(flankerIds.length===2){
      const candidates=([-1,1] as const).map(side=>flankCandidate(anchor,mission,side))
        .filter(p=>p.x>40&&p.y>40&&p.x<g.world.size-40&&p.y<g.world.size-40
          &&g.world.walkable(p,this.obstacles(),15)&&this.danger(p)<3)
        .map(p=>({point:p,route:this.route(anchor,p)})).filter(c=>c.route.length>0)
        .sort((a,b)=>flankRouteScore(anchor,a.route,visible)-flankRouteScore(anchor,b.route,visible)
          ||a.point.x-b.point.x||a.point.y-b.point.y);
      const waypoint=candidates[0]?.point;
      if(waypoint){
        const assigned:Unit[]=[];
        for(const u of mainUnits.filter(u=>flankerIds.includes(u.id))){
          // The old safe/move leg prohibited return fire and exposed isolated
          // flankers to helpless losses. Fight on the way to the waypoint.
          const moved=this.issue([u],waypoint,'assault',undefined,false,false);
          const attacked=moved&&this.issue([u],mission,'assault',undefined,true,false);
          if(attacked){assigned.push(u);this.diagnostics.flankOrders++;}
          else if(moved)this.issue([u],mission,'assault',undefined,false,false);
        }
        newFlank=assigned;
        if(assigned.length===2){
          this.diagnostics.flankGroups++;
          if(experience.active?.sector===mission.sector&&experience.active.guns===0)experience.active.tactic='flank';
         }
        else this.diagnostics.flankNoRoute++;
      }else this.diagnostics.flankNoRoute++;
    }else this.diagnostics.flankNoSquad++;
  }
  if(closeThreat&&screen.length&&this.issue(screen,closeThreat,'assault',closeThreat.id)){
    if(tacticalEnabled)this.diagnostics.screenOrders+=screen.length;
  }
  const flanking=new Set([...newFlank,...continuingFlank].map(u=>u.id));
  const main=mainUnits.filter(u=>!flanking.has(u.id));
  if(this.issue(main,mission,'assault',mission.objective??undefined)&&tacticalEnabled)
    this.diagnostics.mainOrders+=main.length;
  // Escort medics keep the simulation's protected rear formation, rather
  // than receiving a direct attack against a visible close-range defender.
  if(tacticalEnabled)for(const medic of escorts)if(!medic.orders.length)
    this.issue([medic],s.rally??anchor,'safe',undefined,false,false);
  this.airSupport(members,closeThreat??mission,closeThreat?.id??mission.objective);
  // Aircraft that have finished their flank route can keep the same mission.
  for(const u of members.filter(u=>unitSpec(u).flying&&!u.orders.length))this.issue([u],mission,'assault',mission.objective??undefined);
 }
 plan():void{
  if(!profiler)return this.planMeasured();const at=performance.now();try{this.planMeasured();}finally{profiler.record('ai',performance.now()-at);}
 }
 /** Opening uses ordinary paid construction and reachable worker orders. */
 private bootstrapHeadquarters():void{
  const g=this.g,workers=g.units.filter(u=>u.owner===1&&u.kind==='engineer'&&u.hp>0&&!u.carrier);
  if(!workers.length)return;
  const site=g.bases.find(b=>b.owner===1&&b.kind==='headquarters'&&b.hp>0);
  if(site){
   for(const w of workers)if(w.orders[0]?.kind!=='build'||w.orders[0]?.target!==site.id)
    g.command([w.id],{...site,kind:'build',target:site.id});
   return;
  }
  for(const p of g.headquartersCandidates(1))if(!g.buildError(1,'headquarters',p)&&g.build(1,'headquarters',p,workers.map(w=>w.id)))return;
  // The start anchor remains a sensible deterministic AI preference, not a build restriction.
  // Explore fallback positions when terrain or a unit blocks local candidates.
  for(const p of g.headquartersCandidates(1))if(g.world.walkable(p,g.obstacles(),12)&&!g.hasExplored(1,p)){
   const w=workers[0];if(!w.orders.length&&g.world.path(w,p,g.obstacles(),12).length)g.command([w.id],{...p,kind:'move'});
   if(w.orders.length)return;
  }
 }
 private planMeasured():void{
  if(this.g.needsHeadquarters(1)){this.bootstrapHeadquarters();return;}
  const g=this.g,s=this.state;this.observe();s.lastPlan=g.time;s.losses=s.losses.filter(l=>g.time-l.at<90);s.attempts=s.attempts.filter(a=>a.until>g.time||a.losses>0).slice(-30);const signature=JSON.stringify([s.knownTurrets.map(t=>[t.id,t.x,t.y,Math.floor((g.time-t.seenAt)/30)]),s.losses.map(l=>[l.id,Math.floor((g.time-l.at)/15)]),g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)).map(u=>[u.id,u.kind,u.x,u.y,u.hp]),this.obstacles().map(o=>[o.x,o.y,o.radius])]);
  if(signature!==this.routeSignature||this.routeCache.size>128){this.routeCache.clear();this.routeSignature=signature;}this.field();
  const army=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier),home=g.bases.filter(b=>b.owner===1&&b.hp>0).sort((a,b)=>(a.kind==='headquarters'?0:1)-(b.kind==='headquarters'?0:1)||a.id-b.id)[0]??g.territories.find(t=>t.owner===1)?.point??army[0];
  if(!home)return;
  if(g.world.mapVersion>=3&&this.mode==='director')observeOwnedLosses(s.experience??=newExperience(),g.territories.filter(t=>t.owner===1).map(t=>t.id),army.filter(combat).length);
  if(g.world.mapVersion>=3&&this.mode==='director')updateAdaptive(g,s.adaptive??=newAdaptive(),home,s.losses,s.battle);
  const recovering=this.recovery(army,home);if(g.world.mapVersion>=3&&this.mode==='director')for(const id of this.withdrawals(army))recovering.add(id);
  this.airlift(army,home);const explorers=this.recon(army.filter(u=>!recovering.has(u.id)),home),boarding=new Set([...army.filter(u=>u.orders[0]?.kind==='board').map(u=>u.id),...(s.airlift?.phase==='pickup'?s.airlift.passengers??[]:[])]),fighters=army.filter(u=>combat(u)&&!recovering.has(u.id)&&!explorers.has(u.id)&&!boarding.has(u.id)),medics=army.filter(u=>u.kind==='medic'&&!recovering.has(u.id)&&!boarding.has(u.id)).slice(0,2);
  developArmy(g,s,army,p=>this.danger(p));
  for(const w of army.filter(u=>u.kind==='engineer'&&!u.orders.length)){const b=g.bases.filter(b=>b.owner===1&&b.hp>0&&b.hp<buildingSpec(b).hp&&b.buildRemaining<=0).sort((a,b)=>distance(w,a)-distance(w,b))[0];if(b)g.command([w.id],{...b,kind:'repair',target:b.id});}
  const intruders=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)&&g.bases.some(b=>b.owner===1&&b.hp>0&&distance(u,b)<(b.kind==='headquarters'?560:420)));
  if(g.world.mapVersion>=3&&this.mode==='director'){
   const defense=this.localDefense(fighters,medics,intruders,home);
   const raiders=this.expansionRaid(fighters.filter(u=>!defense.has(u.id)),home);
   this.campaign(army,fighters.filter(u=>!defense.has(u.id)&&!raiders.has(u.id)),medics.filter(u=>!defense.has(u.id)),home);
   if(defense.size)campaignPhase(s.commander??=newCampaign(),'emergencyDefense',g.time);
   return;
  }
  if(intruders.length){
   // Anti-siege defence: a rocket launcher or aircraft threatening the HQ is
   // more urgent than a slightly closer infantryman. Never use unseen threats.
   const urgency=(u:Unit)=>distance(u,home)-(u.kind==='artillery'?260:u.kind==='bomber'?220:0);
   if(g.world.mapVersion>=3&&this.mode==='director')campaignPhase(s.commander??=newCampaign(),'emergencyDefense',g.time);
   const entering=s.phase!=='defend';this.setPhase('defend');const nearest=intruders.sort((a,b)=>urgency(a)-urgency(b)||a.id-b.id)[0];
   if(entering||s.objective!==nearest.id)s.groupId++;s.group=fighters.map(u=>u.id);s.objective=nearest.id;this.issue([...fighters,...medics],nearest,'defend',nearest.id);return;
  }
  if(s.phase==='defend'){g.stop(s.group.filter(id=>!recovering.has(id)));this.setPhase('regroup');s.group=[];s.objective=null;s.rally=null;}
  if(s.phase==='attack'){this.raid(fighters);this.reinforce(fighters,home);}
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
   const tooWeak=g.world.mapVersion>=3&&this.mode==='director'
    ? abortAssault({launchSize:s.launchSize,survivors:survivors.length,recentLosses:recentLosses.length,
       stalledSeconds:g.time-s.progressAt,knownUncoveredTurret:safeBroken&&s.knownTurrets.length>0,
       hasSiegeWeapon:survivors.some(u=>u.kind==='artillery'),destinationStillContested:!!target&&target.owner!==1})!==null
    :!target||target.owner===1||survivors.length===0||recentLosses.length>=2||
       survivors.length<s.launchSize*.6||g.time-s.progressAt>(g.world.mapVersion>=3?85:38)||safeBroken;
   if(tooWeak){
    g.stop(members.map(u=>u.id));this.setPhase('regroup');s.group=[];s.objective=null;s.rally=null;
   }else{
    // A revealed tower along a previously safe approach triggers reevaluation before further marching.
    const next=members.find(u=>u.orders[0]?.tactical?.mode==='safe')?.orders[0];
    if(next&&s.knownTurrets.some(t=>distance(t,next)<t.range+65)){g.stop(members.map(u=>u.id));this.setPhase('regroup');s.group=[];s.rally=null;}
    else if(objective?.kind==='turret'&&this.siege(members,objective))return;
    else if(target&&members.some(u=>!u.orders.length)){this.issue(members,target.point,g.world.mapVersion>=3&&this.mode==='director'?'assault':s.knownTurrets.some(t=>distance(t,target.point)<t.range+80)?'assault':'safe',objective?.id);return;}
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
  const ready=selected.filter(u=>distance(u,s.rally!)<(g.world.mapVersion>=3?260:200)),need=defended?(ready.some(u=>u.kind==='artillery')&&c.towers.length?4:6):g.time-s.phaseAt>=18?3:4,power=ready.reduce((n,u)=>n+combatStrength(u),0);
  const scoutAllowed=!defended&&!cluster&&fighters.length<4&&(g.time<40||g.time-s.phaseAt>35);
  const enough=g.world.mapVersion>=3&&this.mode==='director'
   ?assaultDecision({defended,observedTowers:c.towers.length,hasArtillery:ready.some(u=>u.kind==='artillery'),
     visibleDefenderStrength:c.defenders,readyUnits:ready.length,readyStrength:power,
     phaseSeconds:g.time-s.phaseAt,inRegroup:s.phase==='regroup',
     clusteredRecentLosses:cluster,scoutingOpening:scoutAllowed}).launch
   :!(s.phase==='regroup'&&g.time-s.phaseAt<9)&&((ready.length>=need&&power>=(defended?Math.max(6,c.towers.length*4.5+c.defenders*.8):3))||(scoutAllowed&&ready.length>0));
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
  const frontline=g.world.mapVersion>=3?ready.slice().sort((a,b)=>(b.kind==='tank'?5:b.kind==='artillery'?4:b.kind==='heavy'?3:1)-(a.kind==='tank'?5:a.kind==='artillery'?4:a.kind==='heavy'?3:1)||a.id-b.id):ready;
  const group=[...frontline.slice(0,defended?10:6),...medics.filter(u=>distance(u,s.rally!)<240)];s.group=group.map(u=>u.id);s.groupId++;s.launchSize=group.filter(combat).length;s.launchedAt=g.time;s.lastProgress=distance(s.rally,c.t.point);s.progressAt=g.time;this.setPhase('attack');
  const obstacle=defended?c.towers.slice().sort((a,b)=>distance(s.rally!,a)-distance(s.rally!,b))[0]??c.knownHQ??c.knownIndustry:undefined;
  s.objective=obstacle?.id??null;
  if(obstacle){this.issue(group,obstacle,'assault',obstacle.id);if(c.towers.some(t=>t.id===obstacle.id)&&this.siege(group,obstacle))return;this.airSupport(group,obstacle,obstacle.id);}
  else {this.issue(group,c.t.point,g.world.mapVersion>=3&&this.mode==='director'?'assault':'safe');this.airSupport(group,c.t.point,null);}
 }
 static valid(raw:unknown,time:number,point:(p:Point)=>boolean,sectors:number):raw is TacticalState{
  if(raw===undefined)return true;const s=raw as TacticalState,finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v),ids=(v:unknown)=>Array.isArray(v)&&v.length<=96&&v.every(Number.isInteger);
  if(!validCampaign(s?.commander,time,point,sectors))return false;
  if(!validBattle(s?.battle,time,point,sectors))return false;
  if(!validAdaptive(s?.adaptive,time))return false;
  if(!validExperience(s?.experience,time,sectors,point))return false;
  return !!s&&(s.airliftAt===undefined||(finite(s.airliftAt)&&s.airliftAt>=0&&s.airliftAt<=time+.001))&&(s.airlift===undefined||(!!s.airlift&&(s.airlift.passengers===undefined||(ids(s.airlift.passengers)&&s.airlift.passengers.length<=5))&&Number.isInteger(s.airlift.heli)&&s.airlift.heli>=0&&point(s.airlift.target)&&['pickup','delivery'].includes(s.airlift.phase)&&finite(s.airlift.since)&&s.airlift.since>=0&&s.airlift.since<=time+.001))&&(s.recovering===undefined||ids(s.recovering))&&validEconomy(s.economy,time)&&s.version===1&&['gather','attack','regroup','defend'].includes(s.phase)&&[s.phaseAt,s.launchedAt,s.progressAt].every(v=>finite(v)&&v>=0&&v<=time+.001)&&finite(s.lastPlan)&&s.lastPlan>=-3&&s.lastPlan<=time+.001&&finite(s.lastProgress)&&s.lastProgress>=0&&[s.groupId,s.launchSize,s.productionSerial].every(v=>Number.isInteger(v)&&v>=0)&&ids(s.group)&&(s.savingSince===null||(finite(s.savingSince)&&s.savingSince>=0&&s.savingSince<=time+.001))&&(s.savingFor===null||Object.hasOwn(UNITS,s.savingFor))&&(s.target===null||(Number.isInteger(s.target)&&s.target>=0&&s.target<sectors))&&(s.objective===null||Number.isInteger(s.objective))&&(s.rally===null||point(s.rally))&&Array.isArray(s.route)&&s.route.length<=64&&s.route.every(point)&&Array.isArray(s.knownTurrets)&&s.knownTurrets.length<=64&&s.knownTurrets.every(t=>point(t)&&Number.isInteger(t.id)&&finite(t.hp)&&t.hp>0&&finite(t.range)&&t.range===RULES.turret.range&&finite(t.seenAt)&&t.seenAt>=0&&t.seenAt<=time+.001)&&Array.isArray(s.losses)&&s.losses.length<=96&&s.losses.every(l=>point(l)&&Number.isInteger(l.id)&&finite(l.at)&&l.at>=0&&l.at<=time+.001&&finite(l.strength)&&l.strength>=0)&&Array.isArray(s.attempts)&&s.attempts.length<=sectors&&s.attempts.every(a=>Number.isInteger(a.sector)&&a.sector>=0&&a.sector<sectors&&Number.isInteger(a.losses)&&a.losses>=0&&finite(a.until)&&a.until>=0);
 }
}
