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
import {blueDefense} from './benchmark-ai-opponent.mjs';
import {UNITS} from '../dist/src/reborn/catalog.js';

const options=Object.fromEntries(process.argv.slice(2).flatMap((value,i,all)=>value.startsWith('--')
  ?[[value.slice(2),all[i+1]]]:[]));
const version=Number(options.map??4);
const seconds=Number(options.seconds??240);
const seeds=String(options.seeds??'2026,2027,2028').split(',').map(Number);
const opponent=String(options.opponent??'guarded');
if(![3,4,5].includes(version)||!['guarded','idle'].includes(opponent)||!Number.isInteger(seconds)||seconds<30||seconds>900
  ||seeds.length<1||seeds.length>24||seeds.some(v=>!Number.isSafeInteger(v)||v<0||v>4294967295)){
 console.error('Usage: node scripts/benchmark-reborn-ai.mjs --map 3|4|5 --seeds 2026,2027 --seconds 240 --opponent guarded|idle');
 process.exitCode=2;
}else{
 const run=(seed,mode)=>{
  const g=new Simulation(seed,version);g.tactical.mode=mode;
  const starting={blue:g.units.filter(u=>u.owner===0).length,
   redSectors:g.territories.filter(t=>t.owner===1).length,credits:g.credits[1]};
  const metrics={seed,mode,opponent,requestedSeconds:seconds,elapsedSeconds:0,terminalStatus:'playing',initialCredits:starting.credits,
   firstAssault:null,firstVehicle:null,firstFactory:null,firstFrontContact:null,
   finishedBuildings:0,vehicles:0,peakVehicles:0,vehiclesOrdered:0,vehicleOrdersByKind:{},redSectors:starting.redSectors,captures:0,
   blueUnitsLost:0,blueUnitDamage:0,blueHeadquartersHp:null,redUnits:0,redCredits:0,
   firstVehicleShot:null,vehicleShots:0,firstEnemyContact:null,
   vehicleDeaths:0,vehicleRepairHp:0,vehicleEvacuations:0,vehicleReturned:0,
   attackingSeconds:0,productiveFactorySeconds:0,productiveBarracksSeconds:0,
   productiveAirfieldSeconds:0,phaseTransitions:0,score:0,wallMs:0};
  const types=new Set(['tank','rover','artillery','gunship','bomber','scout']);
  let phase=g.tactical.state.phase;
  let previousBlue=new Map(g.units.filter(u=>u.owner===0&&u.hp>0).map(u=>[u.id,u.hp]));
  let previousVehicles=new Set(g.units.filter(u=>u.owner===1&&u.hp>0&&types.has(u.kind)).map(u=>u.id));
  let previousVehicleRecovery=new Set();
  const begin=performance.now();
  const steps=Math.round(seconds/.05);
  for(let step=0;step<steps&&g.status==='playing';step++){
   if(opponent==='guarded'&&step%60===0)blueDefense(g);
   g.step(.05);
   metrics.elapsedSeconds=Number(g.time.toFixed(2));
   // Track deaths by persistent ID, not starting count minus the current
   // count: the defender produces replacement units during the benchmark.
   const currentBlue=new Map(g.units.filter(u=>u.owner===0&&u.hp>0).map(u=>[u.id,u.hp]));
   for(const [id,hp] of previousBlue){
    const remaining=currentBlue.get(id);
    if(remaining===undefined){metrics.blueUnitsLost++;metrics.blueUnitDamage+=hp;}
    else metrics.blueUnitDamage+=Math.max(0,hp-remaining);
   }
   previousBlue=currentBlue;
   const aliveVehicles=new Set(g.units.filter(u=>u.owner===1&&u.hp>0&&types.has(u.kind)).map(u=>u.id));
   for(const id of previousVehicles)if(!aliveVehicles.has(id))metrics.vehicleDeaths++;
   previousVehicles=aliveVehicles;
   const recovery=new Set((g.tactical.state.recovering??[]).filter(id=>g.units.some(u=>
    u.id===id&&u.owner===1&&['tank','rover','artillery'].includes(u.kind))));
   for(const id of recovery)if(!previousVehicleRecovery.has(id))metrics.vehicleEvacuations++;
   for(const id of previousVehicleRecovery)if(!recovery.has(id)){
    const vehicle=g.units.find(u=>u.id===id&&u.owner===1&&u.hp>0);
    if(vehicle&&vehicle.hp>=.9*(UNITS[vehicle.kind]?.hp??Infinity))
     metrics.vehicleReturned++;
   }
   previousVehicleRecovery=recovery;
   for(const effect of g.workEffects)if(effect.kind==='repair'&&Math.abs(effect.at-g.time)<1e-8
    &&g.units.some(u=>u.id===effect.target&&u.owner===1&&['tank','rover','artillery'].includes(u.kind)))
    metrics.vehicleRepairHp+=effect.amount;
   for(const shot of g.shots)if(shot.owner===1&&Math.abs(shot.at-g.time)<1e-8&&types.has(shot.kind)){
    metrics.vehicleShots++;
    if(metrics.firstVehicleShot===null)metrics.firstVehicleShot=Number(g.time.toFixed(1));
   }
   if(step%20!==0)continue;
   const time=Math.round(g.time),red=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier);
   if(metrics.firstEnemyContact===null&&red.some(u=>g.units.some(v=>v.owner===0&&v.hp>0&&!v.carrier
     &&g.canSee(1,v)&&Math.hypot(v.x-u.x,v.y-u.y)<=Math.max(400,Math.min(690,u.kind==='artillery'?690:400)))))
    metrics.firstEnemyContact=time;
   const available=red.filter(u=>types.has(u.kind));
   metrics.peakVehicles=Math.max(metrics.peakVehicles,available.length);
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
  metrics.terminalStatus=g.status;
  metrics.vehicleOrdersByKind=Object.fromEntries(Object.entries(g.tactical.state.economy?.produced??{})
   .filter(([kind])=>types.has(kind)));
  metrics.vehiclesOrdered=Object.values(metrics.vehicleOrdersByKind).reduce((n,count)=>n+count,0);
  metrics.redSectors=g.territories.filter(t=>t.owner===1).length;
  metrics.captures=Math.max(0,metrics.redSectors-starting.redSectors);
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
   'peakVehicles='+result.peakVehicles,'orderedVehicles='+result.vehiclesOrdered,
   'ordersByKind='+JSON.stringify(result.vehicleOrdersByKind),
   'playedSeconds='+result.elapsedSeconds,'status='+result.terminalStatus,
   'blueDeaths='+result.blueUnitsLost,'vehicleShots='+result.vehicleShots,
   'vehicleDeaths='+result.vehicleDeaths,'vehicleRepairHp='+Math.round(result.vehicleRepairHp),
   'evacuations='+result.vehicleEvacuations,'returned='+result.vehicleReturned,
   'firstFront='+String(result.firstFrontContact??'none'),
   'factory='+String(result.firstFactory??'none'),'assaultSeconds='+result.attackingSeconds,
   'score='+result.score,'wallMs='+result.wallMs);
 }
 const avg=(mode,key)=>Number((details.filter(r=>r.mode===mode).reduce((n,r)=>n+r[key],0)/seeds.length).toFixed(2));
 const summary={mapVersion:version,requestedSeconds:seconds,opponent,seeds,
  baseline:{meanCaptures:avg('baseline','captures'),meanBlueDeaths:avg('baseline','blueUnitsLost'),meanVehicleShots:avg('baseline','vehicleShots'),meanVehicleDeaths:avg('baseline','vehicleDeaths'),meanVehicleRepairHp:avg('baseline','vehicleRepairHp'),meanEvacuations:avg('baseline','vehicleEvacuations'),meanReturned:avg('baseline','vehicleReturned'),meanPeakVehicles:avg('baseline','peakVehicles'),meanVehiclesOrdered:avg('baseline','vehiclesOrdered'),meanPlayedSeconds:avg('baseline','elapsedSeconds'),meanVehicles:avg('baseline','vehicles'),
   meanScore:avg('baseline','score'),meanAttackingSeconds:avg('baseline','attackingSeconds')},
  director:{meanCaptures:avg('director','captures'),meanBlueDeaths:avg('director','blueUnitsLost'),meanVehicleShots:avg('director','vehicleShots'),meanVehicleDeaths:avg('director','vehicleDeaths'),meanVehicleRepairHp:avg('director','vehicleRepairHp'),meanEvacuations:avg('director','vehicleEvacuations'),meanReturned:avg('director','vehicleReturned'),meanPeakVehicles:avg('director','peakVehicles'),meanVehiclesOrdered:avg('director','vehiclesOrdered'),meanPlayedSeconds:avg('director','elapsedSeconds'),meanVehicles:avg('director','vehicles'),
   meanScore:avg('director','score'),meanAttackingSeconds:avg('director','attackingSeconds')},
  details};
 console.log('\nAI BENCHMARK JSON\n'+JSON.stringify(summary,null,2));
 if(summary.director.meanCaptures<=summary.baseline.meanCaptures)
  console.log('\nNOTE: The director has not improved captured territory on these seeds. Investigate before declaring victory.');
 if(details.some(r=>r.elapsedSeconds<seconds-.1))
  console.log('\nWARNING: A game ended early. Mean scores may hide early victory/defeat; compare elapsedSeconds and terminalStatus.');
 if(summary.director.meanPeakVehicles<=summary.baseline.meanPeakVehicles)
  console.log('\nNOTE: The director has not improved deployed vehicle count; do not infer better vehicle tactics from unit tests.');
}
