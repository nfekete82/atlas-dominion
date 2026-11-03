#!/usr/bin/env node
/** Paid-production starvation trace, read-only and based ONLY on RED inventory,
 * visible/public state and its own production decisions. No hidden BLUE data. */
import {mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {configureContender} from './ai-strategy-tournament.mjs';
import {OPPONENTS,scriptedBlueTurn} from './ai-tournament-opponents.mjs';

const combat=k=>!['engineer','medic','scout'].includes(k);
const round=n=>Math.round(n*100)/100;
export const STRATEGIES=Object.freeze(['current','early-barracks']);
export function productionSnapshot(g){
 const army=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier);
 const own=g.bases.filter(b=>b.owner===1&&b.hp>0);
 const barracks=own.filter(b=>b.kind==='barracks'&&b.buildRemaining<=0);
 const e=g.tactical.state.economy,decision=e?.production;
 const recent=decision&&g.time-decision.at<=5?decision:null;
 const pending=own.flatMap(b=>b.queueTypes);
 const fighters=army.filter(u=>combat(u.kind)).length;
 const queuedFighters=pending.filter(combat).length;
 const productive=barracks.some(b=>b.queueTypes.length>0);
 const blocked=barracks.length===0?'no-complete-barracks':
  barracks.every(b=>b.queueTypes.length>=2)?'queue-full':
  productive?'paid-infantry-or-support-queued':
  (recent&&barracks.map(b=>recent.facilities?.[b.id]?.reason).find(Boolean))??'no-recent-barracks-decision';
 return {at:g.time,phase:g.tactical.state.phase,
  fighters,queuedFighters,barracksReady:barracks.length,
  barracksQueue:pending.filter(k=>['infantry','heavy','medic'].includes(k)).length,
  productionBlock:blocked,
  income:g.income(1),credits:g.credits[1],
  savingFor:g.tactical.state.savingFor,
  activeBuildGoal:e?.goal??null,
  activeReserveIntent:recent?.goal??null,
  productionReason:recent?.reason??null,
  factoryReady:own.some(b=>b.kind==='factory'&&b.buildRemaining<=0),
  artillery:army.filter(u=>u.kind==='artillery').length,
  artilleryQueued:pending.filter(k=>k==='artillery').length,
  ownedSectors:g.territories.filter(t=>t.owner===1).length};
}
export function classifyShortage(s){
 if(s.fighters>=4)return 'field-sufficient';
 if(s.fighters+s.queuedFighters>=4)return 'replacement-in-pipeline';
 if(s.barracksReady===0)return 'no-barracks';
 if(s.productionBlock==='queue-full'||s.productionBlock==='paid-infantry-or-support-queued')
  return 'queue-already-producing';
 if(s.savingFor==='artillery'||s.artilleryQueued>0)return 'siege-commitment';
 if(s.savingFor==='tank'||s.savingFor==='rover'||s.savingFor==='scout'||s.savingFor==='bomber')
  return 'vehicle-saving';
 if(s.activeBuildGoal&&s.activeBuildGoal!=='barracks')return 'construction-saving';
 if(s.productionBlock==='saving-unit')return 'other-unit-saving';
 if(s.productionBlock==='saving-building')return 'construction-saving';
 if(s.productionBlock==='insufficient-credits')return 'insufficient-credits';
 if(s.productionBlock==='army-cap')return 'army-cap';
 if(s.productionBlock==='composition-complete')return 'composition-complete';
 if(s.productionBlock==='no-recent-barracks-decision')return 'planner-not-reporting';
 return 'other-blockage';
}

