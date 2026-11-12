import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {createStrategicBuilding} from '../scripts/webgl-strategic-buildings.js';
test('compact circular silo matches reference silhouette without changing missile gameplay',()=>{
 assert.equal(BUILDINGS.silo.cost,5000);
 assert.ok(BUILDINGS.silo.width<=185);
 const model=createStrategicBuilding('silo',0);
 assert.equal(model.userData.compactRoundSilo,true);
 for(const name of ['Silo_ArmoredLaunchRing','Silo_ControlHut','Silo_RocketBody',
  'Silo_RocketNose','Silo_RocketStageSeam'])
  assert.ok(model.getObjectByName(name),name);
 const ring=model.getObjectByName('Silo_ArmoredLaunchRing');
 assert.equal(ring.geometry.type,'TorusGeometry');
 const body=model.getObjectByName('Silo_RocketBody');
 const nose=model.getObjectByName('Silo_RocketNose');
 assert.ok(body.geometry.type==='CylinderGeometry');
 assert.ok(body.geometry.parameters.height>=95);
 assert.ok(nose.geometry.type==='ConeGeometry');
 assert.ok(nose.position.y-nose.geometry.parameters.height/2
  <=body.position.y+body.geometry.parameters.height/2+1,
  'missile tip physically overlaps its body');
 assert.ok(body.position.y-body.geometry.parameters.height/2<=62,
  'missile is seated in launch shaft, not floating above its ring');

 const dims=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
 assert.ok(dims.x<205&&dims.z<180,'silo has a small footprint');
 assert.ok(dims.y<165,'missile is not a towering oversized landmark');
 const meshes=[];model.traverse(x=>{if(x.isMesh)meshes.push(x)});
 assert.ok(meshes.length<=20,'static parts stay GPU batched');
 assert.ok(meshes.some(x=>x.material?.name==='SF_base'&&x.material?.map?.isDataTexture));
 assert.ok(meshes.some(x=>x.material?.name==='SF_armor'&&x.material?.map?.isDataTexture));
});
