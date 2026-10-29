#!/usr/bin/env node
/** Deterministic complete matches against the unchanged, paid BLUE defender.
 * ATLAS_SIM_MODULE=/absolute/reference/dist/src/reborn/simulation.js node scripts/benchmark-reborn-ai.mjs \
 *   --maps 4,5 --seeds 2026,2027 --seconds 900 --modes director --label original --output /tmp/original.json
 * Observation never supplies information or commands to RED. No browser/render CPU is claimed here.
 */
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {blueDefense} from './benchmark-ai-opponent.mjs';

const vehicles=new Set(['tank','rover','artillery','bomber','scout']);
const groundVehicles=new Set(['tank','rover','artillery']);
const aircraft=new Set(['bomber','scout']);
const producers=['barracks','factory','airfield'];
const round=n=>Number(n.toFixed(3));
const increment=(counts,key)=>{counts[key]=(counts[key]??0)+1;};
const sum=counts=>Object.values(counts).reduce((n,v)=>n+v,0);
const hash=value=>createHash('sha256').update(value).digest('hex');

export function parseOptions(argv){
 const values={};
 for(let i=0;i<argv.length;i+=2){
  if(!argv[i].startsWith('--')||argv[i+1]===undefined||argv[i+1].startsWith('--'))throw Error('Every option requires a value.');
  const key=argv[i].slice(2);
  if(!['map','maps','seconds','seeds','opponent','modes','output','label'].includes(key))throw Error('Unknown option: '+argv[i]);
  values[key]=argv[i+1];
 }
 const result={maps:String(values.maps??values.map??4).split(',').map(Number),seconds:Number(values.seconds??240),
  seeds:String(values.seeds??'2026,2027,2028').split(',').map(Number),opponent:values.opponent??'guarded',
  modes:String(values.modes??'baseline,director').split(','),output:values.output?resolve(values.output):null,label:values.label??'current'};
 if(result.maps.some(v=>![3,4,5].includes(v))||new Set(result.maps).size!==result.maps.length
  ||!['guarded','idle'].includes(result.opponent)||!Number.isInteger(result.seconds)||result.seconds<30||result.seconds>3600
  ||result.seeds.length<1||result.seeds.length>24||result.seeds.some(v=>!Number.isSafeInteger(v)||v<0||v>4294967295)
  ||new Set(result.seeds).size!==result.seeds.length||result.modes.some(v=>!['baseline','director'].includes(v))
  ||new Set(result.modes).size!==result.modes.length)throw Error('Invalid benchmark options.');
 return result;
}

/** Idle inference is deliberately conservative for old commits without telemetry.
 * It describes producer-seconds, not hypothetical units that could be afforded. */
export function productionIdleReason(g,b,UNITS){
 const s=g.tactical.state,d=s.economy?.production,facility=d?.facilities?.[b.id];
 if(facility)return {reason:facility.reason==='produced'&&!b.queue.length?'awaiting-next-plan':facility.reason,source:'controller'};
 if(b.queue.length>=2)return {reason:'queue-blocked',source:'inferred'};
 if(b.queue.length)return {reason:'queue-running',source:'inferred'};
 if(g.count(1)+(g.queued?.(1)??0)>=48)return {reason:'army-cap',source:'inferred'};
 if(s.savingFor){const cost=UNITS[s.savingFor]?.cost;if(cost>g.credits[1])return {reason:'saving-unit',source:'inferred'};}
 if(s.economy?.goal)return {reason:'saving-building',source:'inferred'};
 const legal=Object.values(UNITS).filter(u=>u.producers?.includes(b.kind));
 if(legal.length&&legal.every(u=>u.cost>g.credits[1]))return {reason:'insufficient-credits',source:'inferred'};
 return {reason:'unexplained-idle',source:'inferred'};
}

