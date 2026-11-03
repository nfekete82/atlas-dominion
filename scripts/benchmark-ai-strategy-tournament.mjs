#!/usr/bin/env node
/** Deterministic AI strategy tournament on real four-bastion simulation.
 * No paid/unpaid shortcuts, no opponent fog inspection or unit stat changes.
 * Any neutral result remains a timeout, not an AI victory.
 */
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {Simulation as Engine} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {TOURNAMENT_OPPONENTS,blueTournamentOpponent} from './ai-tournament-opponents.mjs';
import {AI_CANDIDATES,tournamentRating,aggregateTournament,qualifyCandidate} from './ai-tournament-rankings.mjs';

const argv=process.argv.slice(2);
function option(name,fallback){
 const i=argv.indexOf('--'+name);
 return i<0?fallback:argv[i+1];
}
const seconds=Number(option('seconds','300'));
const seeds=String(option('seeds','2026,2027')).split(',').map(Number);
const opponents=String(option('opponents','guarded,rush,expansion,armor,siege')).split(',');
const policies=String(option('policies','current,classicPlanner,fastWaves,legacyDoctrine,baseline')).split(',');
const output=resolve(String(option('output','ai-arena-results/strategy-tournament.json')));
if(!Number.isInteger(seconds)||seconds<90||seconds>900||
 seeds.length<1||seeds.length>16||seeds.some(s=>!Number.isSafeInteger(s)||s<0)||
 new Set(seeds).size!==seeds.length||opponents.length<1||policies.length<2||
 opponents.some(o=>!TOURNAMENT_OPPONENTS.includes(o))||
 policies.some(p=>!Object.hasOwn(AI_CANDIDATES,p))||
 !policies.includes('current')||new Set(policies).size!==policies.length||
 new Set(opponents).size!==opponents.length)
 throw Error('Invalid tournament options: require current, 1+ competitors, supported BLUE opponents and unique seeds.');
const rows=[];
for(const opponent of opponents){
 for(const seed of seeds){
  let firstHash=null;
  for(const policy of policies){
   const cfg=AI_CANDIDATES[policy];
   class Candidate extends Engine{
    constructor(seed,version){
     super(seed,version);
     this.tactical.planningMode=cfg.planningMode;
     this.tactical.waveMode=cfg.waveMode;
     this.tactical.doctrineMode=cfg.doctrineMode;
    }
   }
   let lastSec=0,redSectorSeconds=0,blueSectorSeconds=0,neutralSectorSeconds=0;
   const m=runMatch({Simulation:Candidate,UNITS},{
    seconds,opponent:'guarded',label:opponent+':'+policy,
    defender:g=>blueTournamentOpponent(g,opponent),
    observe:g=>{
     // Runtime-only A/B transition, never changes credits, fog, game rules
     // or the persisted default. The director inherits only real game state.
     if(cfg.switchAt&&g.time>=cfg.switchAt&&g.tactical.mode==='baseline')
      g.tactical.mode='director';
     const second=Math.floor(g.time+1e-8);
     if(second<=lastSec)return;
     const elapsed=Math.min(second,seconds)-lastSec;
     if(elapsed<=0)return;
     const owners=g.territories.map(t=>t.owner);
     redSectorSeconds+=owners.filter(v=>v===1).length*elapsed;
     blueSectorSeconds+=owners.filter(v=>v===0).length*elapsed;
     neutralSectorSeconds+=owners.filter(v=>v===-1).length*elapsed;
     lastSec=second;
    }
   },seed,cfg.mode,11);
   if(firstHash!==null&&firstHash!==m.initialStateHash)
    throw Error('A/B initial-state mismatch for '+seed+'/'+opponent+'/'+policy);
   firstHash=m.initialStateHash;
   const row={
    seed,opponent,policy,initialHash:m.initialStateHash,
    outcome:m.outcome,elapsedSeconds:m.elapsedSeconds,
    captures:m.captures,netCaptures:m.netCaptures,redSectors:m.redSectors,
    redUnitsLost:m.redUnitsLost,blueUnitsLost:m.blueUnitsLost,
    redUnitDamage:m.redUnitDamage,blueUnitDamage:m.blueUnitDamage,
    enemyHQDamage:m.enemyHQDamage,firstAssault:m.firstAssault,
    abortedMissions:m.abortedMissions,
    redCredits:m.redCredits,paidRecruitCredits:m.paidRecruitCredits,
    paidBuildCredits:m.paidBuildCredits,
    bluePaidRecruitCredits:m.bluePaidRecruitCredits,
    bluePaidBuildCredits:m.bluePaidBuildCredits,
    redSectorSeconds,blueSectorSeconds,neutralSectorSeconds,
    wallMs:m.wallMs
   };
   row.rating=tournamentRating(row);
   rows.push(row);
   console.log(`opponent=${opponent} seed=${seed} candidate=${policy} result=${row.outcome} captures=${row.captures} sectors=${row.redSectorSeconds} losses=${row.redUnitsLost} damage=${row.enemyHQDamage}`);
  }
 }
}
const standings=aggregateTournament(rows),qualification=Object.fromEntries(
 policies.filter(p=>p!=='current').map(p=>[p,qualifyCandidate(rows,p)]));
const report={schemaVersion:1,description:'Deterministic paid-BLUE tournament, same seeded world for each RED candidate; timeouts are not wins. No human win-rate claims.',
 mapVersion:11,seconds,seeds,opponents,policies,standings,qualification,rows};
const fmt=v=>typeof v==='number'?Number(v.toFixed(2)).toString():String(v);
const md=[
 '# Sandforge AI — Vier-Bastionen-Strategieturnier',
 '',
 `Seeds: ${seeds.join(', ')} · Simulierte Sekunden: ${seconds} · Gegner: ${opponents.join(', ')}`,
 '',
 'Alle Ergebnisse stammen aus denselben Startzuständen. Gegner zahlen regulär für Bau und Produktion. Zeitlimits sind **keine Siege**.',
 '',
 '| Strategie | Spiele | Siege | Niederlagen | Timeouts | Ø Bastioneroberungen | Ø eigene Verluste | Ø Sektor-Sekunden | Ø HQ-Schaden |',
 '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
 ...standings.map(s=>`| ${s.policy} | ${s.matches} | ${s.wins} | ${s.losses} | ${s.timeouts} | ${fmt(s.meanCaptures)} | ${fmt(s.meanRedDeaths)} | ${fmt(s.meanRedSectorSeconds)} | ${fmt(s.meanHQDamage)} |`),
 '',
 '## Vergleich zur bestehenden Strategie (current)',
 '',
 ...Object.entries(qualification).map(([p,r])=>`- **${p}**: ${r.qualified?'Kandidat für unabhängigen Holdout-Test':'Nicht qualifiziert'} – ${r.reason}`),
 '',
 'Der Rang ist ein **Analyseindikator**, keine Human-Siegquote. Keine automatische Aktivierung einer Variante.',
 '',
 '## Beobachtbare Regeln',
 '',
 '- BLUE nimmt nur öffentliche Sektorbesitzverhältnisse und eigene Ressourcen/Einheiten als Eingaben.',
 '- RED-Spielregeln, Fog of War, Preise, Trefferpunkte und Startzustand bleiben identisch.',
 '- Echte Spielausgänge werden vor jeder Ersatzkennzahl bewertet.',
 '- Für eine Freigabe sind zusätzlich unabhängige Seeds, stärkere Gegner und menschliche Partien notwendig.'
].join('\n')+'\n';
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
writeFileSync(output.replace(/\.json$/,'-summary.md'),md);
console.log('\n'+md);
console.log('JSON: '+output);
