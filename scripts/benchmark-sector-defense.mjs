#!/usr/bin/env node
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {Simulation as Engine} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {blueDefense} from './benchmark-ai-opponent.mjs';

const flags=process.argv.slice(2);
const arg=(key,fallback)=>{const i=flags.indexOf('--'+key);return i<0?fallback:flags[i+1];};
const seeds=arg('seeds','2026,2027,2028,2029').split(',').map(Number),
 seconds=Number(arg('seconds','240')),opponent=arg('opponent','guarded'),
 output=resolve(arg('output','ai-arena-results/sector-defense.json'));
if(!['guarded','pressure'].includes(opponent)||!Number.isInteger(seconds)||seconds<60||seconds>900||
 seeds.length<1||seeds.length>16||seeds.some(s=>!Number.isSafeInteger(s)||s<0))throw Error('invalid parameters');
const pressure=g=>{
 blueDefense(g);
 if(g.status!=='playing'||g.time<55)return;
 const home=g.bases.find(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0);
 const targets=g.territories.filter(t=>t.owner!==0);
 if(!home||!targets.length)return;
 const army=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&['infantry','heavy'].includes(u.kind))
  .sort((a,b)=>a.id-b.id);
 if(army.length<3)return;
 targets.sort((a,b)=>(a.owner===1?0:240)+Math.hypot(a.point.x-home.x,a.point.y-home.y)-
   ((b.owner===1?0:240)+Math.hypot(b.point.x-home.x,b.point.y-home.y))||a.id-b.id);
 const goal=targets[0].point,units=army.slice(1).filter(u=>!u.orders.some(o=>o.kind==='attackMove'&&Math.hypot(o.x-goal.x,o.y-goal.y)<95));
 if(units.length)g.command(units.map(u=>u.id),{...goal,kind:'attackMove'});
};
const results=[];
for(const seed of seeds){
 let initial=null;
 for(const policy of ['classic','responsive','reserved']){
  class Variant extends Engine{
   constructor(seed,version){super(seed,version);this.tactical.sectorDefenseMode=policy;}
  }
  const m=runMatch({Simulation:Variant,UNITS},{seconds,opponent:'guarded',
    defender:opponent==='pressure'?pressure:undefined,label:policy},seed,'director',11);
  if(initial&&initial!==m.initialStateHash)throw Error('initial playable state mismatch');
  initial=m.initialStateHash;
  const row={seed,policy,outcome:m.outcome,captures:m.captures,netCaptures:m.netCaptures,
   redUnitsLost:m.redUnitsLost,enemyHQDamage:m.enemyHQDamage,redSectors:m.redSectors,
   blueUnitsLost:m.blueUnitsLost,firstAssault:m.firstAssault,
   abortedMissions:m.abortedMissions,reinforcements:m.reinforcements,wallMs:m.wallMs};
  results.push(row);
  console.log('seed='+seed+' policy='+policy+' outcome='+row.outcome+
   ' captures='+row.captures+' HQ='+row.enemyHQDamage+' losses='+row.redUnitsLost);
 }
}
const summary={};
for(const policy of ['classic','responsive','reserved']){
 const rows=results.filter(r=>r.policy===policy),avg=key=>rows.reduce((n,r)=>n+(Number(r[key])||0),0)/rows.length;
 summary[policy]={captures:avg('captures'),HQDamage:avg('enemyHQDamage'),deaths:avg('redUnitsLost'),
  blueDeaths:avg('blueUnitsLost'),wins:rows.filter(r=>r.outcome==='win').length,
  losses:rows.filter(r=>r.outcome==='loss').length,timeouts:rows.filter(r=>r.outcome==='timeout').length};
}
const report={opponent,seeds,seconds,mapVersion:11,summary,results,description:'Paired deterministic synthetic matches. A timeout is not a win. No player-skill inference.'};
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
