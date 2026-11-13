import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createBuildingYard,disposeBuildingYard,YARD_FENCE_HEIGHT,YARD_FENCE_POST_WIDTH}
 from '../scripts/webgl-building-yard.js';
import {setWorldCamouflageBiome,tintFactionMaterials,shouldTintFactionSurface,
 HQ3_MATCHED_DESERT_PALETTE,BARRACKS_HQ3_CHARCOAL_ROOF,CAMOUFLAGE_PALETTES}
 from '../scripts/webgl-faction-accents.js';

function testMaterial(name,hex,owner=0,type='building',kind='headquarters'){
 const source=new THREE.MeshStandardMaterial({name,color:hex,roughness:.3,metalness:.8});
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),source);
 mesh.name='static__'+name;
 const root=new THREE.Group();root.add(mesh);
 const count=tintFactionMaterials(root,owner,kind,type);
 return {mesh,source,count,dispose(){
  mesh.geometry.dispose();mesh.material.dispose();source.dispose();
 }};
}
test('all grey/white imported GLB armour and concrete receive three-tone biome camouflage',()=>{
 for(const biome of ['desert','snow','jungle']){
  setWorldCamouflageBiome(biome);
  for(const name of ['SF_white','SF_steel_light','SF_steel_dark','SF_foundation','SF_Bastion_sandplate']){
   const p=testMaterial(name,'#ffffff');
   try{
    assert.equal(p.count,1,biome+': '+name);
    assert.equal(p.mesh.material.userData.sandforgeCamouflageBiome,biome);
    assert.ok(p.mesh.material.roughness>=.84);
    assert.ok(p.mesh.material.metalness<=.26);
    const shader={
     vertexShader:'#include <common>\n#include <begin_vertex>',
     fragmentShader:'#include <common>\n#include <color_fragment>'
    };
    p.mesh.material.onBeforeCompile(shader,null);
    assert.ok(shader.fragmentShader.includes('sfPaint=mix('));
    assert.ok(shader.fragmentShader.includes('diffuseColor.rgb=mix('));
    assert.ok(shader.fragmentShader.includes(',.94)'));
   }finally{p.dispose();}
  }
 }
 setWorldCamouflageBiome('desert');
});
test('neutral bastions use biome camouflage; glass, signals, skin and team marks stay protected',()=>{
 setWorldCamouflageBiome('desert');
 const neutral=testMaterial('SF_Bastion_concrete','#e5e5e5',-1,'building','bastion');
 try{
  assert.equal(neutral.count,1);
  assert.equal(neutral.mesh.material.userData.sandforgeCamouflageBiome,'desert');
 }finally{neutral.dispose();}
 for(const name of ['SF_glass','SF_blue_glow','SF_red_glow','SF_recess','SF_Bastion_light','SF_team_blue']){
  assert.equal(shouldTintFactionSurface('headquarters','building',name,'static__'+name),false,name);
 }
 const flag=testMaterial('SF_team_blue','#5cabe6',1);
 try{assert.equal(flag.mesh.material.color.getHexString(),'af5449');}
 finally{flag.dispose();}
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.ok(!battlefield.includes('material.emissive.setRGB(1,1,1)'));
 assert.ok(battlefield.includes("tintFactionMaterials(detail,owner,'bastion','building')"));
});
test('HQ3-style desert paint darkens barracks and Bastion MK2 without hiding signal materials',()=>{
 setWorldCamouflageBiome('desert');
 for(const [kind,name] of [
  ['barracks','SF_olive'],
  ['barracks','SF_steel_light'],
  ['bastion','SF_Bastion_concrete'],
  ['bastion','SF_Bastion_armor'],
  ['bastion','SF_Bastion_sandplate']
 ]){
  const p=testMaterial(name,'#ffffff',kind==='bastion'?-1:0,'building',kind);
  try{
   assert.equal(p.count,1,kind+': '+name);
   assert.equal(p.mesh.material.userData.sandforgeCamouflageBiome,'desert');
   assert.ok(p.mesh.material.roughness>=.84);
   const shader={vertexShader:'#include <common>\n#include <begin_vertex>',
    fragmentShader:'#include <common>\n#include <color_fragment>'};
   p.mesh.material.onBeforeCompile(shader,null);
   assert.ok(shader.fragmentShader.includes(HQ3_MATCHED_DESERT_PALETTE.wall[1]));
   assert.ok(shader.fragmentShader.includes(
    kind==='barracks'?BARRACKS_HQ3_CHARCOAL_ROOF[1]:HQ3_MATCHED_DESERT_PALETTE.roof[1]));
   assert.ok(shader.fragmentShader.includes('sfRoofPaint'));
   assert.ok(shader.vertexShader.includes('sfDesertUp'));
  }finally{p.dispose();}
 }
 for(const name of ['SF_Bastion_red','SF_Bastion_light','SF_Bastion_glass',
  'SF_Bastion_dish','SF_Bastion_dishshade','SF_Bastion_stripe']){
  assert.equal(shouldTintFactionSurface('bastion','building',name,
   'static__'+name),false,name+' is preserved');
 }
 const signal=testMaterial('SF_Bastion_red','#ff4137',0,'building','bastion');
 try{
  assert.equal(signal.count,0);
  assert.equal(signal.mesh.material.userData.sandforgeCamouflageBiome,undefined);
 }finally{signal.dispose();}
});
test('every desert facility inherits HQ3 dark olive camouflage while protected details stay legible',()=>{
 setWorldCamouflageBiome('desert');
 for(const kind of ['factory','research','silo','generator','interceptor','airfield','headquarters']){
  const p=testMaterial('SF_olive','#dfd9c7',0,'building',kind);
  try{
   assert.equal(p.count,1,kind);
   const shader={vertexShader:'#include <common>\n#include <begin_vertex>',
    fragmentShader:'#include <common>\n#include <color_fragment>'};
   p.mesh.material.onBeforeCompile(shader,null);
   assert.ok(shader.fragmentShader.includes(HQ3_MATCHED_DESERT_PALETTE.wall[1]),
    kind+' should share HQ3 olive wall paint');
   assert.equal(p.mesh.material.userData.sandforgeCamouflageBiome,'desert');
  }finally{p.dispose();}
 }
 for(const name of ['SF_glass','Radar_Dish','SF_blue_glow','Door_Shutter','Warning_Lamp']){
  assert.equal(shouldTintFactionSurface('factory','building',name,'static__'+name),
   false,name+' detail should not be painted');
 }
});