/** Kept separate from CLI so observer accounting can be checked without running/building matches. */
export function runMatch({Simulation,UNITS,performanceModule},options,seed,mode,version){
 const g=new Simulation(seed,version);g.tactical.mode=mode;
 if(options.plannerMode&&'planningMode' in g.tactical)g.tactical.planningMode=options.plannerMode;
 if(options.waveMode&&'waveMode' in g.tactical)g.tactical.waveMode=options.waveMode;
 if(options.doctrineMode&&'doctrineMode' in g.tactical)g.tactical.doctrineMode=options.doctrineMode;
 const recorder=performanceModule?new performanceModule.PerformanceRecorder(false):null;
 performanceModule?.setProfiler(recorder);
 // Controller internals intentionally differ between original/new; hash the
 // identical initial playable world, resources and fog instead.
 const initialStateHash=hash(JSON.stringify({seed,version,units:g.units,bases:g.bases,
  territories:g.territories,credits:g.credits,explored:g.explored.map(a=>Array.from(a))}));
 const initialHQ=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 const initialHQId=initialHQ?.id,initialHQHp=initialHQ?.hp??0;
 const startingRedSectors=g.territories.filter(t=>t.owner===1).length;
 const metrics={seed,mode,mapVersion:version,label:options.label,opponent:options.opponent,initialStateHash,initialStateHashScope:'playable-world-v1',
  requestedSeconds:options.seconds,elapsedSeconds:0,terminalStatus:'playing',outcome:'timeout',win:false,loss:false,
  initialCredits:g.credits[1],initialComposition:{red:Object.fromEntries(Object.keys(UNITS).map(k=>[k,g.units.filter(u=>u.owner===1&&u.kind===k).length])),blue:Object.fromEntries(Object.keys(UNITS).map(k=>[k,g.units.filter(u=>u.owner===0&&u.kind===k).length]))},firstAssault:null,firstOrganizedAttack:null,firstVehicle:null,firstTank:null,
  firstArtillery:null,firstAircraft:null,firstEnemyHQSeen:null,firstEnemyHQDamage:null,firstEnemyHQDestroyed:null,
  enemyHQSeen:false,enemyHQDamaged:false,enemyHQDestroyed:false,enemyHQCaptured:false,enemyHQDamage:0,
  blueHeadquartersHp:initialHQHp,enemyBuildingsSeen:0,enemyBuildingsDamaged:0,enemyBuildingsDestroyed:0,
  enemyBuildingDamage:0,enemyTowersDestroyed:0,firstFactory:null,firstFrontContact:null,firstEnemyContact:null,
  finishedBuildings:0,vehicles:0,peakVehicles:0,peakArmy:0,peakAircraft:0,vehiclesOrdered:0,vehicleOrdersByKind:{},
  redOrdersByKind:{},redProducedByKind:{},blueProducedByKind:{},redLossesByKind:{},blueLossesByKind:{},
  paidRecruitCredits:0,refundedRecruitCredits:0,vehiclesProduced:0,aircraftProduced:0,
  redSectors:startingRedSectors,captures:0,netCaptures:0,territoriesLost:0,blueCaptures:0,blueTerritoriesLost:0,
  blueUnitsLost:0,redUnitsLost:0,blueUnitDamage:0,redUnitDamage:0,redUnits:0,redCredits:0,
  firstVehicleShot:null,vehicleShots:0,shotsByKind:{},damageByRedKind:{},
  vehicleDeaths:0,vehicleRepairHp:0,vehicleEvacuations:0,vehicleReturned:0,repairedVehiclesReused:0,
  attackingSeconds:0,productiveFactorySeconds:0,productiveBarracksSeconds:0,productiveAirfieldSeconds:0,
  parallelProductionSeconds:0,tripleProductionSeconds:0,maxParallelProducers:0,
  productionSeconds:{barracks:{available:0,busy:0,idle:0},factory:{available:0,busy:0,idle:0},airfield:{available:0,busy:0,idle:0}},
  phaseTransitions:0,commanderTransitions:0,commanderSeconds:{},missionCount:0,abortedMissions:0,unfinishedMissions:0,stalledMissions:0,
  commands:0,unitCommands:0,attackCommands:0,buildingAttackCommands:0,repeatedUnitCommands:0,rapidUnitOrderChanges:0,
  productionIdleReasons:{},productionIdleReasonSources:{},productionDecisionReasons:{},bluePaidOrdersByKind:{},bluePaidRecruitCredits:0,
  paidBuildCredits:0,bluePaidBuildCredits:0,paidBuildingsByKind:{},bluePaidBuildingsByKind:{},
  battleReactions:0,battleRetreats:0,reinforcements:0,counterattacks:0,enemyBuildingKillsByKind:{},missionEvents:[],timeline:[],score:0,wallMs:0,cpu:null};
 const initialUnits=new Set(g.units.map(u=>u.id)),bornUnits=new Set(initialUnits);
 const unitsKnown=new Map(g.units.map(u=>[u.id,{owner:u.owner,kind:u.kind}]));
 const buildingsKnown=new Map(g.bases.map(b=>[b.id,{owner:b.owner,kind:b.kind}]));
 const destroyedBuildings=new Set(),damagedBuildings=new Set(),seenBuildings=new Set(),returnedVehicles=new Set(),reusedVehicles=new Set();
 let previousUnits=new Map(g.units.filter(u=>u.hp>0).map(u=>[u.id,{owner:u.owner,kind:u.kind,hp:u.hp}]));
 let previousBases=new Map(g.bases.filter(b=>b.hp>0).map(b=>[b.id,{owner:b.owner,kind:b.kind,hp:b.hp}]));
 let previousOwnership=new Map(g.territories.map(t=>[t.id,t.owner])),previousRecovery=new Set();
 let phase=g.tactical.state.phase,commanderPhase=null,mission=null,nextTimeline=0;
 const exactKilledBuildings=new WeakSet();
 const stepTimes=[],phaseTimes={};
 if(recorder){const record=recorder.record.bind(recorder);recorder.record=(phase,ms,...rest)=>{(phaseTimes[phase]??=[]).push(ms);return record(phase,ms,...rest);};}
 const time=()=>round(g.time);
 // Transparent observers on successful public APIs count accepted paid orders,
 // rather than assuming an economy intention counter means a unit was built.
 const recruit=g.recruit.bind(g);
 g.recruit=(id,kind)=>{
  const building=g.bases.find(b=>b.id===id),before=g.credits[1],beforeBlue=g.credits[0],ok=recruit(id,kind);
  if(ok&&building?.owner===1){increment(metrics.redOrdersByKind,building.queueTypes.at(-1));metrics.paidRecruitCredits+=before-g.credits[1];}
  if(ok&&building?.owner===0){increment(metrics.bluePaidOrdersByKind,building.queueTypes.at(-1));metrics.bluePaidRecruitCredits+=beforeBlue-g.credits[0];}
  return ok;
 };
 const cancel=g.cancel.bind(g);
 g.cancel=(...args)=>{const before=g.credits[1],result=cancel(...args);metrics.refundedRecruitCredits+=Math.max(0,g.credits[1]-before);return result;};
 if(typeof g.build==='function'){const build=g.build.bind(g);g.build=(owner,kind,...args)=>{const before=g.credits[owner],result=build(owner,kind,...args);if(result){metrics[owner===1?'paidBuildCredits':'bluePaidBuildCredits']+=before-g.credits[owner];increment(metrics[owner===1?'paidBuildingsByKind':'bluePaidBuildingsByKind'],kind);}return result;};}
 const lastOrders=new Map(),command=g.command.bind(g);
 g.command=(ids,order,...rest)=>{
  const redIds=ids.filter(id=>g.units.some(u=>u.id===id&&u.owner===1&&u.hp>0));
  if(redIds.length){metrics.commands++;metrics.unitCommands+=redIds.length;
   const signature=JSON.stringify({kind:order.kind,target:order.target,x:Math.round(order.x??0),y:Math.round(order.y??0)});
   for(const id of redIds){const old=lastOrders.get(id);if(old?.signature===signature)metrics.repeatedUnitCommands++;else if(old&&g.time-old.at<3)metrics.rapidUnitOrderChanges++;lastOrders.set(id,{signature,at:g.time});}
   if(order.kind==='attack'){metrics.attackCommands++;if(g.bases.some(b=>b.id===order.target&&b.owner===0))metrics.buildingAttackCommands++;}}
  return command(ids,order,...rest);
 };
 // TypeScript private methods compile as ordinary methods in this project.
 // Observe exact applied combat damage before healing/construction can hide it.
 const exactDamage=typeof g.strike==='function';
 if(exactDamage){
  const strike=g.strike.bind(g);
  g.strike=(source,target,amount)=>{
   const before=target.hp,owner=target.owner,building='queue' in target;
   const result=strike(source,target,amount),damage=Math.max(0,before-Math.max(0,target.hp));
   if(owner===0&&damage>0){
    if(building){metrics.enemyBuildingDamage+=damage;damagedBuildings.add(target.id);
     if(target.id===initialHQId){metrics.enemyHQDamage+=damage;metrics.firstEnemyHQDamage??=time();}
     if(target.hp<=0){if(!exactKilledBuildings.has(target)){exactKilledBuildings.add(target);increment(metrics.enemyBuildingKillsByKind,target.kind??'unknown');}destroyedBuildings.add(target.id);if(target.id===initialHQId)metrics.firstEnemyHQDestroyed??=time();}
    }else metrics.blueUnitDamage+=damage;
    const sourceKind=unitsKnown.get(source)?.kind??g.units.find(u=>u.id===source)?.kind??buildingsKnown.get(source)?.kind??g.bases.find(b=>b.id===source)?.kind??'unknown';
    metrics.damageByRedKind[sourceKind]=(metrics.damageByRedKind[sourceKind]??0)+damage;
   }else if(owner===1&&!building)metrics.redUnitDamage+=damage;
   return result;
  };
 }
 const exactRepair=typeof g.work==='function';
 if(exactRepair){
  const work=g.work.bind(g);
  g.work=(kind,source,target,amount)=>{
   if(kind==='repair'&&g.units.some(u=>u.id===target&&u.owner===1&&groundVehicles.has(u.kind)))metrics.vehicleRepairHp+=Math.max(0,amount);
   return work(kind,source,target,amount);
  };
 }
 const endMission=reason=>{
  if(!mission)return;
  const target=g.territories.find(t=>t.id===mission.target),objective=g.bases.find(b=>b.id===mission.objective);
  const completed=mission.objective!==null&&mission.objective!==undefined?(!objective||objective.hp<=0||objective.owner===1):target?.owner===1;
  const survivors=g.units.filter(u=>u.hp>0&&mission.units.includes(u.id)).length;
  const outcome=completed?'completed':survivors===0?'annihilated':reason;
  if(!completed&&reason==='aborted')metrics.abortedMissions++;
  if(!completed&&reason==='unfinished')metrics.unfinishedMissions++;
  metrics.missionEvents.push({...mission,units:undefined,ended:time(),survivors,outcome});mission=null;
 };
 const begin=performance.now(),dt=.05,steps=Math.round(options.seconds/dt);
 try{
  for(let step=0;step<steps&&g.status==='playing';step++){
   if(options.opponent==='guarded'&&step%60===0)(options.defender??blueDefense)(g);
   const at=performance.now();g.step(dt);stepTimes.push(performance.now()-at);options.observe?.(g);
   const s=g.tactical.state,now=time();metrics.elapsedSeconds=now;
   for(const u of g.units){
    unitsKnown.set(u.id,{owner:u.owner,kind:u.kind});
    if(!bornUnits.has(u.id)){bornUnits.add(u.id);increment(u.owner===1?metrics.redProducedByKind:metrics.blueProducedByKind,u.kind);}
   }
   const currentUnits=new Map(g.units.filter(u=>u.hp>0).map(u=>[u.id,{owner:u.owner,kind:u.kind,hp:u.hp}]));
   for(const [id,u] of previousUnits){
    const remaining=currentUnits.get(id);
    if(!remaining){increment(u.owner===1?metrics.redLossesByKind:metrics.blueLossesByKind,u.kind);
     if(u.owner===1){metrics.redUnitsLost++;if(vehicles.has(u.kind))metrics.vehicleDeaths++;}else metrics.blueUnitsLost++;}
    if(!exactDamage){const damage=Math.max(0,u.hp-(remaining?.hp??0));metrics[u.owner===1?'redUnitDamage':'blueUnitDamage']+=damage;}
   }
   previousUnits=currentUnits;
   for(const b of g.bases)buildingsKnown.set(b.id,{owner:b.owner,kind:b.kind});
   const currentBases=new Map(g.bases.filter(b=>b.hp>0).map(b=>[b.id,{owner:b.owner,kind:b.kind,hp:b.hp}]));
   for(const [id,b] of previousBases)if(b.owner===0){
    const remaining=currentBases.get(id);
    if(!remaining||remaining.owner!==0){destroyedBuildings.add(id);if(id===initialHQId)metrics.firstEnemyHQDestroyed??=now;}
    if(!exactDamage){const damage=Math.max(0,b.hp-(remaining?.owner===0?remaining.hp:0));if(damage){metrics.enemyBuildingDamage+=damage;damagedBuildings.add(id);if(id===initialHQId){metrics.enemyHQDamage+=damage;metrics.firstEnemyHQDamage??=now;}}}
   }
   previousBases=currentBases;
   for(const t of g.territories){const previous=previousOwnership.get(t.id);
    if(previous!==1&&t.owner===1)metrics.captures++;
    if(previous===1&&t.owner!==1)metrics.territoriesLost++;
    if(previous!==0&&t.owner===0)metrics.blueCaptures++;if(previous===0&&t.owner!==0)metrics.blueTerritoriesLost++;
   }
   previousOwnership=new Map(g.territories.map(t=>[t.id,t.owner]));
   for(const b of g.memories[1])if(b.owner===0&&b.hp>0){seenBuildings.add(b.id);if(b.id===initialHQId)metrics.firstEnemyHQSeen??=now;}
   const red=g.units.filter(u=>u.owner===1&&u.hp>0),deployed=red.filter(u=>!u.carrier),available=red.filter(u=>vehicles.has(u.kind));
   metrics.peakVehicles=Math.max(metrics.peakVehicles,available.length);metrics.peakArmy=Math.max(metrics.peakArmy,red.length);
   metrics.peakAircraft=Math.max(metrics.peakAircraft,red.filter(u=>aircraft.has(u.kind)).length);
   if(available.length)metrics.firstVehicle??=now;
   if(red.some(u=>u.kind==='tank'))metrics.firstTank??=now;
   if(red.some(u=>u.kind==='artillery'))metrics.firstArtillery??=now;
   if(red.some(u=>aircraft.has(u.kind)))metrics.firstAircraft??=now;
   const recovery=new Set((s.recovering??[]).filter(id=>red.some(u=>u.id===id&&groundVehicles.has(u.kind))));
   for(const id of recovery)if(!previousRecovery.has(id))metrics.vehicleEvacuations++;
   for(const id of previousRecovery)if(!recovery.has(id)){
    const u=red.find(u=>u.id===id);if(u&&u.hp>=.9*(UNITS[u.kind]?.hp??Infinity)){metrics.vehicleReturned++;returnedVehicles.add(id);}
   }
   previousRecovery=recovery;
   if(!exactRepair)for(const effect of g.workEffects)if(effect.kind==='repair'&&Math.abs(effect.at-g.time)<1e-8&&red.some(u=>u.id===effect.target&&groundVehicles.has(u.kind)))metrics.vehicleRepairHp+=effect.amount;
   for(const shot of g.shots)if(shot.owner===1&&Math.abs(shot.at-g.time)<1e-8){
    increment(metrics.shotsByKind,shot.kind??'turret');
    if(vehicles.has(shot.kind)){metrics.vehicleShots++;metrics.firstVehicleShot??=now;
     if(returnedVehicles.has(shot.source))reusedVehicles.add(shot.source);}
   }
   if(s.phase==='attack'){
    metrics.firstAssault??=now;metrics.attackingSeconds+=dt;
    if(red.filter(u=>s.group.includes(u.id)&&!['engineer','medic','scout'].includes(u.kind)).length>=3)metrics.firstOrganizedAttack??=now;
   }
   if(phase!==s.phase){metrics.phaseTransitions++;phase=s.phase;}
   const strategic=s.commander?.phase??s.strategy?.phase??'unavailable';
   metrics.commanderSeconds[strategic]=(metrics.commanderSeconds[strategic]??0)+dt;
   if(commanderPhase!==null&&commanderPhase!==strategic){metrics.commanderTransitions++;if(commanderPhase==='emergencyDefense'&&['offensive','siege','endgame'].includes(strategic))metrics.counterattacks++;}
   commanderPhase=strategic;
   if(mission&&(s.phase!=='attack'||s.groupId!==mission.groupId||s.target!==mission.target||s.objective!==mission.objective))endMission('aborted');
   if(s.phase==='attack'&&!mission){metrics.missionCount++;mission={groupId:s.groupId,target:s.target,objective:s.objective,started:now,units:[...s.group],stalled:false};}
   if(mission){for(const id of s.group)if(!mission.units.includes(id)){mission.units.push(id);metrics.reinforcements++;}
    if(!mission.stalled&&g.time-s.progressAt>95){mission.stalled=true;metrics.stalledMissions++;}}
   let busyProducers=0;
   for(const b of g.bases)if(b.owner===1&&b.hp>0&&b.buildRemaining===0&&producers.includes(b.kind)){
    const p=metrics.productionSeconds[b.kind];p.available+=dt;
    const decision=productionIdleReason(g,b,UNITS);metrics.productionDecisionReasons[decision.reason]=(metrics.productionDecisionReasons[decision.reason]??0)+dt;
    if(!b.queue.length){const idle=decision;metrics.productionIdleReasons[idle.reason]=(metrics.productionIdleReasons[idle.reason]??0)+dt;metrics.productionIdleReasonSources[idle.source]=(metrics.productionIdleReasonSources[idle.source]??0)+dt;}p[b.queue.length?'busy':'idle']+=dt;
    if(b.queue.length){busyProducers++;metrics['productive'+b.kind[0].toUpperCase()+b.kind.slice(1)+'Seconds']+=dt;}
    if(b.kind==='factory')metrics.firstFactory??=now;
   }
   metrics.maxParallelProducers=Math.max(metrics.maxParallelProducers,busyProducers);
   if(busyProducers>=2)metrics.parallelProductionSeconds+=dt;
   if(busyProducers>=3)metrics.tripleProductionSeconds+=dt;
   // Expensive contact predicates are sampled at 1 Hz; combat/build/capture events are observed every tick.
   if(step%20===0){
    if(metrics.firstEnemyContact===null&&deployed.some(u=>g.units.some(v=>v.owner===0&&v.hp>0&&!v.carrier&&g.canSee(1,v)&&Math.hypot(v.x-u.x,v.y-u.y)<=(u.kind==='artillery'?690:400))))metrics.firstEnemyContact=now;
    if(metrics.firstFrontContact===null&&deployed.some(u=>!['engineer','medic','scout'].includes(u.kind)&&g.territories.some(t=>t.owner!==1&&Math.hypot(t.point.x-u.x,t.point.y-u.y)<220)))metrics.firstFrontContact=now;
   }
   if(g.time>=nextTimeline){
    const hq=g.bases.find(b=>b.id===initialHQId);
    metrics.timeline.push({at:now,credits:round(g.credits[1]),income:g.income(1),phase:s.phase,commander:strategic,adaptive:s.adaptive?.strategy??null,battle:s.battle?.assessment??null,
     mission:s.commander?.mission?.kind??null,target:s.target,objective:s.objective,group:s.group.length,
     redUnits:red.length,blueUnits:g.count(0),blueBuildings:g.bases.filter(b=>b.owner===0&&b.hp>0).map(b=>({id:b.id,kind:b.kind,hp:round(b.hp)})),
     sectors:g.territories.filter(t=>t.owner===1).length,produced:{...metrics.redProducedByKind},
     enemyHQSeen:metrics.firstEnemyHQSeen!==null,enemyHQHp:hq?.owner===0?Math.max(0,round(hq.hp)):0,enemyHQDamage:round(metrics.enemyHQDamage)});
    nextTimeline+=30;
   }
  }
  if(mission)endMission(g.status==='playing'?'unfinished':'terminal');
  metrics.wallMs=Math.round(performance.now()-begin);metrics.terminalStatus=g.status;
  metrics.win=g.status==='defeat';metrics.loss=g.status==='victory';metrics.outcome=metrics.win?'win':metrics.loss?'loss':'timeout';
  const hq=g.bases.find(b=>b.id===initialHQId);
  metrics.blueHeadquartersHp=hq?.owner===0?Math.max(0,hq.hp):0;
  metrics.enemyHQSeen=metrics.firstEnemyHQSeen!==null;metrics.enemyHQDamaged=metrics.enemyHQDamage>0;
  metrics.enemyHQDestroyed=destroyedBuildings.has(initialHQId);metrics.enemyHQCaptured=hq?.owner===1;
  metrics.enemyBuildingsSeen=seenBuildings.size;metrics.enemyBuildingsDamaged=damagedBuildings.size;metrics.enemyBuildingsDestroyed=destroyedBuildings.size;
  metrics.enemyTowersDestroyed=exactDamage?(metrics.enemyBuildingKillsByKind.turret??0):[...destroyedBuildings].filter(id=>buildingsKnown.get(id)?.kind==='turret').length;
  if(exactDamage)metrics.enemyBuildingsDestroyed=sum(metrics.enemyBuildingKillsByKind);
  metrics.vehicleOrdersByKind=Object.fromEntries(Object.entries(metrics.redOrdersByKind).filter(([kind])=>vehicles.has(kind)));
  metrics.vehiclesOrdered=sum(metrics.vehicleOrdersByKind);
  metrics.vehiclesProduced=sum(Object.fromEntries(Object.entries(metrics.redProducedByKind).filter(([kind])=>vehicles.has(kind))));
  metrics.aircraftProduced=sum(Object.fromEntries(Object.entries(metrics.redProducedByKind).filter(([kind])=>aircraft.has(kind))));
  metrics.redSectors=g.territories.filter(t=>t.owner===1).length;metrics.netCaptures=metrics.redSectors-startingRedSectors;
  metrics.battleReactions=g.tactical.state.battle?.reactions??0;metrics.battleRetreats=g.tactical.state.battle?.retreats??0;
  metrics.tactical=g.tactical.diagnostics?structuredClone(g.tactical.diagnostics):null;
  metrics.counterattackDefinition='emergencyDefense to offensive/siege/endgame commander transitions';
  metrics.finalComposition={red:Object.fromEntries(Object.keys(UNITS).map(k=>[k,g.units.filter(u=>u.owner===1&&u.kind===k&&u.hp>0).length])),blue:Object.fromEntries(Object.keys(UNITS).map(k=>[k,g.units.filter(u=>u.owner===0&&u.kind===k&&u.hp>0).length]))};
  metrics.redUnits=g.count(1);metrics.redCredits=Math.round(g.credits[1]);metrics.repairedVehiclesReused=reusedVehicles.size;
  metrics.vehicles=g.units.filter(u=>u.owner===1&&vehicles.has(u.kind)&&u.hp>0).length;
  metrics.finishedBuildings=g.bases.filter(b=>b.owner===1&&b.hp>0&&b.buildRemaining===0&&producers.includes(b.kind)).length;
  metrics.score=Number(metrics.win)*10000+Number(metrics.enemyHQDestroyed)*2000+metrics.captures*100+metrics.blueUnitsLost*20+(metrics.firstFrontContact!==null?10:0)+Math.min(6,metrics.vehicles)*4;
  stepTimes.sort((a,b)=>a-b);
  const percentile=p=>stepTimes[Math.max(0,Math.ceil(stepTimes.length*p)-1)]??0;
  metrics.cpu={scope:'Node simulation ticks including transparent API telemetry; excludes rendering, opponent actor and benchmark observation between ticks',steps:stepTimes.length,
   stepMs:{mean:stepTimes.reduce((n,v)=>n+v,0)/Math.max(1,stepTimes.length),p95:percentile(.95),p99:percentile(.99),max:stepTimes.at(-1)??0},
   phases:recorder?Object.fromEntries(Object.entries(recorder.snapshot().phases).map(([phase,value])=>{const samples=(phaseTimes[phase]??[]).sort((a,b)=>a-b);return [phase,{...value,p95Ms:samples[Math.max(0,Math.ceil(samples.length*.95)-1)]??0,p99Ms:samples[Math.max(0,Math.ceil(samples.length*.99)-1)]??0}];})):null,pathfinding:recorder?.snapshot().pathfinding??null};
  metrics.attackingSeconds=round(metrics.attackingSeconds);
  for(const o of [metrics.productionIdleReasons,metrics.productionIdleReasonSources,metrics.productionDecisionReasons])for(const k of Object.keys(o))o[k]=round(o[k]);
  for(const p of Object.values(metrics.productionSeconds))for(const key of Object.keys(p))p[key]=round(p[key]);
  for(const key of Object.keys(metrics.commanderSeconds))metrics.commanderSeconds[key]=round(metrics.commanderSeconds[key]);
  for(const key of ['vehicleRepairHp','enemyHQDamage','enemyBuildingDamage','blueUnitDamage','redUnitDamage','productiveFactorySeconds','productiveBarracksSeconds','productiveAirfieldSeconds','parallelProductionSeconds','tripleProductionSeconds'])metrics[key]=round(metrics[key]);
  return metrics;
 }finally{performanceModule?.setProfiler(null);recorder?.dispose();}
}

