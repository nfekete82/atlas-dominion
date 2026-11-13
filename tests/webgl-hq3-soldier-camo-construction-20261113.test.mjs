import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {tintFactionMaterials,setWorldCamouflageBiome,
 shouldTintFactionSurface,SOLDIER_HQ3_DESERT_PALETTE}
 from '../scripts/webgl-faction-accents.js';
import {prepareHeadquartersPortal,disposeHeadquartersPortal}
 from '../scripts/webgl-production-gates.js';
import {prepareAuthoredAssembly,updateAuthoredAssembly,
 releaseAuthoredAssembly} from '../scripts/webgl-construction-assembly.js';
import {createBuildingYard,disposeBuildingYard} from '../scripts/webgl-building-yard.js';
import {attachTeamMarkings,detachTeamMarkings} from '../scripts/webgl-team-markings.js';

const shader=()=>({
 vertexShader:'#include <common>\n#include <begin_vertex>',
 fragmentShader:'#include <common>\n#include <color_fragment>'
});

test('infantry, pioneers and rocket infantry use fine, locally fixed HQ3 olive camouflage',()=>{
 setWorldCamouflageBiome('desert');
 for(const kind of ['infantry','engineer','heavy','medic','rocket']){
  const source=new THREE.MeshStandardMaterial({name:'Generic_Armor',color:'#cacaca'});
  const uniform=new THREE.Mesh(new THREE.BoxGeometry(3,8,2),source);
  uniform.name='Soldier_Vest_Backpack';
  const root=new THREE.Group();root.add(uniform);
  assert.equal(tintFactionMaterials(root,0,kind,'unit'),1,kind);
  const mat=uniform.material;
  assert.equal(mat.userData.sandforgeCamouflageBiome,'desert',kind);
  const compiled=shader();mat.onBeforeCompile(compiled,null);
  assert.ok(compiled.vertexShader.includes('sfDesertWorld=transformed;'),
   'uniform pattern must follow the soldier instead of world coordinates');
  assert.ok(compiled.fragmentShader.includes(SOLDIER_HQ3_DESERT_PALETTE.rgb[1]));
  assert.ok(compiled.fragmentShader.includes('sfDesertWorld.x*8.6'));
  assert.ok(mat.roughness>=.89&&mat.metalness<=.16,
   'army uniform must be matte rather than silver-grey');
  uniform.geometry.dispose();mat.dispose();source.dispose();
 }
 setWorldCamouflageBiome('desert');
});

test('shared glTF materials do not carry soldier camouflage onto rifle, visor or face',()=>{
 setWorldCamouflageBiome('desert');
 assert.equal(shouldTintFactionSurface('engineer','unit',
  'Generic_Armor','SkinnedMesh'),true,
  'the generic glTF SkinnedMesh node must not be mistaken for a human skin material');
 assert.equal(shouldTintFactionSurface('engineer','unit',
  'Human_Skin','SkinnedMesh'),false,
  'actual exposed skin stays protected');
 assert.equal(shouldTintFactionSurface('rocket','unit',
  'Camo_Armor','Rocket_Infantry_SkinnedMesh'),true,
  'rocket specialists wear camouflage despite the word rocket in their rig');
 assert.equal(shouldTintFactionSurface('rocket','unit',
  'Launcher_Metal','RocketLauncher'),false,
  'the actual launcher remains dark metal');
 const source=new THREE.MeshStandardMaterial({name:'Generic_Metal',color:'#c6c2b6'});
 const root=new THREE.Group();
 const meshes=[];
 for(const name of ['Soldier_Helmet','Soldier_Vest','Rifle_Muzzle','Face_Skin','Helmet_Visor']){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),source);
  mesh.name=name;root.add(mesh);meshes.push(mesh);
 }
 tintFactionMaterials(root,0,'engineer','unit');
 assert.notEqual(meshes[0].material,meshes[2].material);
 assert.equal(meshes[0].material.userData.sandforgeCamouflageBiome,'desert');
 for(const mesh of meshes.slice(2)){
  assert.equal(shouldTintFactionSurface('engineer','unit',source.name,mesh.name),false);
  assert.equal(mesh.material.userData.sandforgeCamouflageBiome,undefined,mesh.name);
 }
 for(const mat of new Set(meshes.map(x=>x.material)))mat.dispose();
 for(const mesh of meshes)mesh.geometry.dispose();
 source.dispose();
});

