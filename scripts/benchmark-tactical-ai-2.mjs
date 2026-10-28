#!/usr/bin/env node
/**
 * Honest A/B: identical actual game seed/map/opponent and normal production
 * economy. Only the director's tactical planning policy is switched.
 *
 * npm run build
 * node scripts/benchmark-tactical-ai-2.mjs --maps 3,4,5 --seeds 2026,42,77 \
 *   --seconds 900 --opponents guarded,rush,fortress --output /tmp/tactical-ab.json
 *
 * This is a simulation benchmark, not browser FPS, and does not certify wins
 * from timeout games. Do not compare unpaired seeds.
 */
import {performance} from 'node:perf_hooks';
import {resolve,dirname} from 'node:path';
import {mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,BUILDINGS} from '../dist/src/reborn/catalog.js';
import * as profiling from '../dist/src/reborn/performance.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {blueDefense} from './benchmark-ai-opponent.mjs';

function args(argv){
 const a={maps:[3,4,5],seeds:[2026,42,77],seconds:600,opponents:['guarded','rush','fortress'],output:null};
 for(let i=0;i<argv.length;i+=2){
  if(i+1>=argv.length)throw Error('Each argument needs a value: '+argv[i]);
  const flag=argv[i],value=argv[i+1];
  if(flag==='--maps')a.maps=value.split(',').map(Number);
  else if(flag==='--seeds')a.seeds=value.split(',').map(Number);
  else if(flag==='--seconds')a.seconds=Number(value);
  else if(flag==='--opponents')a.opponents=value.split(',');
  else if(flag==='--output')a.output=resolve(value);
  else throw Error('Unknown argument: '+flag);
 }
 if(a.maps.length<1||a.maps.length>3||a.maps.some(n=>![3,4,5].includes(n))||
  a.seeds.length<1||a.seeds.length>40||a.seeds.some(n=>!Number.isSafeInteger(n)||n<0||n>4294967295)||
  a.seconds<30||a.seconds>3600||!Number.isInteger(a.seconds)||
  a.opponents.length<1||a.opponents.some(n=>!['guarded','rush','fortress'].includes(n))||
  new Set(a.seeds).size!==a.seeds.length||new Set(a.maps).size!==a.maps.length||
  new Set(a.opponents).size!==a.opponents.length)throw Error('Invalid benchmark options');
 return a;
}
function findSite(g,kind,home){
 for(const r of [165,205,255,310,360])for(let n=0;n<16;n++){
  const angle=Math.PI*2*n/16,p={x:home.x+Math.cos(angle)*r,y:home.y+Math.sin(angle)*r};
  if(!g.buildError(0,kind,p))return p;
 }
 return null;
}
/** The defender buys everything; extra turrets cannot be spawned for free. */
export function fortress(g){
 blueDefense(g);
 if(g.time<50)return;
 const own=g.bases.filter(b=>b.owner===0&&b.hp>0),home=own.find(b=>b.kind==='headquarters'),
  worker=g.units.find(u=>u.owner===0&&u.kind==='engineer'&&u.hp>0);
 if(!home||!worker||worker.orders.some(o=>o.kind==='build')||own.some(b=>b.buildRemaining>0)||
  own.filter(b=>b.kind==='turret').length>=3||g.credits[0]<BUILDINGS.turret.cost)return;
 const p=findSite(g,'turret',home);if(p)g.build(0,'turret',p,[worker.id]);
}
/** A public-territory counterpush, with only paid soldiers and legal commands. */
export function rush(g){
 blueDefense(g);
 if(g.time<75)return;
 const red=g.territories.filter(t=>t.owner===1),base=g.bases.find(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0);
 if(!base||!red.length)return;
 red.sort((a,b)=>Math.hypot(a.point.x-base.x,a.point.y-base.y)-Math.hypot(b.point.x-base.x,b.point.y-base.y)||a.id-b.id);
 const goal=red[0].point;
 const fighters=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&['infantry','heavy'].includes(u.kind));
 const newOrders=fighters.filter(u=>!u.orders[0]||u.orders[0].kind!=='attackMove'||Math.hypot(u.orders[0].x-goal.x,u.orders[0].y-goal.y)>120);
 if(fighters.length>=3&&newOrders.length)g.command(newOrders.map(u=>u.id),{...goal,kind:'attackMove'});
}
const enemies={guarded:blueDefense,rush,fortress};
const average=(rows,key)=>rows.length?rows.reduce((n,row)=>n+(Number(row[key])||0),0)/rows.length:0;
const round=n=>Math.round(n*1000)/1000;
export function comparePairs(rows){
 const groups=new Map();
 for(const item of rows){
  const key=[item.mapVersion,item.seed,item.opponent].join(':');
  let group=groups.get(key);if(!group){group={};groups.set(key,group);}
  group[item.plannerMode]=item;
 }
 const pairs=[];
 for(const [key,group] of groups){
  if(!group.classic||!group.tactical)continue;
  const c=group.classic,t=group.tactical;
  if(c.initialStateHash!==t.initialStateHash)throw Error('A/B mismatch in initial playable game: '+key);
  pairs.push({key,seed:c.seed,mapVersion:c.mapVersion,opponent:c.opponent,initialStateHash:c.initialStateHash,
   classic:{win:c.win,loss:c.loss,timeout:!c.win&&!c.loss,score:c.score,captures:c.captures,blueUnitsLost:c.blueUnitsLost,redUnitsLost:c.redUnitsLost,hqDamage:c.enemyHQDamage,aborted:c.abortedMissions,stalled:c.stalledMissions,aiMeanMs:c.cpu.phases?.ai?.meanMs??null,diagnostics:c.tactical??null},
   tactical:{win:t.win,loss:t.loss,timeout:!t.win&&!t.loss,score:t.score,captures:t.captures,blueUnitsLost:t.blueUnitsLost,redUnitsLost:t.redUnitsLost,hqDamage:t.enemyHQDamage,aborted:t.abortedMissions,stalled:t.stalledMissions,aiMeanMs:t.cpu.phases?.ai?.meanMs??null,diagnostics:t.tactical??null},
   delta:{score:t.score-c.score,captures:t.captures-c.captures,blueUnitsLost:t.blueUnitsLost-c.blueUnitsLost,redUnitsLost:t.redUnitsLost-c.redUnitsLost,hqDamage:t.enemyHQDamage-c.enemyHQDamage,aborted:t.abortedMissions-c.abortedMissions,stalled:t.stalledMissions-c.stalledMissions,actualSquadOrders:(t.tactical?.screenOrders??0)+(t.tactical?.flankOrders??0)+(t.tactical?.issuedSieges??0)}});
 }
 return {pairs,summary:{matches:pairs.length,classicWins:pairs.filter(p=>p.classic.win).length,tacticalWins:pairs.filter(p=>p.tactical.win).length,
  meanScoreDelta:round(average(pairs.map(p=>p.delta),'score')),meanCapturesDelta:round(average(pairs.map(p=>p.delta),'captures')),
  meanHqDamageDelta:round(average(pairs.map(p=>p.delta),'hqDamage')),
  meanRedLossDelta:round(average(pairs.map(p=>p.delta),'redUnitsLost')),
  meanAbortedDelta:round(average(pairs.map(p=>p.delta),'aborted')),
  meanStalledDelta:round(average(pairs.map(p=>p.delta),'stalled')),
  meanNewSquadOrders:round(average(pairs.map(p=>p.delta),'actualSquadOrders')),
  observedForecasts:pairs.reduce((n,p)=>n+(p.tactical.diagnostics?.evaluated??0),0),
  flankGroups:pairs.reduce((n,p)=>n+(p.tactical.diagnostics?.flankGroups??0),0),
  screenOrders:pairs.reduce((n,p)=>n+(p.tactical.diagnostics?.screenOrders??0),0),
  siegeDelegations:pairs.reduce((n,p)=>n+(p.tactical.diagnostics?.delegatedSieges??0),0),
  siegeOrders:pairs.reduce((n,p)=>n+(p.tactical.diagnostics?.issuedSieges??0),0)}};
}
export async function main(argv=process.argv.slice(2)){
 const options=args(argv),started=performance.now(),details=[];
 const report={schemaVersion:1,description:'Paired, seeded, paid-for, actual simulation; timeout is not a win',
  ...options,completed:0,expected:options.maps.length*options.seeds.length*options.opponents.length*2,pairs:[],summary:{},runs:[]};
 function persist(){
  const pairs=comparePairs(details);
  report.completed=details.length;report.pairs=pairs.pairs;report.summary=pairs.summary;report.runs=details;
  if(options.output){mkdirSync(dirname(options.output),{recursive:true});const tmp=options.output+'.tmp';
   writeFileSync(tmp,JSON.stringify(report,null,2)+'\n');renameSync(tmp,options.output);}
 }
 persist();
 for(const mapVersion of options.maps)for(const seed of options.seeds)for(const opponent of options.opponents){
  for(const plannerMode of ['classic','tactical']){
   const result=runMatch({Simulation,UNITS,performanceModule:profiling},
    {seconds:options.seconds,opponent:'guarded',defender:enemies[opponent],plannerMode,label:plannerMode},seed,'director',mapVersion);
   details.push({...result,opponent,plannerMode});persist();
   console.log(plannerMode,'map',mapVersion,'seed',seed,opponent,'outcome',result.outcome,
    'captures',result.captures,'HQ dmg',round(result.enemyHQDamage),
    'losses',result.redUnitsLost,'screen',result.tactical?.screenOrders??0,
    'flank',result.tactical?.flankGroups??0,'forecast',result.tactical?.evaluated??0,
    'AI mean ms',round(result.cpu.phases?.ai?.meanMs??0));
  }
 }
 console.log('BENCHMARK COMPLETE',JSON.stringify({elapsedMs:Math.round(performance.now()-started),...report.summary}));
 return report;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
 await main();