export function summarize(details){
 const groups={};
 for(const r of details){const key=`map${r.mapVersion}:${r.mode}`;(groups[key]??=[]).push(r);}
 return Object.fromEntries(Object.entries(groups).map(([key,runs])=>{
  const mean=metric=>{const values=runs.map(r=>r[metric]).filter(Number.isFinite);return values.length?round(values.reduce((n,v)=>n+v,0)/values.length):null;};
  return [key,{runs:runs.length,wins:runs.filter(r=>r.win).length,losses:runs.filter(r=>r.loss).length,timeouts:runs.filter(r=>!r.win&&!r.loss).length,
   hqSeen:runs.filter(r=>r.enemyHQSeen).length,hqDamaged:runs.filter(r=>r.enemyHQDamaged).length,hqDestroyed:runs.filter(r=>r.enemyHQDestroyed).length,
   meanFirstOrganizedAttack:mean('firstOrganizedAttack'),meanFirstEnemyHQSeen:mean('firstEnemyHQSeen'),
   meanFirstEnemyHQDamage:mean('firstEnemyHQDamage'),meanFirstEnemyHQDestroyed:mean('firstEnemyHQDestroyed'),
   meanCaptures:mean('captures'),meanNetCaptures:mean('netCaptures'),meanBlueDeaths:mean('blueUnitsLost'),meanRedDeaths:mean('redUnitsLost'),
   meanEnemyHQDamage:mean('enemyHQDamage'),meanEnemyBuildingsDestroyed:mean('enemyBuildingsDestroyed'),
   meanVehiclesProduced:mean('vehiclesProduced'),meanAircraftProduced:mean('aircraftProduced'),meanPeakVehicles:mean('peakVehicles'),
   meanVehiclesOrdered:mean('vehiclesOrdered'),meanVehicleShots:mean('vehicleShots'),meanVehicleDeaths:mean('vehicleDeaths'),
   meanVehicleRepairHp:mean('vehicleRepairHp'),meanEvacuations:mean('vehicleEvacuations'),meanReturned:mean('vehicleReturned'),meanReused:mean('repairedVehiclesReused'),
   meanPlayedSeconds:mean('elapsedSeconds'),meanVehicles:mean('vehicles'),meanScore:mean('score'),meanAttackingSeconds:mean('attackingSeconds'),
   meanParallelProductionSeconds:mean('parallelProductionSeconds'),meanTripleProductionSeconds:mean('tripleProductionSeconds'),
   meanAbortedMissions:mean('abortedMissions'),meanStalledMissions:mean('stalledMissions'),meanWallMs:mean('wallMs'),
   production:Object.fromEntries(producers.map(kind=>{
    const available=runs.reduce((n,r)=>n+r.productionSeconds[kind].available,0),idle=runs.reduce((n,r)=>n+r.productionSeconds[kind].idle,0);
    return [kind,{builtRuns:runs.filter(r=>r.productionSeconds[kind].available>0).length,meanAvailableSeconds:round(available/runs.length),meanIdleSeconds:round(idle/runs.length),idleFraction:available?round(idle/available):null}];
   })),
   meanStepCpuMs:round(runs.reduce((n,r)=>n+r.cpu.stepMs.mean,0)/runs.length),
   meanAIPlanningCpuMs:runs.some(r=>r.cpu.phases?.ai)?round(runs.reduce((n,r)=>n+(r.cpu.phases?.ai?.meanMs??0),0)/runs.length):null}];
 }));
}

