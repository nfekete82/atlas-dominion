#!/usr/bin/env node
/** Paired *four-bastion* benchmark: same seed, opponent, map, resources, game
 * engine. Only the opening-policy switch differs, never extra AI money/HP.
 * Guarded BLUE is a scripted opponent, NOT a human-win-rate estimate.
 * Timeout is not a win. Keep absolute results and per-seed differences.
 */
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {Simulation as RealSimulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
const argv=process.argv.slice(2);
function arg(key,defaultValue){const i=argv.indexOf('--'+key);return i<0?defaultValue:argv[i+1];}
const seconds=Number(arg('seconds','240'));
const seeds=String(arg('seeds','2026,2027,2028,2029')).split(',').map(Number);
const path=resolve(String(arg('output','ai-arena-results/four-bastion-opening.json')));
if(!Number.isInteger(seconds)||seconds<90||seconds>900||seeds.length<1||seeds.length>16||
 seeds.some(n=>!Number.isSafeInteger(n)||n<0)||new Set(seeds).size!==seeds.length)
 throw Error('Bad benchmark arguments');
const config={seconds,opponent:'guarded',label:'four-bastion-opening-ab'};
const measurements=[];
for(const seed of seeds){
 const pair={seed,initialHash:null,classic:null,responsive:null};
 for(const tempo of ['classic','responsive']){
  class PolicySimulation extends RealSimulation{
   constructor(seed,version){super(seed,version);this.smallMapTempo=tempo;}
  }
  const result=runMatch({Simulation:PolicySimulation,UNITS},config,seed,'director',11);
  if(pair.initialHash&&pair.initialHash!==result.initialStateHash)
   throw Error('A/B variants changed initial game state!');
  pair.initialHash=result.initialStateHash;
  const metrics={
   outcome:result.outcome,elapsedSeconds:result.elapsedSeconds,
   captures:result.captures,netCaptures:result.netCaptures,
   redSectors:result.redSectors,enemyHQDamage:result.enemyHQDamage,
   firstAssault:result.firstAssault,
   firstFactory:result.firstFactory,
   redUnitsLost:result.redUnitsLost,peakArmy:result.peakArmy,
   abortedMissions:result.abortedMissions,
   paidRecruitCredits:result.paidRecruitCredits,paidBuildCredits:result.paidBuildCredits,
   wallMs:result.wallMs
  };
  pair[tempo]=metrics;
  console.log(`seed=${seed} tempo=${tempo} outcome=${metrics.outcome} captures=${metrics.captures} firstAssault=${metrics.firstAssault} HQdmg=${metrics.enemyHQDamage}`);
 }
 measurements.push(pair);
}
const avg=(mode,key)=>measurements.reduce((sum,p)=>sum+(Number(p[mode][key])||0),0)/measurements.length;
const summary={seeds:seeds.length,
 classic:{avgCaptures:avg('classic','captures'),avgHQDamage:avg('classic','enemyHQDamage'),avgRedLosses:avg('classic','redUnitsLost'),wins:measurements.filter(p=>p.classic.outcome==='win').length},
 responsive:{avgCaptures:avg('responsive','captures'),avgHQDamage:avg('responsive','enemyHQDamage'),avgRedLosses:avg('responsive','redUnitsLost'),wins:measurements.filter(p=>p.responsive.outcome==='win').length}};
summary.deltas={captures:summary.responsive.avgCaptures-summary.classic.avgCaptures,
 hqDamage:summary.responsive.avgHQDamage-summary.classic.avgHQDamage,
 redLosses:summary.responsive.avgRedLosses-summary.classic.avgRedLosses};
const report={description:'Paired guarded BLUE synthetic opponent, not a human match prediction',
 mapVersion:11,seconds,seeds,summary,measurements};
mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
console.log('Saved '+path);
