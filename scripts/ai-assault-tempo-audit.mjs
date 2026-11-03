#!/usr/bin/env node
/** Read-only, side-neutral game-clock profiling of RED's tactical tempo.
 * Never dispatches an order, changes resources or reads fogged enemy units.
 * Simulated seconds are sampled at one-second boundaries, not wall time. */
import {mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {configureContender} from './ai-strategy-tournament.mjs';
import {OPPONENTS,scriptedBlueTurn} from './ai-tournament-opponents.mjs';

const round=n=>Math.round(n*100)/100;
const combat=u=>u.owner===1&&u.hp>0&&!u.carrier&&!['engineer','medic','scout'].includes(u.kind);
export const AUDIT_CONTENDERS=Object.freeze(['current','early-barracks','threat-guard','flank-tempo']);
export const TEMPO_REASONS=Object.freeze(['no-mission','home-defense','regroup',
 'attack-with-orders','attack-without-orders','siege-wait','insufficient-force',
 'assembly','other']);

/** All BLUE information here has been seen by RED or is public ownership. */
export function tempoSnapshot(g){
 const s=g.tactical.state,mission=s.commander?.mission??null;
 const fighters=g.units.filter(combat),ids=new Set(s.group);
 const group=fighters.filter(u=>ids.has(u.id));
 const orders=group.filter(u=>['attack','attackMove'].includes(u.orders?.[0]?.kind)).length;
 const tower=!!mission&&g.memories[1].some(b=>b.owner===0&&b.hp>0&&b.kind==='turret'&&
  Math.hypot(b.x-mission.x,b.y-mission.y)<740);
 const objective=mission?.objective===null||mission?.objective===undefined?null:
  g.memories[1].find(b=>b.id===mission.objective&&b.owner===0&&b.hp>0)??null;
 return {
  at:g.time,phase:s.phase,commander:s.commander?.phase??'unavailable',
  mission:mission?{kind:mission.kind,sector:mission.sector,objective:mission.objective,
   progressAt:mission.progressAt}:null,
  objectiveSeenHp:objective&&g.canSee(1,objective)?objective.hp:null,
  groupId:s.groupId,fighters:fighters.length,groupSize:group.length,attackOrders:orders,
  visibleTowerCover:tower,artillery:fighters.filter(u=>u.kind==='artillery').length,
  queuedArtillery:g.bases.filter(b=>b.owner===1&&b.hp>0).reduce((n,b)=>
   n+b.queueTypes.filter(k=>k==='artillery').length,0),
  ownSectors:g.territories.filter(t=>t.owner===1).length,
  ownTerritorySignature:g.territories.map(t=>t.owner===1?'1':'0').join(''),
  credits:g.credits[1],income:g.income(1),
  savingFor:s.savingFor,productionReason:s.economy?.production?.reason??null
 };
}

/** Exclusive root-cause buckets sum to sampled clock time. Secondary signals
 * (stale mission, known covering tower) may overlap by design. */
export function classifyTempo(s){
 if(s.phase==='defend')return 'home-defense';
 if(s.phase==='regroup')return 'regroup';
 if(s.phase==='attack')return s.attackOrders>0?'attack-with-orders':'attack-without-orders';
 if(!s.mission)return 'no-mission';
 if(s.phase==='gather'&&s.visibleTowerCover&&s.artillery===0&&s.queuedArtillery===0)return 'siege-wait';
 if(s.phase==='gather'&&s.fighters<4)return 'insufficient-force';
 if(s.phase==='gather')return 'assembly';
 return 'other';
}

export class TempoObserver{
 constructor(){this.nextAt=1;this.lastAt=0;this.last=null;
  this.phaseSeconds={};this.commanderSeconds={};this.rootCauseSeconds={};
  this.missionChanges=0;this.waveChanges=0;this.noObjectiveProgressSeconds=0;
  this.attackOrderSeconds=0;this.attackNoOrderSeconds=0;this.siegeCoveredSeconds=0;
  this.lowArmySeconds=0;this.firstAttack=null;this.firstObjectiveProgress=null;
  this.longestUnproductiveAttack=0;this.currentUnproductiveAttack=0;
  this.lastActualProgressAt=0;this.latestMissionKey=null;this.latestHp=null;
  this.episodes=[];this.timeline=[];this.sampledSeconds=0;this.lastGroupId=null;
  this.lastSectorSignature=null;
 }
 observe(g){
  if(g.time+1e-6<this.nextAt)return;
  const current=tempoSnapshot(g);
  const dt=g.time-this.lastAt;this.lastAt=g.time;this.nextAt+=1;
  this.absorb(current,dt);
 }
 absorb(s,dt){
  if(!(dt>0)||!Number.isFinite(dt))throw Error('non-positive sample clock');
  const key=s.mission?`${s.mission.kind}:${s.mission.sector}:${s.mission.objective??'none'}`:null;
  if(this.last){
   if(key!==this.latestMissionKey){
    if(key&&this.latestMissionKey)this.missionChanges++;
    this.lastActualProgressAt=s.at;
    this.latestHp=s.objectiveSeenHp;
   }else{
    if(s.objectiveSeenHp!==null&&this.latestHp!==null&&s.objectiveSeenHp<this.latestHp-0.01){
     this.lastActualProgressAt=s.at;this.firstObjectiveProgress??=s.at;
    }
    if(s.objectiveSeenHp!==null)this.latestHp=s.objectiveSeenHp;
   }
   if(this.lastSectorSignature!==s.ownTerritorySignature){
    this.lastActualProgressAt=s.at;this.firstObjectiveProgress??=s.at;
   }
   if(s.groupId!==this.lastGroupId&&s.phase==='attack')this.waveChanges++;
  }else{
   this.lastActualProgressAt=s.at;
   this.latestHp=s.objectiveSeenHp;
  }
  const cause=classifyTempo(s),add=(obj,k)=>{obj[k]=(obj[k]??0)+dt;};
  add(this.phaseSeconds,s.phase);add(this.commanderSeconds,s.commander);
  add(this.rootCauseSeconds,cause);this.sampledSeconds+=dt;
  if(s.phase==='attack')this.firstAttack??=s.at;
  if(s.phase==='attack'&&s.attackOrders>0)this.attackOrderSeconds+=dt;
  if(s.phase==='attack'&&s.attackOrders===0)this.attackNoOrderSeconds+=dt;
  if(s.visibleTowerCover&&s.artillery===0)this.siegeCoveredSeconds+=dt;
  if(s.fighters<4)this.lowArmySeconds+=dt;
  // A coarse symptom, never proof of idle combat: observed objective HP and
  // public sector control have not advanced for at least 45 game seconds.
  if(s.phase==='attack'&&s.mission&&s.at-this.lastActualProgressAt>=45){
   this.noObjectiveProgressSeconds+=dt;
   this.currentUnproductiveAttack+=dt;
   this.longestUnproductiveAttack=Math.max(this.longestUnproductiveAttack,this.currentUnproductiveAttack);
  }else this.currentUnproductiveAttack=0;
  if(key!==this.latestMissionKey&&this.episodes.length<120)
   this.episodes.push({at:round(s.at),from:this.latestMissionKey,to:key,phase:s.phase,
    fighters:s.fighters,artillery:s.artillery,queuedArtillery:s.queuedArtillery});
  if(Math.round(s.at)%30===0)this.timeline.push({
   at:round(s.at),phase:s.phase,commander:s.commander,mission:key,
   fighters:s.fighters,attackOrders:s.attackOrders,artillery:s.artillery,
   queuedArtillery:s.queuedArtillery,credits:round(s.credits),
   ownSectors:s.ownSectors,cause,staleFor:round(s.at-this.lastActualProgressAt)});
  this.latestMissionKey=key;this.lastGroupId=s.groupId;
  this.lastSectorSignature=s.ownTerritorySignature;this.last=s;
 }
 finish(){
  const sums=Object.values(this.rootCauseSeconds).reduce((a,b)=>a+b,0);
  if(Math.abs(sums-this.sampledSeconds)>0.001)throw Error('tempo clock did not reconcile');
  const sort=obj=>Object.fromEntries(Object.entries(obj).sort((a,b)=>b[1]-a[1])
   .map(([k,v])=>[k,round(v)]));
  return {sampledSeconds:round(this.sampledSeconds),
   phaseSeconds:sort(this.phaseSeconds),commanderSeconds:sort(this.commanderSeconds),
   rootCauseSeconds:sort(this.rootCauseSeconds),
   missionChanges:this.missionChanges,waveChanges:this.waveChanges,
   firstAttack:this.firstAttack===null?null:round(this.firstAttack),
   firstObjectiveProgress:this.firstObjectiveProgress===null?null:round(this.firstObjectiveProgress),
   noObjectiveProgressSeconds:round(this.noObjectiveProgressSeconds),
   longestUnproductiveAttack:round(this.longestUnproductiveAttack),
   attackOrderSeconds:round(this.attackOrderSeconds),
   attackNoOrderSeconds:round(this.attackNoOrderSeconds),
   siegeCoveredSeconds:round(this.siegeCoveredSeconds),
   lowArmySeconds:round(this.lowArmySeconds),
   episodes:this.episodes,timeline:this.timeline};
 }
}
export function parseTempoAuditOptions(argv){
 const values={opponent:'pressure',seeds:'2026,2029,2032,2051',seconds:'360',
  output:'ai-arena-results/tempo-audit.json'};
 for(let i=0;i<argv.length;i+=2){
  const key=argv[i]?.replace(/^--/,'');
  if(!argv[i]?.startsWith('--')||!['opponent','seeds','seconds','output'].includes(key)||
   !argv[i+1]||argv[i+1].startsWith('--'))throw Error('Invalid tempo audit option');
  values[key]=argv[i+1];
 }
 const seeds=values.seeds.split(',').map(Number),seconds=Number(values.seconds);
 if(!OPPONENTS.includes(values.opponent)||!Number.isInteger(seconds)||seconds<120||seconds>900||
  seeds.length<1||seeds.length>12||seeds.some(v=>!Number.isSafeInteger(v)||v<0||v>4294967295)||
  new Set(seeds).size!==seeds.length)throw Error('Invalid opponent/seeds/seconds');
 return {opponent:values.opponent,seeds,seconds,output:values.output};
}
export function runTempoAudit({opponent,seeds,seconds}){
 const rows=[];
 for(const seed of seeds){
  let hash=null;
  for(const strategy of AUDIT_CONTENDERS){
   const observer=new TempoObserver();
   class InstrumentedSimulation extends Simulation{
    constructor(...args){super(...args);configureContender(this.tactical,strategy);}
   }
   const m=runMatch({Simulation:InstrumentedSimulation,UNITS},{
    seconds,opponent:'guarded',label:strategy,
    defender:g=>scriptedBlueTurn(g,opponent),
    observe:g=>observer.observe(g)
   },seed,'director',11);
   if(hash!==null&&hash!==m.initialStateHash)throw Error('Initial game/credits/fog differs');
   hash=m.initialStateHash;
   const tempo=observer.finish();
   const row={seed,opponent,strategy,initialStateHash:hash,outcome:m.outcome,
    simulatedSeconds:m.elapsedSeconds,ownLosses:m.redUnitsLost,captures:m.captures,
    blueKills:m.blueUnitsLost,enemyHQDamage:round(m.enemyHQDamage),
    paidRecruitCredits:m.paidRecruitCredits,
    benchmarkAttackSeconds:m.attackingSeconds,
    benchmarkAbortedMissions:m.abortedMissions,
    benchmarkStalledMissions:m.stalledMissions,tempo};
   rows.push(row);
   const reasons=Object.entries(tempo.rootCauseSeconds)
    .sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k}:${v}`).join(',');
   console.log('TEMPO',opponent,seed,strategy,m.outcome,
    'attacks='+tempo.attackOrderSeconds,'gather='+round(tempo.phaseSeconds.gather??0),
    'regroup='+round(tempo.phaseSeconds.regroup??0),
    'noProgress='+tempo.noObjectiveProgressSeconds,
    'switches='+tempo.missionChanges,'reason='+reasons,
    'deaths='+m.redUnitsLost,'captures='+m.captures);
  }
 }
 return {schemaVersion:1,kind:'read-only game-clock attack tempo diagnosis',
  warning:'No-order and no-observed-objective-progress are symptoms, not proof of no firing. Fog-hidden BLUE is never inspected.',
  matchStart:'identical and paid',mapVersion:11,seconds,opponent,
  seeds,contenders:AUDIT_CONTENDERS,expected:seeds.length*AUDIT_CONTENDERS.length,
  completed:rows.length,rows};
}
const called=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(called){
 const opts=parseTempoAuditOptions(process.argv.slice(2));
 const report=runTempoAudit(opts),out=resolve(opts.output);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out+'.tmp',JSON.stringify(report,null,2)+'\n');
 renameSync(out+'.tmp',out);
 console.log('TEMPO AUDIT COMPLETE '+report.completed+'/'+report.expected);
}
