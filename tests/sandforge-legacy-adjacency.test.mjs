import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canCaptureSector,canAirOnlyCaptureSector} from '../dist/src/reborn/territory-warfare.js';

const sectors=[
 {id:0,owner:0,neighbors:[1]},
 {id:1,owner:-1,neighbors:[0,2]},
 {id:2,owner:1,neighbors:[1,3]},
 {id:3,owner:-1,neighbors:[2]}
];
test('legacy ground units may capture remote neutral territory',()=>{
 for(const v of [0,1,2,3,4,5]){
  assert.equal(canCaptureSector(sectors,sectors[1],0,v),true);
  assert.equal(canCaptureSector(sectors,sectors[3],0,v),true);
  assert.equal(canCaptureSector(sectors,sectors[0],0,v),false);
  assert.equal(canCaptureSector(sectors,sectors[3],-1,v),false);
 }
});
test('legacy aircraft cannot skip an unconnected front but new maps retain air mobility',()=>{
 for(const v of [0,1,2]){
  assert.equal(canAirOnlyCaptureSector(sectors,sectors[1],0,v),true);
  assert.equal(canAirOnlyCaptureSector(sectors,sectors[3],0,v),false);
  assert.equal(canAirOnlyCaptureSector(sectors,sectors[3],1,v),true);
 }
 for(const v of [3,4,5])assert.equal(canAirOnlyCaptureSector(sectors,sectors[3],0,v),true);
});
