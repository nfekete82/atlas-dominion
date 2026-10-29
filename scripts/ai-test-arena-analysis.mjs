/**
 * Pure diagnostics for the Sandforge headless AI arena.
 * A signal is an observed correlation, NEVER a proven cause of a lost game.
 * Timed-out games stay separate from wins and losses.
 */
const issueCatalog={
  'late-contact':{
    title:'Kein Kontakt zur gegnerischen Front',
    suggestion:'Aufklärung, Wegfindung und Rally-/Angriffsbefehle auf der betroffenen Karte prüfen.'
  },
  'mission-stalls':{
    title:'Festgefahrene Angriffsmissionen',
    suggestion:'Zielerreichbarkeit, Neuplanung und Abbruch bei fehlendem Fortschritt untersuchen.'
  },
  'repeated-aborts':{
    title:'Häufige Missionsabbrüche',
    suggestion:'Schwellen für Rückzug, Verstärkung und Missionswechsel anhand der Timeline untersuchen.'
  },
  'loss-imbalance':{
    title:'Ungünstiges Verlustverhältnis',
    suggestion:'Aufstellung, Zielpriorisierung, Gegen-Einheiten und Rückzugsfenster prüfen.'
  },
  'unexplained-production-idle':{
    title:'Produktionsanlagen unerklärt untätig',
    suggestion:'Produktionsdiagnostik und Ressourcen-/Queue-Entscheidungen nachvollziehen.'
  },
  'hq-without-damage':{
    title:'Gegnerisches HQ gesehen, aber nicht beschädigt',
    suggestion:'Belagerungsplanung, verfügbare Artillerie und Zielpriorisierung prüfen.'
  }
};
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const value=(n,fallback=0)=>finite(n)?n:fallback;
const sum=o=>Object.values(o??{}).reduce((total,n)=>total+value(n),0);
const round=n=>Math.round(n*1000)/1000;
const mean=(items,key)=>items.length?round(items.reduce((total,r)=>total+value(r[key]),0)/items.length):null;
const keyOf=r=>String(r.mapVersion)+':'+String(r.seed);
const hasContact=r=>r.firstFrontContact!==null&&r.firstFrontContact!==undefined;
const isOutcome=x=>['win','loss','timeout'].includes(x);

export function failureSignals(r){
 const problems=[];
 if(r.win===true||r.outcome==='win')return problems;
 const elapsed=value(r.elapsedSeconds);
 if(elapsed>=120&&!hasContact(r))problems.push('late-contact');
 if(value(r.stalledMissions)>=1)problems.push('mission-stalls');
 if(value(r.missionCount)>=2&&value(r.abortedMissions)/r.missionCount>=0.5)problems.push('repeated-aborts');
 if(value(r.redUnitsLost)>=5&&value(r.redUnitsLost)>=2*Math.max(1,value(r.blueUnitsLost)))problems.push('loss-imbalance');
 const available=Object.values(r.productionSeconds??{}).reduce((n,p)=>n+value(p.available),0);
 const unexplained=value(r.productionIdleReasons?.['unexplained-idle']);
 if(available>=45&&unexplained>=30&&unexplained/available>=0.25)problems.push('unexplained-production-idle');
 if(elapsed>=120&&r.enemyHQSeen===true&&!r.enemyHQDamaged)problems.push('hq-without-damage');
 return problems;
}

function modeStats(results){
 const groups=new Map();
 for(const r of results){
  if(!groups.has(r.mode))groups.set(r.mode,[]);
  groups.get(r.mode).push(r);
 }
 return Object.fromEntries([...groups].sort(([a],[b])=>a.localeCompare(b)).map(([mode,rows])=>{
  const wins=rows.filter(r=>r.outcome==='win').length;
  const losses=rows.filter(r=>r.outcome==='loss').length;
  const timeouts=rows.filter(r=>r.outcome==='timeout').length;
  return [mode,{
   matches:rows.length,wins,losses,timeouts,winRateAll:round(100*wins/rows.length),
   decisiveWinRate:wins+losses?round(100*wins/(wins+losses)):null,
   meanScore:mean(rows,'score'),meanEnemyHQDamage:mean(rows,'enemyHQDamage'),
   meanCaptures:mean(rows,'captures'),meanRedLosses:mean(rows,'redUnitsLost'),
   meanBlueLosses:mean(rows,'blueUnitsLost'),meanWallMs:mean(rows,'wallMs')
  }];
 }));
}

