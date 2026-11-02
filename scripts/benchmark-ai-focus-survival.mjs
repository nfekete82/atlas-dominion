#!/usr/bin/env node
/** Paired deterministic comparison vs unchanged budget-constrained BLUE.
 * Same initial state / seeds and legal unit APIs; timeouts are not victories.
 * Player is never given altered stats, resources or hidden information. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {Simulation as Engine} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {bluePressure} from './benchmark-blue-pressure.mjs';

const variants=[
 ['classic','classic','classic'],
 ['focus','coordinated','classic'],
 ['focus-survival','coordinated','adaptive']
];
const read=(key,fallback)=>{const i=process.argv.indexOf('--'+key);return i<0?fallback:process.argv[i+1];};
const seeds=read('seeds','2026,2027,2028,2029').split(',').map(Number),
 seconds=Number(read('seconds','240')),
 output=resolve(read('output','ai-arena-results/focus-survival.json'));
const opponent=read('opponent','guarded');
if(!['guarded','pressure'].includes(opponent))throw Error('unknown opponent');
if(seeds.length<1||seeds.length>16||seeds.some(x=>!Number.isSafeInteger(x)||x<0)||
 seconds<60||seconds>900||!Number.isInteger(seconds))throw Error('invalid benchmark settings');

const results=[];
for(const seed of seeds){
 let initial=null;
 for(const [label,focus,survival] of variants){
  class AB extends Engine{
   constructor(seed,version){
    super(seed,version);
    this.tactical.focusMode=focus;
    this.tactical.survivalMode=survival;
   }
  }
  const m=runMatch({Simulation:AB,UNITS},{seconds,opponent:'guarded',label,defender:opponent==='pressure'?bluePressure:undefined},seed,'director',11);
  if(initial&&initial!==m.initialStateHash)throw Error('A/B initial state changed');
  initial=m.initialStateHash;
  results.push({seed,label,initialHash:initial,outcome:m.outcome,elapsedSeconds:m.elapsedSeconds,
   captures:m.captures,netCaptures:m.netCaptures,enemyHQDamage:m.enemyHQDamage,
   redUnitsLost:m.redUnitsLost,blueUnitsLost:m.blueUnitsLost,
   redSectors:m.redSectors,firstAssault:m.firstAssault,abortedMissions:m.abortedMissions,
   redCredits:m.redCredits,paidRecruitCredits:m.paidRecruitCredits,
   wallMs:m.wallMs});
  console.log('seed='+seed+' policy='+label+' outcome='+m.outcome+' captures='+m.captures+
   ' HQdamage='+m.enemyHQDamage+' deaths='+m.redUnitsLost+' firstAssault='+m.firstAssault);
 }
}
const avg=(rows,key)=>rows.reduce((n,r)=>n+(Number(r[key])||0),0)/Math.max(1,rows.length);
const summary={};
for(const [label] of variants){
 const rows=results.filter(r=>r.label===label);
 summary[label]={avgCaptures:avg(rows,'captures'),avgHQDamage:avg(rows,'enemyHQDamage'),
  avgDeaths:avg(rows,'redUnitsLost'),avgEnemyLosses:avg(rows,'blueUnitsLost'),
  wins:rows.filter(r=>r.outcome==='win').length,
  losses:rows.filter(r=>r.outcome==='loss').length,
  timeouts:rows.filter(r=>r.outcome==='timeout').length};
}
const report={description:'Paired RED AI headless evaluation versus budget-constrained scripted BLUE, not human skill rating',
 mapVersion:11,seeds,seconds,opponent,summary,results};
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));console.log('Report: '+output);
