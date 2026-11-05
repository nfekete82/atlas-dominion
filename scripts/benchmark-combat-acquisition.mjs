/** Isolated target lookup benchmark. Run after build; an optional reference
 * simulation module must come from a complete copy of dist/src/reborn. */
import {performance} from 'node:perf_hooks';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const reference=process.argv[2];
const modules=[['current',new URL('../dist/src/reborn/simulation.js',import.meta.url)]];
if(reference)modules.unshift(['reference',pathToFileURL(resolve(reference))]);
const loaded=await Promise.all(modules.map(async([label,url])=>({label,url,sourceHash:createHash('sha256').update(readFileSync(url)).digest('hex'),Simulation:(await import(url)).Simulation})));
const result={scope:'CPU-only acquisition; not browser FPS',environment:{node:process.version,platform:process.platform,arch:process.arch},modules:loaded.map(({label,url,sourceHash})=>({label,module:url.href,sourceHash})),units:96,iterations:1000,samples:7,scenarios:{}};
for(const scenario of ['idle','locked','manual']){
 const fixtures=loaded.map(({label,Simulation})=>{
  const g=new Simulation(2026,14);g.aiClock=-1e8;g.units=[];g.world.blocked.fill(0);g.world.opaque.fill(0);
  const teams=[[],[]];
  for(let owner=0;owner<2;owner++)for(let i=0;i<48;i++)teams[owner].push(g.spawn(owner,{x:1000+owner*(scenario==='idle'?1300:120)+i%8*8,y:1400+Math.floor(i/8)*12},'infantry'));
  g.step();g.updateVision();
  for(let i=0;i<48;i++)for(const owner of [0,1]){
   const u=teams[owner][i],enemy=teams[1-owner][i];
   if(scenario==='locked')u.combatTarget=enemy.id;
   if(scenario==='manual')u.orders=[{kind:'attack',target:enemy.id,x:enemy.x,y:enemy.y}];
  }
  return {label,g,times:[]};
 });
 const run=g=>{const at=performance.now();for(let n=0;n<result.iterations;n++)for(const u of g.units)g.acquire(u);return performance.now()-at;};
 for(const f of fixtures)run(f.g);
 for(let sample=0;sample<result.samples;sample++)for(const f of sample%2?[...fixtures].reverse():fixtures)f.times.push(run(f.g));
 result.scenarios[scenario]=Object.fromEntries(fixtures.map(f=>[f.label,{medianMs:[...f.times].sort((a,b)=>a-b)[3],samplesMs:f.times}]));
}
console.log(JSON.stringify(result,null,2));
