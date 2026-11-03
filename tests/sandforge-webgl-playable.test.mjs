import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';

test('Canyon v15-v18: 3D campaign saves remain reloadable without changing simulation',()=>{
 for(const version of [15,16,17,18]){
  const original=new Simulation(2074,version);
  const saved=original.save(),loaded=Simulation.load(saved);
  assert.equal(loaded.seed,original.seed);
  assert.equal(loaded.world.mapVersion,version);
  assert.deepEqual(loaded.bases.map(b=>b.id),original.bases.map(b=>b.id));
  assert.deepEqual(loaded.units.map(u=>u.kind),original.units.map(u=>u.kind));
  assert.equal(loaded.territories.length,original.territories.length);
  loaded.step(.05);
  assert.equal(loaded.time,.05);
 }
});

test('All 9 combat unit kinds and 6 structures have original authored 3D models',()=>{
 for(const kind of Object.keys(UNITS))for(const team of [0,1]){
  const folder=['tank','rover','artillery','scout','bomber'].includes(kind)?'animation':'prototype';
  const path='dist/src/assets/reborn/'+folder+'/'+kind+'-'+team+'.glb';
  assert.ok(existsSync(path),'missing 3D unit model '+path);
 }
 for(const kind of Object.keys(BUILDINGS))for(const team of [0,1]){
  const path='dist/src/assets/reborn/buildings-3d/'+kind+'-'+team+'.glb';
  assert.ok(existsSync(path),'missing 3D structure model '+path);
 }
});

test('WebGL build exposes full gameplay adapter, all draw modules and skinned Three.js animation',()=>{
 for(const path of ['dist/webgl-preview.html','dist/webgl-preview.js','dist/webgl-battlefield.js','dist/webgl-environment.js','dist/vendor/three/addons/utils/SkeletonUtils.js']){
  assert.ok(existsSync(path),path+' missing from runtime image');
 }
 const main=readFileSync('dist/webgl-preview.js','utf8');
 const adapter=readFileSync('dist/webgl-battlefield.js','utf8');
 assert.match(main,/new SandforgeBattlefield/);
 assert.match(main,/new DesertArtPass/);
 assert.match(adapter,/new THREE\.ShaderMaterial/);
 assert.match(adapter,/buildInterface\(/);
 assert.match(adapter,/this\.game\.recruit\(/);
 assert.match(adapter,/this\.game\.build\(/);
 assert.match(adapter,/this\.game\.command\(/);
 assert.match(adapter,/this\.game\.save\(/);
 assert.match(adapter,/cloneSkeleton/);
 assert.match(adapter,/updateShots\(/);
 assert.match(adapter,/drawMinimap\(/);
 assert.match(main,/desert-basecolor\.png/);
 assert.match(main,/desert-normal\.png/);
 const docker=readFileSync('Dockerfile','utf8');
 assert.match(docker,/COPY scripts\/webgl-battlefield\.js/);
 assert.match(docker,/COPY scripts\/webgl-environment\.js/);
});
