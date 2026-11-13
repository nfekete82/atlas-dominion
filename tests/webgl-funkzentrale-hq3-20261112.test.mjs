import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {strategicGlbUrl,applyStrategicGlbFinish} from '../scripts/webgl-strategic-glb.js';
import {setWorldCamouflageBiome,tintFactionMaterials,shouldTintFactionSurface} from '../scripts/webgl-faction-accents.js';

const file='src/assets/reborn/buildings-3d/sandforge_funkzentrale_hq3_game_ready.glb';
test('HQ3 Funkzentrale is used during building and after completion with original meshes and textures',()=>{
 assert.ok(strategicGlbUrl('headquarters','active').endsWith('sandforge_funkzentrale_hq3_game_ready.glb'));
 assert.equal(strategicGlbUrl('headquarters','inactive'),strategicGlbUrl('headquarters','active'));
 const bytes=readFileSync(file);
 assert.equal(bytes.length,2805328);
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),
  '54e06ad8eb860fe3049bdda4fece257f34227b4344e43e530870abf9c1e30551');
 const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 assert.equal(gltf.meshes.length,32,'original user-authored mesh geometry unchanged');
 assert.equal(gltf.materials.length,15);
 assert.equal(gltf.images.length,9);
 assert.equal(gltf.images.filter(i=>i.mimeType==='image/jpeg').length,7);
 assert.equal(gltf.images.filter(i=>i.mimeType==='image/png').length,2);
 assert.ok(gltf.materials.some(m=>m.name==='Desert_Camouflage_Weathered'));
 assert.ok(gltf.materials.some(m=>m.name==='Sand_Concrete_PBR'));
 const pivot=gltf.nodes.find(n=>n.name==='RADAR_DISH_PIVOT');
 assert.ok(pivot?.children?.length>=9,'independent satellite assembly is on one genuine turning pivot');
 for(const child of pivot.children)
  assert.match(gltf.nodes[child].name,/^(Independent_Satellite_Dish|Independent_Dish_)/);
 assert.ok(!gltf.nodes.some(n=>n.name==='GATE_LEFT_PIVOT'),'no invented animated HQ doors');
});
test('desert keeps baked HQ3 UV camouflage while snow and jungle repaint its PBR maps',()=>{
 const texture=new THREE.Texture();
 const create=()=>{
  const root=new THREE.Group();
  const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),
   new THREE.MeshStandardMaterial({name:'Desert_Camouflage_Weathered',map:texture}));
  root.add(m);
  applyStrategicGlbFinish(root);
  assert.equal(m.material.userData.sandforgePreserveHQDesertTextures,true);
  return {root,m};
 };
 setWorldCamouflageBiome('desert');
 const a=create();tintFactionMaterials(a.root,0,'headquarters','building');
 assert.equal(a.m.material.userData.sandforgeCamouflageBiome,undefined);
 setWorldCamouflageBiome('snow');
 const b=create();tintFactionMaterials(b.root,1,'headquarters','building');
 assert.equal(b.m.material.userData.sandforgeCamouflageBiome,'snow');
 setWorldCamouflageBiome('jungle');
 const c=create();tintFactionMaterials(c.root,0,'headquarters','building');
 assert.equal(c.m.material.userData.sandforgeCamouflageBiome,'jungle');
 for(const item of [a,b,c]){item.m.geometry.dispose();item.m.material.dispose();}
 texture.dispose();
 setWorldCamouflageBiome('desert');
});
test('authored stencil, insignia and warning beacons are exempt from broad camouflage',()=>{
 for(const name of ['Wing_Unit_Insignia','HQ3_Stencil','Hazard_Yellow','Beacon_Red_Emissive']){
  assert.equal(shouldTintFactionSurface('headquarters','building',name,'Static_'+name),false,name);
 }
 const code=readFileSync('scripts/webgl-battlefield.js','utf8');
 const portraits=readFileSync('scripts/webgl-portraits.js','utf8');
 const construction=readFileSync('scripts/webgl-construction-assembly.js','utf8');
 assert.ok(code.includes("ensureTexturedHqRadarPivot(entry.detail)"));
 assert.ok(code.includes("['barracks','headquarters'].includes(kind)?"));
 assert.ok(code.includes("this.placementFacing=['research','barracks'].includes(kind)?1:0"));
 assert.ok(!code.includes("['research','barracks','headquarters'].includes(kind)?1:0"));
 assert.ok(code.includes("task.entry.kind!=='headquarters'"));
 assert.ok(portraits.includes("strategicGlbUrl(kind,'active')"));
 assert.ok(construction.includes("'headquarters'"));
});
