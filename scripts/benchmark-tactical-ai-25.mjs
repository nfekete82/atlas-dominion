#!/usr/bin/env node
/** Paired 2.4 vs 2.5 on identical paid games, map+seed+opponent.
 * A timeout is a timeout, not a win; compare measured results only.
 * No omniscient queries, hidden boosts, or free spawned players.
 */
import {performance} from 'node:perf_hooks';
import {resolve,dirname} from 'node:path';
import {mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import * as profiling from '../dist/src/reborn/performance.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {blueDefense} from './benchmark-ai-opponent.mjs';
import {fortress,rush} from './benchmark-tactical-ai-2.mjs';

const opponents={guarded:blueDefense,fortress,rush};
const round=v=>Math.round(v*1000)/1000;
export function parseArgs(args){
 const o={maps:[4,5],seeds:[2026,42],seconds:600,opponents:['guarded','fortress'],output:null};
 for(let i=0;i<args.length;i+=2){
  if(!args[i]?.startsWith('--')||!args[i+1])throw Error('Every flag needs a value');
  const value=args[i+1];
  switch(args[i]){
   case '--maps':o.maps=value.split(',').map(Number);break;
   case '--seeds':o.seeds=value.split(',').map(Number);break;
   case '--seconds':o.seconds=Number(value);break;
   case '--opponents':o.opponents=value.split(',');break;
   case '--output':o.output=resolve(value);break;
   default:throw Error('Unknown flag '+args[i]);
  }
 }
 if(!o.maps.length||o.maps.some(x=>![3,4,5].includes(x))||new Set(o.maps).size!==o.maps.length
  ||!o.seeds.length||o.seeds.some(x=>!Number.isSafeInteger(x)||x<0||x>4294967295)||new Set(o.seeds).size!==o.seeds.length
  ||!Number.isInteger(o.seconds)||o.seconds<60||o.seconds>1800
  ||!o.opponents.length||o.opponents.some(x=>!Object.hasOwn(opponents,x))||new Set(o.opponents).size!==o.opponents.length)
  throw Error('Invalid AI 2.5 benchmark options');
 return o;
}
export function compareDoctrines(rows){
 const byPair=new Map();
 for(const r of rows){
  const key=r.mapVersion+':'+r.seed+':'+r.opponent;
  const pair=byPair.get(key)??{};
  pair[r.doctrineMode]=r;byPair.set(key,pair);
 }
 const pairs=[];
 for(const [key,row] of byPair){
  if(!row.legacy||!row.intelligent)continue;
  const a=row.legacy,b=row.intelligent;
  if(a.initialStateHash!==b.initialStateHash)throw Error('Paired starting worlds differ: '+key);
  pairs.push({key,mapVersion:a.mapVersion,seed:a.seed,opponent:a.opponent,
   initialStateHash:a.initialStateHash,
   ai24:{win:a.win,loss:a.loss,timeout:!a.win&&!a.loss,captures:a.captures,redLosses:a.redUnitsLost,
    hqDamage:a.enemyHQDamage,towersKilled:a.enemyTowersDestroyed,score:a.score,
    paidRecruits:a.paidRecruitCredits,stalledMissions:a.stalledMissions},
   ai25:{win:b.win,loss:b.loss,timeout:!b.win&&!b.loss,captures:b.captures,redLosses:b.redUnitsLost,
    hqDamage:b.enemyHQDamage,towersKilled:b.enemyTowersDestroyed,score:b.score,
    paidRecruits:b.paidRecruitCredits,stalledMissions:b.stalledMissions,
    siegeAngles:b.tactical?.siegeAngles??0,secondaryRaids:b.tactical?.secondaryRaids??0,
    raidOrders:b.tactical?.secondaryRaidOrders??0},
   difference:{captured:b.captures-a.captures,losses:b.redUnitsLost-a.redUnitsLost,
    hqDamage:b.enemyHQDamage-a.enemyHQDamage,towerKills:b.enemyTowersDestroyed-a.enemyTowersDestroyed,
    score:b.score-a.score,stalled:b.stalledMissions-a.stalledMissions}});
 }
 const avg=key=>pairs.length?round(pairs.reduce((sum,p)=>sum+p.difference[key],0)/pairs.length):0;
 return {pairs,summary:{pairs:pairs.length,
  ai24Wins:pairs.filter(p=>p.ai24.win).length,ai25Wins:pairs.filter(p=>p.ai25.win).length,
  avgCaptures:avg('captured'),avgLosses:avg('losses'),avgHQDamage:avg('hqDamage'),
  avgTowerKills:avg('towerKills'),avgScore:avg('score'),avgStalled:avg('stalled'),
  siegeAngles:pairs.reduce((n,p)=>n+p.ai25.siegeAngles,0),
  raids:pairs.reduce((n,p)=>n+p.ai25.secondaryRaids,0),
  raidOrders:pairs.reduce((n,p)=>n+p.ai25.raidOrders,0)}};
}
export async function main(args=process.argv.slice(2)){
 const options=parseArgs(args),rows=[],started=performance.now();
 const report={schemaVersion:1,description:'paid real simulation, exact starting-world SHA pair, no timeout wins; only doctrineMode varies',...options,
  completed:0,expected:options.maps.length*options.seeds.length*options.opponents.length*2,runs:[],pairs:[],summary:{}};
 const save=()=>{
  const {pairs,summary}=compareDoctrines(rows);Object.assign(report,{completed:rows.length,runs:rows,pairs,summary});
  if(options.output){
   mkdirSync(dirname(options.output),{recursive:true});
   const tmp=options.output+'.tmp';writeFileSync(tmp,JSON.stringify(report,null,2)+'\n');renameSync(tmp,options.output);
  }
 };
 save();
 for(const mapVersion of options.maps)for(const seed of options.seeds)for(const opponent of options.opponents)
  for(const doctrineMode of ['legacy','intelligent']){
   const r=runMatch({Simulation,UNITS,performanceModule:profiling},
    {seconds:options.seconds,opponent:'guarded',defender:opponents[opponent],
     plannerMode:'tactical',waveMode:'coordinated',doctrineMode,label:'ai25-'+doctrineMode},seed,'director',mapVersion);
   rows.push({...r,opponent,doctrineMode});save();
   console.log(doctrineMode,'map',mapVersion,'seed',seed,opponent,
    'wins',r.win,'score',r.score,'captures',r.captures,'redLosses',r.redUnitsLost,
    'towerKills',r.enemyTowersDestroyed,'hqDamage',r.enemyHQDamage);
  }
 console.log('TACTICAL AI 2.5 PAIRED COMPARISON',JSON.stringify({elapsedWallMs:round(performance.now()-started),...report.summary}));
 return report;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
