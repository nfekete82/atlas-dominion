#!/usr/bin/env node
/** Read-only 1 Hz census of why the #211 mission escape cannot engage.
 * Instrument the clean #200 simulation without applying the proposed rule.
 * Gate order reproduces the candidate's observable preliminary conditions.
 * No route access: eligible-before-routing is an upper bound, NEVER a launch. */
import {mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {configureContender} from './ai-strategy-tournament.mjs';
import {OPPONENTS,scriptedBlueTurn} from './ai-tournament-opponents.mjs';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const combat=u=>u.owner===1&&u.hp>0&&!u.carrier&&!['engineer','medic','scout'].includes(u.kind);
export const REASONS=Object.freeze([
 'no-mission','other-mission','before-experiment-window',
 'objective-not-observed','no-known-covering-turret',
 'recent-mission-progress','too-few-field-fighters',
 'living-artillery','paid-artillery-commitment','visible-home-threat',
 'no-observed-open-adjacent-sector','eligible-before-routing'
]);

/** This is intentionally an upper bound for #211: its real commander excludes
 * withdrawn/recon/defense fighters, and also checks exact sampled route risk.
 * Count every earlier gate before claiming a proposed trigger is reachable. */
export function missionGateSnapshot(g){
 const s=g.tactical.state,old=s.commander?.mission;
 const known=g.memories[1].filter(m=>m.owner===0&&m.hp>0);
 const observed=old?.objective==null?null:known.find(m=>m.id===old.objective)??null;
 const fighters=g.units.filter(combat);
 const artillery=fighters.some(u=>u.kind==='artillery');
 const artilleryQueue=g.bases.some(b=>b.owner===1&&b.hp>0&&b.queueTypes.includes('artillery'));
 const committedArtillery=s.savingFor==='artillery'||artilleryQueue;
 const covering=!!old&&known.some(m=>m.kind==='turret'&&distance(m,old)<680);
 const visibleHomeThreat=g.bases.some(b=>b.owner===1&&b.hp>0&&
  g.units.some(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)&&distance(u,b)<440));
 const fronts=g.territories.filter(t=>t.owner!==1&&
  t.neighbors.some(id=>g.territories[id]?.owner===1));
 const openFronts=fronts.filter(t=>!known.some(b=>
  ['headquarters','turret'].includes(b.kind??'')&&distance(b,t.point)<690)&&
  !g.units.some(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)&&
   distance(u,t.point)<400));
 return {time:g.time,phase:s.phase,mission:old?.kind??null,missionSector:old?.sector??null,
  objective:old?.objective??null,progressAge:old?g.time-old.progressAt:null,
  objectiveObserved:!!observed,coveringTower:covering,
  fieldFighters:fighters.length,livingArtillery:artillery,artilleryQueue,
  committedArtillery,visibleHomeThreat,adjacentFronts:fronts.length,
  openFronts:openFronts.length,enemyHQEliminated:s.commander?.enemyHQEliminatedAt!==undefined,
  ownSectors:g.territories.filter(t=>t.owner===1).length};
}
export function classifyMissionGate(s){
 if(!s.mission)return 'no-mission';
 if(s.mission!=='structure')return 'other-mission';
 if(s.time<75)return 'before-experiment-window';
 if(!s.objectiveObserved)return 'objective-not-observed';
 if(!s.coveringTower)return 'no-known-covering-turret';
 if(s.progressAge===null||s.progressAge<42)return 'recent-mission-progress';
 if(s.fieldFighters<4)return 'too-few-field-fighters';
 if(s.livingArtillery)return 'living-artillery';
 if(s.committedArtillery)return 'paid-artillery-commitment';
 if(s.visibleHomeThreat)return 'visible-home-threat';
 if(!s.openFronts)return 'no-observed-open-adjacent-sector';
 return 'eligible-before-routing';
}
export class MissionGateObserver{
 constructor(){
  this.nextAt=1;this.counts={};this.samples=0;this.phases={};
  this.structureSeconds=0;this.coveringStructureSeconds=0;
  this.staleTowerSeconds=0;this.preRouteEligibleSeconds=0;
  this.maxProgressAge=0;this.progressAgeSums=0;this.progressAgeSamples=0;
  this.fightersAtStall={};this.examples=[];this.episodes=[];
  this.prev=null;this.active=null;
 }
 observe(g){
  if(g.time+1e-6<this.nextAt)return;
  this.nextAt+=1;
  this.absorb(missionGateSnapshot(g));
 }
 absorb(s){
  const reason=classifyMissionGate(s);
  this.samples++;this.counts[reason]=(this.counts[reason]??0)+1;
  this.phases[s.phase]=(this.phases[s.phase]??0)+1;
  if(s.mission==='structure'){
   this.structureSeconds++;
   if(s.coveringTower)this.coveringStructureSeconds++;
   if(s.coveringTower&&s.progressAge!==null&&s.progressAge>=42)this.staleTowerSeconds++;
  }
  if(s.progressAge!==null){
   this.maxProgressAge=Math.max(this.maxProgressAge,s.progressAge);
   this.progressAgeSums+=s.progressAge;this.progressAgeSamples++;
  }
  if(s.coveringTower&&s.mission==='structure'){
   const bucket=s.fieldFighters>=4?'4+':String(s.fieldFighters);
   this.fightersAtStall[bucket]=(this.fightersAtStall[bucket]??0)+1;
  }
  if(reason==='eligible-before-routing')this.preRouteEligibleSeconds++;
  if(reason!==this.prev){
   if(this.active)this.episodes.push(this.active);
   this.active={from:Math.round(s.time),reason,duration:0,mission:s.mission,
    sector:s.missionSector,fieldFighters:s.fieldFighters,progressAge:Math.round(s.progressAge??0)};
   if(this.examples.length<65)this.examples.push({
    at:Math.round(s.time),reason,phase:s.phase,mission:s.mission,
    sector:s.missionSector,age:Math.round(s.progressAge??0),fighters:s.fieldFighters,
    artillery:s.livingArtillery,committedArtillery:s.committedArtillery,
    openFronts:s.openFronts,homeThreat:s.visibleHomeThreat});
  }
  this.active.duration++;this.prev=reason;
 }
 finish(){
  if(this.active){this.episodes.push(this.active);this.active=null;}
  if(Object.values(this.counts).reduce((a,b)=>a+b,0)!==this.samples)throw Error('Gate accounting mismatch');
  const sorted=o=>Object.fromEntries(Object.entries(o).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])));
  return {sampledSeconds:this.samples,reasons:sorted(this.counts),phases:sorted(this.phases),
   structureSeconds:this.structureSeconds,coveringStructureSeconds:this.coveringStructureSeconds,
   staleTowerSeconds:this.staleTowerSeconds,preRouteEligibleSeconds:this.preRouteEligibleSeconds,
   meanProgressAge:this.progressAgeSamples?Math.round(this.progressAgeSums/this.progressAgeSamples*100)/100:null,
   maxProgressAge:Math.round(this.maxProgressAge*100)/100,
   fieldFightersDuringTowerMission:sorted(this.fightersAtStall),
   episodes:this.episodes.slice(0,150),examples:this.examples};
 }
}
export function parseOptions(argv){
 const o={opponent:'pressure',seeds:'2026,2028,2029,2032,2058',seconds:'360',
  output:'ai-arena-results/assault-gates.json'};
 for(let i=0;i<argv.length;i+=2){
  const k=argv[i]?.replace(/^--/,'');
  if(!argv[i]?.startsWith('--')||!['opponent','seeds','seconds','output'].includes(k)||
   !argv[i+1]||argv[i+1].startsWith('--'))throw Error('Invalid gate census option');
  o[k]=argv[i+1];
 }
 const seeds=o.seeds.split(',').map(Number),seconds=Number(o.seconds);
 if(!OPPONENTS.includes(o.opponent)||seeds.length<1||seeds.length>12||
  seeds.some(n=>!Number.isSafeInteger(n)||n<0||n>4294967295)||
  new Set(seeds).size!==seeds.length||
  !Number.isInteger(seconds)||seconds<120||seconds>900)throw Error('Invalid census opponent/seeds/seconds');
 return {...o,seeds,seconds};
}
export function runAudit({opponent,seeds,seconds}){
 const rows=[];
 for(const seed of seeds){
  let initial=null;
  for(const strategy of ['current','early-barracks']){
   const observer=new MissionGateObserver();
   class ObservedSimulation extends Simulation{
    constructor(...args){super(...args);configureContender(this.tactical,strategy);}
   }
   const result=runMatch({Simulation:ObservedSimulation,UNITS},{
    seconds,opponent:'guarded',label:strategy,
    defender:g=>scriptedBlueTurn(g,opponent),
    observe:g=>observer.observe(g)
   },seed,'director',11);
   if(initial!==null&&initial!==result.initialStateHash)
    throw Error('Not a paired equal-state start');
   initial=result.initialStateHash;
   const gates=observer.finish();
   rows.push({seed,opponent,strategy,outcome:result.outcome,
    initialStateHash:initial,played:result.elapsedSeconds,
    redLosses:result.redUnitsLost,captures:result.captures,
    hqDamage:result.enemyHQDamage,attackSeconds:result.attackingSeconds,gates});
   const top=Object.entries(gates.reasons).slice(0,4).map(([k,v])=>k+':'+v).join(',');
   console.log('GATE',opponent,seed,strategy,'outcome='+result.outcome,
    'structure='+gates.structureSeconds,'tower='+gates.coveringStructureSeconds,
    'staleTower='+gates.staleTowerSeconds,
    'preRouteEligible='+gates.preRouteEligibleSeconds,
    'top='+top);
  }
 }
 return {schemaVersion:1,kind:'read-only clean-baseline gate census',
  warning:'preRouteEligible is an upper bound, not a route-confirmed trigger; snapshots use all RED field fighters, including some that the tactical commander may exclude',
  opponent,seeds,seconds,strategies:['current','early-barracks'],
  expected:seeds.length*2,completed:rows.length,rows};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const opts=parseOptions(process.argv.slice(2)),result=runAudit(opts),out=resolve(opts.output);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out+'.tmp',JSON.stringify(result,null,2)+'\n');
 renameSync(out+'.tmp',out);
 console.log('GATE CENSUS COMPLETE '+result.completed+'/'+result.expected);
}
