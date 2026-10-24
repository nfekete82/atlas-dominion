#!/usr/bin/env node
/**
 * Deterministic whole-match macro benchmark. Uses actual simulation steps,
 * building queues, pathfinding, fighting and bastion capture.
 * No extra units, free money, revealed fog or hidden developer cheats.
 *
 * node scripts/benchmark-reborn-ai.mjs --map 4 --seeds 2026,2027,2028 --seconds 240
 */
import {Simulation} from '../dist/src/reborn/simulation.js';
import {performance} from 'node:perf_hooks';

const options=Object.fromEntries(process.argv.slice(2).flatMap((value,i,all)=>value.startsWith('--')
  ?[[value.slice(2),all[i+1]]]:[]));
const version=Number(options.map??4);
const seconds=Number(options.seconds??240);
const seeds=String(options.seeds??'2026,2027,2028').split(',').map(Number);
if(![3,4,5].includes(version)||!Number.isInteger(seconds)||seconds<30||seconds>900
  ||seeds.length<1||seeds.length>24||seeds.some(v=>!Number.isSafeInteger(v)||v<0||v>4294967295)){
 console.error('Usage: node scripts/benchmark-reborn-ai.mjs --map 3|4|5 --seeds 2026,2027 --seconds 240');
 process.exitCode=2;
}else{
 const run=(seed,mode)=>{
  const g=new Simulation(seed,version);g.tactical.mode=mode;
  const starting={blue:g.units.filter(u=>u.owner===0).length,
   redSectors:g.territories.filter(t=>t.owner===1).length,credits:g.credits[1]};
  const metrics={seed,mode,seconds,initialCredits:starting.credits,
   firstAssault:null,firstVehicle:null,firstFactory:null,firstFrontContact:null,
   finishedBuildings:0,vehicles:0,redSectors:starting.redSectors,captures:0,
   blueUnitsLost:0,blueHeadquartersHp:null,redUnits:0,redCredits:0,
   attackingSeconds:0,productiveFactorySeconds:0,productiveBarracksSeconds:0,
   productiveAirfieldSeconds:0,phaseTransitions:0,score:0,wallMs:0};
  const types=new Set(['tank','rover','artillery','gunship','bomber','scout']);
  let phase=g.tactical.state.phase;
  const begin=performance.now();
  const steps=Math.round(seconds/.05);
  for(let step=0;step<steps&&g.status==='playing';step++){
   g.step(.05);
   if(step%20!==0)continue;
   const time=Math.round(g.time),red=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier);
   const available=red.filter(u=>types.has(u.kind));
   const own=g.bases.filter(b=>b.owner===1&&b.hp>0);
   const factory=own.find(b=>b.kind==='factory'&&b.buildRemaining===0);
   const otherBuildings=own.filter(b=>['barracks','factory','airfield'].includes(b.kind)&&b.buildRemaining===0);
   if(metrics.firstFactory===null&&factory)metrics.firstFactory=time;
   if(metrics.firstVehicle===null&&available.length)metrics.firstVehicle=time;
   if(metrics.firstAssault===null&&g.tactical.state.phase==='attack')metrics.firstAssault=time;
   if(g.tactical.state.phase==='attack')metrics.attackingSeconds++;
   if(phase!==g.tactical.state.phase){metrics.phaseTransitions++;phase=g.tactical.state.phase;}
   for(const b of otherBuildings)if(b.queue.length){
    if(b.kind==='factory')metrics.productiveFactorySeconds++;
    if(b.kind==='barracks')metrics.productiveBarracksSeconds++;
    if(b.kind==='airfield')metrics.productiveAirfieldSeconds++;
   }
   const activeFront=red.some(u=>!['engineer','medic','scout'].includes(u.kind)
    &&g.territories.some(t=>t.owner!==1&&Math.hypot(t.point.x-u.x,t.point.y-u.y)<220));
   if(metrics.firstFrontContact===null&&activeFront)metrics.firstFrontContact=time;
  }
  metrics.wallMs=Math.round(performance.now()-begin);
  metrics.redSectors=g.territories.filter(t=>t.owner===1).length;
  metrics.captures=Math.max(0,metrics.redSectors-starting.redSectors);
  metrics.blueUnitsLost=Math.max(0,starting.blue-g.units.filter(u=>u.owner===0&&u.hp>0).length);
  metrics.blueHeadquartersHp=g.bases.find(b=>b.kind==='headquarters'&&b.territory===g.world.territories(seed).find(t=>t.owner===0)?.id)?.hp??0;
  metrics.redUnits=g.count(1);
  metrics.redCredits=Math.round(g.credits[1]);
  metrics.vehicles=g.units.filter(u=>u.owner===1&&types.has(u.kind)&&u.hp>0).length;
  metrics.finishedBuildings=g.bases.filter(b=>b.owner===1&&b.hp>0&&b.buildRemaining===0&&['factory','barracks','airfield'].includes(b.kind)).length;
  metrics.score=metrics.captures*100+metrics.blueUnitsLost*20+(metrics.firstFrontContact!==null?10:0)
   +Math.min(6,metrics.vehicles)*4;
  return metrics;
 };
 const details=[];
 for(const seed of seeds)for(const mode of ['baseline','director']) {
  const result=run(seed,mode);details.push(result);
  console.log(mode.padEnd(8),'seed='+seed,
   'sectors='+result.redSectors,'captures='+result.captures,
   'vehicles='+result.vehicles,'firstFront='+String(result.firstFrontContact??'none'),
   'factory='+String(result.firstFactory??'none'),'assaultSeconds='+result.attackingSeconds,
   'score='+result.score,'wallMs='+result.wallMs);
 }
 const avg=(mode,key)=>Number((details.filter(r=>r.mode===mode).reduce((n,r)=>n+r[key],0)/seeds.length).toFixed(2));
 const summary={mapVersion:version,simulatedSeconds:seconds,seeds,
  baseline:{meanCaptures:avg('baseline','captures'),meanVehicles:avg('baseline','vehicles'),
   meanScore:avg('baseline','score'),meanAttackingSeconds:avg('baseline','attackingSeconds')},
  director:{meanCaptures:avg('director','captures'),meanVehicles:avg('director','vehicles'),
   meanScore:avg('director','score'),meanAttackingSeconds:avg('director','attackingSeconds')},
  details};
 console.log('\nAI BENCHMARK JSON\n'+JSON.stringify(summary,null,2));
 if(summary.director.meanCaptures<=summary.baseline.meanCaptures)
  console.log('\nNOTE: The director has not improved captured territory on these seeds. Investigate before declaring victory.');
}
