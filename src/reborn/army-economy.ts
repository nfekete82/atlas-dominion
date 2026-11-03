import {UNITS,BUILDINGS,MAX_GENERATORS_PER_FACTION,unitSpec,canAttack,type UnitKind,type BuildingKind} from './catalog.js';
import {distance,type Point} from './config.js';
import {produceCombinedArmy} from './director-production.js';
import {buildBastionDefense,defensiveTowerLimit,rankBastionDefenses} from './bastion-defense.js';
import {aiBuildSiteScore} from './construction-spacing.js';
import {defenseLessonsLost} from './battle-learning.js';
import type {Simulation,Unit,Base} from './simulation.js';
import type {TacticalState} from './tactical-ai.js';
export type ProductionReason='produced'|'saving-unit'|'saving-building'|'insufficient-credits'|'queue-blocked'|'army-cap'|'composition-complete'|'no-producer';
export interface ProductionDecision {reason:ProductionReason;goal:UnitKind|BuildingKind|null;missing:number}
export interface EconomyState {goal:BuildingKind|null;since:number;attemptAt:number;produced:Partial<Record<UnitKind,number>>;built:Partial<Record<BuildingKind,number>>;towerAttemptAt?:number;production? :ProductionDecision&{at:number;facilities:Record<number,ProductionDecision>}}
const fighter=(u:Unit)=>!u.carrier&&!['medic','engineer','scout'].includes(u.kind);
/** Only already observed enemy infrastructure, an operational factory and a
 * missing paid siege weapon may defer optional airfield construction. */
export function deferOptionalAirfieldForSiege(goal:BuildingKind|null,observedSiege:boolean,
 factoryReady:boolean,artilleryCount:number,underAttack:boolean):boolean{
 return goal==='airfield'&&observedSiege&&factoryReady&&artilleryCount===0&&!underAttack;
}
/** Stage passive-income construction around an actual field army. The first
 * core is an opening investment; later cores must not delay a barracks,
 * leave an undefended front, or eat the cash needed for replacement troops.
 * No enemy information or invisible economy is required. */
export function generatorBuildPriority(input:{
 existing:number;fighters:number;credits:number;
 barracksReady:boolean;underAttack:boolean;finishing:boolean
}):boolean{
 const {existing,fighters,credits,barracksReady,underAttack,finishing}=input;
 if(finishing||underAttack||existing>=MAX_GENERATORS_PER_FACTION)return false;
 // Keep saving for the first core even if fewer than 150 credits remain.
 if(existing===0)return true;
 if(!barracksReady)return false;
 const minimumFighters=existing===1?3:5;
 const reserveAfterBuild=existing===1?200:300;
 return fighters>=minimumFighters&&credits>=BUILDINGS.generator.cost+reserveAfterBuild;
}
/** Opt-in spending gate: only *deployed*, paid fighters protect a frontier.
 * The static screen is retained for A/B comparison. Adaptive screen instead
 * reacts only to units we actually see and to public territorial ownership;
 * neither opponent scripts nor hidden units feed this policy. */
export function deferOpeningInvestment(input:{
 mapVersion:number;mode:string;time:number;fighters:number;barracksReady:boolean;
 visibleAttackers?:number;visibleArmor?:number;enemySectorLead?:number;
}):boolean{
 if(input.mapVersion!==11||input.time>=90||!input.barracksReady||input.fighters>=4)return false;
 if(input.mode==='barracks-screen')return true;
 if(input.mode!=='adaptive-screen')return false;
 // Do not cripple economy against passive/armored opponents without evidence.
 // Territory leadership is public, not guessed from fog-hidden enemy troops.
 return (input.visibleAttackers??0)>=2||(input.visibleArmor??0)>=1
  ||(input.enemySectorLead??0)>0;
}
/** Temporary, derived siege budget: never add virtual credits or remember an
 * unknown enemy. The first paid rocket is protected while our first factory
 * is being built; observed threats and a destroyed factory cancel protection. */
