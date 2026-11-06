#!/usr/bin/env node
/**
 * Strict, reproducible AI 4.1 vs AI 4.1 paired arena report.
 * In contrast to baseline/director comparisons, both reports use director
 * with identical map/seed, opponent, simulation duration, and catalog.
 * A timeout is neither a win nor a loss.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {compareArenaReports} from './ai-test-arena-compare.mjs';

const [beforePath,afterPath,outputPath='ai-arena-results/ai-42-summary.md']=process.argv.slice(2);
if(!beforePath||!afterPath){
 console.error('Usage: node scripts/ai-40-version-report.mjs BEFORE.json AFTER.json [OUTPUT.md]');
 process.exit(2);
}
const before=JSON.parse(readFileSync(resolve(beforePath),'utf8'));
const after=JSON.parse(readFileSync(resolve(afterPath),'utf8'));
const comparison=compareArenaReports(before,after);
if(JSON.stringify(before.modes)!==JSON.stringify(['director']))
 throw Error('Versionsvergleich braucht ausschließlich director gegen director.');
const key=r=>[r.mapVersion,r.seed,r.mode].join(':');
const previous=new Map(before.details.map(r=>[key(r),r]));
const pairs=after.details.map(now=>({old:previous.get(key(now)),now}));
if(pairs.some(p=>!p.old)||pairs.length!==comparison.pairs)
 throw Error('Missing paired arena match.');
const mean=fn=>Math.round(pairs.reduce((n,p)=>n+fn(p),0)/pairs.length*1000)/1000;
const count=(which,status)=>pairs.filter(p=>p[which].outcome===status).length;
const total=(which,fn)=>pairs.reduce((n,p)=>n+fn(p[which]),0);
const delta=fn=>mean(p=>fn(p.now)-fn(p.old));
const measurable=[
 ['Erfolgreiche Bastionseroberungen (Ø)',r=>r.captures??0],
 ['Verlorene Bastionen (Ø)',r=>r.territoriesLost??0],
 ['Eigene Einheitenverluste (Ø)',r=>r.redUnitsLost??0],
 ['Gegnerisches HQ beschädigt (Ø HP)',r=>r.enemyHQDamage??0],
 ['Eigene gebaute Geschütztürme (Ø)',r=>r.paidBuildingsByKind?.turret??0],
 ['Abgebrochene Missionen (Ø)',r=>r.abortedMissions??0],
 ['Steckengebliebene Missionen (Ø)',r=>r.stalledMissions??0],
 ['Score (Ø)',r=>r.score??0]
];
const pct=n=>Math.round(n/pairs.length*1000)/10;
const summary={
 pairedMatches:comparison.pairs,worldMismatches:comparison.worldMismatches.length,
 maps:before.maps,seeds:before.seeds,simulationSeconds:before.requestedSeconds,
 before:before.label,after:after.label,
 win:{before:count('old','win'),after:count('now','win')},
 loss:{before:count('old','loss'),after:count('now','loss')},
 timeout:{before:count('old','timeout'),after:count('now','timeout')},
 deltaMean:{
 captures:delta(r=>r.captures??0),territoriesLost:delta(r=>r.territoriesLost??0),
 redUnitsLost:delta(r=>r.redUnitsLost??0),enemyHQDamage:delta(r=>r.enemyHQDamage??0),
 towersBuilt:delta(r=>r.paidBuildingsByKind?.turret??0),
 abortedMissions:delta(r=>r.abortedMissions??0),stalledMissions:delta(r=>r.stalledMissions??0),
 score:delta(r=>r.score??0)
 }
};
const lines=[
 '# Sandforge – Tactical AI 4.2 gegen AI 4.0','',
 '**Testmethode:** identische Karte, Seed, BLUE-Gegner und Director-Modus; alle Paarungen verwenden denselben spielbaren Startzustand.',
 '',
 '- Vorher: `'+before.label+'`',
 '- Nachher: `'+after.label+'`',
 '- Vergleichbare Schlachtpaare: **'+pairs.length+'**',
 '- Anfangszustand-Abweichungen: **'+comparison.worldMismatches.length+'**',
 '- Kartenversionen: '+before.maps.join(', '),
 '- Seeds: '+before.seeds.join(', '),
 '- Simulationsdauer je Match: '+before.requestedSeconds+' Sekunden',
 '',
 '| Ergebnis | Vorher | AI 4.2 | Differenz |',
 '|---|---:|---:|---:|',
 '| Siege | '+summary.win.before+' | '+summary.win.after+' | '+(summary.win.after-summary.win.before)+' |',
 '| Niederlagen | '+summary.loss.before+' | '+summary.loss.after+' | '+(summary.loss.after-summary.loss.before)+' |',
 '| Zeitlimits (keine Niederlagen!) | '+summary.timeout.before+' | '+summary.timeout.after+' | '+(summary.timeout.after-summary.timeout.before)+' |',
 '| Siege in % aller Gefechte | '+pct(summary.win.before)+' % | '+pct(summary.win.after)+' % | '+(pct(summary.win.after)-pct(summary.win.before)).toFixed(1)+' PP |'
];
for(const [label,get] of measurable){
 const old=mean(p=>get(p.old)),now=mean(p=>get(p.now));
 lines.push('| '+label+' | '+old+' | '+now+' | '+Math.round((now-old)*1000)/1000+' |');
}
lines.push('',
 '## Einzelergebnisse',
 '',
 '| Karte | Seed | Vorher | AI 4.2 | Eroberungen Δ | Verluste Δ | Turmbau Δ | HQ-Schaden Δ |',
 '|---|---:|---|---|---:|---:|---:|---:|');
for(const {old,now} of pairs)lines.push(
 '| '+now.mapVersion+' | '+now.seed+' | '+old.outcome+' | '+now.outcome+
 ' | '+((now.captures??0)-(old.captures??0))+
 ' | '+((now.redUnitsLost??0)-(old.redUnitsLost??0))+
 ' | '+((now.paidBuildingsByKind?.turret??0)-(old.paidBuildingsByKind?.turret??0))+
 ' | '+((now.enemyHQDamage??0)-(old.enemyHQDamage??0))+' |'
);
lines.push('',
 '## Interpretation',
 '',
 'Die Testarena verwendet einen begrenzten, skriptgesteuerten BLUE-Verteidiger und ist kein Ersatz für menschliche Testspieler.',
 'Ein beobachteter Unterschied beweist noch nicht, dass ausschließlich die neuen Lernregeln ursächlich sind.',
 'Eine Änderung der Spielstärke muss an mehreren Seeds und gegen andere Gegnertypen überprüft werden.',
 'Zeitlimits sind nicht als Siege oder Niederlagen gezählt.',
 '',
 '## Reproduzierbarkeit',
 '',
 '- Vorher Simulation SHA-256: `'+before.simulationSourceHash+'`',
 '- Nachher Simulation SHA-256: `'+after.simulationSourceHash+'`',
 '- Gegner SHA-256: `'+before.opponentSourceHash+'`',
 '- Einheitenkatalog SHA-256: `'+before.catalogSourceHash+'`',
 ''
);
const output=resolve(outputPath);
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,lines.join('\n'));
writeFileSync(output.replace(/\.md$/i,'.json'),JSON.stringify(summary,null,2)+'\n');
console.log(lines.slice(0,lines.indexOf('## Einzelergebnisse')).join('\n'));
console.log('\nREPORT_RESULT_JSON='+JSON.stringify(summary));
