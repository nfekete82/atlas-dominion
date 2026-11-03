#!/usr/bin/env node
/** Collect ALL opponent reports, reject incomplete/duplicate/mismatched pairs.
 * Never auto-merge: a candidate passing is only eligible for human review. */
import {readFileSync,writeFileSync} from 'node:fs';
const files=process.argv.slice(2);
if(files.length<2)throw Error('Require at least two disjoint opponent tournament reports');
const reports=files.map(path=>JSON.parse(readFileSync(path,'utf8')));
const base=reports[0],set=new Set(),rows=[];
for(const r of reports){
 if(r.mapVersion!==11||r.seconds!==base.seconds||JSON.stringify(r.seeds)!==JSON.stringify(base.seeds))
  throw Error('Tournament settings differ across opponent reports');
 for(const p of r.profiles){if(set.has(p))throw Error('Duplicate opponent '+p);set.add(p);}
 rows.push(...r.results);
}
const policies=['classic','frontier'],byOpponent={};
for(const profile of set){
 const groups={};
 for(const policy of policies){
  const rs=rows.filter(r=>r.profile===profile&&r.policy===policy);
  if(rs.length!==base.seeds.length||
    base.seeds.some(seed=>rs.filter(r=>r.seed===seed).length!==1))
   throw Error('Incomplete '+profile+'/'+policy+' seed set');
  const mean=k=>rs.reduce((n,r)=>n+(Number(r[k])||0),0)/rs.length;
  groups[policy]={wins:rs.filter(r=>r.outcome==='win').length,
   losses:rs.filter(r=>r.outcome==='loss').length,
   timeouts:rs.filter(r=>r.outcome==='timeout').length,
   captures:mean('captures'),netCaptures:mean('netCaptures'),
   deaths:mean('redDeaths'),HQDamage:mean('enemyHQDamage')};
 }
 byOpponent[profile]=groups;
}
const flat=policy=>rows.filter(r=>r.policy===policy),summary={};
for(const policy of policies){
 const list=flat(policy),mean=k=>list.reduce((n,r)=>n+(Number(r[k])||0),0)/list.length;
 summary[policy]={wins:list.filter(r=>r.outcome==='win').length,
  losses:list.filter(r=>r.outcome==='loss').length,
  captures:mean('captures'),netCaptures:mean('netCaptures'),
  deaths:mean('redDeaths'),HQDamage:mean('enemyHQDamage')};
}
const a=summary.classic,b=summary.frontier;
const gate={
 winsNonDecreasing:b.wins>=a.wins,
 lossesNonIncreasing:b.losses<=a.losses,
 sectorsImprove:b.netCaptures>=a.netCaptures+.10,
 deathsNotWorse:b.deaths<=a.deaths+.15,
 allOpponentsSafe:Object.values(byOpponent).every(g=>
   g.frontier.losses<=g.classic.losses&&g.frontier.deaths<=g.classic.deaths+.30)
};
gate.qualifies=Object.values(gate).every(Boolean);
const report={profiles:[...set],seeds:base.seeds,seconds:base.seconds,
 matchCount:rows.length,summary,byOpponent,gate};
writeFileSync('ai-tournament-decision.json',JSON.stringify(report,null,2)+'\n');
console.log('AGGREGATE_TOURNAMENT '+JSON.stringify(report));
if(!gate.qualifies)console.log('NOT QUALIFIED: leave classic default untouched');
