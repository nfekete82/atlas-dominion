#!/usr/bin/env node
/** Outcome/time-to-kill diagnosis at a 900-second horizon. Read-only.
 * Every metric originates from the unchanged full-match benchmark's observer.
 * No simulated units, production choices, AI orders or fog are modified. */
import {mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {configureContender} from './ai-strategy-tournament.mjs';
import {OPPONENTS,scriptedBlueTurn} from './ai-tournament-opponents.mjs';

export const STRATEGIES=['current','early-barracks'];
const round=n=>Math.round(n*100)/100;
export function classifyTempo(m){
 const played=m.elapsedSeconds;
 const phase=m.commanderSeconds??{};
 const hqFirst=m.firstEnemyHQDamage,assault=m.firstOrganizedAttack;
 const attackWindow=assault===null?0:Math.max(0,played-assault);
 const firstHitLag=hqFirst===null||assault===null?null:round(hqFirst-assault);
 const siegeWaiting=round((phase.siege??0)+(phase.buildup??0));
 const missionEvents=(m.missionEvents??[]).map(x=>({
  started:x.started,ended:x.ended,outcome:x.outcome,target:x.target,
  objective:x.objective,duration:round((x.ended??played)-(x.started??played))
 }));
 const stalls=missionEvents.filter(x=>x.outcome==='unfinished'||x.outcome==='aborted');
 const timelines=(m.timeline??[]).map(x=>({at:x.at,phase:x.phase,
  commander:x.commander,mission:x.mission,group:x.group,
  redUnits:x.redUnits,sectors:x.sectors,enemyHQHp:x.enemyHQHp,
  enemyHQDamage:x.enemyHQDamage}));
 return {outcome:m.outcome,played,firstOrganizedAttack:assault,
  firstEnemyHQSeen:m.firstEnemyHQSeen,firstEnemyHQDamage:hqFirst,
  firstEnemyHQDestroyed:m.firstEnemyHQDestroyed,
  firstArtillery:m.firstArtillery,firstFactory:m.firstFactory,
  firstFrontContact:m.firstFrontContact,firstAssault:m.firstAssault,
  timeToFirstHQHitAfterOrganizedAttack:firstHitLag,
  attackWindow,attackingSeconds:m.attackingSeconds,
  siegeBuildupSeconds:siegeWaiting,
  phaseSeconds:phase,abortedMissions:m.abortedMissions,
  stalledMissions:m.stalledMissions,unfinishedMissions:m.unfinishedMissions,
  missionCount:m.missionCount,phaseTransitions:m.phaseTransitions,
  commanderTransitions:m.commanderTransitions,
  rapidUnitOrderChanges:m.rapidUnitOrderChanges,
  repeatedUnitCommands:m.repeatedUnitCommands,
  firstArtilleryOrder:m.firstArtilleryOrder,
  endingEnemyHQDamage:m.enemyHQDamage,
  endingEnemyBuildingsDamaged:m.enemyBuildingsDamaged,
  endingEnemyBuildingsDestroyed:m.enemyBuildingsDestroyed,
  paidRecruitCredits:m.paidRecruitCredits,
  paidBuildCredits:m.paidBuildCredits,
  redUnitsLost:m.redUnitsLost,blueUnitsLost:m.blueUnitsLost,
  captures:m.captures,
  missionEvents:missionEvents.slice(0,90),stalls:stalls.slice(0,40),
  timeline:timelines};
}
export function compareTempo(a,b){
 if(a.outcome==='timeout'&&b.outcome==='win')return 'late-win-vs-baseline-timeout';
 if(a.outcome==='win'&&b.outcome==='timeout')return 'baseline-wins-candidate-timeout';
 if(a.outcome==='win'&&b.outcome==='loss')return 'baseline-win-to-loss';
 if(a.outcome==='timeout'&&b.outcome==='loss')return 'timeout-to-loss';
 if(a.outcome===b.outcome&&a.outcome==='win'){
  const advantage=round(a.played-b.played);
  return Math.abs(advantage)<=1?'same-win-time':'both-win-'+(advantage>0?'candidate-faster':'baseline-faster');
 }
 return a.outcome===b.outcome?'same-outcome':'different-outcome';
}
export function parseOptions(argv){
 const flags={opponent:'pressure',seeds:'2026,2029,2074,2075',
  seconds:'900',output:'ai-arena-results/attack-tempo.json'};
 for(let i=0;i<argv.length;i+=2){
  const k=argv[i]?.startsWith('--')?argv[i].slice(2):null;
  if(!k||!Object.hasOwn(flags,k)||!argv[i+1]||argv[i+1].startsWith('--'))
   throw Error('Invalid tempo option');
  flags[k]=argv[i+1];
 }
 const seeds=flags.seeds.split(',').map(Number),seconds=Number(flags.seconds);
 if(!OPPONENTS.includes(flags.opponent)||seeds.length<1||seeds.length>12||
  seeds.some(x=>!Number.isSafeInteger(x)||x<0||x>4294967295)||
  new Set(seeds).size!==seeds.length||
  !Number.isInteger(seconds)||seconds<600||seconds>1200)
  throw Error('Invalid tempo seeds, opponent or horizon');
 return {...flags,seeds,seconds};
}
export function runAudit({opponent,seeds,seconds}){
 const pairs=[];
 for(const seed of seeds){
  let initial=null;const strategies={};
  for(const strategy of STRATEGIES){
   class T extends Simulation{
    constructor(...args){super(...args);configureContender(this.tactical,strategy);}
   }
   const m=runMatch({Simulation:T,UNITS},{
    seconds,opponent:'guarded',label:strategy,
    defender:g=>scriptedBlueTurn(g,opponent)
   },seed,'director',11);
   if(initial!==null&&initial!==m.initialStateHash)
    throw Error('Unmatched paid playable-world initial state');
   initial=m.initialStateHash;strategies[strategy]=classifyTempo(m);
   console.log('TEMPO',opponent,seed,strategy,m.outcome,
    'time='+m.elapsedSeconds,'firstContact='+m.firstFrontContact,
    'organizedAttack='+m.firstOrganizedAttack,'firstHQDamage='+m.firstEnemyHQDamage,
    'phases='+JSON.stringify(m.commanderSeconds),'missions='+m.missionCount);
  }
  const [base,candidate]=STRATEGIES.map(k=>strategies[k]);
  pairs.push({seed,opponent,initialStateHash:initial,
   pairResult:compareTempo(base,candidate),strategies});
 }
 return {schemaVersion:1,kind:'read-only 900s attack tempo root-cause audit',
  opponent,seeds,seconds,expected:seeds.length*2,completed:pairs.length*2,
  caveat:'The 900-second game result is decisive; 360-second timeouts are not wins. Metrics are transparent live-simulation observers; no actual behavior is modified.',
  pairs};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const o=parseOptions(process.argv.slice(2)),report=runAudit(o),out=resolve(o.output);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out+'.tmp',JSON.stringify(report,null,2)+'\n');
 renameSync(out+'.tmp',out);
 console.log('TEMPO AUDIT COMPLETE '+report.completed+'/'+report.expected);
}