export function compareMatched(before,after,requireSource=false){
 const sourceCompatible=!requireSource||(
  before.simulationSourceHash===after.simulationSourceHash&&
  before.catalogSourceHash===after.catalogSourceHash&&
  before.opponentSourceHash===after.opponentSourceHash
 );
 if(requireSource&&!sourceCompatible)throw Error('Source fingerprints differ. Identical code is required for this comparison.');
 const beforeMap=new Map((before.details??[]).map(r=>[keyOf(r)+':'+r.mode,r]));
 const pairs=[],mismatches=[];
 for(const next of after.details??[]){
  const old=beforeMap.get(keyOf(next)+':'+next.mode);
  if(!old)continue;
  if(old.initialStateHash!==next.initialStateHash){
   mismatches.push({seed:next.seed,mapVersion:next.mapVersion,mode:next.mode});
   continue;
  }
  pairs.push({seed:next.seed,mapVersion:next.mapVersion,mode:next.mode,
   before:old.outcome,after:next.outcome,scoreDelta:round(value(next.score)-value(old.score)),
   hqDamageDelta:round(value(next.enemyHQDamage)-value(old.enemyHQDamage)),
   captureDelta:value(next.captures)-value(old.captures),
   redLossesDelta:value(next.redUnitsLost)-value(old.redUnitsLost),
   winDelta:Number(next.outcome==='win')-Number(old.outcome==='win')});
 }
 return {
  pairs:pairs.length,unmatchedBefore:(before.details??[]).length-pairs.length,
  unmatchedAfter:(after.details??[]).length-pairs.length,
  worldMismatches:mismatches,
  meanScoreDelta:mean(pairs,'scoreDelta'),meanHQDamageDelta:mean(pairs,'hqDamageDelta'),
  meanCaptureDelta:mean(pairs,'captureDelta'),meanRedLossesDelta:mean(pairs,'redLossesDelta'),
  extraWins:pairs.reduce((n,p)=>n+p.winDelta,0),perMatch:pairs
 };
}

export function analyzeArena(report){
 const details=report.details??[];
 const issues={};
 for(const r of details.filter(r=>r.mode==='director'&&r.outcome!=='win')){
  for(const id of failureSignals(r)){
   const entry=issues[id]??={id,...issueCatalog[id],matches:0,examples:[]};
   entry.matches++;
   if(entry.examples.length<4)entry.examples.push({mapVersion:r.mapVersion,seed:r.seed,outcome:r.outcome});
  }
 }
 const topSignals=Object.values(issues).sort((a,b)=>b.matches-a.matches||a.id.localeCompare(b.id));
 const baseline={details:details.filter(r=>r.mode==='baseline')},
       director={details:details.filter(r=>r.mode==='director')};
 const paired=compareMatched(baseline,director);
 // CompareMatched keys by mode; pair baseline/director explicitly using identical seeds/world.
 const blueprints=new Map(baseline.details.map(r=>[keyOf(r),r]));
 const modePairs=[];
 const worldMismatches=[];
 for(const next of director.details){
  const old=blueprints.get(keyOf(next));if(!old)continue;
  if(old.initialStateHash!==next.initialStateHash){
   worldMismatches.push({seed:next.seed,mapVersion:next.mapVersion});continue;
  }
  modePairs.push({seed:next.seed,mapVersion:next.mapVersion,
   baseline:old.outcome,director:next.outcome,
   scoreDelta:round(value(next.score)-value(old.score)),
   hqDamageDelta:round(value(next.enemyHQDamage)-value(old.enemyHQDamage)),
   captureDelta:value(next.captures)-value(old.captures),
   redLossesDelta:value(next.redUnitsLost)-value(old.redUnitsLost)});
 }
 return {
  completedRuns:details.length,expectedRuns:report.expectedRuns??details.length,
  complete:report.complete===true,
  byMode:modeStats(details),
  diagnosticSample:details.filter(r=>r.mode==='director'&&r.outcome!=='win').length,
  topSignals,
  modeComparison:{
   pairs:modePairs.length,worldMismatches,
   meanScoreDelta:mean(modePairs,'scoreDelta'),
   meanHQDamageDelta:mean(modePairs,'hqDamageDelta'),
   meanCaptureDelta:mean(modePairs,'captureDelta'),
   meanRedLossesDelta:mean(modePairs,'redLossesDelta'),
   directorExtraWins:modePairs.reduce((n,p)=>n+Number(p.director==='win')-Number(p.baseline==='win'),0),
   perMatch:modePairs
  }
 };
}

