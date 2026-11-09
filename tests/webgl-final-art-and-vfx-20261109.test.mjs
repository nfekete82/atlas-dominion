import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStrategicBuilding} from '../scripts/webgl-strategic-buildings.js';

test('silo and lab retain their major 3D signatures after static batching',()=>{
 const silo=createStrategicBuilding('silo',0);
 const lab=createStrategicBuilding('research',0);
 assert.ok(silo.getObjectByName('Silo_RocketBody'));
 assert.ok(silo.getObjectByName('Silo_RocketNose'));
 assert.ok(silo.getObjectByName('Silo_RocketStageSeam'));
 assert.ok(lab.getObjectByName('Research_Radar'));
 assert.ok(lab.getObjectByName('Research_SensorArray'));
 for(const model of [silo,lab]){
  assert.ok(model.children.some(o=>o.name.startsWith('SF_StaticBatch_')));
  const meshes=[];model.traverse(o=>{if(o.isMesh)meshes.push(o);});
  assert.ok(meshes.length<65,'one launch facility should not cause dozens of per-frame draw calls');
 }
});

test('strategic flight missile uses shared rocket geometries and recycles them',()=>{
 const source=readFileSync('scripts/webgl-strategic-effects.js','utf8');
 assert.match(source,/sharedFlame:new THREE\.ConeGeometry/);
 assert.match(source,/rocketNose:new THREE\.ConeGeometry/);
 assert.match(source,/root\.name='Strategic_Missile_'/);
 assert.match(source,/s\.upperHull,s\.olive/);
 assert.match(source,/s\.rocketNose,s\.graphite/);
 assert.match(source,/rocket\.removeFromParent\(\);this\.rockets\.delete\(id\)/);
 const update=source.slice(source.indexOf(' update(active=true){'),source.indexOf(' dispose(){'));
 assert.doesNotMatch(update,/new THREE\.(?:CylinderGeometry|ConeGeometry|BoxGeometry)/);
});

test('ruin-road dressing is visual-only, instanced and costs no per-frame update',()=>{
 const source=readFileSync('scripts/webgl-preview.js','utf8');
 const start=source.indexOf('function addBuriedRuinRoad(');
 const end=source.indexOf('function dressRuinDamage(',start);
 assert.ok(start>=0&&end>start);
 const road=source.slice(start,end);
 assert.match(road,/new THREE\.InstancedMesh/);
 assert.match(road,/nonPlayable:true,roadFragment:true/);
 assert.match(road,/castShadow=false;mesh\.receiveShadow=false/);
 assert.match(source,/addBuriedRuinRoad\(anchor,ruin,i\)/);
});
