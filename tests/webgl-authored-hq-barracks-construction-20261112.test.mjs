import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {AUTHORED_ASSEMBLY_KINDS,prepareAuthoredAssembly,
 updateAuthoredAssembly,releaseAuthoredAssembly}
 from '../scripts/webgl-construction-assembly.js';

function meshWithMergedFloors(){
 const g=new THREE.BufferGeometry();
 const pos=new Float32Array([
  -1,0,-1, 1,0,-1, 1,0,1,
  -1,9,-1, 1,9,-1, 1,9,1,
  -1,17,-1,1,17,-1,1,17,1
 ]);
 g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 g.setIndex([6,7,8,3,4,5,0,1,2]);
 const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({name:'SF_olive'}));
 mesh.name='static__olive';
 const root=new THREE.Group();root.add(mesh);
 return {root,mesh,original:g};
}
test('building height staging reveals merged GLB triangle groups bottom-up',()=>{
 assert.ok(AUTHORED_ASSEMBLY_KINDS.includes('headquarters'));
 assert.ok(AUTHORED_ASSEMBLY_KINDS.includes('barracks'));
 const {root,mesh,original}=meshWithMergedFloors();
 const source=Array.from(original.index.array);
 const state=prepareAuthoredAssembly(root);
 assert.ok(state?.meshes.length);
 assert.notEqual(mesh.geometry,original,'never reorder shared glTF geometry');
 updateAuthoredAssembly(state,0);
 assert.equal(mesh.geometry.drawRange.count,0);
 updateAuthoredAssembly(state,.4);
 assert.ok(mesh.geometry.drawRange.count>=3);
 assert.ok(mesh.geometry.drawRange.count<9);
 updateAuthoredAssembly(state,1);
 assert.equal(mesh.geometry.drawRange.count,9);
 releaseAuthoredAssembly(state);
 assert.equal(mesh.geometry,original);
 assert.deepEqual(Array.from(original.index.array),source,'cached source remains unchanged');
 mesh.material.dispose();original.dispose();
});
test('HQ3 is staged in place while Kaserne uses its closed variant',()=>{
 const code=readFileSync('scripts/webgl-construction.js','utf8');
 const battle=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.ok(code.includes('Boolean(entry.detail??entry.placeholder)'));
 assert.ok(code.includes("base.kind==='barracks'?entry.variantDetail:entry.detail"));
 assert.ok(code.includes("if(!authored)stageGroup(model,'building')"));
 assert.ok(code.includes('releaseAuthoredAssembly(state.authoredAssembly)'));
 assert.ok(code.includes('entry.detail,entry.variantDetail,entry.placeholder'));
 assert.ok(battle.includes("task.entry.kind!=='headquarters'"));
 assert.ok(battle.includes("task.entry.kind==='barracks'?'inactive':'active'"));
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.ok(build.includes("cpSync('scripts/webgl-construction-assembly.js'"));
});
