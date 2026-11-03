/** Pure tournament scoring and qualification. A simulated timeout is NEVER
 * counted as a victory. Strategy changes are not automatically shipped. */
export const AI_CANDIDATES=Object.freeze({
 current:{mode:'director',planningMode:'tactical',waveMode:'coordinated',doctrineMode:'intelligent'},
 classicPlanner:{mode:'director',planningMode:'classic',waveMode:'coordinated',doctrineMode:'intelligent'},
 fastWaves:{mode:'director',planningMode:'tactical',waveMode:'legacy',doctrineMode:'intelligent'},
 legacyDoctrine:{mode:'director',planningMode:'classic',waveMode:'legacy',doctrineMode:'legacy'},
 baseline:{mode:'baseline',planningMode:'classic',waveMode:'legacy',doctrineMode:'legacy'}
});

export const AI_METRICS=Object.freeze(['redSectors','blueSectors','captures','redUnitsLost',
 'blueUnitsLost','enemyHQDamage','firstAssault','abortedMissions','paidRecruitCredits',
 'paidBuildCredits','redCredits','bluePaidRecruitCredits','bluePaidBuildCredits','wallMs']);

export function tournamentRating(m){
 // One genuine match result outranks every possible secondary objective score.
 const result=m.outcome==='win'?1_000_000:m.outcome==='loss'?-1_000_000:0;
 const red=Math.max(0,m.redSectorSeconds??0),blue=Math.max(0,m.blueSectorSeconds??0);
 const progress=(red-blue)*.12+Math.max(0,m.redSectors??0)*24+
   Math.max(0,m.captures??0)*18+
   Math.min(1500,Math.max(0,m.enemyHQDamage??0))*.045+
   Math.max(0,m.blueUnitsLost??0)*6-Math.max(0,m.redUnitsLost??0)*10;
 return result+progress;
}
export function aggregateTournament(rows){
 const groups=new Map();
 for(const row of rows){
  const key=row.policy, list=groups.get(key)??[];list.push(row);groups.set(key,list);
 }
 const mean=(rows,key)=>rows.length?rows.reduce((sum,row)=>sum+(Number(row[key])||0),0)/rows.length:0;
 return [...groups].map(([policy,matches])=>({
  policy,matches:matches.length,opponents:[...new Set(matches.map(r=>r.opponent))].sort(),
  wins:matches.filter(x=>x.outcome==='win').length,
  losses:matches.filter(x=>x.outcome==='loss').length,
  timeouts:matches.filter(x=>x.outcome==='timeout').length,
  meanCaptures:mean(matches,'captures'),meanRedDeaths:mean(matches,'redUnitsLost'),
  meanBlueDeaths:mean(matches,'blueUnitsLost'),
  meanHQDamage:mean(matches,'enemyHQDamage'),
  meanRedSectorSeconds:mean(matches,'redSectorSeconds'),
  meanBlueSectorSeconds:mean(matches,'blueSectorSeconds'),
  meanScore:mean(matches,'rating')
 })).sort((a,b)=>b.wins-a.wins||a.losses-b.losses||
   b.meanRedSectorSeconds-a.meanRedSectorSeconds||
   b.meanScore-a.meanScore||a.policy.localeCompare(b.policy));
}
/** Paired guardrail: no strategy qualifies unless it matches/beats the
 * baseline across EVERY opponent on completed outcomes and average territory
 * control, with at least one material gain. */
export function qualifyCandidate(rows,policy,base='current'){
 const opponents=[...new Set(rows.filter(r=>r.policy===base).map(r=>r.opponent))];
 if(!opponents.length||policy===base)return {qualified:false,reason:'missing comparison'};
 let improvement=false;
 for(const opponent of opponents){
  const baseline=rows.filter(r=>r.policy===base&&r.opponent===opponent)
   .slice().sort((a,b)=>a.seed-b.seed);
  const proposed=rows.filter(r=>r.policy===policy&&r.opponent===opponent)
   .slice().sort((a,b)=>a.seed-b.seed);
  if(!baseline.length||proposed.length!==baseline.length||
    baseline.some((b,i)=>b.seed!==proposed[i].seed))
   return {qualified:false,reason:'unpaired '+opponent};
  const w=rs=>rs.filter(r=>r.outcome==='win').length;
  const l=rs=>rs.filter(r=>r.outcome==='loss').length;
  const mean=rs=>rs.reduce((n,r)=>n+(r.redSectorSeconds??0),0)/rs.length;
  if(w(proposed)<w(baseline)||l(proposed)>l(baseline)||
     mean(proposed)<mean(baseline)-1e-6)
   return {qualified:false,reason:'regression against '+opponent};
  if(w(proposed)>w(baseline)||l(proposed)<l(baseline)||
     mean(proposed)>mean(baseline)+30)improvement=true;
 }
 return {qualified:improvement,reason:improvement?'candidate for holdout and human trials':'no meaningful improvement'};
}
