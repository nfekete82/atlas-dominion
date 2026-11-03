/**
 * Operational Commander v1.
 *
 * One deterministic owner of the *strategic* mission. Existing local defense,
 * squad positioning, artillery standoff, paid production and damage authority
 * remain separate execution systems; none may invent opponents behind fog.
 *
 * Pure, opt-in, not serialized. Only candidates assembled from public sector
 * ownership, own strength, observed units/structures and verified routes are
 * accepted. A timeout is NOT an operational victory.
 */
export type OperationPhase =
 'expand'|'breakthrough'|'siege'|'strike-production'|'finish'|'recover'|'defend';
export type OperationKind='capture'|'structure'|'hunt';
export interface OperationCandidate {
 key:string;kind:OperationKind;sector:number;objective:number|null;
 owner:number;income:number;structureKind:string|null;
 routeLength:number;routeRisk:number;knownTowers:number;
 visibleDefenders:number;knownEnemyBase:boolean;
}
export interface OperationObservation {
 time:number;mapVersion:number;ownSectors:number;fighters:number;artillery:number;
 recentLosses:number;enemyHQEliminated:boolean;homeThreat:boolean;
 activeKey:string|null;activeProgressAge:number;activeObjectiveDamaged:boolean;
 candidates:readonly OperationCandidate[];
}
export interface OperationMemory {
 version:1;key:string|null;phase:OperationPhase;since:number;
 switches:number;failedKey:string|null;failedUntil:number;
 reason:string;lastScore:number;
}
export interface OperationDecision {
 key:string|null;phase:OperationPhase;reason:string;
 changed:boolean;score:number;state:OperationMemory;
}
export function newOperations():OperationMemory{
 return {version:1,key:null,phase:'expand',since:0,switches:0,
  failedKey:null,failedUntil:0,reason:'initial',lastScore:Infinity};
}
const isRouted=(c:OperationCandidate)=>Number.isFinite(c.routeLength)&&
 c.routeLength>0&&c.routeLength<=3500&&Number.isFinite(c.routeRisk)&&
 c.routeRisk>=0&&c.routeRisk<100;
const phaseFor=(c:OperationCandidate,x:OperationObservation):OperationPhase=>
 x.enemyHQEliminated?'finish':c.kind==='capture'?
  (c.owner===0?'breakthrough':'expand'):c.structureKind==='turret'?
  'siege':c.structureKind==='headquarters'?'finish':'strike-production';
/** No combat command is issued here. All scores are in approximate route-meters. */
export function operationScore(c:OperationCandidate,x:OperationObservation,
 memory:OperationMemory):number{
 if(!isRouted(c)||c.owner===1&&c.kind==='capture')return Infinity;
 const heavyCover=c.knownTowers>0;
 const realSiege=x.artillery>0;
 const understrength=x.fighters<4;
 let score=c.routeLength*.66+c.routeRisk*125+
  c.visibleDefenders*160+c.knownTowers*(realSiege?275:2450)-
  c.income*17;
 if(c.kind==='capture'){
  // Take ground and income before the front becomes a stationary tower queue.
  score+=c.owner===0?-850:-650;
  if(understrength&&(heavyCover||c.visibleDefenders>0))score+=1700;
  if(c.knownEnemyBase&&!x.enemyHQEliminated)score+=2600;
 }else if(c.kind==='structure'){
  if(c.structureKind==='headquarters'){
   score-=realSiege?2300:700;
   if(heavyCover&&!realSiege)score+=1800;
  }else if(c.structureKind==='turret'){
   score-=realSiege?1550:150;
  }else if(['barracks','factory','airfield'].includes(c.structureKind??'')){
   score-=realSiege||!heavyCover?1900:600;
  }else score-=350;
  if(understrength&&c.visibleDefenders>0)score+=950;
 }else score+=x.enemyHQEliminated?-950:800;
 if(x.recentLosses>=3&&(c.visibleDefenders>0||heavyCover))score+=700;
 if(memory.failedKey===c.key&&x.time<memory.failedUntil)score+=1800;
 // Avoid pointless mission churn while real HP/proximity progress occurs.
 if(c.key===x.activeKey&&x.activeProgressAge<45)score-=350;
 if(c.key===memory.key&&x.time-memory.since<24)score-=300;
 return score;
}
export function decideOperation(
 current:OperationMemory,obs:OperationObservation
):OperationDecision{
 const memory={...current};
 const eligible=obs.candidates.filter(isRouted).map(c=>({
  c,score:operationScore(c,obs,memory)
 })).filter(v=>Number.isFinite(v.score))
  .sort((a,b)=>a.score-b.score||a.c.key.localeCompare(b.c.key));
 const old=eligible.find(v=>v.c.key===obs.activeKey);
 if(obs.homeThreat){
  // The tactical local-defense commander owns actual orders.
  return {key:old?.c.key??null,phase:'defend',reason:'visible-home-threat',
   changed:false,score:old?.score??Infinity,state:{...memory,phase:'defend',reason:'visible-home-threat'}};
 }
 const best=eligible[0],age=obs.time-memory.since;
 const lostProgress=old&&obs.activeProgressAge>=55&&!obs.activeObjectiveDamaged;
 // Holding an already selected mission may be preferable to a marginal score
 // win: route stability beats a stream of three-second strategic reversals.
 const keep=!!old&&!!best&&old.c.key!==best.c.key&&
  (!lostProgress&&age<30 ||!lostProgress&&old.score<=best.score+300||
   lostProgress&&old.score<=best.score+70);
 let chosen=keep?old:best;
 if(!chosen&&old)chosen=old;
 if(!chosen){
  return {key:null,phase:'recover',reason:'no-reachable-candidate',
   changed:memory.key!==null,score:Infinity,
   state:{...memory,key:null,phase:'recover',reason:'no-reachable-candidate',since:obs.time}};
 }
 // Reset stale-target penalty after a verified alternative becomes primary.
 const changed=chosen.c.key!==memory.key;
 if(changed&&old&&lostProgress){
  memory.failedKey=old.c.key;
  memory.failedUntil=obs.time+55;
 }
 const phase=phaseFor(chosen.c,obs);
 if(changed){memory.switches++;memory.since=obs.time;}
 memory.key=chosen.c.key;
 memory.phase=phase;
 memory.lastScore=chosen.score;
 memory.reason=keep?'retain-progress':
  changed?'operation-transition':'continue-operation';
 return {key:memory.key,phase,reason:memory.reason,changed,
  score:chosen.score,state:memory};
}
