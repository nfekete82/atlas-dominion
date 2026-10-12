import test from 'node:test';
import assert from 'node:assert/strict';
import {territoryContours} from '../dist/src/render/territory-contours.js';

test('single tile yields a closed four-sided diamond with mid-edge corners',()=>{
  const segments=territoryContours(new Int16Array([0]),1).get(0);
  assert.equal(segments?.length,4);
  assert.ok(segments.every(s=>s.every(Number.isFinite)));
  assert.deepEqual([...new Set(segments.flatMap(s=>[s[0]+','+s[1],s[2]+','+s[3]]))].sort(),
    ['0,0.5','0.5,0','0.5,1','1,0.5'].sort());
});
test('diagonal factions never acquire spurious bridges',()=>{
  const owners=new Int16Array([0,-1,-1,0]);
  assert.equal(territoryContours(owners,2).get(0)?.length,8);
});
test('contours skip water and preserve ownership input',()=>{
  const owners=new Int16Array([0,0,-2,1,1,-2]);
  const snapshot=owners.slice();
  const contours=territoryContours(owners,3);
  assert.deepEqual(owners,snapshot);
  assert.equal(contours.has(-2),false);
  assert.ok(contours.get(0)?.length);
  assert.ok(contours.get(1)?.length);
});
test('rejects malformed grids',()=>assert.throws(()=>territoryContours(new Int16Array(5),2)));
