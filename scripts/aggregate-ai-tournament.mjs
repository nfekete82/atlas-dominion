#!/usr/bin/env node
/** Deterministic cross-opponent leaderboard from separate GitHub Actions jobs.
 * Fail closed if any opponent/seed/policy report is missing or inconsistent.
 */
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {TOURNAMENT_OPPONENTS} from './ai-tournament-opponents.mjs';
import {aggregateTournament,qualifyCandidate} from './ai-tournament-rankings.mjs';

const cli=process.argv.slice(2);
const option=(name,defaultValue)=>{const i=cli.indexOf('--'+name);return i<0?defaultValue:cli[i+1];};
const input=resolve(option('dir','ai-arena-results'));
const output=resolve(option('output','ai-arena-results/strategy-overall.json'));
const required=option('opponents',TOURNAMENT_OPPONENTS.join(',')).split(',');
if(!required.length||required.some(p=>!TOURNAMENT_OPPONENTS.includes(p))||
 new Set(required).size!==required.length)throw Error('Invalid opponent list');
const files=readdirSync(input).filter(s=>/^tournament-(guarded|rush|expansion|armor|siege)\.json$/.test(s));
const docs=files.map(file=>JSON.parse(readFileSync(resolve(input,file),'utf8')));
if(docs.length!==required.length)throw Error('Incomplete tournament: found '+files.join(', '));
const rows=[],metas=[];
for(const doc of docs){
 if(doc.schemaVersion!==1||doc.mapVersion!==11||doc.opponents.length!==1)
  throw Error('Invalid source tournament metadata');
 const opponent=doc.opponents[0];
 if(!required.includes(opponent)||rows.some(row=>row.opponent===opponent))
  throw Error('Unexpected or duplicate opponent '+opponent);
 const sig=JSON.stringify({seeds:doc.seeds,policies:doc.policies,seconds:doc.seconds});
 metas.push(sig);
 if(metas[0]!==sig)throw Error('Mismatched tournament seeds/policies/duration');
 if(doc.rows.length!==doc.seeds.length*doc.policies.length)
  throw Error('Missing paired matches for '+opponent);
 for(const row of doc.rows){
  if(row.opponent!==opponent||!doc.seeds.includes(row.seed)||
     !doc.policies.includes(row.policy)||!['win','loss','timeout'].includes(row.outcome))
   throw Error('Inconsistent match row');
  rows.push(row);
 }
}
if(required.some(op=>!docs.some(d=>d.opponents[0]===op)))throw Error('Missing a BLUE opponent');
const seen=new Set();
for(const r of rows){
 const key=[r.opponent,r.seed,r.policy].join(':');
 if(seen.has(key))throw Error('Duplicate match '+key);
 seen.add(key);
 const anchor=rows.find(x=>x.opponent===r.opponent&&x.seed===r.seed&&x.policy==='current');
 if(!anchor||r.initialHash!==anchor.initialHash)throw Error('Unpaired playable world '+key);
}
const standings=aggregateTournament(rows);
const candidates=Object.fromEntries(docs[0].policies.filter(p=>p!=='current')
 .map(p=>[p,qualifyCandidate(rows,p)]));
const total=rows.length,meta={...JSON.parse(metas[0]),opponents:required};
const obj={schemaVersion:1,total,meta,standings,candidates,rows,
 description:'Five paid scripted BLUE opponents; win rate is versus these scripts only. Do not infer human skill or auto-promote AI.'};
const fmt=v=>typeof v==='number'?v.toFixed(2):String(v);
const markdown=[
 '# Sandforge · KI-Turnier (vier Bastionen)',
 '',
 `**${total} echte Simulationen**, ${meta.seconds} Sekunden je Partie, ${meta.seeds.length} Seeds, ${required.length} BLUE-Gegnerprofile.`,
 '',
 'Sieg/Niederlage vor allen Sekundärwerten; Timeouts sind unentschieden. Jeder RED-Kandidat erhält identische Startbedingungen.',
 '',
 '| RED-Strategie | Siege | Niederlagen | Timeouts | Ø Eroberungen | Ø eigene Verluste | Ø Sektor-Sekunden | Ø HQ-Schaden |',
 '|---|---:|---:|---:|---:|---:|---:|---:|',
 ...standings.map(s=>`| ${s.policy} | ${s.wins} | ${s.losses} | ${s.timeouts} | ${fmt(s.meanCaptures)} | ${fmt(s.meanRedDeaths)} | ${fmt(s.meanRedSectorSeconds)} | ${fmt(s.meanHQDamage)} |`),
 '',
 '## Freigabeprüfung gegen die bisherige KI',
 '',
 ...Object.entries(candidates).map(([policy,result])=>`- **${policy}**: ${result.qualified?'Vorläufiger Kandidat, weiterer Holdout erforderlich':'Nicht freigeben'} — ${result.reason}`),
 '',
 '**Keine der Varianten wird automatisch aktiviert.** Für eine Freigabe sind unabhängige Seeds, längere Partien und Spiele gegen Menschen erforderlich.',
 ''
].join('\n');
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify(obj,null,2)+'\n');
writeFileSync(output.replace(/\.json$/,'-summary.md'),markdown+'\n');
console.log(markdown);
