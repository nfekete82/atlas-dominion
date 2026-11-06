import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseArgs,compareWaves} from '../scripts/benchmark-tactical-ai-24.mjs';

const run=(waveMode,hash='same')=>({seed:42,mapVersion:4,opponent:'fortress',waveMode,
 initialStateHash:hash,win:waveMode==='coordinated',loss:false,
 score:waveMode==='coordinated'?150:80,captures:waveMode==='coordinated'?3:1,
 redUnitsLost:waveMode==='coordinated'?2:4,enemyHQDamage:waveMode==='coordinated'?90:0,
 firstOrganizedAttack:24,paidRecruitCredits:440,stalledMissions:0,
 tactical:{waveWaits:2,waveLaunches:1,reinforcementStagingOrders:3}});
test('2.4 A/B reports true paired gains, actual losses, and no fabricated wins from timeouts',()=>{
 const r=compareWaves([run('coordinated'),run('legacy')]);
 assert.equal(r.summary.matches,1);
 assert.equal(r.summary.legacyWins,0);
 assert.equal(r.summary.coordinatedWins,1);
 assert.equal(r.summary.meanRedLossDelta,-2);
 assert.equal(r.summary.meanCaptureDelta,2);
 assert.equal(r.summary.stagedReinforcements,3);
 assert.equal(r.pairs[0].legacy.timeout,true);
 assert.equal(r.pairs[0].coordinated.paidRecruit,440);
});
test('2.4 A/B rejects different starting worlds and does not claim unpaired matches',()=>{
 assert.throws(()=>compareWaves([run('legacy'),run('coordinated','different')]),/Different initial world/);
 assert.equal(compareWaves([run('coordinated')]).summary.matches,0);
});
test('2.4 A/B option validation requires exact real campaign maps, seeds, opponents and duration',()=>{
 const x=parseArgs(['--maps','3,4','--seeds','2026,42','--seconds','240','--opponents','guarded,rush']);
 assert.deepEqual(x.maps,[3,4]);assert.deepEqual(x.seeds,[2026,42]);
 assert.throws(()=>parseArgs(['--seconds','10']),/Invalid benchmark/);
 assert.throws(()=>parseArgs(['--opponents','cheating']),/Invalid benchmark/);
 assert.throws(()=>parseArgs(['--maps','4,4']),/Invalid benchmark/);
});
