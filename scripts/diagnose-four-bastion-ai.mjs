#!/usr/bin/env node
/** Diagnostic-only: four-bastion RED versus an ordinary paid expanding BLUE.
 * No state manipulation or extra information is fed to the AI. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {bluePressure} from './benchmark-compact-blue-pressure.mjs';

const seeds=[2026,2027,2028,2029],seconds=360;
const results=[];
for(const seed of seeds){
 const m=runMatch({Simulation,UNITS},{seconds,opponent:'guarded',defender:bluePressure,label:'classic-diagnostics'},seed,'director',11);
 const row={
  seed,outcome:m.outcome,elapsed:m.elapsedSeconds,redSectors:m.redSectors,
  captures:m.captures,territoriesLost:m.territoriesLost,
  damageToEnemyHQ:m.enemyHQDamage,enemyHQSeenAt:m.firstEnemyHQSeen,
  enemyHQFirstDamagedAt:m.firstEnemyHQDamage,
  firstAssault:m.firstAssault,firstOrganizedAttack:m.firstOrganizedAttack,
  firstFactory:m.firstFactory,firstArtillery:m.firstArtillery,
  artilleryOrderedAt:m.firstArtilleryOrder,firstContact:m.firstFrontContact,
  redLosses:m.redUnitsLost,blueLosses:m.blueUnitsLost,
  redUnits:m.redUnits,redCredits:m.redCredits,
  paidRecruitCredits:m.paidRecruitCredits,paidBuildCredits:m.paidBuildCredits,
  peakArmy:m.peakArmy,peakVehicles:m.peakVehicles,
  reinforcements:m.reinforcements,retreats:m.battleRetreats,
  abortedMissions:m.abortedMissions,stalledMissions:m.stalledMissions,
  rapidCommandChanges:m.rapidUnitOrderChanges,repeatedCommands:m.repeatedUnitCommands,
  commands:m.commands,
  idleProduction:m.productionIdleReasons,productionReasons:m.productionDecisionReasons,
  producerSeconds:m.productionSeconds,
  redProduced:m.redProducedByKind,redKilled:m.redLossesByKind,
  missionEvents:m.missionEvents,timeline:m.timeline
 };
 results.push(row);
 const selected={seed,outcome:row.outcome,sectors:row.redSectors,redLosses:row.redLosses,
  blueLosses:row.blueLosses,HQDamage:row.damageToEnemyHQ,firstAssault:row.firstAssault,
  firstFactory:row.firstFactory,firstArtillery:row.firstArtillery,
  commandChanges:row.rapidCommandChanges,aborts:row.abortedMissions,
  reinforcementOrders:row.reinforcements,credits:row.redCredits,
  production:row.redProduced};
 console.log('DIAGNOSTIC '+JSON.stringify(selected));
}
const av=(key)=>results.reduce((sum,r)=>sum+(Number(r[key])||0),0)/results.length;
const summary={avgLosses:av('redLosses'),avgEnemyLosses:av('blueLosses'),
 avgTerritoriesLost:av('territoriesLost'),avgAborts:av('abortedMissions'),
 avgRapidCommandChanges:av('rapidCommandChanges'),avgReinforcementOrders:av('reinforcements'),
 avgHQDamage:av('damageToEnemyHQ'),avgFinalCredits:av('redCredits')};
console.log('SUMMARY '+JSON.stringify(summary));
const out=resolve('ai-arena-results/four-bastion-diagnostics.json');
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify({seconds,seeds,summary,results},null,2)+'\n');
console.log('REPORT '+out);
