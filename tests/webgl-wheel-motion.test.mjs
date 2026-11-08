import test from 'node:test';
import assert from 'node:assert/strict';
import {wheelsShouldRoll,rolloutWheelsShouldRoll} from '../scripts/webgl-wheel-motion.js';

test('stationary Humvees never rotate tyres just because movement is ordered',()=>{
 for(const travel of [0,.0001,.05,.15,-1,NaN,Infinity])
  assert.equal(wheelsShouldRoll('rover',travel),false,String(travel));
 assert.equal(wheelsShouldRoll('rover',2.4),true);
 assert.equal(wheelsShouldRoll('rover',10),true);
});

test('vehicle wheel motion requires actual valid 20-Hz distance',()=>{
 for(const kind of ['rover','tank','artillery']){
  assert.equal(wheelsShouldRoll(kind,0),false);
  assert.equal(wheelsShouldRoll(kind,1.5),true);
  assert.equal(wheelsShouldRoll(kind,300),false);
 }
 for(const kind of ['infantry','heavy','medic','engineer','scout','bomber'])
  assert.equal(wheelsShouldRoll(kind,2),false);
});

test('factory shutter animation alone does not rotate any wheels',()=>{
 assert.equal(rolloutWheelsShouldRoll(false,100),false);
 assert.equal(rolloutWheelsShouldRoll(true,0),false);
 assert.equal(rolloutWheelsShouldRoll(true,.2),false);
 assert.equal(rolloutWheelsShouldRoll(true,NaN),false);
 assert.equal(rolloutWheelsShouldRoll(true,Infinity),false);
 assert.equal(rolloutWheelsShouldRoll(true,55),true);
});
