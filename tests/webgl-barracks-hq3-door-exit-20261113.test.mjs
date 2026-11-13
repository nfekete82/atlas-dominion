import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {prepareBarracksPortal,setBarracksDoorOpen,barracksExitLane,
 disposeBarracksPortal} from '../scripts/webgl-barracks-portal.js';
import {createBuildingYard,disposeBuildingYard}
 from '../scripts/webgl-building-yard.js';
import {calibratedScale,STRATEGIC_BUILDING_VISUAL_SCALE,buildingFacingAngle}
 from '../scripts/webgl-scale.js';
import {setWorldCamouflageBiome,tintFactionMaterials,
 HQ3_MATCHED_DESERT_PALETTE} from '../scripts/webgl-faction-accents.js';

function exampleBarracksDoor(){
 const model=new THREE.Group();
 // Not centred at X=0: authored GLB door meshes can live off-axis,
 // including when pivot transforms are identity but vertices are not.
 for(const [name,x] of [['GATE_LEFT_PIVOT',-.40],
  ['GATE_RIGHT_PIVOT',1.60]]){
  const pivot=new THREE.Group();pivot.name=name;
  pivot.position.set(x,0,-4.3);
  const leaf=new THREE.Mesh(new THREE.BoxGeometry(.80,2.2,.14),
   new THREE.MeshStandardMaterial());
  leaf.position.y=1.1;pivot.add(leaf);model.add(pivot);
 }
 return model;
}

test('barracks automatic exit is aligned to the actual GLB airlock',()=>{
 const model=exampleBarracksDoor(),entry={kind:'barracks',detail:model};
 const portal=prepareBarracksPortal(entry,{localClippingEnabled:false});
 assert.ok(portal?.authored);
 const lane=barracksExitLane(portal);
 assert.ok(Math.abs(lane.inside.x-.60)<1e-4,
  'departure must use the off-centre authored doorway, not world X=0');
 assert.ok(Math.abs(lane.inside.x-lane.outside.x)<1e-6);
 assert.ok(lane.outside.z<lane.inside.z-5,
  'troop walks outward through local -Z door before moving to rally');
 assert.ok(lane.inside.z<0);
 const closedL=portal.left.position.x,closedR=portal.right.position.x;
 assert.equal(portal.hall.visible,false,'closed gate initially hides interior');
 setBarracksDoorOpen(portal,0);
 assert.ok(portal.left.position.x<closedL&&portal.right.position.x>closedR,
  'both authored shutters slide OUTWARD, not across each other');
 assert.equal(portal.hall.visible,true,'hall visible while shutters open');
 setBarracksDoorOpen(portal,1);
 assert.equal(portal.left.position.x,closedL);
 assert.equal(portal.right.position.x,closedR);
 assert.equal(portal.hall.visible,false);
 disposeBarracksPortal(entry);
 model.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
});

test('authored barracks exit turns with each of the four builder rotations',()=>{
 for(const facing of [0,2,1,3]){
  const model=exampleBarracksDoor();
  const actor=new THREE.Group();actor.rotation.y=buildingFacingAngle(facing);
  actor.add(model);actor.updateWorldMatrix(true,true);
  const portal=prepareBarracksPortal({detail:model},{localClippingEnabled:false});
  const lane=barracksExitLane(portal);
  const inside=model.localToWorld(lane.inside.clone());
  const outside=model.localToWorld(lane.outside.clone());
  const delta=outside.clone().sub(inside).normalize();
  const angle=buildingFacingAngle(facing);
  assert.ok(Math.abs(delta.x+Math.sin(angle))<1e-4);
  assert.ok(Math.abs(delta.z+Math.cos(angle))<1e-4);
  model.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
 }
});

test('barracks production no longer cancels hidden troop and opens authored shutter first',()=>{
 const code=readFileSync('scripts/webgl-production-gates.js','utf8');
 assert.ok(code.includes('barracksExitLane(entry.gate.portal)'));
 assert.ok(code.includes('barracksExitLane(gate.portal)'));
 assert.ok(code.includes('gate.portal.authored?1-pose.open:pose.open'));
 assert.ok(!code.includes('||!actor.node.visible||'));
 assert.ok(code.includes('actor.node.visible=age>=GATE_TIMING.warning+GATE_TIMING.opening;'));
});

test('barracks visual scale and HQ3-style textured matte roof remain cosmetic',()=>{
 assert.equal(STRATEGIC_BUILDING_VISUAL_SCALE.barracks,1.20);
 const dims={x:120,y:85,z:100};
 const base=Math.min(140/120,119/85);
 assert.ok(Math.abs(calibratedScale('barracks','building',dims,140)-base*1.20)<1e-8);
 const yard=createBuildingYard('barracks',140);
 try{assert.equal(yard.scale.x,1.20);}finally{disposeBuildingYard(yard);}
 setWorldCamouflageBiome('desert');
 for(const name of ['SF_white','SF_olive','SF_steel_light']){
  const source=new THREE.MeshStandardMaterial({name,color:'#dfd9c7',
   roughness:.51,metalness:.61});
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),source);
  const root=new THREE.Group();root.add(mesh);
  assert.equal(tintFactionMaterials(root,0,'barracks','building'),1,name);
  const mat=mesh.material;
  assert.ok(mat.roughness>=.91&&mat.metalness<=.15,name);
  const shader={vertexShader:'#include <common>\n#include <begin_vertex>',
   fragmentShader:'#include <common>\n#include <color_fragment>'};
  mat.onBeforeCompile(shader,null);
  assert.ok(shader.fragmentShader.includes(HQ3_MATCHED_DESERT_PALETTE.wall[1]));
  assert.ok(shader.fragmentShader.includes('sfGrain'));
  assert.ok(shader.fragmentShader.includes('sfRoofPaint'),
   'light roof plates should be anthracite, not off-white');
  assert.ok(shader.fragmentShader.includes(',.985)'));
  mesh.geometry.dispose();mat.dispose();source.dispose();
 }
});
