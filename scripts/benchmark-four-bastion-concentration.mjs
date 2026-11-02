#!/usr/bin/env node
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {Simulation as Engine} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {bluePressure} from './benchmark-compact-blue-pressure.mjs';

const read=(k,fallback)=>{const i=process.argv.indexOf('--'+k);return i<0?fallback:process.argv[i+1];};
const seeds=read('seeds','2026,2027,2028,2029').split(',').map(Number);
const seconds=Number(read('seconds','240')),opponent=read('opponent','pressure');
const output=resolve(read('output','ai-arena-results/compact-front.json'));
if(!['guarded','pressure'].includes(opponent)||seeds.length<1||seeds.length>16||
 seconds<60||seconds>900||!Number.isInteger(seconds)||
 seeds.some(n=>!Number.isSafeInteger(n)||n<0))throw Error('invalid benchmark arguments');
const modes=['classic','tempo-only','concentrated','sector-defense','sector-priority','tempo-sector','fortify-early'],results=[];
for(const seed of seeds){
 let initial=null;
 for(const policy of modes){
  class AB extends Engine{
   constructor(seed,version){super(seed,version);this.tactical.frontDoctrine=policy;}
  }
  const m=runMatch({Simulation:AB,UNITS},{
   seconds,label:policy,opponent:'guarded',
   ...(opponent==='pressure'?{defender:bluePressure}:{})
  },seed,'director',11);
  if(initial!==null&&initial!==m.initialStateHash)throw Error('different A/B initial worlds');
  initial=m.initialStateHash;
  const row={seed,policy,outcome:m.outcome,sectorCaptures:m.captures,netCaptures:m.netCaptures,
   heldSectors:m.redSectors,enemyHQDamage:m.enemyHQDamage,
   redLosses:m.redUnitsLost,enemyLosses:m.blueUnitsLost,
   redCredits:m.redCredits,firstAssault:m.firstAssault,
   reinforcements:m.reinforcements,abortedMissions:m.abortedMissions,
   retreatCount:m.battleRetreats,paidBuildCredits:m.paidBuildCredits,paidRecruitCredits:m.paidRecruitCredits,
   elapsedSeconds:m.elapsedSeconds};
  console.log('seed='+seed+' mode='+policy+' outcome='+row.outcome+' captures='+row.sectorCaptures+
   ' net='+row.netCaptures+' HQdmg='+row.enemyHQDamage+' losses='+row.redLosses);
  results.push(row);
 }
}
const summary={};
for(const policy of modes){
 const rows=results.filter(r=>r.policy===policy),
 avg=key=>rows.reduce((n,r)=>n+(Number(r[key])||0),0)/rows.length;
 summary[policy]={captures:avg('sectorCaptures'),netCaptures:avg('netCaptures'),
  heldSectors:avg('heldSectors'),hqDamage:avg('enemyHQDamage'),
  deaths:avg('redLosses'),enemyDeaths:avg('enemyLosses'),
  wins:rows.filter(r=>r.outcome==='win').length,
  defeats:rows.filter(r=>r.outcome==='loss').length,
  timeouts:rows.filter(r=>r.outcome==='timeout').length};
}
const report={warning:'Synthetic scripted BLUE opponent, not human win-rate evidence; timeouts are incomplete',mapVersion:11,seeds,seconds,opponent,summary,results};
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));console.log('saved '+output);
