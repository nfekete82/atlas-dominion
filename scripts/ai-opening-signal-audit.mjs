#!/usr/bin/env node
/** Read-only four-bastion opening audit. No tactical orders, credit changes,
 * hidden BLUE positions, or spawn modifiers. The benchmark is the only driver. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {deferOpeningInvestment} from '../dist/src/reborn/army-economy.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {OPPONENTS,scriptedBlueTurn} from './ai-tournament-opponents.mjs';

export const MODES=['early-barracks','adaptive-opening'];
export function visibleOpeningSignals(g){
 const own=g.bases.filter(b=>b.owner===1&&b.hp>0);
 const home=own.find(b=>b.kind==='headquarters')??own[0];
 const army=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier);
 const fighters=army.filter(u=>!['engineer','medic','scout'].includes(u.kind));
 const seen=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u));
 return {
  time:Number(g.time.toFixed(2)),fighters:fighters.length,
  queuedFighters:own.reduce((n,b)=>n+b.queueTypes.filter(k=>!['engineer','medic','scout'].includes(k)).length,0),
  barracksReady:own.some(b=>b.kind==='barracks'&&b.buildRemaining<=0),
  barracksBuilt:own.some(b=>b.kind==='barracks'),
  generators:own.filter(b=>b.kind==='generator').length,
  factoryBuilt:own.some(b=>b.kind==='factory'),
  credits:g.credits[1],income:g.income(1),
  visibleAttackers:home?seen.filter(u=>!['engineer','medic','scout'].includes(u.kind)
   &&Math.hypot(u.x-home.x,u.y-home.y)<760).length:0,
  visibleArmor:home?seen.filter(u=>UNITS[u.kind].group==='Fahrzeuge'
   &&Math.hypot(u.x-home.x,u.y-home.y)<920).length:0,
  enemySectorLead:g.territories.filter(t=>t.owner===0).length-
   g.territories.filter(t=>t.owner===1).length
 };
}
export function openingAuditStats(samples){
 const when=fn=>samples.find(fn)?.time??null;
 const eligible=samples.filter(s=>s.time<90&&s.barracksReady&&s.fighters<4);
 const actual=eligible.filter(s=>deferOpeningInvestment({...s,mapVersion:11,mode:'adaptive-screen'}));
 return {
  eligibleSamples:eligible.length,activeHoldSamples:actual.length,
  firstBarracks:when(s=>s.barracksBuilt),
  firstReadyBarracks:when(s=>s.barracksReady),
  firstGenerator:when(s=>s.generators>0),
  firstFactory:when(s=>s.factoryBuilt),
  firstFourFighters:when(s=>s.fighters>=4),
  firstThreat:when(s=>s.visibleAttackers>=2||s.visibleArmor>=1),
  firstSectorDeficit:when(s=>s.enemySectorLead>0),
  firstEligibleHold:actual[0]?.time??null
 };
}
export function openingAuditOptions(argv){
 const opts={opponent:'pressure',seeds:'2026,2029,2030,2038',output:'ai-arena-results/opening-audit.json'};
 for(let i=0;i<argv.length;i+=2){
  const k=argv[i]?.replace(/^--/,'');
  if(!argv[i]?.startsWith('--')||!['opponent','seeds','output'].includes(k)||argv[i+1]===undefined)
   throw Error('Unknown or incomplete audit flag: '+argv[i]);
  opts[k]=argv[i+1];
 }
 const seeds=opts.seeds.split(',').map(Number);
 if(!OPPONENTS.includes(opts.opponent)||seeds.length<1||seeds.length>16||
  new Set(seeds).size!==seeds.length||seeds.some(n=>!Number.isSafeInteger(n)||n<0||n>4294967295))
  throw Error('Invalid opening audit options');
 return {...opts,seeds};
}
export function auditOpening({opponent,seeds}){
 const results=[];
 for(const seed of seeds){
  let hash=null;
  for(const mode of MODES){
   const samples=[];
   let next=0;
   class OpeningSimulation extends Simulation{
    constructor(...args){
     super(...args);
     this.tactical.earlyEconomyMode=mode==='early-barracks'?'barracks-first':'adaptive-screen';
    }
   }
   const m=runMatch({Simulation:OpeningSimulation,UNITS},
    {seconds:120,opponent:'guarded',label:mode,defender:g=>scriptedBlueTurn(g,opponent),
     observe:g=>{
      if(g.time+1e-6>=next){
       samples.push(visibleOpeningSignals(g));
       next+=3;
      }
     }},seed,'director',11);
   if(hash!==null&&hash!==m.initialStateHash)throw Error('A/B starting world differs');
   hash=m.initialStateHash;
   const metrics=openingAuditStats(samples);
   results.push({seed,opponent,mode,hash,outcome:m.outcome,
    redUnitsLost:m.redUnitsLost,redCredits:m.redCredits,paidBuildCredits:m.paidBuildCredits,
    paidRecruitCredits:m.paidRecruitCredits,captures:m.captures,
    ...metrics,snapshots:samples.filter(s=>[12,24,30,45,60,75,90,120].includes(Math.round(s.time)))});
   console.log('OPENING',opponent,seed,mode,'hold='+metrics.activeHoldSamples,
    'eligible='+metrics.eligibleSamples,'threat='+metrics.firstThreat,
    'sectorDeficit='+metrics.firstSectorDeficit,'generator='+metrics.firstGenerator,
    'factory='+metrics.firstFactory,'fighters4='+metrics.firstFourFighters,
    'deaths='+m.redUnitsLost,'outcome='+m.outcome);
  }
 }
 const pairs=[];
 for(const seed of seeds){
  const a=results.find(r=>r.seed===seed&&r.mode===MODES[0]);
  const b=results.find(r=>r.seed===seed&&r.mode===MODES[1]);
  pairs.push({seed,matchIdentical:JSON.stringify(a.snapshots)===JSON.stringify(b.snapshots),
   holdSamples:b.activeHoldSamples,deathDelta:b.redUnitsLost-a.redUnitsLost,
   outcomeChanged:b.outcome!==a.outcome,buildBudgetDelta:b.paidBuildCredits-a.paidBuildCredits,
   recruitBudgetDelta:b.paidRecruitCredits-a.paidRecruitCredits});
 }
 return {schemaVersion:1,kind:'read-only sampled opening signal audit',opponent,seeds,modes:MODES,
  samplesEverySeconds:3,pairs,results};
}
if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const opts=openingAuditOptions(process.argv.slice(2)),report=auditOpening(opts);
 const output=resolve(opts.output);mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log('AUDIT COMPLETE',JSON.stringify(report.pairs));
}
