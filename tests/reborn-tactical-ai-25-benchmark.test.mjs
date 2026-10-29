import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareDoctrines,parseArgs} from '../scripts/benchmark-tactical-ai-25.mjs';

const example=(doctrineMode,hash='same')=>({
 seed:42,mapVersion:5,opponent:'fortress',doctrineMode,initialStateHash:hash,
 win:doctrineMode==='intelligent',loss:false,score:doctrineMode==='intelligent'?90:80,
 captures:doctrineMode==='intelligent'?4:3,redUnitsLost:doctrineMode==='intelligent'?6:9,
 enemyHQDamage:doctrineMode==='intelligent'?120:0,enemyTowersDestroyed:doctrineMode==='intelligent'?2:1,
 paidRecruitCredits:1230,stalledMissions:0,tactical:{siegeAngles:5,secondaryRaids:3,secondaryRaidOrders:4}
});
test('2.5 benchmark compares exact paired playable worlds and counts a timeout as no win',()=>{
 const report=compareDoctrines([example('legacy'),example('intelligent')]);
 assert.equal(report.summary.pairs,1);
 assert.equal(report.summary.ai24Wins,0);
 assert.equal(report.summary.ai25Wins,1);
 assert.equal(report.summary.avgCaptures,1);
 assert.equal(report.summary.avgLosses,-3);
 assert.equal(report.summary.avgTowerKills,1);
 assert.equal(report.summary.siegeAngles,5);
 assert.equal(report.summary.raids,3);
 assert.equal(report.pairs[0].ai24.timeout,true);
 assert.equal(report.pairs[0].ai25.paidRecruits,1230);
});
test('2.5 benchmark cannot compare different seeds/world hashes or invent unmatched runs',()=>{
 assert.throws(()=>compareDoctrines([example('legacy','seed-A'),example('intelligent','seed-B')]),/starting worlds differ/);
 assert.equal(compareDoctrines([example('intelligent')]).summary.pairs,0);
});
test('2.5 benchmark rejects unknown cheating opponents, invalid seeds and bad map counts',()=>{
 const options=parseArgs(['--maps','4,5','--seeds','2026,42','--seconds','360','--opponents','guarded,fortress']);
 assert.deepEqual(options.maps,[4,5]);assert.deepEqual(options.seeds,[2026,42]);
 assert.throws(()=>parseArgs(['--opponents','cheating']),/Invalid/);
 assert.throws(()=>parseArgs(['--seconds','0']),/Invalid/);
 assert.throws(()=>parseArgs(['--maps','4,4']),/Invalid/);
});