export function arenaMarkdown(report){
 const a=report.analysis??analyzeArena(report);
 const lines=[
  '# Sandforge – KI-Testarena',
  '',
  '**Status:** '+(a.complete?'vollständig':'unvollständig / Zwischenstand')+
  ' · **Gefechte:** '+a.completedRuns+'/'+a.expectedRuns,
  '',
  'Derselbe Seed und dieselbe Karte werden für Baseline und Director verwendet. '+
  'Der BLUE-Gegner ist ein festes, budgetgebundenes Verteidigungsskript; '+
  'dies ist kein menschlicher Gegner und keine vollständige Selbstspiel-KI.',
  '',
  '## Ergebnisse',
  '',
  '| Modus | Gefechte | Siege | Niederlagen | Zeitlimits | Siege / alle | Ø Score | Ø HQ-Schaden |',
  '|---|---:|---:|---:|---:|---:|---:|---:|'
 ];
 for(const [name,r] of Object.entries(a.byMode)){
  lines.push('| '+name+' | '+r.matches+' | '+r.wins+' | '+r.losses+' | '+r.timeouts+
   ' | '+r.winRateAll+' % | '+r.meanScore+' | '+r.meanEnemyHQDamage+' |');
 }
 const p=a.modeComparison;
 lines.push('','## Paarvergleich Director minus Baseline','',
  '**Vergleichbare Paare:** '+p.pairs+' · **Abweichende Startwelten:** '+p.worldMismatches.length,
  '',
  '- Zusätzliche Siege: '+p.directorExtraWins,
  '- Ø Score-Differenz: '+(p.meanScoreDelta??'–'),
  '- Ø HQ-Schaden-Differenz: '+(p.meanHQDamageDelta??'–'),
  '- Ø Eroberungen-Differenz: '+(p.meanCaptureDelta??'–'),
  '- Ø eigene Verluste-Differenz: '+(p.meanRedLossesDelta??'–'),
  '',
  '## Häufigste Warnsignale des Directors',
  '',
  'Warnsignale sind **beobachtete Auffälligkeiten, keine nachgewiesenen Ursachen**. '+
  'Mehrere Signale können im selben Gefecht auftreten. Zeitlimits sind keine Niederlagen.',
  '',
  '**Bewertete Niederlagen/Zeitlimits:** '+a.diagnosticSample,'',
  '| Auffälligkeit | Betroffene Gefechte | Nächster Prüfpunkt |',
  '|---|---:|---|');
 for(const s of a.topSignals.slice(0,6))lines.push('| '+s.title+' | '+s.matches+' | '+s.suggestion+' |');
 if(!a.topSignals.length)lines.push('| Keine automatischen Warnsignale | 0 | Einzelfälle anhand der Timeline prüfen |');
 lines.push('','## Nächste Schritte','',
  '1. Die drei häufigsten Warnsignale im JSON mit ihren Map-/Seed-Beispielen reproduzieren.',
  '2. Für jeden echten Fehler einen gezielten Regressionstest schreiben und die KI korrigieren.',
  '3. Dieselbe Arena mit identischen Seeds erneut ausführen und die Berichte paarweise vergleichen.',
  '',
  'Hinweis: Die Siegquote verwendet **alle** Gefechte als Nenner; Zeitlimits werden separat ausgewiesen. '+
  'Ein Vergleich zwischen verschiedenen Code-Versionen setzt identische spielbare Startwelten voraus.',
  '');
 return lines.join('\n');
}
