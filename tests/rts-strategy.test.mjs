import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreRTSTarget,chooseRTSOperation,chooseRTSPosture,chooseRTSTheaterTarget} from '../dist/src/engine/rts-strategy.js';

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

test('strategic commander concentrates forces against viable operations',()=>{
  const weak={target:10,committed:40,formations:1,distance:12,threat:180};
  const strong={target:20,committed:120,formations:2,distance:8,threat:40};
  assert.deepEqual(chooseRTSOperation([weak,strong]),strong);
  assert.deepEqual(chooseRTSOperation([strong,weak]),strong,
    'incidental insertion order cannot influence the selected theater');
});

test('campaign selection rejects malformed operations and ties resolve by target',()=>{
  assert.equal(chooseRTSOperation([]),null);
  assert.equal(chooseRTSOperation([{target:-1,committed:80,formations:1,distance:2,threat:0}]),null);
  const a={target:7,committed:80,formations:2,distance:4,threat:10};
  const b={...a,target:8};
  assert.equal(chooseRTSOperation([b,a]).target,7);
});

test('operational postures distinguish defense, reinforcement and expansion',()=>{
 const base={localThreat:0,availableTroops:100,activeCampaigns:0,
   neutralFrontier:false,hostileFrontier:false};
 assert.equal(chooseRTSPosture({...base,localThreat:130}),'defend');
 assert.equal(chooseRTSPosture({...base,availableTroops:10}),'recover');
 assert.equal(chooseRTSPosture({...base,activeCampaigns:1}),'reinforce');
 assert.equal(chooseRTSPosture({...base,neutralFrontier:true}),'expand');
 assert.equal(chooseRTSPosture({...base,hostileFrontier:true}),'invade');
 assert.equal(chooseRTSPosture(base),'redeploy');
});

test('theater commander weighs defended capitals, attainable targets and losses',()=>{
 const neutral={tile:10,neutral:true,defenderStrength:0,assaultStrength:100,distance:3,
   strategicValue:0,committed:0};
 const capital={...neutral,tile:11,neutral:false,strategicValue:80};
 const heavilyGuarded={...capital,tile:12,defenderStrength:400};
 assert.equal(chooseRTSTheaterTarget([neutral,capital,heavilyGuarded]),capital);
 assert.equal(chooseRTSTheaterTarget([heavilyGuarded,neutral]),neutral);
 assert.equal(chooseRTSTheaterTarget([neutral,{...neutral,tile:9}]),9,
   'equal candidates use deterministic tile tie-breaks');
 assert.equal(chooseRTSTheaterTarget([]),null);
});
