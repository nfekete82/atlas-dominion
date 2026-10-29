#!/usr/bin/env node
/** Compare two completed arena reports from different code revisions. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {compareMatched} from './ai-test-arena-analysis.mjs';

export function compareArenaReports(oldReport,newReport){
 for(const r of [oldReport,newReport]){
  if(r.schemaVersion!==1||r.complete!==true||r.completedRuns!==r.expectedRuns)
   throw Error('Both arena reports must be complete schema v1 experiments.');
 }
 const mustMatch=['opponent','opponentSourceHash','catalogSourceHash','requestedSeconds','timestep'];
 for(const field of mustMatch)if(oldReport[field]!==newReport[field])
  throw Error('Incompatible experiment setting: '+field);
 for(const name of ['maps','seeds','modes'])
  if(JSON.stringify(oldReport[name])!==JSON.stringify(newReport[name]))
   throw Error('Incompatible experiment design: '+name);
 const diff=compareMatched(oldReport,newReport);
 if(diff.worldMismatches.length||diff.pairs!==oldReport.expectedRuns)
  throw Error('Different or unmatched playable starting worlds; no valid global comparison.');
 return {
  schemaVersion:1,oldLabel:oldReport.label,newLabel:newReport.label,
  oldSimulationHash:oldReport.simulationSourceHash,newSimulationHash:newReport.simulationSourceHash,
  ...diff
 };
}

export function comparisonMarkdown(r){
 const lines=['# Sandforge – KI-Versionsvergleich','',
  '**Von:** '+r.oldLabel+' · **Nach:** '+r.newLabel,
  '',
  '**Identische Startwelten:** '+r.pairs,
  '',
  '| Kennzahl | Neue minus alte Version |','|---|---:|',
  '| Zusätzliche KI-Siege | '+r.extraWins+' |',
  '| Ø Score-Differenz | '+r.meanScoreDelta+' |',
  '| Ø HQ-Schaden-Differenz | '+r.meanHQDamageDelta+' |',
  '| Ø zusätzliche Eroberungen | '+r.meanCaptureDelta+' |',
  '| Ø zusätzliche eigene Verluste | '+r.meanRedLossesDelta+' |',
  '',
  'Alle Paare verwenden dieselbe Karte, denselben Seed, denselben Modus und denselben spielbaren Startzustand. '+
  'Der Gegner, die Einheitenkosten, die Laufzeit und die Zeitschrittweite sind unverändert. '+
  'Zeitlimits zählen nicht als Siege oder Niederlagen. '+
  'Score-Differenzen sind Hinweise und keine Garantie für bessere Spielstärke.',
  '',
  '## Einzelne Paare','','| Karte | Seed | Modus | Vorher | Nachher | Score-Δ | HQ-Δ |',
  '|---|---:|---|---|---|---:|---:|'];
 for(const p of r.perMatch)
  lines.push('| '+p.mapVersion+' | '+p.seed+' | '+p.mode+' | '+p.before+' | '+p.after+
   ' | '+p.scoreDelta+' | '+p.hqDamageDelta+' |');
 return lines.join('\n')+'\n';
}

async function main(){
 const [beforePath,afterPath,out]=process.argv.slice(2);
 if(!beforePath||!afterPath)throw Error('Usage: node scripts/ai-test-arena-compare.mjs BEFORE.json AFTER.json [OUTPUT.md]');
 const before=JSON.parse(readFileSync(resolve(beforePath),'utf8'));
 const after=JSON.parse(readFileSync(resolve(afterPath),'utf8'));
 const comparison=compareArenaReports(before,after);
 const md=comparisonMarkdown(comparison);
 if(out){const file=resolve(out);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,md);}
 console.log(md);
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 try{await main();}catch(e){console.error(e.message);process.exitCode=1;}
}
