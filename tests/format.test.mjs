import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCompact} from '../dist/src/format.js';

test('HUD uses short German K/M/Mrd instead of wrapping large numbers',()=>{
  assert.equal(formatCompact(0),'0');
  assert.equal(formatCompact(950),'950');
  assert.equal(formatCompact(1500),'1,5K');
  assert.equal(formatCompact(2500000),'2,5M');
  assert.equal(formatCompact(3200000000),'3,2 Mrd.');
  assert.equal(formatCompact(1200000000000),'1,2 Bio.');
  assert.equal(formatCompact(35000),'35K');
});
test('Fractional growth and money income keep one decimal',()=>{
  assert.equal(formatCompact(12.95,1),'13');
  assert.equal(formatCompact(3.84,1),'3,8');
  assert.equal(formatCompact(0.6,1),'0,6');
  assert.equal(formatCompact(-1250),'−1,3K');
});
test('Even extreme values never produce enormous UI strings',()=>{
  assert.equal(formatCompact(Number.NaN),'–');
  assert.equal(formatCompact(Infinity),'∞');
  assert.equal(formatCompact(-Infinity),'−∞');
  assert.ok(formatCompact(1e69).length<12);
  assert.ok(formatCompact(1e307).length<12);
});
