#!/usr/bin/env node
/** Paired paid-opponent A/B. Example: node scripts/benchmark-titan.mjs --before /tmp/atlas-titan-baseline/dist/src/reborn/simulation.js --profiles infantry,armor --maps 4 --seeds 2026 --seconds 900 --output /tmp/titan.json */
import {runMatch,summarize} from './benchmark-reborn-ai.mjs';
import {rushPolicy} from './tower-rush-opponent.mjs';
import {adaptiveOpponent,TITAN_PROFILES} from './adaptive-opponents.mjs';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,renameSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
const hash=x=>createHash('sha256').update(x).digest('hex');
export function parseTitanOptions(argv){
 const v={};for(let i=0;i<argv.length;i+=2){const k=argv[i]?.slice(2);if(!argv[i]?.startsWith('--')||!['before','after','profiles','maps','seeds','seconds','only','output'].includes(k)||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Unknown or incomplete option: '+argv[i]);v[k]=argv[i+1];}
 const o={before:v.before?resolve(v.before):null,after:resolve(v.after??'dist/src/reborn/simulation.js'),profiles:(v.profiles??TITAN_PROFILES.join(',')).split(','),maps:(v.maps??'3,4,5').split(',').map(Number),seeds:(v.seeds??'2026').split(',').map(Number),seconds:Number(v.seconds??900),only:v.only??null,output:v.output?resolve(v.output):null};
 if(!o.before||o.profiles.some(p=>!TITAN_PROFILES.includes(p))||o.maps.some(v=>![3,4,5].includes(v))||!o.seeds.length||o.seeds.length>24||o.seeds.some(v=>!Number.isSafeInteger(v)||v<0||v>4294967295)||!Number.isInteger(o.seconds)||o.seconds<30||o.seconds>3600||o.only&&!['before','after'].includes(o.only)||[o.profiles,o.maps,o.seeds].some(a=>new Set(a).size!==a.length))throw Error('Invalid Titan benchmark options');return o;
}
async function loadModel(path){const url=pathToFileURL(path),catalogURL=new URL('./catalog.js',url);return {...await import(url.href),...await import(catalogURL.href),performanceModule:await import(new URL('./performance.js',url).href),hashes:{simulation:hash(readFileSync(url)),catalog:hash(readFileSync(catalogURL)),moduleGraph:hash(JSON.stringify(readdirSync(dirname(path)).filter(n=>n.endsWith('.js')).sort().map(n=>[n,hash(readFileSync(resolve(dirname(path),n)))]))) }};}
export async function main(argv){
 const options=parseTitanOptions(argv),models={before:await loadModel(options.before),after:await loadModel(options.after)};
 if(JSON.stringify([models.before.UNITS,models.before.BUILDINGS])!==JSON.stringify([models.after.UNITS,models.after.BUILDINGS]))throw Error('Unequal prices or unit/building stats');
 const labels=options.only?[options.only]:['before','after'];
 const report={schemaVersion:1,options,modules:Object.fromEntries(Object.entries(models).map(([k,m])=>[k,{path:options[k],...m.hashes}])),observerHash:hash(readFileSync(new URL('./benchmark-reborn-ai.mjs',import.meta.url))),opponentHash:hash(readFileSync(new URL('./adaptive-opponents.mjs',import.meta.url))),towerPolicyHash:hash(readFileSync(new URL('./tower-rush-opponent.mjs',import.meta.url))),rules:{timestep:.05,credits:950,fog:'normal; actors use own/visible entities, remembered buildings and public sectors',mode:'director',selfPlay:'Independent BLUE public-API actor. Full Commander is hardcoded to RED faction 1; symmetric self-play requires source generalization and is not claimed.'},expectedRuns:options.profiles.length*options.maps.length*options.seeds.length*labels.length,completedRuns:0,complete:false,details:[],summary:{}};
 const persist=()=>{report.completedRuns=report.details.length;report.complete=report.completedRuns===report.expectedRuns;report.summary=Object.fromEntries(options.profiles.map(p=>[p,summarize(report.details.filter(r=>r.profile===p).map(r=>({...r,mode:r.label})))]));if(options.output){mkdirSync(dirname(options.output),{recursive:true});writeFileSync(options.output+'.tmp',JSON.stringify(report,null,2)+'\n');renameSync(options.output+'.tmp',options.output);}};persist();
 for(const profile of options.profiles)for(const map of options.maps)for(const seed of options.seeds)for(const label of labels){
  const m=models[label],opponentMetrics={};let defender;
  if(profile.startsWith('tower')){Object.assign(opponentMetrics,{towersOrdered:0,blueTowerCredits:0,peakTowers:0,allTowersReadyAt:null,turretHits:0,turretDamage:0,immediateResponses:0,responseLatency:[]});defender=rushPolicy(Number(profile.slice(5)),opponentMetrics,m.UNITS);}else defender=adaptiveOpponent(profile,opponentMetrics,m);
  const result=runMatch(m,{seconds:options.seconds,label,opponent:'guarded',defender},seed,'director',map);delete opponentMetrics.initialized;result.profile=profile;result.actor=opponentMetrics;
  const births=result.blueProducedByKind;
  result.strategyRealized=profile.startsWith('tower')?opponentMetrics.peakTowers>=Number(profile.slice(5)):profile==='armor'?(births.tank??0)>0:profile==='combined'?['bomber'].some(k=>(births[k]??0)>0)&&['infantry','tank','rover'].some(k=>(births[k]??0)+(result.initialComposition.blue[k]??0)>0):profile==='expansion'?(opponentMetrics.paidBuildings.generator??0)>=3:profile==='fortress'?opponentMetrics.peakTowers>=4:profile==='attrition'?opponentMetrics.peakTowers>=2:(births.infantry??0)>=3;
  const other=report.details.find(r=>r.profile===profile&&r.mapVersion===map&&r.seed===seed);if(other&&other.initialStateHash!==result.initialStateHash)throw Error('Unequal initial worlds');
  report.details.push(result);persist();console.log(label,profile,'map='+map,'seed='+seed,result.outcome,'seconds='+result.elapsedSeconds,'losses='+result.redUnitsLost,'births='+JSON.stringify(result.redProducedByKind),'opponentBirths='+JSON.stringify(result.blueProducedByKind),'p95='+result.cpu.stepMs.p95.toFixed(3));
 }
 return report;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main(process.argv.slice(2));
