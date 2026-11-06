/**
 * CI stress harness for Sandforge's authoritative RTS simulation.
 * Deterministic, synthetic combat load (NOT an AI win-rate benchmark).
 * Four current WebGL campaign versions, simulated-time checkpoints and
 * bounded memory/CPU regressions, with complete JSON evidence.
 */
import {Simulation} from '../dist/src/reborn/simulation.js';
import {performance} from 'node:perf_hooks';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';

const output=resolve(process.env.STRESS_OUTPUT_DIR??'tests/browser/artifacts/stress');
mkdirSync(output,{recursive:true});
const seconds=Math.max(30,Number(process.env.STRESS_SIM_SECONDS??180));
const seed=Number(process.env.STRESS_SEED??2074)>>>0;
const versions=[{bastions:4,version:19},{bastions:8,version:20},
 {bastions:12,version:21},{bastions:16,version:22}];
const maxP95=Math.max(100,Number(process.env.STRESS_MAX_SIM_P95_MS??500));
const maxHeap=Math.max(300,Number(process.env.STRESS_MAX_HEAP_MB??1100));
const q=(items,p)=>{const a=items.slice().sort((x,y)=>x-y);
 return a[Math.min(a.length-1,Math.max(0,Math.ceil(a.length*p)-1))]??0;};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const results=[];
let failures=0;

function injectBattle(game,count){
 const mid=game.world.size/2;
 const obstacles=[...game.obstacles(),...game.bastionColliders()];
 const anchor=game.world.nearest({x:mid,y:mid},obstacles);
 if(!anchor)throw Error('No safe battle anchor in map '+game.world.mapVersion);
 const ids=[[],[]],all=[];
 for(const owner of [0,1]){
  for(let i=0;i<count;i++){
   const row=Math.floor(i/5),col=i%5;
   const desired={x:anchor.x+(owner===0?-210:210)+(owner===0?-1:1)*row*15,
    y:anchor.y+(col-2)*29+row*11};
   const p=game.world.nearest(desired,obstacles);
   if(!p)throw Error('No reachable synthetic spawn '+owner+'/'+i);
   const kind=i%9===0?'tank':i%6===0?'heavy':'infantry';
   const u=game.spawn(owner,p,kind);
   ids[owner].push(u.id);all.push(u);
  }
 }
 for(const owner of [0,1])game.command(ids[owner],
  {x:anchor.x+(owner===0?240:-240),y:anchor.y,kind:'attackMove'});
 game.updateVision();
 return {anchor,units:all,spawned:all.length};
}

for(const scenario of versions){
 const game=Simulation.campaign(seed,scenario.version);
 const injected=injectBattle(game,6+scenario.bastions);
 const runtimes=[[],[],[]],seenHp=new Map(),samples=[];
 let damageEvents=0,deaths=0,peakUnits=0,steps=0;
 for(const u of injected.units)seenHp.set(u.id,u.hp);
 const wallStart=performance.now();
 const totalTicks=Math.ceil(seconds/.05);
 for(let tick=0;tick<totalTicks&&game.status==='playing';tick++){
  const started=performance.now();
  game.step(.05);
  const duration=performance.now()-started;
  if(!Number.isFinite(duration))throw Error('Nonfinite simulation time');
  runtimes[Math.min(2,Math.floor(tick/Math.max(1,totalTicks/3)))].push(duration);
  steps++;
  peakUnits=Math.max(peakUnits,game.units.filter(u=>u.hp>0&&!u.carrier).length);
  for(const u of injected.units){
   const before=seenHp.get(u.id)??u.hp;
   if(u.hp<before){damageEvents++;if(u.hp<=0&&before>0)deaths++;}
   seenHp.set(u.id,u.hp);
  }
  if(tick%400===0||tick===totalTicks-1)
   samples.push({time:game.time,units:game.units.filter(u=>u.hp>0).length,
    heapMB:Math.round(process.memoryUsage().heapUsed/1048576),
    credits:game.credits.slice(),status:game.status});
 }
 const stages=runtimes.map(a=>({ticks:a.length,p50:+q(a,.5).toFixed(3),
  p95:+q(a,.95).toFixed(3),p99:+q(a,.99).toFixed(3),
  max:+Math.max(0,...a).toFixed(3)}));
 const heapMB=+(process.memoryUsage().heapUsed/1048576).toFixed(1);
 const report={...scenario,seed,mode:'deterministic synthetic battle + live AI',
  secondsRequested:seconds,secondsReached:+game.time.toFixed(2),
  wallMs:+(performance.now()-wallStart).toFixed(1),
  status:game.status,steps,peakUnits,combat:{spawned:injected.spawned,
   damageEvents,deaths},stages,heapMB,samples,
  limits:{maxSimP95Ms:maxP95,maxHeapMB:maxHeap}};
 const risks=[];
 if(!steps||!stages.some(x=>x.ticks>0))risks.push('no simulation progress');
 if(!damageEvents)risks.push('no synthetic combat detected');
 if(stages.some(x=>x.p95>maxP95))risks.push('simulation p95 exceeded watchdog');
 if(heapMB>maxHeap)risks.push('heap watchdog exceeded');
 const start=stages[0].p95,end=stages[2].p95;
 const tailWarning=end>Math.max(25,start*3);
 report.warnings=[...(tailWarning?['late-phase simulation p95 substantially above initial phase']:[])];
 report.errors=risks;
 if(risks.length)failures++;
 results.push(report);
 writeFileSync(join(output,'simulation-'+scenario.bastions+'.json'),
  JSON.stringify(report,null,2)+'\n');
 console.log('[stress]',scenario.bastions+' Bastionen',
  'ticks='+steps,'damage='+damageEvents,'p95='+stages.map(x=>x.p95).join('/'),
  'heap='+heapMB+'MB','status='+game.status,
  risks.length?'FAIL '+risks.join('; '):'PASS');
}
writeFileSync(join(output,'simulation-summary.json'),
 JSON.stringify({seed,seconds,failures,results},null,2)+'\n');
if(failures)process.exitCode=1;
