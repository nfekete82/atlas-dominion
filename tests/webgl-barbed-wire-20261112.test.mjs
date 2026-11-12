import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createStrategicBuilding} from '../scripts/webgl-strategic-buildings.js';
import {readFileSync} from 'node:fs';
test('wall includes static concertina wire above the coping, without gameplay colliders',()=>{
 const wall=createStrategicBuilding('wall',0);
 const wire=wall.getObjectByName('WallConcertinaBarbedWire');
 assert.ok(wire?.isMesh);
 assert.equal(wire.userData.nonPlayable,true);
 assert.equal(wire.userData.barbedWire,true);
 const bounds=new THREE.Box3().setFromObject(wire);
 assert.ok(bounds.min.y>50,'concertina lies above coping');
 assert.ok(bounds.max.y<70,'coil must not tower above barricade');
 assert.ok(bounds.max.x-bounds.min.x>95,'continuous along wall');
 assert.ok(wire.geometry.getAttribute('normal'));
 assert.ok(wire.material.metalness>=.9);
});
test('drag preview merges same finished wall wire geometry',()=>{
 const source=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.ok(source.includes("const authored=createStrategicBuilding('wall',0)"));
 assert.ok(source.includes('mergeGeometries(parts,false)'));
});