export class StarvationObserver{
 constructor(){this.next=1;this.totals={};this.lowTotals={};
  this.samples=0;this.firstBarracks=null;this.firstFour=null;
  this.samplesLow=[];this.episode=null;this.episodes=[];
 }
 observe(g){
  if(g.time+1e-6<this.next)return;
  const s=productionSnapshot(g);this.next+=1;
  this.samples++;
  const cause=classifyShortage(s);
  this.totals[cause]=(this.totals[cause]??0)+1;
  if(s.barracksReady>0)this.firstBarracks??=Math.round(s.at);
  if(s.fighters>=4)this.firstFour??=Math.round(s.at);
  const shortage=s.fighters<4&&s.barracksReady>0;
  if(shortage){
   this.lowTotals[cause]=(this.lowTotals[cause]??0)+1;
   if(!this.episode)this.episode={start:Math.round(s.at),duration:0,
    reasons:{},creditsStart:s.credits,fieldStart:s.fighters};
   this.episode.duration++;
   this.episode.reasons[cause]=(this.episode.reasons[cause]??0)+1;
   if(this.samplesLow.length<15||Math.round(s.at)%30===0)
    this.samplesLow.push({at:Math.round(s.at),fighters:s.fighters,queue:s.queuedFighters,
     credits:Math.round(s.credits),block:s.productionBlock,
     reason:cause,build:s.activeBuildGoal,savingFor:s.savingFor,
     artillery:s.artillery,artilleryQueued:s.artilleryQueued});
  }else if(this.episode){this.episodes.push(this.episode);this.episode=null;}
 }
 finish(){
  if(this.episode)this.episodes.push(this.episode),this.episode=null;
  if(Object.values(this.totals).reduce((x,y)=>x+y,0)!==this.samples)
   throw Error('Sample accounting mismatch');
  const rank=obj=>Object.fromEntries(Object.entries(obj).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])));
  return {samples:this.samples,firstBarracks:this.firstBarracks,firstFour:this.firstFour,
   lowWithBarracksSeconds:Object.values(this.lowTotals).reduce((n,v)=>n+v,0),
   shortageReasons:rank(this.lowTotals),allReasons:rank(this.totals),
   longestShortage:this.episodes.reduce((m,e)=>Math.max(m,e.duration),0),
   episodes:this.episodes.slice(0,30),samplesLow:this.samplesLow};
 }
}
export function auditOptions(args){
 const opts={opponent:'expansion',seeds:'2026,2029,2032,2051',seconds:'360',
  output:'ai-arena-results/starvation.json'};
 for(let i=0;i<args.length;i+=2){
  const k=args[i]?.replace(/^--/,'');
  if(!args[i]?.startsWith('--')||!['opponent','seeds','seconds','output'].includes(k)
    ||!args[i+1]||args[i+1].startsWith('--'))throw Error('Invalid flag '+args[i]);
  opts[k]=args[i+1];
 }
 const seeds=opts.seeds.split(',').map(Number),seconds=Number(opts.seconds);
 if(!OPPONENTS.includes(opts.opponent)||seeds.length===0||seeds.length>12||
  seeds.some(s=>!Number.isSafeInteger(s)||s<0||s>4294967295)||
  new Set(seeds).size!==seeds.length||!Number.isInteger(seconds)||seconds<120||seconds>900)
  throw Error('Invalid paid audit options');
 return {...opts,seeds,seconds};
}
export function audit({seeds,opponent,seconds}){
 const results=[];
 for(const seed of seeds){
  let hash=null;
  for(const strategy of STRATEGIES){
   const observer=new StarvationObserver();
   class InstrumentedSimulation extends Simulation{
    constructor(...args){super(...args);configureContender(this.tactical,strategy);}
   }
   const m=runMatch({Simulation:InstrumentedSimulation,UNITS},{
    seconds,opponent:'guarded',label:strategy,
    defender:g=>scriptedBlueTurn(g,opponent),
    observe:g=>observer.observe(g)
   },seed,'director',11);
   if(hash!==null&&hash!==m.initialStateHash)throw Error('Unpaired playable start');
   hash=m.initialStateHash;
   const starvation=observer.finish();
   results.push({opponent,seed,strategy,outcome:m.outcome,
    initialStateHash:hash,elapsedSeconds:m.elapsedSeconds,
    losses:m.redUnitsLost,captures:m.captures,
    attackingSeconds:m.attackingSeconds,
    firstArtillery:m.firstArtillery,firstArtilleryOrder:m.firstArtilleryOrder,
    paidRecruitCredits:m.paidRecruitCredits,starvation});
   console.log('STARVATION',opponent,seed,strategy,
    'outcome='+m.outcome,'shortage='+starvation.lowWithBarracksSeconds,
    'reasons='+JSON.stringify(starvation.shortageReasons),
    'firstBarracks='+starvation.firstBarracks,'firstFour='+starvation.firstFour,
    'attack='+m.attackingSeconds,'losses='+m.redUnitsLost);
  }
 }
 return {schemaVersion:1,kind:'read-only paid barracks low-force root cause',
  mapVersion:11,seconds,seeds,opponent,strategies:STRATEGIES,
  expected:seeds.length*STRATEGIES.length,completed:results.length,results};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const opt=auditOptions(process.argv.slice(2)),report=audit(opt),output=resolve(opt.output);
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output+'.tmp',JSON.stringify(report,null,2)+'\n');
 renameSync(output+'.tmp',output);
 console.log('STARVATION AUDIT COMPLETE '+report.completed+'/'+report.expected);
}
