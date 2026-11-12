import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBuildingYard,disposeBuildingYard} from '../scripts/webgl-building-yard.js';
import {calibratedScale,STRATEGIC_BUILDING_VISUAL_SCALE} from '../scripts/webgl-scale.js';
import {applyStrategicGlbFinish} from '../scripts/webgl-strategic-glb.js';

const WIDTH=140;
function postsOf(yard){
 const fence=yard.getObjectByName('YardFencePosts');
 assert.ok(fence?.isInstancedMesh);
 const matrix=new THREE.Matrix4(),point=new THREE.Vector3(),posts=[];
 for(let i=0;i<fence.count;i++){
  fence.getMatrixAt(i,matrix);posts.push(point.setFromMatrixPosition(matrix).clone());
 }
 return {fence,posts};
}
test('research perimeter moves the cross-fence behind its real -Z entrance',()=>{
 const yard=createBuildingYard('research',WIDTH);
 try{
  const {fence,posts}=postsOf(yard);
  assert.equal(yard.scale.x,.88);
  assert.ok(posts.some(p=>Math.abs(p.x)<WIDTH*.12&&Math.abs(p.z-WIDTH*.53)<.01),
   'back (+Z) must have a cross-fence');
  assert.ok(!posts.some(p=>Math.abs(p.x)<WIDTH*.12&&p.z<0),
   'research entrance (-Z) must be unobstructed');
  const matrix=new THREE.Matrix4(),scale=new THREE.Vector3();
  fence.getMatrixAt(0,matrix);scale.setFromMatrixScale(matrix);
  assert.equal(scale.y,18);
  assert.equal(fence.userData.nonPlayable,true);
 }finally{disposeBuildingYard(yard);}
});
test('other facilities retain their normal +Z open entrance',()=>{
 const yard=createBuildingYard('headquarters',WIDTH);
 try{
  const {posts}=postsOf(yard);
  assert.ok(posts.some(p=>Math.abs(p.x)<WIDTH*.12&&Math.abs(p.z+WIDTH*.53)<.01));
  assert.ok(!posts.some(p=>Math.abs(p.x)<WIDTH*.12&&p.z>0));
  assert.equal(yard.scale.x,1);
 }finally{disposeBuildingYard(yard);}
});
test('smaller strategic buildings and yard props use one visual scale',()=>{
 for(const kind of ['research','silo']){
  const factor=STRATEGIC_BUILDING_VISUAL_SCALE[kind];
  assert.ok(factor>=.85&&factor<=.92);
  assert.ok(Math.abs(calibratedScale(kind,'building',{x:200,y:100,z:180},140)-.7*factor)<1e-9);
  const yard=createBuildingYard(kind,WIDTH);
  try{assert.equal(yard.scale.x,factor);}finally{disposeBuildingYard(yard);}
 }
});
test('warm desert finish clones and preserves the source material',()=>{
 const source=new THREE.MeshStandardMaterial({name:'SF_white',roughness:.3,metalness:.9});
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),source);
 const root=new THREE.Group();root.add(mesh);
 assert.equal(applyStrategicGlbFinish(root),1);
 assert.notEqual(mesh.material,source);
 assert.equal(source.color.getHexString(),'ffffff');
 assert.equal(mesh.material.color.getHexString(),'c3b69a');
 assert.ok(mesh.material.roughness>=.78&&mesh.material.metalness<=.34);
 mesh.geometry.dispose();mesh.material.dispose();source.dispose();
});
