import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

test('AI activity diagnostic records actual stationary units and multi-tick idle episodes',()=>{
 const source=readFileSync(new URL('../scripts/rts-ai-activity.mjs',import.meta.url),'utf8');
 for(const label of ['stationaryTicks','stationaryOrderedTicks','stationaryUnorderedTicks',
  'stationaryNearEnemyTicks','stationaryNeutralFrontTicks','stationaryDeepHomeTicks',
  'longIdleEpisodes','maxIdleStreak']){
   assert.ok(source.includes(label),label);
 }
 const run=spawnSync(process.execPath,['scripts/rts-ai-activity.mjs','8','20261013'],
   {encoding:'utf8',timeout:30000});
 assert.equal(run.status,0,run.stderr);
 const stats=JSON.parse(run.stdout);
 assert.equal(stats.ticks,8);
 assert.equal(stats.inactivity.stationaryTicks,
   stats.inactivity.stationaryOrderedTicks+stats.inactivity.stationaryUnorderedTicks);
 assert.equal(stats.inactivity.stationaryTicks,
   stats.inactivity.stationaryNeutralFrontTicks+
   stats.inactivity.stationaryNearEnemyTicks+stats.inactivity.stationaryDeepHomeTicks);
 assert.ok(Number.isFinite(stats.losses)&&stats.losses>=0);
 assert.equal(stats.movement.movedSquadTicks,
   stats.movement.landMoves+stats.movement.seaLandings);
 assert.equal(stats.movement.invalidLandMoves,0);
 assert.ok(stats.performance.p95StepMs>=stats.performance.medianStepMs);
 assert.match(stats.stateHash,/^[a-f0-9]{64}$/);
});
