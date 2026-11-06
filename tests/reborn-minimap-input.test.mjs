import {test} from 'node:test';
import assert from 'node:assert/strict';
import {minimapWorldPoint} from '../dist/src/reborn/minimap-input.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
for(const world of [3762,4180,5600])for(const size of [128,224,267.53125])test(`minimap: CSS size ${size}, fractional offset and world ${world} map all corners and centre exactly`,()=>{
 const rect={left:1031.375,top:75.125,width:size,height:size};
 for(const [x,y] of [[0,0],[1,0],[0,1],[1,1],[.5,.5],[.17,.83]]){const p=minimapWorldPoint({x:rect.left+size*x,y:rect.top+size*y},rect,world);assert.ok(Math.abs(p.x-world*x)<1e-8);assert.ok(Math.abs(p.y-world*y)<1e-8);}
});
test('minimap: transformed CSS display is independent of native canvas pixels, DPR and world-camera zoom',()=>{
 const rect={left:97.2,top:128.4,width:168.75,height:211.5};{const p=minimapWorldPoint({x:rect.left+rect.width*.25,y:rect.top+rect.height*.75},rect,4000);assert.ok(Math.abs(p.x-1000)<1e-9);assert.ok(Math.abs(p.y-3000)<1e-9);}
});
test('minimap: captured drag coordinates clamp at edges and invalid/hidden boxes are ignored',()=>{
 const rect={left:20,top:40,width:100,height:100};assert.deepEqual(minimapWorldPoint({x:-10,y:200},rect,4000),{x:0,y:4000});for(const field of ['width','height'])assert.equal(minimapWorldPoint({x:50,y:50},{...rect,[field]:0},4000),null);assert.equal(minimapWorldPoint({x:NaN,y:50},rect,4000),null);assert.equal(minimapWorldPoint({x:50,y:50},rect,Infinity),null);
});
test('pioneer: public label changes independently of the compatible engineer key and HQ producer',()=>{
 assert.equal(UNITS.engineer.name,'Pionier');assert.deepEqual(UNITS.engineer.producers,['headquarters']);assert.equal(UNITS.engineer.cost,200);assert.equal(UNITS.engineer.buildTime,7);
});