test('snow/jungle Bastion and barracks use the original per-biome palettes',()=>{
 for(const biome of ['snow','jungle']){
  setWorldCamouflageBiome(biome);
  for(const [kind,name] of [['barracks','SF_olive'],['bastion','SF_Bastion_armor']]){
   const p=testMaterial(name,'#b7a181',0,'building',kind);
   try{
    const shader={vertexShader:'#include <common>\n#include <begin_vertex>',
     fragmentShader:'#include <common>\n#include <color_fragment>'};
    p.mesh.material.onBeforeCompile(shader,null);
    assert.equal(p.mesh.material.userData.sandforgeCamouflageBiome,biome);
    assert.ok(shader.fragmentShader.includes(CAMOUFLAGE_PALETTES[biome].rgb[0]));
    assert.ok(!shader.fragmentShader.includes('sfRoofPaint'));
   }finally{p.dispose();}
  }
 }
 setWorldCamouflageBiome('desert');
});
test('all building fences are slim and have raised barbed strands without blocking entrances',()=>{
 for(const kind of ['headquarters','barracks','research','silo','factory','interceptor']){
  const yard=createBuildingYard(kind,160);
  try{
   const posts=yard.getObjectByName('YardFencePosts');
   const rails=yard.getObjectByName('YardFenceRails');
   const wires=yard.getObjectByName('YardFenceMesh');
   assert.ok(posts?.isInstancedMesh);
   assert.ok(rails?.isInstancedMesh);
   assert.ok(wires?.isInstancedMesh);
   const size=new THREE.Vector3(),p=new THREE.Vector3(),
    q=new THREE.Quaternion(),matrix=new THREE.Matrix4();
   posts.getMatrixAt(0,matrix);matrix.decompose(p,q,size);
   assert.ok(size.x<=YARD_FENCE_POST_WIDTH&&size.z<=YARD_FENCE_POST_WIDTH);
   assert.ok(Math.abs(size.y-YARD_FENCE_HEIGHT)<1e-4);
   rails.getMatrixAt(0,matrix);matrix.decompose(p,q,size);
   assert.ok(Math.min(size.x,size.y,size.z)<1);
   const meta=yard.getObjectByName('BasePerimeter_'+kind).userData;
   assert.ok(meta.barbedWirePieces>=20,kind+' has visible top wire and spikes');
   assert.equal(wires.userData.containsBarbedWire,true);
   assert.equal(wires.count,meta.fenceWires);
   let highWire=false;
   for(let i=0;i<wires.count;i++){
    wires.getMatrixAt(i,matrix);
    p.setFromMatrixPosition(matrix);
    if(p.y>=YARD_FENCE_HEIGHT){highWire=true;break;}
   }
   assert.ok(highWire,'stacheldraht is above the normal rails');
  }finally{disposeBuildingYard(yard);}
 }
});
