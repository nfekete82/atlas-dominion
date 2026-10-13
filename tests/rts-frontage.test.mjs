import test from 'node:test';
import assert from 'node:assert/strict';
import {rtsFrontWidth,rtsContactLoss} from '../dist/src/engine/rts-frontage.js';

test('frontage scales with real soldiers but never grows without bound',()=>{
  assert.equal(rtsFrontWidth(24),2);
  assert.equal(rtsFrontWidth(120),10);
  assert.equal(rtsFrontWidth(360),30);
  assert.equal(rtsFrontWidth(500),30);
  assert.equal(rtsFrontWidth(50000),30);
});

test('a strong physical defender inflicts more attacker casualties',()=>{
  const weak=rtsContactLoss(500,30,true,false);
  const strong=rtsContactLoss(500,300,true,false);
  assert.ok(strong.attackerLost>weak.attackerLost*5);
  assert.ok(strong.defenderLost/300<weak.defenderLost/30);
  assert.ok(strong.attackerLost<=500&&strong.defenderLost<=300);
});

test('defensive home advantage is symmetric and never invents casualties',()=>{
  const a=rtsContactLoss(150,90,true,false);
  const b=rtsContactLoss(90,150,false,true);
  assert.equal(a.attackerLost,b.defenderLost);
  assert.equal(a.defenderLost,b.attackerLost);
  const equal=rtsContactLoss(100,100,true,true);
  assert.equal(equal.attackerLost,equal.defenderLost);
  assert.deepEqual(rtsContactLoss(0,100,true),{attackerLost:0,defenderLost:0});
});
