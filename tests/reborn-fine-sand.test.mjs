import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FINE_SAND_TILE_SIZE,fineSandColor} from '../dist/src/reborn/fine-sand.js';

test('fine sand is a high-resolution seamless 2K material',()=>{
  assert.equal(FINE_SAND_TILE_SIZE,2048);
  for(const [x,y] of [[0,0],[35,72],[501,1903],[2047,2047]]){
    assert.deepEqual(fineSandColor(x,y),fineSandColor(x+2048,y));
    assert.deepEqual(fineSandColor(x,y),fineSandColor(x,y+2048));
  }
});
test('fine sand retains subtle, deterministic golden microcontrast',()=>{
  const pixels=[];
  for(let y=0;y<512;y+=17)for(let x=0;x<512;x+=19) {
    const rgb=fineSandColor(x,y);
    assert.deepEqual(rgb,fineSandColor(x,y));
    assert.ok(rgb[0]>197&&rgb[0]<255);
    assert.ok(rgb[1]>155&&rgb[1]<216);
    assert.ok(rgb[2]>89&&rgb[2]<143);
    pixels.push(Math.round(rgb[0]));
  }
  assert.ok(new Set(pixels).size>12,'visible but soft sand-grain variation');
});
