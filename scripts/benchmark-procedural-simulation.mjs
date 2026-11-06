#!/usr/bin/env node
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {PerformanceRecorder,setProfiler} from '../dist/src/reborn/performance.js';
const referenceURL=process.env.BATTLEFIELD_REFERENCE_MODULE?pathToFileURL(resolve(process.env.BATTLEFIELD_REFERENCE_MODULE)):null;
const ReferenceSimulation=referenceURL?(await import(referenceURL.href)).Simulation:Simulation;
const referenceProfiler=referenceURL?await import(new URL('./performance.js',referenceURL).href):{PerformanceRecorder,setProfiler};
const rows=[];
for(const [count,reference,current] of [[4,19,23],[16,22,26]])for(const seed of [0,1,2,3])for(const profile of ['reference','open','dunes','rocky','oasis','mixed']){
 const start=performance.now(),cpuStart=process.cpuUsage(),version=profile==='reference'?reference:current;
 const g=(profile==='reference'?ReferenceSimulation:Simulation).campaign(seed,version,profile==='reference'?undefined:profile);
 const perf=profile==='reference'?referenceProfiler:{PerformanceRecorder,setProfiler},recorder=new perf.PerformanceRecorder(false);
 g.highGroundEnabled=true;g.visionScale=1.3;g.infantryVisionBonus=1.15;g.updateVision();perf.setProfiler(recorder);
 const ticks=[];
 for(let tick=0;tick<180*20&&g.status==='playing';tick++){const t=performance.now();g.step(.05);ticks.push(performance.now()-t);}
 perf.setProfiler(null);const cpu=process.cpuUsage(cpuStart);ticks.sort((a,b)=>a-b);
 const summary=recorder.snapshot();
 const row={count,seed,profile,version,seconds:g.time,wallMs:performance.now()-start,cpuMs:(cpu.user+cpu.system)/1000,
  tickMedianMs:ticks[Math.floor(ticks.length*.5)],tickP95Ms:ticks[Math.floor(ticks.length*.95)],tickMaxMs:ticks.at(-1),
  ai:summary.phases.ai,pathfinding:summary.pathfinding,units:g.units.length,sectors:g.territories.filter(t=>t.owner===1).length};
 rows.push(row);console.log(JSON.stringify(row));
}
mkdirSync('docs/qa/procedural-battlefields',{recursive:true});writeFileSync('docs/qa/procedural-battlefields/simulation-performance.json',JSON.stringify({referenceModule:referenceURL?.href??'current implementation with historical map IDs',scope:'48 real 180-second paid AI bootstrap runs. Same settings and seeds for v19/22 reference generation and all five v23/26 profiles. Process CPU excludes external suspension; trajectories differ with geometry, so this is not an identical-state microbenchmark.',rows},null,2)+'\n');
