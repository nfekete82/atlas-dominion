import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

for(const name of ['ruin-house','ruin-depot'])test('canyon: valid embedded original 3D glTF model '+name,async()=>{
 const gltf=JSON.parse(await readFile(new URL('../src/assets/reborn/canyon-3d/'+name+'.gltf',import.meta.url),'utf8'));
 assert.equal(gltf.asset.version,'2.0');
 assert.equal(gltf.scenes[0].nodes[0],0);
 assert.ok(gltf.materials.length>=5);
 assert.ok(gltf.meshes[0].primitives.length>=5);
 const bin=Buffer.from(gltf.buffers[0].uri.split(',')[1],'base64');
 assert.equal(bin.length,gltf.buffers[0].byteLength);
 let triangles=0;
 for(const primitive of gltf.meshes[0].primitives){
  const position=gltf.accessors[primitive.attributes.POSITION];
  const normal=gltf.accessors[primitive.attributes.NORMAL];
  const indices=gltf.accessors[primitive.indices];
  assert.equal(position.componentType,5126);
  assert.equal(normal.count,position.count);
  assert.equal(indices.componentType,5123);
  assert.equal(indices.count%3,0);
  triangles+=indices.count/3;
  for(const id of [primitive.attributes.POSITION,primitive.attributes.NORMAL,primitive.indices]){
   const accessor=gltf.accessors[id],view=gltf.bufferViews[accessor.bufferView];
   assert.ok(view.byteOffset>=0&&view.byteOffset+view.byteLength<=bin.length);
  }
  assert.ok(position.max[1]>0,'there must be extruded wall height');
 }
 assert.ok(triangles>500,'real triangulated 3D mesh, not a texture reference');
});
