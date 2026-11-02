import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assaultDecision} from '../dist/src/reborn/ai-director.js';

const base={
  defended:true, observedTowers:0, hasArtillery:false, visibleDefenderStrength:2,
  readyUnits:4, readyStrength:9, phaseSeconds:20, inRegroup:false,
  clusteredRecentLosses:false, scoutingOpening:false
};

test('overmatch: four strong units attack a known tower-free defended objective',()=>{
  assert.deepEqual(assaultDecision(base),{
    launch:true,requiredUnits:4,requiredStrength:7,reason:'ready'
  });
});
test('overmatch: never bypass observed turret requirements',()=>{
  const result=assaultDecision({...base,observedTowers:1});
  assert.equal(result.launch,false);
});
test('overmatch: strong visible defenders require 2.5x combat power',()=>{
  assert.equal(assaultDecision({...base,visibleDefenderStrength:5}).launch,false);
  assert.equal(assaultDecision({...base,visibleDefenderStrength:5,readyStrength:13}).launch,true);
});
test('overmatch: recent casualties and regroup block shortcut',()=>{
  assert.equal(assaultDecision({...base,clusteredRecentLosses:true}).launch,false);
  assert.equal(assaultDecision({...base,inRegroup:true,phaseSeconds:3}).launch,false);
});
test('overmatch: do not launch before rallying or with only three fighters',()=>{
  assert.equal(assaultDecision({...base,phaseSeconds:5}).launch,false);
  assert.equal(assaultDecision({...base,readyUnits:3}).launch,false);
});
