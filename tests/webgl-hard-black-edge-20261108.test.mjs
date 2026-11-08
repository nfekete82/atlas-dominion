import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addVisualPerimeter} from '../scripts/webgl-perimeter.js';
import {addBoundaryCliffs} from '../scripts/webgl-edge-cliffs.js';

const size=4160;
test('hard-black maps create zero exterior terrain tiles or dark overlays',()=>{
 let adds=0;
 const scene={add(){adds++;}};
 const empty=addVisualPerimeter({scene,size,hardVoid:true});
 assert.equal(adds,0,'no exterior geometry added');
 assert.deepEqual(empty.meshes,[]);
 assert.deepEqual(empty.voidCover,[]);
 assert.equal(empty.minX,0);
 assert.equal(empty.maxX,size);
 assert.equal(empty.minZ,0);
 assert.equal(empty.maxZ,size);
 assert.equal(empty.margin,0);
 assert.equal(empty.hardVoid,true);
});
test('hard-black maps create zero exterior cliffs, scree or monoliths',()=>{
 let adds=0,loads=0;
 const scene={add(){adds++;}};
 const empty=addBoundaryCliffs({
  scene,size,hardVoid:true,lowQuality:false,
  heightAt(){loads++;throw Error('Should not sample exterior terrain');}
 });
 assert.equal(adds,0);
 assert.equal(loads,0);
 assert.deepEqual(empty.cliffs,[]);
 assert.deepEqual(empty.scree,[]);
 assert.equal(empty.monoliths,null);
 assert.equal(empty.collisionChanged,false);
 assert.equal(empty.hardVoid,true);
});
test('full WebGL terrain directly meets black with no exterior stone pass',()=>{
 const src=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(src,/scene\.background=new THREE\.Color\('#000000'\)/);
 assert.match(src,/textureScale:spacious\?2200:1500,hardVoid:spacious/);
 assert.match(src,/softRim:spacious,hardVoid:spacious/);
 assert.match(src,/for\(let i=0;i<\(spacious\?0:2100\);i\+\+\)/);
 assert.match(src,/if\(spacious&&\(x<90\|\|z<90\|\|x>size-90\|\|z>size-90\)\)return/);
 assert.doesNotMatch(src,/scene\.background=new THREE\.Color\('#bfa889'\)/);
});