test('infantry owner marks are armour paint, not floating black rectangular quads',()=>{
 for(const owner of [0,1]){
  const model=new THREE.Group();
  const armour=new THREE.Mesh(new THREE.BoxGeometry(1,2,.8),
   new THREE.MeshStandardMaterial({name:'Soldier_Armour'}));
  model.add(armour);
  const entry={node:new THREE.Group(),detail:model};
  entry.node.add(model);
  const marker=attachTeamMarkings(entry,owner,'engineer',25,43);
  assert.ok(marker);
  assert.equal(marker.children.length,0,
   'free-standing wrist/chest billboards must not appear beside the soldier');
  assert.equal(marker.userData.paintedMeshCount,0);
  assert.equal(attachTeamMarkings(entry,owner,'engineer',25,43),marker,
   'same owner reuses the existing marker without creating overlays');
  detachTeamMarkings(entry);
  assert.equal(entry.teamMarkings,null);
  armour.geometry.dispose();armour.material.dispose();
 }
});

test('HQ3 roof, portal doors, and side building meshes share bottom-up construction',()=>{
 const root=new THREE.Group();
 const facade=new THREE.Mesh(new THREE.BoxGeometry(8,9,8),new THREE.MeshStandardMaterial());
 facade.position.y=4.5;root.add(facade);
 const entry={kind:'headquarters',detail:root};
 const portal=prepareHeadquartersPortal(entry);
 assert.ok(portal);
 const assembly=prepareAuthoredAssembly(root);
 assert.ok(assembly.meshes.some(p=>p.mesh===facade));
 for(const {leaf} of portal.leaves)
  assert.ok(assembly.meshes.some(p=>leaf.children.includes(p.mesh)),
   'both sliding shutters participate in the same height reveal');
 updateAuthoredAssembly(assembly,0);
 for(const {geometry} of assembly.meshes)
  assert.equal(geometry.drawRange.count,0,'nothing from the finished building is visible at 0%');
 updateAuthoredAssembly(assembly,.5);
 assert.ok(facade.geometry.drawRange.count>0,'walls rise during construction');
 assert.ok(facade.geometry.drawRange.count<facade.geometry.index.count,
  'the whole building is not placed in one frame');
 updateAuthoredAssembly(assembly,1);
 for(const {geometry} of assembly.meshes)
  assert.equal(geometry.drawRange.count,geometry.index.count);
 releaseAuthoredAssembly(assembly);
 assert.equal(facade.geometry.index.count,36,'source geometry is restored after completion');
 disposeHeadquartersPortal(entry);
 facade.geometry.dispose();facade.material.dispose();
});

test('HQ3 side station and crates rise with the same height budget, fence instances stay separate',()=>{
 const yard=createBuildingYard('headquarters',160);
 try{
  const station=yard.getObjectByName('ServiceConsole');
  assert.ok(station,'side service housing exists');
  const original=station.geometry;
  const assembly=prepareAuthoredAssembly(yard,{referenceHeight:140/yard.scale.y});
  assert.ok(assembly.meshes.some(p=>p.mesh===station));
  assert.ok(!assembly.meshes.some(p=>p.mesh.isInstancedMesh),
   'instanced perimeter is staged as late fence pieces, not ordinary wall triangles');
  updateAuthoredAssembly(assembly,0);
  assert.equal(station.geometry.drawRange.count,0);
  updateAuthoredAssembly(assembly,.15);
  assert.equal(station.geometry.drawRange.count,0);
  updateAuthoredAssembly(assembly,1);
  assert.equal(station.geometry.drawRange.count,station.geometry.index.count);
  releaseAuthoredAssembly(assembly);
  assert.equal(station.geometry,original);
 }finally{disposeBuildingYard(yard);}
 const src=readFileSync('scripts/webgl-construction.js','utf8');
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.ok(src.includes("entry.headquartersPortal?.root"),
  'doors added after model streaming trigger a construction rescan');
 assert.ok(src.includes('state.siteAssembly=prepareAuthoredAssembly(entry.yard'));
 assert.ok(src.includes('instancedOnly:Boolean(state.siteAssembly)'));
 assert.ok(battlefield.indexOf('this.construction.update(entry,b)')>
  battlefield.indexOf("entry.yard=createBuildingYard(b.kind"),
  'new site props must be staged before their first rendered frame');
});
