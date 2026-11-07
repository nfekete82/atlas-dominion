import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBuildingYard} from '../scripts/webgl-building-yard.js';

test('barracks equipment is human-scaled instead of building-scaled',()=>{
 const yard=createBuildingYard('barracks',160);
 assert.ok(yard);
 const group=yard.getObjectByName('InfantryEquipment');
 assert.ok(group);
 assert.equal(group.scale.x,.48);
 const names=new Set();
 group.traverse(obj=>{if(obj.isMesh)names.add(obj.name);});
 for(const expected of ['InfantryHelmet','HelmetRim','RifleBarrel','WeaponRack','EquipmentPallet','AmmunitionCrate'])
  assert.ok(names.has(expected),'missing '+expected);
 const helmet=group.getObjectByName('InfantryHelmet');
 const rifle=group.getObjectByName('InfantryWeaponRackRifle');
 const headDiameter=new THREE.Box3().setFromObject(helmet).getSize(new THREE.Vector3()).x;
 const rifleLength=new THREE.Box3().setFromObject(rifle).getSize(new THREE.Vector3()).z;
 assert.ok(headDiameter>=7&&headDiameter<=10,'helmet should fit an infantry head: '+headDiameter);
 assert.ok(rifleLength>17&&rifleLength<32,'rifle should fit human scale: '+rifleLength);
 assert.equal(yard.userData.visualOnly,true);
});

test('factory exterior inventory stays unchanged by barracks correction',()=>{
 const factory=createBuildingYard('factory',160);
 assert.ok(factory.getObjectByName('VehicleSpareParts'));
 assert.equal(factory.getObjectByName('VehicleSpareParts').scale.x,1);
});
