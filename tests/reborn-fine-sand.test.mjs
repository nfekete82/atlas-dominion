import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FINE_SAND_TILE_SIZE,sandSeamWeight} from '../dist/src/reborn/fine-sand.js';

const source=(file)=>readFileSync(new URL('../src/reborn/'+file,import.meta.url),'utf8');

test('fine sand uses 2048px native sampling and seamless feathering',()=>{
  assert.equal(FINE_SAND_TILE_SIZE,2048);
  assert.equal(sandSeamWeight(0),0);
  assert.equal(sandSeamWeight(112),1);
  assert.equal(sandSeamWeight(2048),0);
  for(const x of [1,15,55,111,112]){
    assert.ok(Math.abs(sandSeamWeight(x)-sandSeamWeight(2048-x))<1e-9);
  }
  assert.ok(sandSeamWeight(55)>0&&sandSeamWeight(55)<1);
});

test('terrain restores authored ripple artwork instead of flat noise',()=>{
  const renderer=source('renderer.ts'),terrain=source('terrain-presentation.ts');
  assert.match(renderer,/this\.sand\.src='\/src\/assets\/reborn\/sand-ripples-v2\.png'/);
  assert.match(renderer,/this\.sand\.decode\(\)/);
  assert.match(terrain,/fineSandPattern\(c,sand\)/);
  assert.match(terrain,/globalAlpha=\.80/);
  assert.doesNotMatch(terrain,/fineSandColor/);
  assert.doesNotMatch(renderer,/Legacy maps also receive the same seamless 2K fine-sand finish/);
  const png=readFileSync(new URL('../src/assets/reborn/sand-ripples-v2.png',import.meta.url));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
});
