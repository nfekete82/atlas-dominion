import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {prepareHeadquartersPortal,setHeadquartersDoorOpen,
 disposeHeadquartersPortal,productionGatePose,GATE_TIMING}
 from '../scripts/webgl-production-gates.js';
import {createBuildingYard,disposeBuildingYard,
 YARD_FENCE_HEIGHT,YARD_FENCE_POST_WIDTH}
 from '../scripts/webgl-building-yard.js';
import {calibratedScale,STRATEGIC_BUILDING_VISUAL_SCALE}
 from '../scripts/webgl-scale.js';

test('HQ3 front doors open and close as symmetric sliding leaves; authored GLB stays untouched',()=>{
 const model=new THREE.Group();
 const entry={kind:'headquarters',detail:model};
 const portal=prepareHeadquartersPortal(entry);
 assert.ok(portal,'HQ portal should be built after GLB is loaded');
 assert.equal(prepareHeadquartersPortal(entry),portal,'no duplicate front doors');
 assert.equal(model.getObjectByName('HQ3FrontEntrancePortal'),portal.root);
 assert.equal(portal.leaves.length,2);
 assert.ok(portal.root.position.z>0,'entrance is the authored +Z side');
 const positions=portal.leaves.map(p=>p.leaf.position.x);
 setHeadquartersDoorOpen(portal,1);
 assert.ok(portal.leaves[0].leaf.position.x<positions[0]-1);
 assert.ok(portal.leaves[1].leaf.position.x>positions[1]+1);
 assert.ok(portal.hall.material.color.getHex()===0x0a1010);
 setHeadquartersDoorOpen(portal,0);
 assert.ok(Math.abs(portal.leaves[0].leaf.position.x-positions[0])<1e-6);
 assert.ok(Math.abs(portal.leaves[1].leaf.position.x-positions[1])<1e-6);
 disposeHeadquartersPortal(entry);
 assert.equal(model.children.length,0);
 assert.equal(entry.headquartersPortal,undefined);
});

test('production timing opens first, walks out, and shuts the HQ gate last',()=>{
 const before=productionGatePose(GATE_TIMING.warning*.5);
 assert.equal(before.open,0);
 const opened=productionGatePose(GATE_TIMING.warning+GATE_TIMING.opening);
 assert.equal(opened.open,1);
 const exiting=productionGatePose(GATE_TIMING.warning+GATE_TIMING.opening+1.2);
 assert.equal(exiting.moving,true);
 const closed=productionGatePose(GATE_TIMING.warning+
  GATE_TIMING.opening+GATE_TIMING.drive+GATE_TIMING.closing);
 assert.equal(closed.open,0);
 assert.equal(closed.done,true);
 const simulation=readFileSync('src/reborn/simulation.ts','utf8');
 const graphics=readFileSync('scripts/webgl-battlefield.js','utf8');
 const gates=readFileSync('scripts/webgl-production-gates.js','utf8');
 assert.ok(simulation.includes("['factory','barracks','headquarters'].includes(b.kind)"));
 assert.ok(graphics.includes("['factory','barracks','headquarters'].includes(entry.kind)"));
 assert.ok(gates.includes("['factory','barracks','headquarters'].includes(base.kind)"));
 assert.ok(gates.includes('actor.productionMotion={moving:actuallyRolling'));
});

test('supply crates and barrels have genuine repeatable textured surfaces',()=>{
 const yard=createBuildingYard('headquarters',160);
 try{
  for(const name of ['CrateBody','CrateLid','CrateBand','BarrelShell']){
   const node=yard.getObjectByName(name);
   assert.ok(node,name+' exists');
   assert.ok(node.material.map?.isDataTexture,name+' has a procedural albedo texture');
   assert.equal(node.material.map.colorSpace,THREE.SRGBColorSpace);
   assert.equal(node.material.map.wrapS,THREE.RepeatWrapping);
   assert.equal(node.material.map.image.width,64);
   const values=node.material.map.image.data;
   assert.ok(values.some((v,i)=>i%4===0&&v!==values[0]),
    name+' texture has actual fine grain/scratches, not a flat colour');
  }
 }finally{disposeBuildingYard(yard);}
});

test('HQ model and fence enlarge together while posts become taller and thinner',()=>{
 assert.equal(STRATEGIC_BUILDING_VISUAL_SCALE.headquarters,1.10);
 const model=calibratedScale('headquarters','building',{x:120,y:65,z:100},140);
 assert.ok(model>1);
 const yard=createBuildingYard('headquarters',160);
 try{
  assert.equal(yard.scale.x,1.1);
  assert.ok(YARD_FENCE_HEIGHT>16.8);
  assert.ok(YARD_FENCE_POST_WIDTH<1.15);
  const posts=yard.getObjectByName('YardFencePosts');
  const matrix=new THREE.Matrix4();
  posts.getMatrixAt(0,matrix);
  const scale=new THREE.Vector3().setFromMatrixScale(matrix);
  assert.ok(Math.abs(scale.y-YARD_FENCE_HEIGHT)<1e-5);
  assert.ok(scale.x<=YARD_FENCE_POST_WIDTH);
 }finally{disposeBuildingYard(yard);}
});
