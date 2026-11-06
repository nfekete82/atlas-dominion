import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

test('3D effects are included with the standalone OrbStack WebGL build',()=>{
 const files=['dist/webgl-combat-vfx.js','dist/webgl-preview.js','dist/webgl-battlefield.js',
  'dist/vendor/three/three.module.js'];
 for(const path of files)assert.ok(existsSync(path),'missing file '+path);
 const source=readFileSync('dist/webgl-combat-vfx.js','utf8');
 const main=readFileSync('dist/webgl-preview.js','utf8');
 const docker=readFileSync('Dockerfile','utf8');
 assert.ok(source.includes('export class SandforgeCombatEffects'));
 assert.ok(main.includes('new SandforgeCombatEffects'));
 assert.ok(main.includes('effects.update(dt,running,accumulator)'), 'rocket flight uses fractional simulation time for 3D interpolation');
 assert.ok(docker.includes('COPY scripts ./scripts')||docker.includes('COPY scripts/webgl-combat-vfx.js'),'Docker must include the VFX module either via complete scripts directory or explicit copy');
});

test('3D effects reuse authoritative combat events and do not mutate pathfinding or AI',()=>{
 const src=readFileSync('dist/webgl-combat-vfx.js','utf8');
 for(const feature of ['this.game.blasts','this.game.shots','this.game.canSee(0',
   'new THREE.InstancedMesh','this.trackCount','this.wreckHull','this.smoke','this.flames']){
  assert.ok(src.includes(feature),'missing graphics feature '+feature);
 }
 assert.ok(!src.includes('.step('),'effects must not advance the simulation');
 assert.ok(!src.includes('.build('),'effects must never create gameplay buildings');
 assert.ok(!src.includes('.recruit('),'effects must never recruit gameplay units');
});
