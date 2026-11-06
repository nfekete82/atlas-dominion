#!/usr/bin/env node
/** Post-match forensic view: descriptive causes, not causal proof or new AI actions. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const [arenaPath,outputPath='ai-arena-results/ai-48-artillery-diagnostics.md']=process.argv.slice(2);
if(!arenaPath)throw Error('Usage: node scripts/ai-48-artillery-report.mjs AFTER.json [OUTPUT.md]');
const report=JSON.parse(readFileSync(resolve(arenaPath),'utf8'));
if(!report.complete||report.modes?.join(',')!=='director'||!report.details?.length)
 throw Error('Diagnostic analysis requires a complete director-only arena.');
if(report.details.some(x=>!x.artilleryTelemetry))
 throw Error('Missing observer telemetry; cannot infer artillery failures from generic match statistics.');
const matches=report.details;
const total=(predicate,extract)=>matches.filter(predicate).reduce((n,r)=>n+(extract(r)??0),0);
const round=n=>Math.round(n*100)/100;
const states=[...new Set(matches.flatMap(r=>Object.keys(r.artilleryTelemetry.gunSeconds??{})))].sort();
const mean=(rows,fn)=>round(rows.reduce((n,r)=>n+(fn(r)??0),0)/Math.max(1,rows.length));
const timeout=matches.filter(r=>r.outcome==='timeout');
const winner=matches.filter(r=>r.outcome==='win');
const safe=r=>r.artilleryTelemetry;
const first=r=>r===null||r===undefined?'–':String(r);
const lines=[
 '# Sandforge AI 4.8 – Artillerie-Diagnose','',
 '**Messprinzip:** Reine Beobachtung durch die Headless-Arena, ohne KI-Kommandos oder Änderungen an der Simulation.',
 'Jede Artillerie wird höchstens einmal pro simulierter Sekunde klassifiziert. Die Klassifikation ist eine Momentaufnahme, keine kausale Fehlerdiagnose.',
 'Schüsse werden nur gezählt, wenn eine Rakete tatsächlich gestartet wurde. Angriffsbefehle zählen nicht als Schüsse.',
 '',
 '- Gefechte: '+matches.length+' ('+winner.length+' Siege, '+timeout.length+' Zeitlimits)',
 '- Arena: '+report.label,
 '- Beobachtungsabdeckung: '+matches.filter(r=>r.artilleryTelemetry.samples>0).length+'/'+matches.length,
 '- Ø Zeitpunkt erste Artillerie in allen Gefechten: '+first(mean(matches.filter(r=>safe(r).firstArtillerySeen!==null),r=>safe(r).firstArtillerySeen))+'s (nur Gefechte mit Artillerie)',
 '- Ø Zeitpunkt erster Artillerieschuss: '+first(mean(matches.filter(r=>safe(r).firstShot!==null),r=>safe(r).firstShot))+'s (nur Gefechte mit Schuss)',
 '- Schüsse insgesamt: '+total(()=>true,r=>safe(r).shots),
 '- Angriffsbefehle ersetzt: '+total(()=>true,r=>safe(r).attackOrderReplacements),
 '- Aktive Angriffe per Stop abgebrochen: '+total(()=>true,r=>safe(r).attackOrdersStopped),
 '',
 '## Zustandsverteilung – Raketenwerfer-Sekunden','',
 '| Zustand | Alle Matches | Zeitlimits | Siege |','|---|---:|---:|---:|'
];
for(const key of states)lines.push('| '+key+' | '+total(()=>true,r=>safe(r).gunSeconds?.[key])+
 ' | '+total(r=>r.outcome==='timeout',r=>safe(r).gunSeconds?.[key])+
 ' | '+total(r=>r.outcome==='win',r=>safe(r).gunSeconds?.[key])+' |');
lines.push('','## Tatsächliche Schüsse nach Zieltyp','','| Zieltyp | Anzahl |','|---|---:|');
for(const kind of [...new Set(matches.flatMap(r=>Object.keys(safe(r).shotsByTargetKind)))].sort())
 lines.push('| '+kind+' | '+total(()=>true,r=>safe(r).shotsByTargetKind[kind])+' |');
lines.push('','## Zeitlimit-Gefechte: konkrete Diagnose','','| Karte | Seed | Erste Artillerie (s) | Erster Schuss (s) | Turmschüsse | Blockiert (Rak.-s) | Anmarsch (Rak.-s) | Außer Reichweite (Rak.-s) | Befehlswechsel |',
 '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for(const r of timeout.slice().sort((a,b)=>a.mapVersion-b.mapVersion||a.seed-b.seed)){
 const t=safe(r);
 lines.push('| '+r.mapVersion+' | '+r.seed+' | '+first(t.firstArtillerySeen)+' | '+first(t.firstShot)+
 ' | '+(t.shotsByTargetKind.turret??0)+' | '+(t.gunSeconds['line-blocked']??0)+
 ' | '+(t.gunSeconds['moving-to-waypoint']??0)+' | '+(t.gunSeconds['out-of-range']??0)+
 ' | '+t.attackOrderReplacements+' |');
}
lines.push('','## Grenzen und nächste Experimente','',
 '- Sichtbarkeit und Hindernisse werden am Ende jedes sampled Sekundenintervalls geprüft; kurzzeitige Blockaden können ungezählt bleiben.',
 '- Raketen können nach dem Abschuss verfehlen oder abgefangen werden; gestartete Raketen sind kein garantierter Schaden.',
 '- Diese Diagnose belegt Häufigkeiten, nicht die alleinige Ursache der Zeitlimits.',
 '- Für den nächsten Taktik-Patch zuerst die dominanten Zustände in den elf Zeitlimit-Partien mit Feuerereignissen und Missionswechseln vergleichen.',
 '');
const output=resolve(outputPath);writeFileSync(output,lines.join('\n')+'\n');
const summary={matches:matches.length,wins:winner.length,timeouts:timeout.length,gunSeconds:Object.fromEntries(states.map(k=>[k,total(()=>true,r=>safe(r).gunSeconds?.[k])])),shots:total(()=>true,r=>safe(r).shots),replaced:total(()=>true,r=>safe(r).attackOrderReplacements),stopped:total(()=>true,r=>safe(r).attackOrdersStopped)};
writeFileSync(output.replace(/\.md$/i,'.json'),JSON.stringify(summary,null,2)+'\n');
console.log(lines.slice(0,lines.indexOf('## Zeitlimit-Gefechte: konkrete Diagnose')).join('\n'));
console.log('ARTILLERY_DIAG_JSON='+JSON.stringify(summary));