async function main(){
 let options;
 try{options=parseOptions(process.argv.slice(2));}catch(error){console.error(error.message+'\nUsage: node scripts/benchmark-reborn-ai.mjs --maps 3,4,5 --seeds 2026,2027 --seconds 900 --modes baseline,director --opponent guarded --label current --output /tmp/ai.json');process.exitCode=2;return;}
 const reference=process.env.ATLAS_SIM_MODULE;
 const simulationURL=reference?(reference.startsWith('file:')?new URL(reference):pathToFileURL(resolve(reference))):new URL('../dist/src/reborn/simulation.js',import.meta.url);
 const [{Simulation},{UNITS},performanceModule]=await Promise.all([import(simulationURL.href),import(new URL('./catalog.js',simulationURL).href),import(new URL('./performance.js',simulationURL).href)]);
 const details=[],report={schemaVersion:2,label:options.label,simulationModule:simulationURL.href,
  simulationSourceHash:hash(readFileSync(simulationURL)),catalogSourceHash:hash(readFileSync(new URL('./catalog.js',simulationURL))),
  opponentSourceHash:hash(readFileSync(new URL('./benchmark-ai-opponent.mjs',import.meta.url))),
  maps:options.maps,mapVersion:options.maps.length===1?options.maps[0]:null,requestedSeconds:options.seconds,opponent:options.opponent,seeds:options.seeds,modes:options.modes,timestep:.05,
  completedRuns:0,expectedRuns:options.maps.length*options.seeds.length*options.modes.length,complete:false,summary:{},details};
 const persist=()=>{
  report.completedRuns=details.length;report.complete=details.length===report.expectedRuns;report.summary=summarize(details);
  // Preserve the original one-map report keys used by older analysis scripts.
  if(options.maps.length===1)for(const mode of options.modes)report[mode]=report.summary[`map${options.maps[0]}:${mode}`]??null;
  if(options.output){mkdirSync(dirname(options.output),{recursive:true});writeFileSync(options.output+'.tmp',JSON.stringify(report,null,2)+'\n');renameSync(options.output+'.tmp',options.output);}
 };
 persist();
 for(const version of options.maps)for(const seed of options.seeds)for(const mode of options.modes){
  const result=runMatch({Simulation,UNITS,performanceModule},options,seed,mode,version);details.push(result);persist();
  console.log(options.label,mode,'map='+version,'seed='+seed,'outcome='+result.outcome,'played='+result.elapsedSeconds,
   'HQseen='+result.firstEnemyHQSeen,'HQdamage='+Math.round(result.enemyHQDamage),'HQdestroyed='+result.enemyHQDestroyed,
   'captures='+result.captures,'kills='+result.blueUnitsLost,'losses='+result.redUnitsLost,
   'births='+JSON.stringify(result.redProducedByKind),'repairs='+Math.round(result.vehicleRepairHp),'reused='+result.repairedVehiclesReused,
   'AImeanMs='+String(result.cpu.phases?.ai?.meanMs??null),'wallMs='+result.wallMs);
 }
 console.log('\nAI BENCHMARK JSON\n'+JSON.stringify(report,null,2));
 if(details.some(r=>r.outcome==='timeout'))console.log('\nNOTE: Timed-out matches are incomplete wars, not wins. Inspect HQ damage, remaining defenders, missions and production.');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
