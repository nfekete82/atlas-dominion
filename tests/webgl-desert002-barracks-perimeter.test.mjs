import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {desert002Texture,desert002UniformTexture,DESERT_002_TEXTURE_URL} from '../scripts/webgl-desert002.js';
import {SOLDIER_CAMO_UV_REVISION} from '../scripts/webgl-soldier-camo.js';
import {buildingTexture,BUILDING_DESIGN_REVISION} from '../scripts/webgl-building-design.js';
import {setWorldCamouflageBiome,tintFactionMaterials} from '../scripts/webgl-faction-accents.js';
import {createBuildingYard,disposeBuildingYard} from '../scripts/webgl-building-yard.js';

test('Real desert 002 asset is committed, cropped, shared and correctly colour managed',()=>{
 const bytes=readFileSync('src/assets/reborn/textures/desert-002-master.webp');
 assert.ok(bytes.length>2500&&bytes.length<100000);
 assert.equal(bytes.toString('ascii',0,4),'RIFF');
 assert.equal(bytes.toString('ascii',8,12),'WEBP');
 assert.equal(DESERT_002_TEXTURE_URL,'/src/assets/reborn/textures/desert-002-master.webp');
 const map=desert002Texture();
 assert.equal(map,buildingTexture('camouflage-albedo'));
 assert.equal(map.name,'Sandforge_Desert002_MainCamouflage');
 assert.equal(map.wrapS,THREE.RepeatWrapping);
 assert.equal(map.wrapT,THREE.RepeatWrapping);
 assert.equal(map.colorSpace,THREE.SRGBColorSpace);
 assert.match(BUILDING_DESIGN_REVISION,/desert-002/);
});

test('Infantry and engineer use the same literal desert 002 texture only on uniform pieces',()=>{
 setWorldCamouflageBiome('desert');
 for(const kind of ['infantry','engineer','medic','heavy','rocket']){
  const root=new THREE.Group();
  const torso=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),
   new THREE.MeshStandardMaterial({name:'uniform_cloth',color:'#b8b49e'}));
  torso.name='CombatUniformChest';root.add(torso);
  const rifle=new THREE.Mesh(new THREE.BoxGeometry(.4,1,2),
   new THREE.MeshStandardMaterial({name:'weapon_rifle',color:'#222222'}));
  rifle.name='WeaponRifle';root.add(rifle);
  const visor=new THREE.Mesh(new THREE.PlaneGeometry(1,1),
   new THREE.MeshStandardMaterial({name:'glass_visor',color:'#101010'}));
  visor.name='GlassVisor';root.add(visor);
  tintFactionMaterials(root,0,kind,'unit');
  assert.equal(torso.material.map,desert002UniformTexture(),kind+' chest');
  assert.equal(torso.material.map.repeat.x,2.75);
  assert.equal(torso.geometry.userData.sandforgeSoldierCamoUV,SOLDIER_CAMO_UV_REVISION);
  assert.equal(torso.material.vertexColors,false);
  assert.equal(torso.material.roughness,.93);
  assert.equal(torso.material.color.getHexString(),'dcc5a8');
  assert.equal(rifle.material.map,null,kind+' weapon stays metal');
  assert.equal(visor.material.map,null,kind+' visor stays glass');
 }
});

test('all buildings are fence-free, including barracks, HQ and factory',()=>{
 for(const kind of ['barracks','headquarters','factory','research','silo','interceptor']){
  const yard=createBuildingYard(kind,158);
  assert.ok(yard,'service yard still exists for '+kind);
  const perimeter=yard.getObjectByName('BasePerimeter_'+kind);
  assert.ok(perimeter,'supply/lamp group retained');
  for(const name of ['YardFencePosts','YardFenceRails','YardFenceMesh'])
   assert.equal(perimeter.getObjectByName(name),undefined,kind+' '+name);
  assert.equal(perimeter.userData.fencePosts,undefined);
  disposeBuildingYard(yard);
 }
});
