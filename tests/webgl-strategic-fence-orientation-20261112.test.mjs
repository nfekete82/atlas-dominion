import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBuildingYard,disposeBuildingYard,YARD_FENCE_HEIGHT,YARD_FENCE_POST_WIDTH}
 from '../scripts/webgl-building-yard.js';
import {calibratedScale,STRATEGIC_BUILDING_VISUAL_SCALE} from '../scripts/webgl-scale.js';
import {applyStrategicGlbFinish} from '../scripts/webgl-strategic-glb.js';

const WIDTH=140;
function fencePosts(yard){
 const mesh=yard.getObjectByName('YardFencePosts');
 assert.ok(mesh?.isInstancedMesh);
 const matrix=new THREE.Matrix4(),point=new THREE.Vector3(),posts=[];
 for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,matrix);
  posts.push(point.setFromMatrixPosition(matrix).clone());
 }
 return {mesh,posts};
}
test('barracks and research retain their -Z facade openings',()=>{
 for(const kind of ['barracks','research']){
  const yard=createBuildingYard(kind,WIDTH);
  try{
   const {mesh,posts}=fencePosts(yard);
   const x=WIDTH*.65,z=WIDTH*.53;
   assert.ok(posts.some(p=>Math.abs(p.x)<WIDTH*.1&&Math.abs(p.z-z)<.01),
    kind+': solid cross-fence behind the building (+Z)');
   assert.ok(!posts.some(p=>Math.abs(p.x)<WIDTH*.1&&p.z<0),
    kind+': no fence across front entrance (-Z)');
   assert.ok(posts.some(p=>Math.abs(p.x+x)<.01));
   const factor=STRATEGIC_BUILDING_VISUAL_SCALE[kind]??1;
   assert.equal(yard.scale.x,factor);
   const m=new THREE.Matrix4(),scale=new THREE.Vector3();
   mesh.getMatrixAt(0,m);scale.setFromMatrixScale(m);
   assert.ok(Math.abs(scale.y-YARD_FENCE_HEIGHT)<1e-4);
   assert.equal(mesh.userData.nonPlayable,true);
  }finally{disposeBuildingYard(yard);}
 }
});
test('HQ3 Funkzentrale has its entrance opening at +Z, with rear fence at -Z',()=>{
 const yard=createBuildingYard('headquarters',WIDTH);
 try{
  const {mesh,posts}=fencePosts(yard);
  const x=WIDTH*.65,z=WIDTH*.53;
  assert.ok(posts.some(p=>Math.abs(p.x)<WIDTH*.1&&Math.abs(p.z+z)<.01),
   'rear fence must be solid behind the HQ3 at -Z');
  assert.ok(!posts.some(p=>Math.abs(p.x)<WIDTH*.1&&p.z>0),
   'front stairs and spawn lane at +Z must be open');
  assert.ok(posts.some(p=>Math.abs(p.x-x)<.01));
  assert.ok(posts.some(p=>Math.abs(p.x+x)<.01));
  const m=new THREE.Matrix4(),scale=new THREE.Vector3();
  mesh.getMatrixAt(0,m);scale.setFromMatrixScale(m);
  assert.ok(Math.abs(scale.y-YARD_FENCE_HEIGHT)<1e-4);
  assert.equal(yard.scale.x,1);
 }finally{disposeBuildingYard(yard);}
});
test('the other facility entrance remains +Z, not changed by the HQ correction',()=>{
 const yard=createBuildingYard('silo',WIDTH);
 try{
  const {posts}=fencePosts(yard);
  assert.ok(posts.some(p=>Math.abs(p.x)<WIDTH*.1&&Math.abs(p.z+WIDTH*.53)<.01));
  assert.ok(!posts.some(p=>Math.abs(p.x)<WIDTH*.1&&p.z>0));
 }finally{disposeBuildingYard(yard);}
});
test('strategic scale and decorative fencing remain cosmetic',()=>{
 for(const kind of ['research','silo']){
  const factor=STRATEGIC_BUILDING_VISUAL_SCALE[kind];
  assert.ok(factor>=1&&factor<=1.1);
  const expected=Math.min(140/200,135/100)*factor;
  assert.ok(Math.abs(calibratedScale(kind,'building',{x:200,y:100,z:180},140)-expected)<1e-9);
  const yard=createBuildingYard(kind,WIDTH);
  try{assert.equal(yard.scale.x,factor);}finally{disposeBuildingYard(yard);}
 }
});
test('warm desert finish clones and preserves the source material',()=>{
 const material=new THREE.MeshStandardMaterial({name:'SF_white',roughness:.3,metalness:.9});
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),material);
 const root=new THREE.Group();root.add(mesh);
 assert.equal(applyStrategicGlbFinish(root),1);
 assert.notEqual(mesh.material,material);
 assert.equal(material.color.getHexString(),'ffffff');
 assert.equal(mesh.material.color.getHexString(),'d4c2a2');
 assert.ok(mesh.material.roughness>=.78&&mesh.material.metalness<=.18);
 mesh.geometry.dispose();mesh.material.dispose();material.dispose();
});
