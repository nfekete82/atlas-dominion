import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {CAMOUFLAGE_PALETTES,SOLDIER_HQ3_DESERT_PALETTE,
 setWorldCamouflageBiome,worldCamouflageBiome,
 tintFactionMaterials,shouldTintFactionSurface} from '../scripts/webgl-faction-accents.js';
test('snow/desert/jungle use three distinct camouflage palettes on structures and units',()=>{
 for(const biome of ['snow','desert','jungle']){
  assert.equal(setWorldCamouflageBiome(biome),biome);
  for(const type of ['unit','building']){
   const m=new THREE.MeshStandardMaterial({name:'Camo_Armor',color:'#c0b6a4'});
   const obj=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),m);
   obj.name=type==='unit'?'Soldier_Uniform':'Headquarters_Wall';
   const root=new THREE.Group();root.add(obj);
   assert.equal(tintFactionMaterials(root,0,type==='unit'?'infantry':'headquarters',type),1);
   const finish=obj.material;
   assert.equal(finish.userData.sandforgeCamouflageBiome,biome);
   const shader={vertexShader:'#include <common>\n#include <begin_vertex>',
    fragmentShader:'#include <common>\n#include <color_fragment>'};
   finish.onBeforeCompile(shader,null);
   assert.ok(shader.fragmentShader.includes('sfPaint='));
   const expected=biome==='desert'&&type==='unit'?
    SOLDIER_HQ3_DESERT_PALETTE.rgb:CAMOUFLAGE_PALETTES[biome].rgb;
   assert.ok(shader.fragmentShader.includes(expected[0]));
   assert.ok(shader.fragmentShader.includes(expected[2]));
   assert.ok(shader.vertexShader.includes('sfDesertWorld'));
   obj.geometry.dispose();obj.material.dispose();m.dispose();
  }
 }
 setWorldCamouflageBiome('desert');
});
test('keep owner flag, glass, skin, wheels and weapons readable',()=>{
 setWorldCamouflageBiome('jungle');
 for(const name of ['Rotor_Blade','Cockpit_Visor','Rifle_Muzzle',
  'Soldier_Face','Track_Wheel','TEAM_FLAG_blue']){
  assert.equal(shouldTintFactionSurface('infantry','unit','Metal',name),false,name);
 }
 const flag=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),
  new THREE.MeshStandardMaterial({name:'SF_team_blue',color:'#347c9c'}));
 const root=new THREE.Group();root.add(flag);
 tintFactionMaterials(root,1,'barracks','building');
 assert.equal(flag.material.color.getHexString(),'af5449');
 setWorldCamouflageBiome('desert');
});
test('active map biome configures the same camouflage for all loaded 3D entities',()=>{
 const source=readFileSync('scripts/webgl-preview.js','utf8');
 assert.ok(source.includes('setWorldCamouflageBiome(biome)'));
 const portrait=readFileSync('scripts/webgl-portraits.js','utf8');
 assert.ok(portrait.includes('isStrategicBuilding(kind)||isStrategicGlbKind(kind)'));
});
