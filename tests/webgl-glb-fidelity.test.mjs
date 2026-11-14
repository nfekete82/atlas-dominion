import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {
 shouldPreserveAuthoredGLB,protectAuthoredGlbMaterials,glbMaterialAudit,
 recordGlbAsset,glbAuditEntries
} from '../scripts/webgl-glb-quality.js';
import {tintFactionMaterials} from '../scripts/webgl-faction-accents.js';
import {auditGlbBuffer} from '../scripts/audit-glb-file.mjs';

test('Meshy is PBR-preserved by default; authored override is explicit',()=>{
 assert.equal(shouldPreserveAuthoredGLB('/src/assets/meshy/headquarters.glb','?models=meshy'),true);
 assert.equal(shouldPreserveAuthoredGLB('/src/assets/meshy/headquarters.glb','?glbMaterials=sandforge'),false);
 assert.equal(shouldPreserveAuthoredGLB('/src/assets/reborn/buildings-3d/tank-0.glb',''),false);
 assert.equal(shouldPreserveAuthoredGLB('/src/assets/reborn/buildings-3d/tank-0.glb','?glbMaterials=original'),true);
});

test('protected GLB retains PBR textures, colour and roughness through faction tint',()=>{
 const sourceTex=new THREE.Texture(),normal=new THREE.Texture();
 sourceTex.colorSpace=THREE.SRGBColorSpace;
 const source=new THREE.MeshStandardMaterial({
  name:'Meshy military paint',color:'#a68d71',map:sourceTex,normalMap:normal,
  roughness:.43,metalness:.37
 });
 const root=new THREE.Group();
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(3,2,2),source);
 root.add(mesh);
 const audit=protectAuthoredGlbMaterials(root,{maxAnisotropy:4});
 assert.equal(audit.meshes,1);assert.equal(audit.triangles,12);
 assert.equal(audit.textures,2);
 assert.notEqual(mesh.material,source);
 assert.equal(mesh.material.map,sourceTex);
 assert.equal(mesh.material.normalMap,normal);
 assert.equal(mesh.material.map.colorSpace,THREE.SRGBColorSpace);
 assert.equal(mesh.material.roughness,.43);
 assert.equal(mesh.material.metalness,.37);
 const before=mesh.material.color.getHex();
 assert.equal(tintFactionMaterials(root,0,'headquarters','building'),0);
 assert.equal(mesh.material.color.getHex(),before);
 assert.equal(mesh.material.map,sourceTex);
 assert.equal(mesh.material.normalMap,normal);
 assert.equal(mesh.material.userData.sandforgePreserveAuthoredMaterials,true);
});

test('asset diagnostics report loaded fallback path rather than requested file',()=>{
 const entry={};
 const info=recordGlbAsset(entry,{kind:'headquarters',owner:0,
  requested:'/src/assets/meshy/headquarters.glb',
  actual:'/src/assets/reborn/buildings-3d/headquarters-0.glb'});
 assert.equal(info.fallback,true);
 assert.equal(info.actual,entry.loadedGlb.actual);
 assert.ok(glbAuditEntries().some(a=>a.actual===info.actual));
 const noAsset=glbMaterialAudit(null);
 assert.equal(noAsset.meshes,0);
});

test('GLB CLI reports metadata with no GPU dependency',()=>{
 const data={asset:{version:'2.0'},meshes:[{primitives:[{
  attributes:{POSITION:0,TEXCOORD_0:1},indices:2,material:0}]}],
  materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}}}],
  textures:[{source:0}],images:[{bufferView:0,mimeType:'image/png'}],
  accessors:[{count:6},{count:6},{count:6}],nodes:[{mesh:0}]};
 const json=Buffer.from(JSON.stringify(data));
 const padded=Buffer.alloc(Math.ceil(json.length/4)*4,0x20);json.copy(padded);
 const bytes=Buffer.alloc(20+padded.length);
 bytes.write('glTF',0);bytes.writeUInt32LE(2,4);
 bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(padded.length,12);
 bytes.write('JSON',16);padded.copy(bytes,20);
 const result=auditGlbBuffer(bytes);
 assert.equal(result.triangles,2);
 assert.equal(result.textures,1);
 assert.equal(result.primitivesMissingTexcoords,0);
 assert.throws(()=>auditGlbBuffer(Buffer.from('xyz')),/Header/);
});

test('WebGL distribution includes fidelity QA viewer and offline decoders',()=>{
 const build=readFileSync('scripts/build.mjs','utf8');
 const engine=readFileSync('scripts/webgl-preview.js','utf8');
 const battle=readFileSync('scripts/webgl-battlefield.js','utf8');
 const page=readFileSync('glb-quality.html','utf8');
 for(const target of ['KTX2Loader.js','meshopt_decoder.module.js','basis_transcoder.wasm',
  'glb-quality.html','webgl-glb-quality.js','glb-quality-preview.js'])
  assert.ok(build.includes(target),target);
 assert.match(engine,/scene.environment=baked.texture/);
 assert.match(engine,/loader.setKTX2Loader\(ktx2\).setMeshoptDecoder\(MeshoptDecoder\)/);
 assert.match(battle,/recordGlbAsset\(entry/);
 assert.match(battle,/protectAuthoredGlbMaterials\(model/);
 assert.match(page,/RECHTS · Sandforge/);
});
