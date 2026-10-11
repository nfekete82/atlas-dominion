import test from 'node:test';
import assert from 'node:assert/strict';
import { TerritoryWave, WAVE_DURATION_MS, waveProgress } from '../dist/src/render/wave.js';

test('chained captures form an outward wave from previously controlled sectors',()=>{
  const wave=new TerritoryWave(Int16Array.from([0,-1,-1,-1,-1]),5);
  const owners=Int16Array.from([0,0,0,0,-1]);
  assert.equal(wave.capture(owners,1000),3);
  const frames=wave.active(1000);
  assert.deepEqual(frames.map(f=>f.index),[1,2,3]);
  assert.deepEqual(frames.map(f=>f.delay),[0,24,48]);
  assert.equal(waveProgress(frames[0],1000),0);
  assert.equal(waveProgress(frames[0],1000+WAVE_DURATION_MS),1);
  assert.ok(waveProgress(frames[1],1200)<waveProgress(frames[0],1200));
});

test('presentation changes never mutate real game ownership and clear after animation',()=>{
  const owners=Int16Array.from([0,-1,-1,-2,1,-1]);
  const wave=new TerritoryWave(owners,3);
  const updated=Int16Array.from([0,0,-1,-2,1,1]);
  const before=updated.slice();
  assert.equal(wave.capture(updated,50),2);
  assert.deepEqual([...updated],[...before]);
  assert.equal(wave.capture(updated,51),0);
  assert.equal(wave.active(50+WAVE_DURATION_MS+200).length,0);
  wave.reset(owners);
  assert.equal(wave.active(50).length,0);
});

test('simultaneous changes never flow across opposite owners or row boundaries',()=>{
  const initial=Int16Array.from([0,-1,-1, 2,-1,-1, 2,-1,-1]);
  const updated=Int16Array.from([0,0,-1, 2,2,-1, 2,2,-1]);
  const tracker=new TerritoryWave(initial,3);
  tracker.capture(updated,0);
  const frames=tracker.active(0);
  assert.deepEqual(frames.map(f=>f.index),[1,4,7]);
  assert.ok(frames.every(f=>f.delay===0));
});

test('fast capture animation completes without persistent cosmetic artifacts',()=>{
  const original=Int16Array.from([0,-1,-1,-1,1]);
  const wave=new TerritoryWave(original,5);
  const after=Int16Array.from([0,0,0,0,1]);
  assert.equal(wave.capture(after,500),3);
  assert.ok(WAVE_DURATION_MS<=220);
  const frames=wave.active(500);
  assert.deepEqual(frames.map(f=>f.delay),[0,24,48]);
  assert.ok(frames.every(f=>waveProgress(f,500+WAVE_DURATION_MS+48)===1));
  assert.equal(wave.active(500+WAVE_DURATION_MS+48).length,0);
  assert.deepEqual([...after],[0,0,0,0,1],'animation never changes game ownership');
});
