import test from 'node:test';
import assert from 'node:assert/strict';
import {findConnectedAttackFront} from '../dist/src/engine/front-target.js';

const parse=(rows)=>Int16Array.from(rows.join('').split('').map(c=>({
  A:0,B:1,C:2,N:-1,W:-2
})[c]));

test('a deep click into a bordering country resolves at the closest actual land front',()=>{
  const owners=parse([
    'AABBBBBBBBBBBBBBBBBB',
    'AABBBBBBBBBBBBBBBBBB',
    'AABBBBBBBBBBBBBBBBBB',
  ]);
  const width=20;
  const clicked=1*width+18;
  assert.equal(findConnectedAttackFront(owners,width,clicked,0),1*width+2);
  assert.equal(findConnectedAttackFront(owners,width,clicked,0,14),-1);
});

test('separate islands, enemy states and water cannot connect a click to our border',()=>{
  const owners=parse([
    'AABBBWWWBBBBBBBBBBBB',
    'AABBBWWWBBBBBBBBBBBB',
    'AABBBCCCBBBBBBBBBBBB',
  ]);
  const width=20;
  assert.equal(findConnectedAttackFront(owners,width,1*width+17,0),-1);
  assert.equal(findConnectedAttackFront(owners,width,1*width+3,0),1*width+2);
  assert.equal(findConnectedAttackFront(owners,width,1*width+7,0),-1);
});

test('neutral clicks require a local frontier; no continent-wide virtual neutral faction',()=>{
  const owners=parse(['AANNNNNNNNNNNNNNNNNN']);
  assert.equal(findConnectedAttackFront(owners,20,18,0,14),-1);
  assert.equal(findConnectedAttackFront(owners,20,8,0,14),2);
  assert.equal(findConnectedAttackFront(owners,20,1,0,14),-1);
});

test('no row wrap and no invalid position permits a fake frontline',()=>{
  const owners=parse(['NNNA','BNNN']);
  assert.equal(findConnectedAttackFront(owners,4,4,0),-1);
  assert.equal(findConnectedAttackFront(owners,4,9,0),-1);
  assert.equal(findConnectedAttackFront(owners,0,4,0),-1);
});
