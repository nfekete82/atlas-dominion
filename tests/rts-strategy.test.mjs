import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreRTSTarget} from '../dist/src/engine/rts-strategy.js';

const base={neutral:false,enemyTroops:20,friendlyTroops:100,distance:2,
  capital:false,barracks:false,tower:false,city:false,factory:false,committedAttackers:0};

test('RTS commander prefers affordable high value objectives',()=>{
  assert.ok(scoreRTSTarget({...base,capital:true})>scoreRTSTarget(base));
  assert.ok(scoreRTSTarget({...base,barracks:true})>scoreRTSTarget(base));
  assert.ok(scoreRTSTarget({...base,neutral:true})>scoreRTSTarget(base));
  assert.ok(scoreRTSTarget({...base,tower:true})<scoreRTSTarget(base));
});

test('RTS commander avoids overwhelming defenders and favors coordinated pressure',()=>{
  assert.ok(scoreRTSTarget({...base,enemyTroops:250})<scoreRTSTarget(base));
  assert.ok(scoreRTSTarget({...base,committedAttackers:60})>scoreRTSTarget(base));
  assert.ok(scoreRTSTarget({...base,distance:12})<scoreRTSTarget(base));
});

test('RTS target score is deterministic and input remains unchanged',()=>{
  const candidate=Object.freeze({...base,city:true});
  const value=scoreRTSTarget(candidate);
  for(let n=0;n<100;n++)assert.equal(scoreRTSTarget(candidate),value);
  assert.deepEqual(candidate,{...base,city:true});
});
