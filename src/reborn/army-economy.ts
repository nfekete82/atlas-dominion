import {UNITS,BUILDINGS,unitSpec,canAttack,type UnitKind,type BuildingKind} from './catalog.js';
import {distance,type Point} from './config.js';
import {preferredRole} from './ai-director.js';
import type {Simulation,Unit,Base} from './simulation.js';
import type {TacticalState} from './tactical-ai.js';
export interface EconomyState {goal:BuildingKind|null;since:number;attemptAt:number;produced:Partial<Record<UnitKind,number>>;built:Partial<Record<BuildingKind,number>>}
const fighter=(u:Unit)=>!u.carrier&&!['medic','engineer','scout'].includes(u.kind);
/** A production/building policy inside the existing tactical controller, using only paid game APIs. */
export function developArmy(g:Simulation,s:TacticalState,army:Unit[],dangerAt:(p:Point)=>number):void{
 const e=s.economy??={goal:null,since:g.time,attemptAt:-9,produced:{},built:{}},own=g.bases.filter(b=>b.owner===1&&b.hp>0),home=own.find(b=>b.kind==='headquarters')??own[0];if(!home)return;
 const fighters=army.filter(fighter),workers=army.filter(u=>u.kind==='engineer'&&!u.carrier),seen=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)),income=g.income(1);
 const underAttack=seen.some(u=>own.some(b=>distance(b,u)<480)),known=s.knownTurrets.length;
 const count=(kind:UnitKind)=>army.filter(u=>u.kind===kind).length+own.reduce((n,b)=>n+b.queueTypes.filter(k=>k===kind).length,0);
 const has=(kind:BuildingKind)=>own.some(b=>b.kind===kind),complete=(kind:BuildingKind)=>own.some(b=>b.kind===kind&&b.buildRemaining<=0);
 const unfinished=own.find(b=>b.buildRemaining>0);
 for(const w of workers)if(!w.orders.length&&w.defendUntil<=g.time){
  const target=unfinished??own.filter(b=>b.buildRemaining<=0&&b.hp<BUILDINGS[b.kind].hp).sort((a,b)=>distance(w,a)-distance(w,b))[0];
  if(target)g.command([w.id],{...target,kind:target.buildRemaining>0?'build':'repair',target:target.id});
 }
 let goal:BuildingKind|null=null;
 if(!unfinished&&workers.length&&(!underAttack||!has('barracks'))){
  if(!has('barracks'))goal='barracks';
  else if(!has('factory')&&fighters.length>=3&&(income>=20||known>0||g.time>=55))goal='factory';
  else if(!has('airfield')&&has('factory')&&fighters.length>=4&&(income>=35||g.time>=110||seen.some(u=>unitSpec(u).flying))&&(g.world.mapVersion<3||g.tactical.mode==='baseline'||(complete('factory')&&count('tank')+count('rover')+count('artillery')>=3&&income>=55)))goal='airfield';
  else if(!has('barracks')&&fighters.length>=3)goal='barracks';
 }
 if(e.goal!==goal){e.goal=goal;e.since=g.time;}
 if(goal&&g.credits[1]>=BUILDINGS[goal].cost&&g.time-e.attemptAt>=9){
  e.attemptAt=g.time;
   // Don't cancel a field engineer's emergency vehicle repair with a fresh
   // factory/airfield construction order. A second idle worker may build.
   const worker=workers.find(w=>w.defendUntil<=g.time&&!w.orders.some(o=>o.kind==='build'||
    (g.world.mapVersion>=3&&g.tactical.mode==='director'&&o.kind==='repair'&&
     army.some(v=>v.id===o.target&&s.recovering?.includes(v.id)))));
  if(worker){
   const candidates:Point[]=[];for(const center of [home,...g.territories.filter(t=>t.owner===1).map(t=>t.point)])for(const radius of [180,250,330,410])for(let i=0;i<16;i++){
    const p={x:center.x+Math.cos(i*Math.PI/8)*radius,y:center.y+Math.sin(i*Math.PI/8)*radius};if(dangerAt(p)<2&&!g.buildError(1,goal,p))candidates.push(p);
   }
   candidates.sort((a,b)=>distance(a,home)+distance(a,worker)*.2-(distance(b,home)+distance(b,worker)*.2));
   for(const p of candidates.slice(0,8)){const b=g.build(1,goal,p,[worker.id]);if(b){e.built[goal]=(e.built[goal]??0)+1;e.goal=null;break;}}
  }
 }
 // Never reserve the airfield budget ahead of a working vehicle factory.
 // Early-game macro first pays for at least two actual ground vehicles.
 const reserve=e.goal&&(e.goal==='barracks'||!underAttack&&fighters.length>=3)&&g.time-e.since<85?BUILDINGS[e.goal].cost:0;
 const maxArmy=Math.min(30,Math.max(14,Math.floor(income/4)+8));if(g.count(1)+g.queued(1)>=maxArmy)return;
 const wounded=army.filter(u=>!u.carrier&&unitSpec(u).group==='Infanterie'&&u.kind!=='engineer'&&u.hp<unitSpec(u).hp*.7).length;
 const armor=seen.filter(u=>!unitSpec(u).flying&&unitSpec(u).group==='Fahrzeuge').length,air=seen.filter(u=>unitSpec(u).flying).length;
 const military=g.memories[1].filter(b=>b.owner===0&&b.hp>0&&['headquarters','factory','airfield','turret'].includes(b.kind??''));
 const scores:Record<UnitKind,number>={
  infantry:Math.max(1,22-count('infantry')*5)+(fighters.length<4?18:0),
  heavy:14+(known?20+known*10:0)+armor*5+(fighters.length>=3?9:0)-count('heavy')*11,
  medic:(wounded>=2?30:Math.max(0,fighters.length-2)*4)-count('medic')*20,
  engineer:count('engineer')===0?(!complete('barracks')?80:fighters.length>=2?38:0):own.length>=4&&count('engineer')<2?15:0,
  rover:complete('factory')?35+(g.explored[1].reduce((n,v)=>n+v,0)/g.explored[1].length<.4?6:0)-count('rover')*17:0,
  tank:complete('factory')?44+known*4+armor*6-count('tank')*16:0,
  artillery:complete('factory')&&(known||fighters.length>=5)?32+known*14-count('artillery')*32:0,
  scout:complete('airfield')&&fighters.length>=4?25-count('scout')*35:0,
  gunship:complete('airfield')?38+air*10+armor*3-count('gunship')*19:0,
  bomber:complete('airfield')&&(count('scout')+count('gunship')>0)&&income>=65&&fighters.length>=6&&military.length?22+military.filter(b=>b.kind==='factory'||b.kind==='airfield').length*3-count('bomber')*25:0,
 };
 if(underAttack&&fighters.length<4){scores.infantry+=20;scores.heavy+=15;}
 if(air){scores.artillery=0;scores.bomber=0;}
 // Macro manager: all completed producers can run independently. In the old
 // algorithm just ONE facility queued an item per AI pulse, leaving expensive
 // factories/airfields idle while barracks bought cheap infantry.
 if(g.world.mapVersion>=3&&g.tactical.mode==='director'){
  const priority:Record<string,number>={factory:0,airfield:1,barracks:2,headquarters:3};
  const ordered=[...own].filter(b=>b.buildRemaining<=0&&b.queue.length<2)
   .sort((a,b)=>(priority[a.kind]??4)-(priority[b.kind]??4)||a.id-b.id);
  for(const producer of ordered){
   if(g.count(1)+g.queued(1)>=maxArmy||g.credits[1]<=reserve)break;
   const counts=Object.fromEntries((Object.keys(UNITS) as UnitKind[]).map(k=>[k,count(k)])) as Record<string,number>;
   const ranks=preferredRole(producer.kind,counts,known,air);
   // Save enough for the first tank instead of buying infantry forever.
   const savingFirstTank=complete('factory')&&count('tank')===0&&count('rover')===0&&count('artillery')===0
    &&!underAttack&&g.credits[1]-reserve<UNITS.tank.cost;
   if(producer.kind==='barracks'&&savingFirstTank)continue;
   const kind=ranks.find(k=>Object.hasOwn(UNITS,k)&&UNITS[k as UnitKind].producers.includes(producer.kind)
    &&scores[k as UnitKind]>0&&(!air||canAttack({kind:k as UnitKind},seen.find(u=>unitSpec(u).flying)!)||['medic','engineer','scout'].includes(k))
    &&UNITS[k as UnitKind].cost<=g.credits[1]-reserve) as UnitKind|undefined;
   if(!kind)continue;
   if(g.recruit(producer.id,kind)){
    e.produced[kind]=(e.produced[kind]??0)+1;
    s.productionSerial++;s.savingFor=null;s.savingSince=null;
   }
  }
  return;
 }
 const choices=(Object.keys(scores) as UnitKind[]).filter(k=>scores[k]>0&&own.some(b=>b.buildRemaining<=0&&b.queue.length<2&&UNITS[k].producers.includes(b.kind))&&(!air||canAttack({kind:k},seen.find(u=>unitSpec(u).flying)!)||['medic','engineer','scout'].includes(k))).sort((a,b)=>scores[b]-scores[a]||Object.keys(scores).indexOf(a)-Object.keys(scores).indexOf(b));
 const budget=Math.max(0,g.credits[1]-reserve);let kind=choices[0];if(!kind)return;
 if(UNITS[kind].cost>budget){
  if(s.savingFor!==kind){s.savingFor=kind;s.savingSince=g.time;}
  const wait=clampWait(UNITS[kind].cost-budget,income,fighters.length>=4);
  if(income>0&&budget>=75&&g.time-(s.savingSince??g.time)<wait)return;
  kind=choices.find(k=>UNITS[k].cost<=budget)!;if(!kind)return;
 }
 const producers=own.filter(b=>b.buildRemaining<=0&&b.queue.length<2&&UNITS[kind].producers.includes(b.kind)).sort((a,b)=>(a.kind==='headquarters'?1:0)-(b.kind==='headquarters'?1:0)||a.queue.length-b.queue.length||a.id-b.id);
 const producer=producers[0];if(producer&&g.recruit(producer.id,kind)){e.produced[kind]=(e.produced[kind]??0)+1;s.productionSerial++;s.savingFor=null;s.savingSince=null;}
}
const clampWait=(missing:number,income:number,secure:boolean)=>Math.min(secure?100:15,Math.max(6,missing/Math.max(1,income)*10+3));
export function validEconomy(e:EconomyState|undefined,time:number):boolean{
 if(e===undefined)return true;return !!e&&(e.goal===null||Object.hasOwn(BUILDINGS,e.goal))&&Number.isFinite(e.since)&&e.since>=0&&e.since<=time+.001&&Number.isFinite(e.attemptAt)&&e.attemptAt>=-9&&e.attemptAt<=time+.001&&!!e.produced&&!!e.built&&Object.entries(e.produced).every(([k,v])=>Object.hasOwn(UNITS,k)&&Number.isSafeInteger(v)&&v>=0)&&Object.entries(e.built).every(([k,v])=>Object.hasOwn(BUILDINGS,k)&&Number.isSafeInteger(v)&&v>=0);
}
