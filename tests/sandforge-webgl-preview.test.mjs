import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {World} from '../dist/src/reborn/world.js';
import {canyonHeightAt,ridgeCenterY,rampAtX} from '../dist/src/reborn/canyon-height.js';

test('webgl: 3D heightfield is deterministic for existing authoritative 2D map seeds',()=>{
 const world=new World(2074,16),ridges=world.generated.ridges,r=ridges[0];
 const a=canyonHeightAt(2074,ridges,1321,1100);
 assert.equal(a,canyonHeightAt(2074,ridges,1321,1100));
 assert.ok(Number.isFinite(a));
 assert.ok(r.ramps.length>=2);
 const x=r.spine[Math.floor(r.spine.length/2)].x,z=ridgeCenterY(r,x);
 assert.equal(rampAtX(r,x),false);
 const cliffDelta=canyonHeightAt(2074,ridges,x,z-30)-canyonHeightAt(2074,ridges,x,z+30);
 assert.ok(cliffDelta>75,'real raised plateau with near-vertical cliff face');
 for(const gate of r.ramps){
  const y=ridgeCenterY(r,gate.x);
  assert.equal(rampAtX(r,gate.x),true);
  const approach=canyonHeightAt(2074,ridges,gate.x,y-30)-canyonHeightAt(2074,ridges,gate.x,y+30);
  assert.ok(approach>0&&approach<cliffDelta*.55,'wide accessible 3D ramp rather than visual wall');
  assert.equal(world.walkable({x:gate.x,y}),true,'ramp visual and navigation agree');
 }
 assert.equal(world.walkable({x,y:z}),false,'cliff body remains physically blocked');
});

test('webgl: height sampler never mutates saved map geometry or navigation grids',()=>{
 const world=new World(2026,15),snapshot=world.blocked.slice();
 for(let x=10;x<world.size;x+=19)for(let z=10;z<world.size;z+=27)
  assert.ok(Number.isFinite(canyonHeightAt(world.seed,world.generated.ridges,x,z)));
 assert.deepEqual(world.blocked,snapshot);
});

test('webgl: preview is actually packaged with local offline Three.js vendor and original glTF assets',()=>{
 for(const name of ['webgl-preview.html','webgl-preview.js','vendor/three/three.module.js','vendor/three/addons/loaders/GLTFLoader.js',
  'src/reborn/canyon-height.js','src/assets/reborn/canyon-3d/ruin-house.gltf','src/assets/reborn/canyon-3d/ruin-depot.gltf'])
  assert.ok(existsSync('dist/'+name),'missing offline asset: '+name);
 const docker=readFileSync('Dockerfile','utf8');
 assert.match(docker,/webgl-preview\.html/,'Docker build stage must copy WebGL HTML');
 assert.match(docker,/COPY scripts\/webgl-preview\.js/,'Docker build stage must copy WebGL script');
 const html=readFileSync('dist/webgl-preview.html','utf8');
 const js=readFileSync('dist/webgl-preview.js','utf8');
 assert.match(html,/type="importmap"/);
 assert.match(html,/\/webgl-preview.js/);
 assert.match(js,/new THREE.WebGLRenderer/);
 assert.match(js,/const smooth=value=>/, 'WebGL terrain must define its smoothstep shading helper');
 assert.match(js,/inputSeed!==null/, 'missing query seed must preserve the default 2026');
 assert.match(html,/3D-Startfehler/, 'browser crashes must surface visibly');
 assert.match(js,/new THREE.InstancedMesh/);
 assert.match(js,/\.gltf/);
 assert.match(js,/new Simulation\(seed,sizes\[bastions\]\)/);
 assert.doesNotMatch(js,/eval\(|https?:\/\//);
});
