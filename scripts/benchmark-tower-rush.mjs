#!/usr/bin/env node
/** Paid early tower emplacements at the front edge of BLUE's real territory.
 * No units/buildings/resources/fog are injected. Both commits face this exact
 * policy, including identical ordinary defensive recruitment after construction. */
import {rushPolicy} from './tower-rush-opponent.mjs';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {pathToFileURL} from 'node:url';
import {resolve,dirname,join} from 'node:path';
import {writeFileSync,mkdirSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const flags=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>i%2?a:[...a,[v.slice(2),all[i+1]]],[]));
const counts=(flags.towers??'1,3,6').split(',').map(Number),seeds=(flags.seeds??'2026,2027').split(',').map(Number),seconds=Number(flags.seconds??900),map=Number(flags.map??4);
if(counts.some(n=>![1,3,6].includes(n))||seeds.some(n=>!Number.isSafeInteger(n)||n<0)||!Number.isInteger(seconds)||seconds<30||seconds>1800||![3,4,5].includes(map)||!flags.before)throw Error('Use --before path [--towers 1,3,6 --seeds 2026,2027 --seconds 900 --map 4 --output file]');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function model(path){const p=resolve(path);return {...await import(pathToFileURL(p).href),...await import(pathToFileURL(join(dirname(p),'catalog.js')).href),performanceModule:await import(pathToFileURL(join(dirname(p),'performance.js')).href)};}
const models={before:await model(flags.before),after:await model(flags.after??'dist/src/reborn/simulation.js')};
if(hash([models.before.UNITS,models.before.BUILDINGS])!==hash([models.after.UNITS,models.after.BUILDINGS]))throw Error('Unequal prices or stats');
const report={reference:resolve(flags.before),candidate:resolve(flags.after??'dist/src/reborn/simulation.js'),map,seeds,seconds,counts,complete:false,details:[]};
const persist=()=>{if(flags.output){mkdirSync(dirname(resolve(flags.output)),{recursive:true});writeFileSync(flags.output,JSON.stringify(report,null,2)+'\n');}};persist();
for(const towers of counts)for(const seed of seeds)for(const [label,m] of Object.entries(models).filter(([label])=>!flags.only||label===flags.only)){
 const rush={towersOrdered:0,blueTowerCredits:0,peakTowers:0,allTowersReadyAt:null,turretHits:0,turretDamage:0,immediateResponses:0,responseLatency:[]};
 let nextTrace=30;const observe=flags.trace?g=>{if(g.time<nextTrace)return;nextTrace+=30;appendFileSync(flags.trace,JSON.stringify({time:Math.round(g.time),battle:g.tactical.state.battle,phase:g.tactical.state.phase,rally:g.tactical.state.rally,mission:g.tactical.state.commander?.mission,group:g.tactical.state.group,units:g.units.filter(u=>u.owner===1).map(u=>({id:u.id,kind:u.kind,hp:Math.round(u.hp),x:Math.round(u.x),y:Math.round(u.y),orders:u.orders}))})+'\n');}:undefined;
 const result=runMatch(m,{seconds,opponent:'guarded',label,defender:rushPolicy(towers,rush,m.UNITS),observe},seed,'director',map);
 delete rush.initialized;result.rush={...rush,turretDamage:Number(rush.turretDamage.toFixed(2))};result.towers=towers;
 const other=report.details.find(r=>r.seed===seed&&r.towers===towers);if(other&&other.initialStateHash!==result.initialStateHash)throw Error('Unequal initial worlds');
 report.details.push(result);persist();console.log(label,'towers',towers,'seed',seed,result.outcome,result.elapsedSeconds,'losses',result.redUnitsLost,'towerDamage',rush.turretDamage.toFixed(0),'ready',rush.peakTowers,'HQ',result.enemyHQDamage);
}
report.complete=true;persist();
