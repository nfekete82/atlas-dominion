import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {shouldTintFactionSurface,tintFactionMaterials,setWorldCamouflageBiome} from '../scripts/webgl-faction-accents.js';
import {desert002UniformTexture,desert002Texture} from '../scripts/webgl-desert002.js';
import {soldierUniformUVs,applyUniformProjection,SOLDIER_CAMO_UV_REVISION} from '../scripts/webgl-soldier-camo.js';

const samples=[
 ['Atlas_HelmetShell','Atlas sand ceramic',true],
 ['Atlas_ChestCeramic','Atlas sand ceramic',true],
 ['Atlas_PackCasing','Atlas sand ceramic',true],
 ['Atlas_ForearmLSuit','Atlas three-tone desert fabric',true],
 ['Atlas_BootUpper','Atlas charcoal webbing',true],
 ['Atlas_Gauntlet','Atlas worn ceramic bevels',true],
 ['Atlas_Handguard','Atlas phosphate steel',false],
 ['Atlas_RifleReceiver','Atlas phosphate steel',false],
 ['Atlas_MuzzleBore','Atlas dark boot rubber',false],
 ['Atlas_Optics','Atlas amber optics',false],
 ['Atlas_HelmetStripe','Atlas faction enamel',false],
 ['Atlas_MedicalHelmetBand','Atlas faction enamel',false]
];
for(const kind of ['infantry','engineer','medic','heavy','rocket'])
 test(kind+' paints real Atlas ceramic/fabric while retaining rifle and insignia',()=>{
  for(const [mesh,mat,want] of samples)
   assert.equal(shouldTintFactionSurface(kind,'unit',mat,mesh),want,
    kind+' '+mesh+'/'+mat);
 });

test('Atlas ceramic loses the huge white patches using the ACTUAL desert 002 texture',()=>{
 setWorldCamouflageBiome('desert');
 const root=new THREE.Group();
 const add=(name,materialName)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.38,.52,.22),
   new THREE.MeshStandardMaterial({name:materialName,color:'#fafaf6'}));
  mesh.name=name;root.add(mesh);return mesh;
 };
 const helmet=add('Atlas_HelmetShell','Atlas sand ceramic');
 const chest=add('Atlas_ChestCeramic','Atlas sand ceramic');
 const fabric=add('Atlas_ForearmLSuit','Atlas three-tone desert fabric');
 const rifle=add('Atlas_RifleReceiver','Atlas phosphate steel');
 const insignia=add('Atlas_HelmetStripe','Atlas faction enamel');
 const originalHelmetGeometry=helmet.geometry,originalUV=helmet.geometry.getAttribute('uv');
 const originalRifleMaterial=rifle.material;
 const painted=tintFactionMaterials(root,0,'infantry','unit');
 assert.ok(painted>=3);
 for(const mesh of [helmet,chest,fabric]){
  assert.equal(mesh.material.map,desert002UniformTexture());
  assert.equal(mesh.material.color.getHexString(),'dcc5a8');
  assert.equal(mesh.material.roughness,.93);
  assert.equal(mesh.material.metalness,.035);
  assert.equal(mesh.geometry.userData.sandforgeSoldierCamoUV,SOLDIER_CAMO_UV_REVISION);
 }
 assert.notEqual(helmet.geometry,originalHelmetGeometry);
 assert.equal(originalHelmetGeometry.getAttribute('uv'),originalUV,'native GLB UV untouched');
 assert.equal(helmet.geometry.getAttribute('position'),originalHelmetGeometry.getAttribute('position'),
  'native skinned vertex geometry shared instead of expensive deep-clone');
 assert.notEqual(helmet.geometry.getAttribute('uv'),originalUV);
 assert.equal(rifle.material.map,null);
 assert.equal(insignia.material.map,null);
 assert.equal(originalRifleMaterial.map,null);
 assert.equal(desert002UniformTexture().repeat.x,2.75);
 assert.notEqual(desert002UniformTexture(),desert002Texture(),'building UVs remain unchanged');
});

test('projected UV cache is per native mesh geometry; shared attributes survive',()=>{
 const geo=new THREE.BoxGeometry(1,1,1),result=soldierUniformUVs(geo);
 assert.equal(soldierUniformUVs(geo),result,'cache avoids repeated soldier UV allocations');
 assert.notEqual(result,geo);
 assert.equal(result.index,geo.index);
 assert.ok(result.getAttribute('uv').count>0);
 const camo=new THREE.MeshStandardMaterial({name:'camo'});
 camo.userData.sandforgeMasterCamo='desert-002';
 const node=new THREE.Mesh(geo,camo);
 assert.equal(applyUniformProjection(node),true);
 assert.equal(node.geometry,result);
 const metal=new THREE.MeshStandardMaterial({name:'metal'});
 const mixed=new THREE.Mesh(geo,[camo,metal]);
 assert.equal(applyUniformProjection(mixed),false,'mixed original metal UVs protected');
 assert.equal(mixed.geometry,geo);
});

// The materials above are not hypothetical: assert they occur in the actual
// native model's binary JSON without loading/rendering its 7MB textures.
test('GLB has distinct Atlas sand ceramic and fabric materials to recolour',()=>{
 for(const file of ['infantry-0.glb','engineer-0.glb','medic-0.glb','heavy-0.glb']){
  const bytes=readFileSync('src/assets/reborn/prototype/'+file);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
  const names=new Set(json.materials.map(m=>m.name));
  for(const mat of ['Atlas sand ceramic','Atlas three-tone desert fabric','Atlas faction enamel'])
   assert.ok(names.has(mat),file+' '+mat);
 }
});
