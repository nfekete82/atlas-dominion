import {test} from 'node:test';
import assert from 'node:assert/strict';
import {edgeOverscan,cameraEdgeReach,snapToPlayableEdge,worldToMinimap}
 from '../scripts/webgl-map-edges.js';

test('all four edges accept a small overshoot and keep legal clickable terrain targets',()=>{
 for(const size of [4160,6240]){
  const mid=size/2,overscan=edgeOverscan(size);
  assert.ok(overscan>=80&&overscan<=160);
  const targets=[
   [{x:-overscan*.8,y:mid},{x:12,y:mid}],
   [{x:size+overscan*.8,y:mid},{x:size-12,y:mid}],
   [{x:mid,y:-overscan*.8},{x:mid,y:12}],
   [{x:mid,y:size+overscan*.8},{x:mid,y:size-12}],
   [{x:-overscan*.7,y:size+overscan*.7},{x:12,y:size-12}]
  ];
  for(const [point,expected] of targets)
   assert.deepEqual(snapToPlayableEdge(point,size),expected);
  assert.equal(snapToPlayableEdge({x:-overscan-1,y:mid},size),null);
  assert.equal(snapToPlayableEdge({x:mid,y:size+overscan+1},size),null);
  assert.deepEqual(snapToPlayableEdge({x:mid,y:mid},size),{x:mid,y:mid});
 }
});

test('nonfinite or remote commands never bypass authoritative movement bounds',()=>{
 for(const point of [null,undefined,{x:NaN,y:0},{x:Infinity,y:3},
   {x:10,y:-Infinity},{x:-100000,y:80}])
  assert.equal(snapToPlayableEdge(point,6240),null);
 assert.equal(snapToPlayableEdge({x:40,y:50},0),null);
});

test('camera overscan is limited and never changes the playable world size',()=>{
 for(const size of [4160,6240]){
  assert.ok(cameraEdgeReach(size)>0);
  assert.ok(cameraEdgeReach(size)<=140);
  assert.ok(cameraEdgeReach(size)<edgeOverscan(size));
 }
});

test('world minimap projection shares the exact world center and boundaries',()=>{
 for(const size of [4160,6240]){
  const half=size/2;
  assert.deepEqual(worldToMinimap(-half,-half,size,224,224),{x:0,y:0});
  assert.deepEqual(worldToMinimap(half,half,size,224,224),{x:224,y:224});
  assert.deepEqual(worldToMinimap(0,0,size,224,224),{x:112,y:112});
  const p=worldToMinimap(half*.4,-half*.6,size,224,224);
  assert.ok(p.x>112&&p.y<112);
 }
});
