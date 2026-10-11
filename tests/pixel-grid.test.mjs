import test from 'node:test';
import assert from 'node:assert/strict';
import {pixelGridEdges} from '../dist/src/render/pixel-grid.js';

test('territory sectors cover the full 1600x900 canvas without seams or overlaps',()=>{
  for(const [cells,pixels] of [[480,1600],[260,900],[360,1600],[240,900]]){
    const edges=pixelGridEdges(cells,pixels);
    assert.equal(edges.length,cells+1);
    assert.equal(edges[0],0);
    assert.equal(edges.at(-1),pixels);
    assert.equal(edges.reduce((total,v,i)=>i===0?total:total+v-edges[i-1],0),pixels);
    assert.ok(edges.every((value,i)=>i===0||value>edges[i-1]));
  }
});

test('invalid native grids cannot create zero-width sectors',()=>{
  assert.throws(()=>pixelGridEdges(480,200));
  assert.throws(()=>pixelGridEdges(0,1600));
});
