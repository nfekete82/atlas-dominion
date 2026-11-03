#!/usr/bin/env node
/**
 * Sandforge four-bastion strategy league.
 * Fixed, paired seeds + multiple paid scripted BLUE strategies. A draw at
 * the horizon remains a timeout, NEVER a win. A/B starting states are hashed
 * by the existing observer; no gameplay parameters or fog are modified.
 */
import {mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {OPPONENTS,scriptedBlueTurn} from './ai-tournament-opponents.mjs';

export const CONTENDERS=Object.freeze(['current','legacy-wave','legacy-doctrine','baseline',
 'legacy-mission','no-side-raids','legacy-mission-no-raids','legacy-siege']);
export function tournamentOptions(argv){
 const flags={};
 for(let i=0;i<argv.length;i+=2){
  if(!argv[i]?.startsWith('--')||argv[i+1]===undefined)throw Error('Expected --key value');
  const key=argv[i].slice(2);
  if(!['seeds','seconds','opponents','contenders','output'].includes(key)||key in flags)throw Error('Invalid flag: '+key);
  flags[key]=argv[i+1];
 }
 const seeds=(flags.seeds??'2026,2027,2028,2029').split(',').map(Number),
  seconds=Number(flags.seconds??360),
  opponents=(flags.opponents??OPPONENTS.join(',')).split(','),
  contenders=(flags.contenders??CONTENDERS.join(',')).split(','),
  output=resolve(flags.output??'ai-arena-results/strategy-tournament.json');
 if(seeds.length<1||seeds.length>32||new Set(seeds).size!==seeds.length||
  seeds.some(v=>!Number.isSafeInteger(v)||v<0||v>4294967295)||
  !Number.isInteger(seconds)||seconds<120||seconds>1200||
  opponents.length<1||new Set(opponents).size!==opponents.length||
  opponents.some(v=>!OPPONENTS.includes(v))||
  contenders.length<2||!contenders.includes('current')||new Set(contenders).size!==contenders.length||
  contenders.some(v=>!CONTENDERS.includes(v)))throw Error('Invalid tournament configuration');
 return {seeds,seconds,opponents,contenders,output};
}
export function configureContender(tactical,name){
 if(!CONTENDERS.includes(name))throw Error('Unknown strategy: '+name);
 tactical.mode=name==='baseline'?'baseline':'director';
 if(name==='legacy-wave')tactical.waveMode='legacy';
 if(name==='legacy-doctrine')tactical.doctrineMode='legacy';
 if(name==='legacy-mission'||name==='legacy-mission-no-raids')tactical.missionPlannerMode='legacy';
 if(name==='no-side-raids'||name==='legacy-mission-no-raids')tactical.raidDetachmentMode='off';
 if(name==='legacy-siege')tactical.siegeEvaluationMode='legacy';
}
/** Independent, auditable metrics. Do not call a draw a victory, and do not
 * treat a tiny tie-breaker difference as evidence of a superior strategy. */
export function summarizeTournament(results,contenders,opponents,seeds){
 const matrix={},leaderboard=[];
 const average=(rows,key)=>rows.reduce((s,r)=>s+(Number(r[key])||0),0)/Math.max(1,rows.length);
 for(const strategy of contenders){
  const subset=results.filter(r=>r.strategy===strategy);
  const wins=subset.filter(r=>r.outcome==='win').length,
   losses=subset.filter(r=>r.outcome==='loss').length,
   draws=subset.filter(r=>r.outcome==='timeout').length;
  // One point per actual win, half a point for a timeout, none for a loss.
  const row={strategy,matches:subset.length,wins,losses,timeouts:draws,
   matchPoints:wins+.5*draws,winRate:wins/subset.length,
   avgCaptures:average(subset,'captures'),avgNetCaptures:average(subset,'netCaptures'),
   avgDeaths:average(subset,'redUnitsLost'),avgEnemyKills:average(subset,'blueUnitsLost'),
   avgEnemyHQDamage:average(subset,'enemyHQDamage'),avgRedSectors:average(subset,'redSectors'),
   avgAbortedMissions:average(subset,'abortedMissions')};
  leaderboard.push(row);
  matrix[strategy]=Object.fromEntries(opponents.map(op=>{
   const matches=subset.filter(r=>r.opponent===op);
   return [op,{wins:matches.filter(x=>x.outcome==='win').length,
    losses:matches.filter(x=>x.outcome==='loss').length,
    timeouts:matches.filter(x=>x.outcome==='timeout').length,
    captures:average(matches,'captures'),redLosses:average(matches,'redUnitsLost')}];
  }));
 }
 leaderboard.sort((a,b)=>b.matchPoints-a.matchPoints||
  b.avgNetCaptures-a.avgNetCaptures||a.avgDeaths-b.avgDeaths||a.strategy.localeCompare(b.strategy));
 const reference=results.filter(x=>x.strategy==='current'),comparisons={};
 for(const strategy of contenders.filter(x=>x!=='current')){
  const paired=[];
  for(const opponent of opponents)for(const seed of seeds){
   const baseline=reference.find(r=>r.opponent===opponent&&r.seed===seed);
   const candidate=results.find(r=>r.opponent===opponent&&r.seed===seed&&r.strategy===strategy);
   if(!baseline||!candidate)throw Error('Unpaired tournament match');
   if(baseline.initialStateHash!==candidate.initialStateHash)throw Error('A/B initial state changed!');
   paired.push({seed,opponent,deltaCaptures:candidate.captures-baseline.captures,
    deltaDeaths:candidate.redUnitsLost-baseline.redUnitsLost,
    changedOutcome:candidate.outcome!==baseline.outcome,
    baselineOutcome:baseline.outcome,candidateOutcome:candidate.outcome});
  }
  comparisons[strategy]={
   improvedOutcomes:paired.filter(r=>r.baselineOutcome!=='win'&&r.candidateOutcome==='win').length,
   degradedOutcomes:paired.filter(r=>r.baselineOutcome==='win'&&r.candidateOutcome!=='win'||r.baselineOutcome!=='loss'&&r.candidateOutcome==='loss').length,
   avgCaptureDelta:average(paired,'deltaCaptures'),avgDeathDelta:average(paired,'deltaDeaths'),
   paired};
 }
 const decisives=results.filter(r=>r.outcome!=='timeout').length;
 return {leaderboard,matrix,comparisons,decisiveMatches:decisives,
  hasDecisiveEvidence:decisives>=Math.max(4,Math.ceil(results.length*.25)),
  championApproved:false,
  reason:'League ranking is descriptive only. No auto-promotion without enough decisive matches and held-out confirmation.'};
}
function persist(output,report){
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output+'.tmp',JSON.stringify(report,null,2)+'\n');
 renameSync(output+'.tmp',output);
}
export function runTournament(opts){
 const expected=opts.seeds.length*opts.opponents.length*opts.contenders.length;
 const report={schemaVersion:1,kind:'Sandforge four-bastion strategy tournament',
  disclaimer:'Scripted BLUE opponents, not human win rates; timed out matches are draws; no auto-promotion.',
  mapVersion:11,seconds:opts.seconds,seeds:opts.seeds,opponents:opts.opponents,contenders:opts.contenders,
  expected,completed:0,complete:false,results:[],analysis:null};
 persist(opts.output,report);
 for(const opponent of opts.opponents)for(const seed of opts.seeds){
  let hash=null;
  for(const strategy of opts.contenders){
   class TournamentSimulation extends Simulation{
    constructor(...args){super(...args);configureContender(this.tactical,strategy);}
   }
   const m=runMatch({Simulation:TournamentSimulation,UNITS},
    {seconds:opts.seconds,opponent:'guarded',label:strategy,defender:g=>scriptedBlueTurn(g,opponent)},
    seed,strategy==='baseline'?'baseline':'director',11);
   if(hash!==null&&hash!==m.initialStateHash)throw Error('Tournament initial-state integrity failure');
   hash=m.initialStateHash;
   const row={opponent,seed,strategy,initialStateHash:hash,outcome:m.outcome,
    elapsedSeconds:m.elapsedSeconds,captures:m.captures,netCaptures:m.netCaptures,
    redUnitsLost:m.redUnitsLost,blueUnitsLost:m.blueUnitsLost,
    redSectors:m.redSectors,enemyHQDamage:m.enemyHQDamage,
    abortedMissions:m.abortedMissions,redCredits:m.redCredits,
    paidRecruitCredits:m.paidRecruitCredits,paidBuildCredits:m.paidBuildCredits,
    bluePaidRecruitCredits:m.bluePaidRecruitCredits,bluePaidBuildCredits:m.bluePaidBuildCredits,
    wallMs:m.wallMs};
   report.results.push(row);report.completed++;
   persist(opts.output,report);
   console.log('match '+report.completed+'/'+expected,opponent,seed,strategy,
    row.outcome,'captures='+row.captures,'deaths='+row.redUnitsLost,'HQ='+Math.round(row.enemyHQDamage));
  }
 }
 report.complete=true;report.analysis=summarizeTournament(report.results,opts.contenders,opts.opponents,opts.seeds);
 persist(opts.output,report);
 return report;
}
const invoked=process.argv[1]&&new URL('file://'+resolve(process.argv[1])).href===import.meta.url;
if(invoked){
 try{
  const opts=tournamentOptions(process.argv.slice(2)),report=runTournament(opts);
  console.log('TOURNAMENT COMPLETE '+report.completed+'/'+report.expected);
  console.log(JSON.stringify(report.analysis.leaderboard,null,2));
  console.log('championApproved='+report.analysis.championApproved);
 }catch(err){console.error(err.stack??String(err));process.exitCode=1;}
}
