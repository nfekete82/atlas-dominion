import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {cpus} from 'node:os';

const output=resolve(process.argv[2]??'docs/qa/rts-ai-long-term-20261013');
const variants={
  original:resolve(process.argv[3]??'/tmp/atlas-ai-baseline/dist/src/engine/game.js'),
  baseline:resolve(process.argv[4]??'/tmp/atlas-ai-first-opt/dist/src/engine/game.js'),
  candidate:resolve('dist/src/engine/game.js')
};
const seeds=[20261013,20261024,221041];
const thresholds={earlyTerritoryRetention:.95,lateTerritoryRetention:1,
  maximumLossRatio:1,maximumTimingRatio:1.15};
mkdirSync(output,{recursive:true});
const manifest={node:process.version,platform:process.platform,arch:process.arch,
  cpu:cpus()[0]?.model,seeds,thresholds,warmupTicks:360,observer:true,variants:{}};
for(const [name,module] of Object.entries(variants)){
  manifest.variants[name]={module,hashes:{}};
  for(const file of ['game.js','rts-path.js','rts-frontage.js','navigation.js']){
    try{manifest.variants[name].hashes[file]=createHash('sha256')
      .update(readFileSync(join(dirname(module),file))).digest('hex');}catch{}
  }
}
writeFileSync(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const matrix=[];
// Serial paired processes: no tests or competing benchmark processes should
// run concurrently. Every checkpoint is an actual elapsed simulation tick.
for(const opponents of [8,49])for(const seed of seeds){
  const reports={};
  for(const [name,module] of Object.entries(variants)){
    const result=spawnSync(process.execPath,['--expose-gc','scripts/rts-ai-long-run.mjs',
      String(seed),String(opponents),module,'1000','--warmup',
      ...(seed===seeds[0]&&opponents===8?['--trace']:[])],{encoding:'utf8',maxBuffer:16*1024*1024});
    if(result.status!==0)throw Error(`${name}/${opponents}/${seed}: ${result.stderr}`);
    const report=JSON.parse(result.stdout);reports[name]=report;
    writeFileSync(join(output,`${name}-${opponents+1}-${seed}.json`),result.stdout);
    console.log(`${name}: ${opponents+1} countries, seed ${seed}, `+
      `1000 ticks, territory ${report.checkpoints.at(-1).territory}, `+
      `losses ${report.checkpoints.at(-1).realLosses.toFixed(2)}`);
  }
  for(const candidate of reports.candidate.checkpoints){
    const baseline=reports.baseline.checkpoints.find(r=>r.ticks===candidate.ticks);
    const original=reports.original.checkpoints.find(r=>r.ticks===candidate.ticks);
    const checks={
      territory:candidate.territory>=baseline.territory*(candidate.ticks===1000?
        thresholds.lateTerritoryRetention:thresholds.earlyTerritoryRetention),
      losses:candidate.realLosses<=baseline.realLosses*thresholds.maximumLossRatio+1e-6,
      median:candidate.performance.median<=baseline.performance.median*thresholds.maximumTimingRatio,
      p95:candidate.performance.p95<=baseline.performance.p95*thresholds.maximumTimingRatio,
      p99:candidate.performance.p99<=baseline.performance.p99*thresholds.maximumTimingRatio,
      movement:candidate.invalidMoves===0,
      conservation:reports.candidate.conservation.violatingTicks===0
    };
    matrix.push({countries:opponents+1,seed,ticks:candidate.ticks,original,baseline,candidate,
      checks,accepted:Object.values(checks).every(Boolean)});
  }
  writeFileSync(join(output,'matrix.json'),JSON.stringify({thresholds,rows:matrix},null,2)+'\n');
}
console.log(`Accepted ${matrix.filter(row=>row.accepted).length}/${matrix.length} comparisons`);
