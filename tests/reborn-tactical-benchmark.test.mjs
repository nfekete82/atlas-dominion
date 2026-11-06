import {test} from 'node:test';
import assert from 'node:assert/strict';
import {comparePairs} from '../scripts/benchmark-tactical-ai-2.mjs';

const run=(plannerMode,hash='same')=>({seed:42,mapVersion:4,opponent:'guarded',plannerMode,
 initialStateHash:hash,win:plannerMode==='tactical',loss:false,score:plannerMode==='tactical'?200:100,
 captures:plannerMode==='tactical'?2:1,blueUnitsLost:3,redUnitsLost:1,
 enemyHQDamage:plannerMode==='tactical'?120:0,abortedMissions:0,stalledMissions:0,cpu:{phases:{ai:{meanMs:.5}}}});
test('tactical A/B: same seeds, world, opponent and paid economy are paired exactly once',()=>{
 const a=comparePairs([run('classic'),run('tactical')]);
 assert.equal(a.summary.matches,1);
 assert.equal(a.summary.classicWins,0);assert.equal(a.summary.tacticalWins,1);
 assert.equal(a.pairs[0].delta.score,100);
 assert.equal(a.pairs[0].delta.hqDamage,120);
 assert.equal(a.pairs[0].classic.timeout,true,'timeouts are never converted to wins');
});
test('tactical A/B: incompatible playable-world hashes fail closed, unpaired runs are excluded',()=>{
 assert.throws(()=>comparePairs([run('classic'),run('tactical','different')]),/mismatch/);
 assert.equal(comparePairs([run('classic')]).summary.matches,0);
});
