import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canCaptureSector} from '../dist/src/reborn/territory-warfare.js';

const sectors=[
 {id:0,owner:0,neighbors:[1]},
 {id:1,owner:-1,neighbors:[0,2]},
 {id:2,owner:1,neighbors:[1,3]},
 {id:3,owner:-1,neighbors:[2]}
];
test('legacy maps 0–2 require a legally neighboring owned sector',()=>{
 for(const v of [0,1,2]){
  assert.equal(canCaptureSector(sectors,sectors[1],0,v),true,'adjacent neutral');
  assert.equal(canCaptureSector(sectors,sectors[1],1,v),true,'adjacent enemy sector');
  assert.equal(canCaptureSector(sectors,sectors[3],0,v),false,'disconnected neutral sector');
  assert.equal(canCaptureSector(sectors,sectors[0],0,v),false,'already owned');
 }
});
test('new Sandforge maps preserve non-adjacent capture with actual unit presence',()=>{
 for(const v of [3,4,5]){
  assert.equal(canCaptureSector(sectors,sectors[3],0,v),true);
  assert.equal(canCaptureSector(sectors,sectors[0],0,v),false);
  assert.equal(canCaptureSector(sectors,sectors[3],-1,v),false);
 }
});