export function firstSiegeRocketReserve(input:{
 director:boolean;factoryPresent:boolean;observedSiege:boolean;
 underAttack:boolean;urgentDefense:boolean;visibleAir:boolean;
 visibleArmorThreat:boolean;fighters:number;artillery:number;
}):number{
 return input.director&&input.factoryPresent&&input.observedSiege&&
  !input.underAttack&&!input.urgentDefense&&!input.visibleAir&&
  !input.visibleArmorThreat&&input.fighters>=3&&input.artillery===0
  ? UNITS.artillery.cost : 0;
}
/** A production/building policy inside the existing tactical controller, using only paid game APIs. */
export function developArmy(g:Simulation,s:TacticalState,army:Unit[],dangerAt:(p:Point)=>number):void{
 const e:EconomyState=s.economy??{goal:null,since:g.time,attemptAt:-9,produced:{},built:{}},own=g.bases.filter(b=>b.owner===1&&b.hp>0),home=own.find(b=>b.kind==='headquarters')??own[0];if(!home)return;
 const fighters=army.filter(fighter),workers=army.filter(u=>u.kind==='engineer'&&!u.carrier),seen=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)),income=g.income(1);
 const underAttack=seen.some(u=>own.some(b=>distance(b,u)<480)),known=s.knownTurrets.length;
 const director=g.world.mapVersion>=3&&g.tactical.mode==='director';
 const finishing=director&&s.commander?.enemyHQEliminatedAt!==undefined;
 if(director&&!s.economy)s.economy=e; // Keep paid turret cooldowns across macro ticks and save/reload.
 const count=(kind:UnitKind)=>army.filter(u=>u.kind===kind).length+own.reduce((n,b)=>n+b.queueTypes.filter(k=>k===kind).length,0);
 const has=(kind:BuildingKind)=>own.some(b=>b.kind===kind),complete=(kind:BuildingKind)=>own.some(b=>b.kind===kind&&b.buildRemaining<=0);
 const unfinished=own.find(b=>b.buildRemaining>0);
 const learnedDefense=director&&s.experience?defenseLessonsLost(s.experience)>0:false;
 const defenseFronts=director?rankBastionDefenses(g):[];
 const urgentDefense=defenseFronts.some(c=>c.urgent);
 const generators=own.filter(b=>b.kind==='generator').length;
 const observedSiege=known>0||g.memories[1].some(m=>m.owner===0&&m.hp>0&&m.kind==='headquarters');
 // Compute the reserve BEFORE optional construction can spend it.
 // The first generator is a core investment; later cores are optional.
 const siegeReserve=firstSiegeRocketReserve({
  director,factoryPresent:has('factory'),observedSiege,underAttack,urgentDefense,
  visibleAir:seen.some(u=>unitSpec(u).flying),
  visibleArmorThreat:seen.filter(u=>unitSpec(u).group==='Fahrzeuge'&&!unitSpec(u).flying).length>=2,
  fighters:fighters.length,artillery:count('artillery')
 });
 for(const w of workers)if(!w.orders.length&&w.defendUntil<=g.time){
  const target=unfinished??own.filter(b=>b.buildRemaining<=0&&b.hp<BUILDINGS[b.kind].hp-.01).sort((a,b)=>distance(w,a)-distance(w,b))[0];
  if(target)g.command([w.id],{...target,kind:target.buildRemaining>0?'build':'repair',target:target.id});
 }
 let goal:BuildingKind|null=null;
 const openingBarracks=director&&g.world.mapVersion===11&&
  g.tactical.earlyEconomyMode!=='classic'&&!has('barracks');
 const screenHold=deferOpeningInvestment({mapVersion:g.world.mapVersion,
  mode:g.tactical.earlyEconomyMode,time:g.time,fighters:fighters.length,
  barracksReady:complete('barracks'),
  visibleAttackers:seen.filter(u=>!['engineer','medic','scout'].includes(u.kind)
   &&distance(u,home)<760).length,
  visibleArmor:seen.filter(u=>unitSpec(u).group==='Fahrzeuge'
   &&distance(u,home)<920).length,
  enemySectorLead:g.territories.filter(t=>t.owner===0).length-
   g.territories.filter(t=>t.owner===1).length
 });
 const wantCore=director&&!openingBarracks&&!screenHold&&(generators===0||siegeReserve===0)&&generatorBuildPriority({
  existing:generators,fighters:fighters.length,credits:g.credits[1],
  barracksReady:complete('barracks'),underAttack,finishing
 });
 if((!finishing||!has('barracks')||!has('factory')&&known>0||wantCore)
  &&!unfinished&&workers.length&&(!underAttack||!has('barracks'))){
  // First core immediately; later cores only when a paid ground force is
  // already available and enough credits remain for ongoing recruitment.
  if(wantCore)goal='generator';
  else if(!has('barracks'))goal='barracks';
  else if(!screenHold&&!has('factory')&&fighters.length>=3&&(income>=20||known>0||g.time>=55))goal='factory';
  else if(!has('airfield')&&has('factory')&&fighters.length>=4&&(income>=35||g.time>=110||seen.some(u=>unitSpec(u).flying))&&(!director||(complete('factory')&&count('tank')+count('rover')+count('artillery')>=3&&income>=35)))goal='airfield';
  else if(!has('barracks')&&fighters.length>=3)goal='barracks';
 }
 // A confirmed visible or remembered siege objective should not lose its
 // first funded rocket to optional airfield construction. Fogged HQs do not
 // qualify; an already paid artillery queue releases this temporary deferral.
 if(deferOptionalAirfieldForSiege(goal,observedSiege,complete('factory'),count('artillery'),underAttack))goal=null;
 if(e.goal!==goal){e.goal=goal;e.since=g.time;}
 if(goal&&g.credits[1]>=BUILDINGS[goal].cost&&g.time-e.attemptAt>=9){
  e.attemptAt=g.time;
   // Don't cancel a field engineer's emergency vehicle repair with a fresh
   // factory/airfield construction order. A second idle worker may build.
   const worker=workers.find(w=>w.defendUntil<=g.time
    &&(goal==='generator'?!w.orders.length
      :!w.orders.some(o=>o.kind==='build'||
       (g.world.mapVersion>=3&&g.tactical.mode==='director'&&o.kind==='repair'&&
        army.some(v=>v.id===o.target&&s.recovering?.includes(v.id))))));
  if(worker){
   const candidates:Point[]=[];for(const center of [home,...g.territories.filter(t=>t.owner===1).map(t=>t.point)])for(const radius of [260,340,430,520,620])for(let i=0;i<20;i++){
    const p={x:center.x+Math.cos(i*Math.PI/10)*radius,y:center.y+Math.sin(i*Math.PI/10)*radius};if(dangerAt(p)<2&&!g.buildError(1,goal,p))candidates.push(p);
   }
   candidates.sort((a,b)=>aiBuildSiteScore(a,goal,home,worker,own)-aiBuildSiteScore(b,goal,home,worker,own)||a.x-b.x||a.y-b.y);
   for(const p of candidates.slice(0,12)){const b=g.build(1,goal,p,[worker.id]);if(b){e.built[goal]=(e.built[goal]??0)+1;e.goal=null;break;}}
  }
 }
 // Fortify owned border bastions after core production has started. Unlike
 // a passive HQ guard, a real turret can hold a captured frontier while the
 // mobile army advances. Do not block repairs, construction or new armor.
 if(director&&!finishing&&!unfinished&&!g.bases.some(b=>b.owner===1&&b.hp>0&&b.buildRemaining>0)
  &&(goal===null||goal==='generator'||(learnedDefense||urgentDefense)&&goal==='factory')
  &&(!observedSiege||count('artillery')>0||urgentDefense)
  &&complete('barracks')&&(complete('factory')||learnedDefense||urgentDefense)
  &&fighters.length>=(urgentDefense?3:4)&&g.time>=(urgentDefense?60:75)&&g.credits[1]>=BUILDINGS.turret.cost+(urgentDefense?150:400)
  &&own.filter(b=>b.kind==='turret').length<defensiveTowerLimit(g.territories.length)
  &&g.time-(e.towerAttemptAt??-30)>=18){
  const idle=workers.filter(w=>w.defendUntil<=g.time&&!w.orders.length);
  if(idle.length){
   e.towerAttemptAt=g.time;
   if(buildBastionDefense(g,idle,dangerAt)!==null)e.built.turret=(e.built.turret??0)+1;
  }
 }
 // Never reserve the airfield budget ahead of a working vehicle factory.
 // Early-game macro first pays for at least two actual ground vehicles.
 // A second paid engineer enables forward fortifications while the first
 // completes construction/repairs; never cancel an existing worker order.
 const defenseNeedsWorker=director&&!finishing&&complete('barracks')&&(complete('factory')||learnedDefense||urgentDefense)
  &&g.time>=75&&fighters.length>=4&&workers.length===1
  &&own.filter(b=>b.kind==='turret').length<defensiveTowerLimit(g.territories.length)
  &&rankBastionDefenses(g).length>0&&!workers.some(w=>w.defendUntil<=g.time&&!w.orders.length)
  &&g.credits[1]>=BUILDINGS.turret.cost+(urgentDefense?150:400);
 // Do not freeze recruitment for an unbuilt second or third core. Preserve
 // only the committed active construction goal, then reassess next pulse.
 const buildReserve=e.goal&&(e.goal==='barracks'||!underAttack&&fighters.length>=3)
  &&g.time-e.since<85?BUILDINGS[e.goal].cost:0;
 const reserve=Math.max(buildReserve,siegeReserve);
 const maxArmy=director?Math.min(36,Math.max(18,Math.floor(income/3)+10)):Math.min(30,Math.max(14,Math.floor(income/4)+8));if(g.count(1)+g.queued(1)>=maxArmy&&(!director||count('engineer')>0)){
  if(director)e.production={at:g.time,reason:'army-cap',goal:null,missing:0,facilities:Object.fromEntries(own.filter(b=>b.buildRemaining<=0).map(b=>[b.id,{reason:b.queue.length>=2?'queue-blocked':'army-cap',goal:null,missing:0}]))};
  return;
 }
 const wounded=army.filter(u=>!u.carrier&&unitSpec(u).group==='Infanterie'&&u.kind!=='engineer'&&u.hp<unitSpec(u).hp*.7).length;
 const armor=seen.filter(u=>!unitSpec(u).flying&&unitSpec(u).group==='Fahrzeuge').length,air=seen.filter(u=>unitSpec(u).flying).length;
 const military=g.memories[1].filter(b=>b.owner===0&&b.hp>0&&['headquarters','factory','airfield','turret'].includes(b.kind??''));
 // Once scouts have actually identified the enemy HQ, a paid siege weapon is
 // worth waiting for. Fogged, unknown bases must not count as revealed.
 const knownEnemyHQ=military.some(b=>b.kind==='headquarters');
 const scores:Record<UnitKind,number>={
  infantry:Math.max(1,22-count('infantry')*5)+(fighters.length<4?18:0),
  heavy:14+(known?20+known*10:0)+armor*5+(fighters.length>=3?9:0)-count('heavy')*11,
  medic:(wounded>=2?30:Math.max(0,fighters.length-2)*4)-count('medic')*20,
  engineer:count('engineer')===0?(!complete('barracks')?80:fighters.length>=2?38:0):own.length>=4&&count('engineer')<2?15:0,
  rover:complete('factory')?35+(g.explored[1].reduce((n,v)=>n+v,0)/g.explored[1].length<.4?6:0)-count('rover')*17:0,
  tank:complete('factory')?44+known*4+armor*6-count('tank')*16:0,
  artillery:complete('factory')&&(known||fighters.length>=5)?32+known*14-count('artillery')*32:0,
  scout:complete('airfield')&&fighters.length>=4?25-count('scout')*35:0,
  bomber:complete('airfield')&&count('scout')>0&&income>=65&&fighters.length>=6&&military.length?22+military.filter(b=>b.kind==='factory'||b.kind==='airfield').length*3-count('bomber')*25:0,
 };
 if(finishing){
  // Preserve a paid replacement builder, but put other spending into the army.
  scores.bomber=0;scores.engineer=count('engineer')===0?80:0;
 }
 if(underAttack&&fighters.length<4){scores.infantry+=20;scores.heavy+=15;}
 if(air){scores.artillery=0;scores.bomber=0;}
 // Macro manager: all completed producers can run independently. In the old
 // algorithm just ONE facility queued an item per AI pulse, leaving expensive
 // factories/airfields idle while barracks bought cheap infantry.
 if(director){
  produceCombinedArmy(g,s,{own,army,seen,income,underAttack,knownTurrets:known,knownEnemyHQ,reserve,siegeReserve,maxArmy,scores,defenseNeedsWorker,finishing});
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
 if(e===undefined)return true;return !!e&&(e.towerAttemptAt===undefined||(Number.isFinite(e.towerAttemptAt)&&e.towerAttemptAt>=0&&e.towerAttemptAt<=time+.001))&&(e.goal===null||Object.hasOwn(BUILDINGS,e.goal))&&Number.isFinite(e.since)&&e.since>=0&&e.since<=time+.001&&Number.isFinite(e.attemptAt)&&e.attemptAt>=-9&&e.attemptAt<=time+.001&&!!e.produced&&!!e.built&&Object.entries(e.produced).every(([k,v])=>Object.hasOwn(UNITS,k)&&Number.isSafeInteger(v)&&v>=0)&&Object.entries(e.built).every(([k,v])=>Object.hasOwn(BUILDINGS,k)&&Number.isSafeInteger(v)&&v>=0)&&
  (e.production===undefined||(Number.isFinite(e.production.at)&&e.production.at>=0&&e.production.at<=time+.001&&validDecision(e.production)&&!!e.production.facilities&&Object.entries(e.production.facilities).length<=40&&Object.entries(e.production.facilities).every(([id,d])=>Number.isSafeInteger(Number(id))&&Number(id)>=0&&validDecision(d))));
}
const validDecision=(d:ProductionDecision)=>!!d&&['produced','saving-unit','saving-building','insufficient-credits','queue-blocked','army-cap','composition-complete','no-producer'].includes(d.reason)&&(d.goal===null||Object.hasOwn(UNITS,d.goal)||Object.hasOwn(BUILDINGS,d.goal))&&Number.isFinite(d.missing)&&d.missing>=0;
