import test from 'node:test';
import assert from 'node:assert/strict';
import {organicCaptureRadius,burningFrontAlpha} from '../dist/src/render/capture-visual.js';

test('organic capture front grows continuously without animated randomness',()=>{
  const points=[0,.1,.3,.5,.7,.9,1].map(p=>organicCaptureRadius(p,4,120));
  assert.equal(points[0],0);
  assert.ok(points.every((x,i)=>i===0||x>=points[i-1]));
  assert.ok(points.at(-1)>=4.4);
  assert.equal(organicCaptureRadius(.5,4,120),organicCaptureRadius(.5,4,120));
});
test('warm capture glow exists only in active transition, not permanently',()=>{
  assert.equal(burningFrontAlpha(0),0);
  assert.ok(burningFrontAlpha(.5)>0);
  assert.ok(burningFrontAlpha(1)<1e-10);
});
