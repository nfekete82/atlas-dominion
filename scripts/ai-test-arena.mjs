#!/usr/bin/env node
/**
 * Headless arena: 3 playable campaign layouts x 8 identical seeds x 2 tactics = 48 matches.
 * Run after build: npm run benchmark:arena
 *
 * Smaller smoke:
 * node scripts/ai-test-arena.mjs --maps 3 --seeds 2026 --seconds 60 --modes baseline,director
 *
 * A timeout is NEVER a win or a loss. Generated reports are resumable artifacts, not savegames.
 */
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,renameSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {parseOptions,runMatch,summarize} from './benchmark-reborn-ai.mjs';
import {analyzeArena,arenaMarkdown} from './ai-test-arena-analysis.mjs';

const defaults={
 maps:'3,4,5',
 seeds:'2026,2027,2028,2029,2030,2031,2032,2033',
 seconds:'240',
 modes:'baseline,director',
 opponent:'guarded',
 label:'sandforge-arena'
};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const defaultOutput='ai-arena-results/latest.json';

export function arenaOptions(argv){
 const supplied=new Set(argv.filter(a=>a.startsWith('--')).map(a=>a.slice(2)));
 const initial=Object.entries(defaults).filter(([key])=>!supplied.has(key)).flatMap(([key,val])=>['--'+key,val]);
 const parsed=parseOptions([...initial,...argv]);
 parsed.output??=resolve(defaultOutput);
 return parsed;
}

export async function runArena(options){
 const simulationURL=new URL('../dist/src/reborn/simulation.js',import.meta.url);
 const catalogURL=new URL('../dist/src/reborn/catalog.js',import.meta.url);
 const [{Simulation},{UNITS},performanceModule]=await Promise.all([
  import(simulationURL.href),import(catalogURL.href),
  import(new URL('../dist/src/reborn/performance.js',import.meta.url).href)
 ]);
 const output=resolve(options.output??defaultOutput);
 const sha=file=>digest(readFileSync(file));
 const details=[];
 const report={
  schemaVersion:1,label:options.label,generatedAt:new Date().toISOString(),
  simulationSourceHash:sha(simulationURL),catalogSourceHash:sha(catalogURL),
  opponentSourceHash:sha(new URL('./benchmark-ai-opponent.mjs',import.meta.url)),
  benchmarkSourceHash:sha(new URL('./benchmark-reborn-ai.mjs',import.meta.url)),
  maps:options.maps,seeds:options.seeds,modes:options.modes,opponent:options.opponent,
  requestedSeconds:options.seconds,timestep:0.05,expectedRuns:options.maps.length*options.seeds.length*options.modes.length,
  completedRuns:0,complete:false,summary:{},analysis:null,details
 };
 const persist=()=>{
  report.completedRuns=details.length;
  report.complete=details.length===report.expectedRuns;
  report.summary=summarize(details);
  report.analysis=analyzeArena(report);
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output+'.tmp',JSON.stringify(report,null,2)+'\n');
  renameSync(output+'.tmp',output);
  const markdown=output.replace(/\.json$/i,'')+'.md';
  writeFileSync(markdown+'.tmp',arenaMarkdown(report));
  renameSync(markdown+'.tmp',markdown);
 };
 persist();
 const start=performance.now();
 for(const version of options.maps){
  for(const seed of options.seeds){
   for(const mode of options.modes){
    const r=runMatch({Simulation,UNITS,performanceModule},options,seed,mode,version);
    details.push(r);
    persist();
    console.log('['+details.length+'/'+report.expectedRuns+'] map='+version+' seed='+seed+' mode='+mode+
     ' outcome='+r.outcome+' captures='+r.captures+' HQdamage='+r.enemyHQDamage+
     ' redLosses='+r.redUnitsLost+' wallMs='+r.wallMs);
   }
  }
 }
 const seconds=((performance.now()-start)/1000).toFixed(1);
 console.log('\nArena complete: '+details.length+' matches, '+seconds+'s wall time');
 console.log('JSON: '+output);
 console.log('Markdown: '+output.replace(/\.json$/i,'')+'.md');
 console.log('Comparable mode pairs: '+report.analysis.modeComparison.pairs);
 console.log('Top observed signals: '+report.analysis.topSignals.slice(0,3).map(x=>x.id+':'+x.matches).join(', '));
 return report;
}

async function main(){
 try{await runArena(arenaOptions(process.argv.slice(2)));}
 catch(e){console.error('AI arena failed: '+(e?.stack??e));process.exitCode=1;}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
