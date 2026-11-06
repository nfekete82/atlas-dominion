#!/usr/bin/env node
/**
 * Tactical AI 2.4 A/B versus 2.3. Both use the same tactical planner,
 * same world, same real paid units, and the same public Blue opposition.
 * Only the coordinated wave policy changes. A timeout is NOT a win.
 *
 * npm run build
 * node scripts/benchmark-tactical-ai-24.mjs --maps 4,5 --seeds 2026,42 \
 *   --seconds 300 --opponents guarded,fortress --output /tmp/sandforge-ai-24.json
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

const enemies={guarded:blueDefense,fortress,rush};
const round=v=>Math.round(v*1000)/1000;
export function parseArgs(args){
 const options={maps:[4,5],seeds:[2026,42],seconds:300,opponents:['guarded','fortress'],output:null};
 for(let i=0;i<args.length;i+=2){
  if(!args[i]?.startsWith('--')||!args[i+1])throw Error('Each option needs a value');
  const val=args[i+1];
  switch(args[i]){
   case '--maps':options.maps=val.split(',').map(Number);break;
   case '--seeds':options.seeds=val.split(',').map(Number);break;
   case '--seconds':options.seconds=Number(val);break;
   case '--opponents':options.opponents=val.split(',');break;
   case '--output':options.output=resolve(val);break;
   default:throw Error('Unknown benchmark flag '+args[i]);
  }
 }
 if(!options.maps.length||options.maps.some(v=>![3,4,5].includes(v))||new Set(options.maps).size!==options.maps.length||
 !options.seeds.length||options.seeds.some(v=>!Number.isSafeInteger(v)||v<0||v>4294967295)||
 new Set(options.seeds).size!==options.seeds.length||
 !Number.isInteger(options.seconds)||options.seconds<60||options.seconds>1800||
 !options.opponents.length||options.opponents.some(v=>!Object.hasOwn(enemies,v))||
 new Set(options.opponents).size!==options.opponents.length)throw Error('Invalid benchmark options');
 return options;
}
export function compareWaves(results){
 const groups=new Map();
 for(const r of results){
  const key=r.mapVersion+':'+r.seed+':'+r.opponent;
  const pair=groups.get(key)??{};pair[r.waveMode]=r;groups.set(key,pair);
 }
 const pairs=[];
 for(const [key,r] of groups){
  if(!r.legacy||!r.coordinated)continue;
  if(r.legacy.initialStateHash!==r.coordinated.initialStateHash)throw Error('Different initial world in '+key);
  const a=r.legacy,b=r.coordinated;
  pairs.push({key,mapVersion:a.mapVersion,seed:a.seed,opponent:a.opponent,initialStateHash:a.initialStateHash,
   legacy:{win:a.win,loss:a.loss,timeout:!a.win&&!a.loss,captures:a.captures,redLosses:a.redUnitsLost,hqDamage:a.enemyHQDamage,score:a.score,firstAttack:a.firstOrganizedAttack,paidRecruit:a.paidRecruitCredits,stalled:a.stalledMissions},
   coordinated:{win:b.win,loss:b.loss,timeout:!b.win&&!b.loss,captures:b.captures,redLosses:b.redUnitsLost,hqDamage:b.enemyHQDamage,score:b.score,firstAttack:b.firstOrganizedAttack,paidRecruit:b.paidRecruitCredits,stalled:b.stalledMissions,diagnostics:b.tactical},
   delta:{captures:b.captures-a.captures,redLosses:b.redUnitsLost-a.redUnitsLost,hqDamage:round(b.enemyHQDamage-a.enemyHQDamage),score:round(b.score-a.score),stalled:b.stalledMissions-a.stalledMissions}});
 }
 const avg=key=>pairs.length?round(pairs.reduce((sum,p)=>sum+p.delta[key],0)/pairs.length):0;
 return {pairs,summary:{matches:pairs.length,legacyWins:pairs.filter(p=>p.legacy.win).length,
  coordinatedWins:pairs.filter(p=>p.coordinated.win).length,meanCaptureDelta:avg('captures'),
  meanRedLossDelta:avg('redLosses'),meanHQDamageDelta:avg('hqDamage'),
  meanScoreDelta:avg('score'),meanStalledDelta:avg('stalled'),
  waveWaits:pairs.reduce((n,p)=>n+(p.coordinated.diagnostics?.waveWaits??0),0),
  coordinatedWaveLaunches:pairs.reduce((n,p)=>n+(p.coordinated.diagnostics?.waveLaunches??0),0),
  stagedReinforcements:pairs.reduce((n,p)=>n+(p.coordinated.diagnostics?.reinforcementStagingOrders??0),0)}};
}
export async function main(args=process.argv.slice(2)){
 const options=parseArgs(args),rows=[],start=performance.now();
 const report={schemaVersion:1,description:'same seed, world and paid RTS economy; only wave policy differs; timeout not victory',...options,completed:0,expected:options.maps.length*options.seeds.length*options.opponents.length*2,pairs:[],summary:{},runs:[]};
 const persist=()=>{
  const current=compareWaves(rows);Object.assign(report,{completed:rows.length,pairs:current.pairs,summary:current.summary,runs:rows});
  if(options.output){
   mkdirSync(dirname(options.output),{recursive:true});
   const tmp=options.output+'.tmp';writeFileSync(tmp,JSON.stringify(report,null,2)+'\n');renameSync(tmp,options.output);
  }
 };
 persist();
 for(const mapVersion of options.maps)for(const seed of options.seeds)for(const opponent of options.opponents)
 for(const waveMode of ['legacy','coordinated']){
  const r=runMatch({Simulation,UNITS,performanceModule:profiling},{
   seconds:options.seconds,opponent:'guarded',defender:enemies[opponent],
   plannerMode:'tactical',waveMode,label:'tactical-ai-24-'+waveMode
  },seed,'director',mapVersion);
  rows.push({...r,opponent,waveMode});persist();
  console.log(waveMode,mapVersion,seed,opponent,'score',r.score,'captures',r.captures,
   'redDeaths',r.redUnitsLost,'hqDamage',r.enemyHQDamage,'outcome',r.outcome);
 }
 console.log('AI 2.4 A/B COMPLETE',JSON.stringify({wallMs:round(performance.now()-start),...report.summary}));
 return report;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
