#!/usr/bin/env node
/**
 * Fact-only endgame report. Simulation world truth is visible to the offline
 * benchmark observer only. AI never receives the actual hidden HQ state.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

export function endgameReport(arena){
 if(!arena.complete||arena.modes?.join(',')!=='director'||!arena.details?.length)
  throw Error('Requires a complete director-only arena.');
 if(arena.details.some(r=>!r.endgameTelemetry))throw Error('Missing AI 5.1 endgame telemetry.');
 const round=n=>Math.round(n*100)/100;
 const rows=arena.details.slice().sort((a,b)=>a.mapVersion-b.mapVersion||a.seed-b.seed);
 const timeouts=rows.filter(r=>r.outcome==='timeout');
 const counters=(items,key)=>items.reduce((counts,r)=>{
  for(const [name,n] of Object.entries(r.endgameTelemetry?.[key]??{}))
   counts[name]=(counts[name]??0)+n;
  return counts;
 },{});
 const total=(a,key)=>a.reduce((v,r)=>v+(r.endgameTelemetry[key]??0),0);
 const no=n=>n===null||n===undefined?'–':String(n);
 const confirmationReasons=counters(timeouts,'confirmationReasonsAfterActualDestruction');
 const batteryReasons=counters(timeouts,'batteryReasonsAfterActualDestruction');
 const status=r=>r.endgameTelemetry.firstWorldHqGone===null?'HQ not eliminated':
  r.endgameTelemetry.firstConfirmedHqGone===null?'not confirmed':
  'confirmed after '+round(r.endgameTelemetry.firstConfirmedHqGone-r.endgameTelemetry.firstWorldHqGone)+'s';
 const lines=[
  '# Sandforge AI 5.1 – Endspiel-Gate-Diagnostik','',
  '**Unveränderte Kampflogik:** Das Headless-Testprogramm beobachtet die KI, sendet keine Befehle und ändert keine Sichtbarkeitsinformationen.',
  'Die tatsächliche HQ-Zerstörung ist nur dem Benchmark bekannt. Die KI erhält diesen Wert niemals.',
  'Zeitangaben aus der Diagnose werden in 1-Sekunden-Abständen erfasst; frühere Trefferzeiten aus der Kampfmetrik bleiben unverändert.',
  '',
  '- Simulierte Gefechte: '+rows.length,
  '- Siege: '+rows.filter(r=>r.outcome==='win').length+', Zeitlimits: '+timeouts.length,
  '- Zeitlimit-Gefechte mit tatsächlichem HQ-Verlust: '+timeouts.filter(r=>r.endgameTelemetry.firstWorldHqGone!==null).length,
  '- Davon ohne bestätigtes KI-Endspiel bis Matchende: '+timeouts.filter(r=>r.endgameTelemetry.firstWorldHqGone!==null&&r.endgameTelemetry.firstConfirmedHqGone===null).length,
  '- Zeitlimit-Gefechte mit Sekundentelemetrie: '+timeouts.filter(r=>r.endgameTelemetry.samplingSeconds>0).length+'/'+timeouts.length,
  '',
  '## Alle Zeitlimit-Gefechte','',
  '| Karte | Seed | HQ zerstört (s) | Endspiel bestätigt (s) | Ergebnis Bestätigung | Unbestätigte HQ-Sekunden | Missionswechsel danach | Abbrüche danach |',
  '|---|---:|---:|---:|---|---:|---:|---:|'
 ];
 for(const r of timeouts){const t=r.endgameTelemetry;
  lines.push('| '+r.mapVersion+' | '+r.seed+' | '+no(r.firstEnemyHQDestroyed)+
   ' | '+no(t.firstConfirmedHqGone)+' | '+status(r)+
   ' | '+t.unconfirmedAfterWorldHqDownSeconds+' | '+t.postHqMissionChanges+
   ' | '+t.postHqAbortedIncrements+' |');
 }
 lines.push('','## Verhinderungsgründe nach tatsächlicher HQ-Zerstörung in Zeitlimit-Partien','',
 'Zählung: ein Grund pro Sekunde, solange das HQ tatsächlich zerstört ist und die KI das Endspiel noch nicht bestätigt hat.',
 'Keine Bestätigung aufgrund von fehlendem Sichtkontakt darf nicht durch Kenntnis des Benchmarks über den Gegner ersetzt werden.','','| Signal | Sekunden |','|---|---:|');
 for(const [name,n] of Object.entries(confirmationReasons).sort((a,b)=>b[1]-a[1]))
  lines.push('| '+name+' | '+n+' |');
 lines.push('','## Artillerie-Endspielregel nach tatsächlicher HQ-Zerstörung','',
 'Zählung: führender nicht erfüllter Guard pro Sekunde; reine Offline-Diagnose, kein Ersatz für den Controllerzustand.','','| Signal | Sekunden |','|---|---:|');
 for(const [name,n] of Object.entries(batteryReasons).sort((a,b)=>b[1]-a[1]))lines.push('| '+name+' | '+n+' |');
 lines.push('','## Sonderfall Karte 5 / Seed 2026 und 2033','');
 for(const seed of [2026,2033]){
  const r=rows.find(r=>r.mapVersion===5&&r.seed===seed);
  if(!r)continue;
  const t=r.endgameTelemetry;
  lines.push('### Seed '+seed,'',
   '- Tatsächliche HQ-Zerstörung: '+no(r.firstEnemyHQDestroyed)+'s',
   '- KI-Bestätigung: '+no(t.firstConfirmedHqGone)+'s',
   '- Unbestätigte Sekunden: '+t.unconfirmedAfterWorldHqDownSeconds,
   '- Missionswechsel nach HQ-Fall: '+t.postHqMissionChanges,
   '- KI-Missionsabbrüche nach HQ-Fall: '+t.postHqAbortedIncrements,
   '- Phasen nach HQ-Fall: '+JSON.stringify(t.commanderPhasesAfterWorldHqDown),
   '- HQ-Gates: '+JSON.stringify(t.confirmationReasonsAfterActualDestruction),
   '- Batterie-Gates: '+JSON.stringify(t.batteryReasonsAfterActualDestruction),'');
 }
 lines.push('## Hinweise zur Auswertung','',
  '- Ein erkannter HQ-Treffer ist nicht gleichbedeutend mit der verifizierten HQ-Zerstörung.',
  '- Die Eintrittsbedingung für die Endspielregel hängt am bestätigten Flag enemyHQEliminatedAt, nicht am Kampfmetrikfeld firstEnemyHQDestroyed.',
  '- Ein Standort außerhalb der aktuellen Sicht ist gemäß Fog-of-War kein legaler Beweis für dessen Zerstörung.',
  '- Die Untersuchung nennt die Hindernisse für vorhandene Regeln; eine spätere Taktikänderung braucht einen eigenen gepaarten Benchmark.','');
 const summary={
  matches:rows.length,wins:rows.filter(r=>r.outcome==='win').length,timeouts:timeouts.length,
  timeoutsWithHqDestroyed:timeouts.filter(r=>r.endgameTelemetry.firstWorldHqGone!==null).length,
  timeoutsWithHqDestroyedUnconfirmed:timeouts.filter(r=>r.endgameTelemetry.firstWorldHqGone!==null&&r.endgameTelemetry.firstConfirmedHqGone===null).length,
  totalUnconfirmedHQSeconds:total(timeouts,'unconfirmedAfterWorldHqDownSeconds'),
  confirmationReasons,batteryReasons,
  focus:Object.fromEntries([2026,2033].map(seed=>{const r=rows.find(r=>r.mapVersion===5&&r.seed===seed);return [seed,r?{
   outcome:r.outcome,hqDestroyedAt:r.firstEnemyHQDestroyed,
   confirmedAt:r.endgameTelemetry.firstConfirmedHqGone,
   unconfirmedSeconds:r.endgameTelemetry.unconfirmedAfterWorldHqDownSeconds,
   postHqMissionChanges:r.endgameTelemetry.postHqMissionChanges,
   postHqAborted:r.endgameTelemetry.postHqAbortedIncrements
  }:null]}))
 };
 return {summary,markdown:lines.join('\n')+'\n'};
}
if(process.argv[1]&&process.argv[1].endsWith('ai-51-endgame-report.mjs')){
 const [input,output='ai-arena-results/ai-51-endgame-diagnostics.md']=process.argv.slice(2);
 if(!input)throw Error('Usage: node scripts/ai-51-endgame-report.mjs AFTER.json [OUTPUT.md]');
 const {summary,markdown}=endgameReport(JSON.parse(readFileSync(resolve(input),'utf8')));
 const path=resolve(output);mkdirSync(dirname(path),{recursive:true});
 writeFileSync(path,markdown);
 writeFileSync(path.replace(/\.md$/i,'.json'),JSON.stringify(summary,null,2)+'\n');
 console.log(markdown);
 console.log('ENDGAME_DIAG_JSON='+JSON.stringify(summary));
}
