import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {TEAM_MARKING_COLORS,VEHICLE_PAINT_REVISION,selectVehiclePaintMeshes,
 attachTeamMarkings,detachTeamMarkings} from '../scripts/webgl-team-markings.js';

test('infantry keep blue/red armbands without white floating signposts',()=>{
 assert.equal(TEAM_MARKING_COLORS[0],'#28769b');
 assert.equal(TEAM_MARKING_COLORS[1],'#a84f42');
 for(const owner of [0,1])for(const kind of ['infantry','medic','rocket','heavy']){
  const node=new THREE.Group(),entry={node};
  const group=attachTeamMarkings(entry,owner,kind,30,40);
  assert.ok(group.getObjectByName('TeamArmband_Left'));
  assert.ok(group.getObjectByName('TeamArmband_Right'));
  assert.equal(group.getObjectByName('TeamFlagpole'),undefined);
  assert.equal(attachTeamMarkings(entry,owner,kind,30,40),group);
  detachTeamMarkings(entry);
 }
});
test('vehicle emblems are actually PBR paint with zero separate meshes/draw calls',()=>{
 for(const [kind,owner] of [['tank',0],['tank',1],['artillery',0],
  ['rover',0],['scout',0],['scout',1],['bomber',0]]){
  const node=new THREE.Group(),detail=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(100,30,90),
   new THREE.MeshStandardMaterial({name:'Camouflage',roughness:.95}));
  body.name=kind==='scout'?'Helicopter_Fuselage':kind==='bomber'?'Bomber_Wing':'Turret_Armour';
  body.position.y=20;detail.add(body);
  if(kind==='scout'){
   const rotor=new THREE.Mesh(new THREE.BoxGeometry(130,2,8),
    new THREE.MeshStandardMaterial({name:'Rotor'}));
   rotor.name='MainRotorBlade';rotor.position.y=60;detail.add(rotor);
  }
  node.add(detail);
  const entry={node,detail},original=body.material;
  assert.ok(selectVehiclePaintMeshes(detail,kind).includes(body));
  assert.ok(!selectVehiclePaintMeshes(detail,kind).some(x=>/Rotor/.test(x.name)));
  const group=attachTeamMarkings(entry,owner,kind,100,40);
  assert.equal(group.children.length,0,'NO overlay mesh');
  assert.equal(group.parent,null,'NO additional 3D node in the scene');
  assert.notEqual(body.material,original,'owned PBR shader clone');
  assert.equal(body.material.userData.sandforgeVehiclePaintRevision,VEHICLE_PAINT_REVISION);
  assert.equal(body.material.userData.sandforgeVehiclePaintOwner,owner);
  assert.ok(body.material.roughness>.9);
  const s={vertexShader:'#include <common>\n#include <begin_vertex>',
   fragmentShader:'#include <common>\n#include <color_fragment>'};
  body.material.onBeforeCompile(s,{});
  assert.match(s.fragmentShader,/sfBand1/);
  assert.match(s.fragmentShader,/sfUp/);
  assert.match(s.fragmentShader,/diffuseColor.rgb=mix/);
  assert.ok(!s.fragmentShader.includes('sfWhiteCross'));
  assert.equal(attachTeamMarkings(entry,owner,kind,100,40),group);
  const updated=attachTeamMarkings(entry,1-owner,kind,100,40);
  assert.equal(updated.children.length,0);
  assert.equal(body.material.userData.sandforgeVehiclePaintOwner,1-owner);
  const shader={vertexShader:'#include <common>\n#include <begin_vertex>',
   fragmentShader:'#include <common>\n#include <color_fragment>'};
  body.material.onBeforeCompile(shader,{});
  assert.notEqual(shader.fragmentShader,s.fragmentShader,
   'captured paint color must change when a vehicle changes faction');
 }
});
test('standard materials retain the original camouflage texture and map',()=>{
 const node=new THREE.Group(),detail=new THREE.Group(),tex=new THREE.Texture();
 const body=new THREE.Mesh(new THREE.BoxGeometry(140,36,110),
  new THREE.MeshStandardMaterial({name:'Desert_Camo',map:tex,roughness:.9}));
 body.name='Tank_Turret';detail.add(body);node.add(detail);
 const entry={node,detail};
 attachTeamMarkings(entry,0,'tank');
 assert.equal(body.material.map,tex);
 assert.equal(body.material.roughness,.9);
 assert.ok(!node.getObjectByName('TeamArmourFlag'));
 assert.ok(!node.getObjectByName('TeamAircraftWing_1'));
 const src=readFileSync('scripts/webgl-team-markings.js','utf8');
 assert.doesNotMatch(src,/function surfacePatch/);
 assert.ok(readFileSync('scripts/build.mjs','utf8').includes('webgl-team-markings.js'));
});
