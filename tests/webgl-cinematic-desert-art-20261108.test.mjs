import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync,existsSync} from 'node:fs';
import {desertWadiCenter,desertWadiSample,cinematicSandSample,addDesertWashStones}
 from '../scripts/webgl-desert-art.js';
import {cameraEdgeReach,cameraBlackOverscan,snapToPlayableEdge}
 from '../scripts/webgl-map-edges.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

test('golden dune shading and winding dry riverbed are deterministic and bounded',()=>{
 const size=4160,seed=2074;
 assert.equal(desertWadiCenter(1400,size,seed),desertWadiCenter(1400,size,seed));
 for(const x of [100,880,1900,2900,4010]){
  const center=desertWadiCenter(x,size,seed);
  assert.ok(center>=0&&center<=size);
  const close=desertWadiSample(x,center,size,seed,'dunes');
  const far=desertWadiSample(x,center+close.width*3,size,seed,'dunes');
  assert.ok(close.strength>.99);
  assert.equal(far.strength,0);
  const render=cinematicSandSample({x,z:center,size,seed,profile:'dunes',height:28,slope:.07});
  assert.ok(render.wadi>.45&&render.wadi<=1);
  assert.ok(render.shade>=.81&&render.shade<=1.03);
  assert.ok(render.rock>=0&&render.rock<=1);
  assert.deepEqual(render,cinematicSandSample({x,z:center,size,seed,profile:'dunes',height:28,slope:.07}));
 }
 assert.equal(desertWadiSample(NaN,0,size,seed).strength,0);
 assert.equal(desertWadiSample(100,0,0,seed).strength,0);
});

test('dry-wash pebbles are deterministic, batched, clickable-through and strictly on-map',()=>{
 const size=4160,seed=2074;
 const meshes=[];
 const scene={add(mesh){meshes.push(mesh);}};
 const world={generated:{battlefield:{profile:'dunes'}},index(){return 0;},blocked:new Uint8Array(1)};
 const options={scene,world,size,seed,heightAt:()=>5,sites:[{x:2000,y:2200}],lowQuality:false};
 const first=addDesertWashStones(options);
 assert.ok(first?.isInstancedMesh);
 assert.equal(first.name,'visual-desert-dry-wash-pebbles');
 assert.equal(first.count,480);
 assert.equal(first.userData.nonPlayable,true);
 assert.equal(first.castShadow,false);
 assert.equal(first.raycast.toString(),'()=>{}');
 assert.equal(meshes.length,1,'single GPU draw call');
 const sampled=new THREE.Matrix4();
 const positions=[];
 for(let i=0;i<first.count;i++){
  first.getMatrixAt(i,sampled);
  const x=sampled.elements[12]+size/2,z=sampled.elements[14]+size/2;
  positions.push([x,z]);
  assert.ok(x>=100&&z>=100&&x<=size-100&&z<=size-100);
  assert.ok(Math.abs(z-desertWadiCenter(x,size,seed))<165);
  assert.ok(Math.hypot(x-2000,z-2200)>=190);
 }
 const second=addDesertWashStones({...options,scene:{add(){}}});
 const mat2=new THREE.Matrix4();
 for(let i=0;i<second.count;i++){
  second.getMatrixAt(i,mat2);
  assert.ok(Math.abs(mat2.elements[12]-(positions[i][0]-size/2))<.001);
  assert.ok(Math.abs(mat2.elements[14]-(positions[i][1]-size/2))<.001);
 }
 const lite=addDesertWashStones({...options,scene:{add(){}},lowQuality:true});
 assert.equal(lite.count,140,'bounded lite mode');
 assert.equal(addDesertWashStones({...options,world:{...world,generated:{}}}),null);
});

test('hard-black maps can be viewed from several hundred units OUTSIDE their playable edge',()=>{
 const size=4160,half=size/2;
 const overscan=cameraBlackOverscan(size);
 assert.ok(overscan>=550&&overscan<=750);
 assert.ok(overscan>cameraEdgeReach(size)*3);
 assert.equal(cameraBlackOverscan(0),350);
 const source=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(source,/const focusLimit=half\+\(spacious\?cameraBlackOverscan\(size\):cameraEdgeReach\(size\)\)/);
 assert.match(source,/if\(spacious\)return;\s*\/\/ Legacy maps retain/);
 assert.match(source,/scene\.background=new THREE\.Color\('#000000'\)/);
 assert.ok(half+overscan>size/2+500);
 assert.deepEqual(snapToPlayableEdge({x:size+150,y:size/2},size),null,
  'camera pan must NOT alter legal command destinations');
 const valid=snapToPlayableEdge({x:size+50,y:size/2},size);
 assert.ok(valid.x<size,'command still clamps at actual playable limit');
});

test('reference-inspired shader palette and cliffs only affect render assets and legacy saves remain deterministic',()=>{
 const src=readFileSync('scripts/webgl-preview.js','utf8');
 const cliff=readFileSync('scripts/webgl-environment.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(src,/cinematicSandSample\(\{x,z,size,seed,profile:terrain\.battlefield\.profile,slope,height:h\}\)/);
 assert.match(src,/addDesertWashStones\(\{scene,world,size,seed,heightAt,/);
 assert.match(src,/sandstone-strata-v1\.png/);
 assert.match(src,/const rings=\[1\.02,\.985,\.94,\.88,\.82,\.75,\.67,\.56,\.41\]/);
 assert.match(src,/textureScale:spacious\?2200:1500,hardVoid:spacious/);
 assert.match(cliff,/visual-inland-palm-grove/);
 assert.match(build,/cpSync\('scripts\/webgl-desert-art\.js','dist\/webgl-desert-art\.js'\)/);
 assert.ok(existsSync('dist/webgl-desert-art.js'));
 const old=new Simulation(2074,19);
 const modern=new Simulation(2074,23);
 assert.equal(old.world.mapVersion,19);
 assert.equal(modern.world.mapVersion,23);
 assert.equal(old.world.generated.battlefield,undefined);
 assert.ok(modern.world.generated.battlefield);
});
