import test from 'node:test';
import assert from 'node:assert/strict';
import {territoryContours,contourRings} from '../dist/src/render/territory-contours.js';

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

test('smooth territory fills use closed rings and preserve holes',()=>{
  const owners=Int16Array.from([
    0,0,0,
    0,-1,0,
    0,0,0,
  ]);
  const rings=contourRings(territoryContours(owners,3).get(0)??[]);
  assert.equal(rings.length,2,'outer coast and the neutral inland hole must remain separate');
  assert.ok(rings.every(r=>r.length>=6&&r.length%2===0));
  assert.equal(contourRings(territoryContours(new Int16Array([0]),1).get(0)??[]).length,1);
});

test('wide non-square grids keep far coastline vertices and factions separate',()=>{
  const owners=new Int16Array(480*3).fill(-2);
  owners[479]=0;owners[480]=0;owners[1439]=1;
  const contours=territoryContours(owners,480);
  const islands=contourRings(contours.get(0));
  assert.equal(islands.length,2);
  assert.equal(contourRings(contours.get(1)).length,1);
  for(const ring of islands){
    const xs=ring.filter((_,i)=>i%2===0),ys=ring.filter((_,i)=>i%2===1);
    assert.equal(Math.max(...xs)-Math.min(...xs),1);
    assert.equal(Math.max(...ys)-Math.min(...ys),1);
  }
});
