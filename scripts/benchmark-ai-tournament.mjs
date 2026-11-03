#!/usr/bin/env node
/** Reproducible RED vs budget-constrained BLUE tournament; this is NOT self-play
 * between two full directors, and synthetic opponents are not human players.
 * Candidate and baseline use identical seeds, initial map, economy and fog. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {Simulation as Engine} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {OPPONENTS,scriptedOpponent} from './ai-tournament-opponents.mjs';
const args=process.argv.slice(2);
const flag=(name,def)=>{const i=args.indexOf('--'+name);return i<0?def:args[i+1];};
const seconds=Number(flag('seconds','360')),seeds=flag('seeds','2026,2027,2028,2029,2030,2031').split(',').map(Number),
 profiles=flag('profiles',OPPONENTS.join(',')).split(','),
 path=resolve(flag('output','ai-arena-results/economy-tournament.json'));
if(!Number.isInteger(seconds)||seconds<90||seconds>1200||seeds.length<1||seeds.length>16||
 seeds.some(n=>!Number.isSafeInteger(n)||n<0)||new Set(seeds).size!==seeds.length||
 profiles.some(p=>!OPPONENTS.includes(p))||new Set(profiles).size!==profiles.length)
 throw Error('Invalid tournament arguments');
const results=[];
for(const profile of profiles)for(const seed of seeds){
 let hash=null;
 for(const policy of ['classic','frontier']){
  class Variant extends Engine {
   constructor(seed,version){super(seed,version);this.tactical.economyPolicy=policy;}
  }
  const result=runMatch({Simulation:Variant,UNITS},{seconds,opponent:'guarded',
   defender:scriptedOpponent(profile),label:profile+':'+policy},seed,'director',11);
  if(hash&&hash!==result.initialStateHash)throw Error('Different initial playable world!');
  hash=result.initialStateHash;
  const row={profile,seed,policy,hash,outcome:result.outcome,captures:result.captures,
   netCaptures:result.netCaptures,redSectors:result.redSectors,redDeaths:result.redUnitsLost,
   blueDeaths:result.blueUnitsLost,enemyHQDamage:result.enemyHQDamage,
   firstAssault:result.firstAssault,abortedMissions:result.abortedMissions,
   redCredits:result.redCredits,paidRecruitCredits:result.paidRecruitCredits,
   paidBuildCredits:result.paidBuildCredits,elapsedSeconds:result.elapsedSeconds,wallMs:result.wallMs};
  results.push(row);
  console.log('profile='+profile+' seed='+seed+' policy='+policy+
   ' outcome='+row.outcome+' captures='+row.captures+
   ' sectors='+row.redSectors+' deaths='+row.redDeaths+' HQ='+row.enemyHQDamage);
 }
}
function summarize(rows){
 const mean=k=>rows.reduce((n,r)=>n+(Number(r[k])||0),0)/rows.length;
 return {games:rows.length,wins:rows.filter(r=>r.outcome==='win').length,
   losses:rows.filter(r=>r.outcome==='loss').length,
   timeouts:rows.filter(r=>r.outcome==='timeout').length,
   meanCaptures:mean('captures'),meanNetCaptures:mean('netCaptures'),
   meanSectors:mean('redSectors'),meanRedDeaths:mean('redDeaths'),
   meanEnemyHQDamage:mean('enemyHQDamage'),meanAbortedMissions:mean('abortedMissions')};
}
const summary=Object.fromEntries(['classic','frontier'].map(p=>[p,summarize(results.filter(r=>r.policy===p))]));
const byOpponent=Object.fromEntries(profiles.map(p=>[p,Object.fromEntries(['classic','frontier'].map(k=>[k,summarize(results.filter(r=>r.policy===k&&r.profile===p))]))]));
// Outcome gate is primary. If equal, require both territory growth AND
// survival parity across all scripted opponent profiles. No auto-activation.
const b=summary.classic,c=summary.frontier;
const gate={winsNonDecreasing:c.wins>=b.wins,lossesNonIncreasing:c.losses<=b.losses,
 territoryImproves:c.meanNetCaptures>=b.meanNetCaptures+.10,
 deathsNotWorse:c.meanRedDeaths<=b.meanRedDeaths+.15,
 everyOpponentSafe:profiles.every(p=>byOpponent[p].frontier.losses<=byOpponent[p].classic.losses&&
  byOpponent[p].frontier.meanRedDeaths<=byOpponent[p].classic.meanRedDeaths+.3)};
gate.candidateQualifies=Object.values(gate).every(Boolean);
const report={kind:'Synthetic RED-vs-scripted-BLUE tournament, not full self-play or human rating',
 mapVersion:11,seeds,profiles,seconds,summary,byOpponent,gate,results};
mkdirSync(dirname(path),{recursive:true});
writeFileSync(path,JSON.stringify(report,null,2)+'\n');
console.log('TOURNAMENT_SUMMARY '+JSON.stringify({summary,byOpponent,gate}));
console.log('Report '+path);
