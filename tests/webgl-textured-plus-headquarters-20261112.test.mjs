import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {strategicGlbUrl,applyStrategicGlbFinish} from '../scripts/webgl-strategic-glb.js';
import {setWorldCamouflageBiome,tintFactionMaterials,shouldTintFactionSurface} from '../scripts/webgl-faction-accents.js';

const path='src/assets/reborn/buildings-3d/sandforge_feldkommando_textured_plus.glb';
test('new textured-plus Feldkommando has intact geometry, authored PBR artwork and animated radar pivot',()=>{
 assert.ok(strategicGlbUrl('headquarters','active').endsWith('sandforge_funkzentrale_hq3_game_ready.glb'));
 // Keep the previous textured-plus asset available without loading it as HQ.
 const bytes=readFileSync(path);
 assert.equal(bytes.length,7783052);
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),
  'dc9985641126bae0581257185632ea8993ccf0ce121373ab320937a41272dc2e');
 const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 assert.equal(gltf.images.length,26);
 assert.equal(gltf.materials.length,29);
 const radarNodes=gltf.nodes.filter(n=>n.name?.startsWith('DISH_'));
 assert.ok(radarNodes.length>=5,'original textured dish parts present');
 const view=readFileSync('scripts/webgl-strategic-glb.js','utf8');
 assert.ok(view.includes('ensureTexturedHqRadarPivot(root)'));
 assert.ok(view.includes('pivot.attach(component)'));
 assert.ok(gltf.materials.some(m=>m.name==='Desert_Camouflage_PBR'));
 assert.ok(gltf.materials.filter(m=>m.pbrMetallicRoughness?.baseColorTexture).length>=15);
 assert.ok(!gltf.nodes.some(n=>n.name==='GATE_LEFT_PIVOT'),
  'do not try to animate an absent old HQ door node');
});
test('original uploaded HQ dish is grouped without adding replacement geometry',async()=>{
 const {ensureTexturedHqRadarPivot}=await import('../scripts/webgl-strategic-glb.js');
 const root=new THREE.Group();
 for(let i=0;i<6;i++){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());
  mesh.name='DISH_part_'+i;mesh.position.set(9+i*.1,3,2);
  root.add(mesh);
 }
 const before=new THREE.Box3().setFromObject(root);
 const pivot=ensureTexturedHqRadarPivot(root);
 assert.equal(pivot.name,'RADAR_DISH_PIVOT');
 assert.equal(pivot.children.length,6);
 assert.deepEqual(new THREE.Box3().setFromObject(root).min.toArray(),before.min.toArray());
 assert.deepEqual(new THREE.Box3().setFromObject(root).max.toArray(),before.max.toArray());
 assert.equal(ensureTexturedHqRadarPivot(root),pivot,'idempotent');
 for(const child of pivot.children){child.geometry.dispose();child.material.dispose();}
});
test('preserve authored 2048px desert textures while supporting snow and jungle camouflage',()=>{
 const root=new THREE.Group();
 const texture=new THREE.Texture();
 const camo=new THREE.MeshStandardMaterial({
  name:'Desert_Camouflage_PBR',map:texture,color:'#ffffff',roughness:.69});
 const meshed=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),camo);
 meshed.name='Desert_Camouflage_PBR';root.add(meshed);
 const plus=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),
  new THREE.MeshStandardMaterial({name:'Tan_Concrete',map:texture}));
 root.add(plus);
 applyStrategicGlbFinish(root);
 assert.equal(meshed.material.userData.sandforgePreserveHQDesertTextures,true);
 setWorldCamouflageBiome('desert');
 tintFactionMaterials(root,0,'headquarters','building');
 assert.equal(meshed.material.userData.sandforgeCamouflageBiome,undefined);
 assert.equal(plus.material.userData.sandforgeCamouflageBiome,undefined);
 setWorldCamouflageBiome('snow');
 assert.equal(shouldTintFactionSurface('headquarters','building',
  'Desert_Camouflage_PBR','Desert_Camouflage_PBR'),true,
  'camouflage is not a flag even though it contains the substring flag');
 const clean=new THREE.Group();
 const snowMesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),
  new THREE.MeshStandardMaterial({name:'Desert_Camouflage_PBR',map:texture}));
 clean.add(snowMesh);
 applyStrategicGlbFinish(clean);
 tintFactionMaterials(clean,0,'headquarters','building');
 assert.equal(snowMesh.material.userData.sandforgeCamouflageBiome,'snow');
 for(const m of [meshed,plus,snowMesh]){m.geometry.dispose();m.material.dispose();}
 camo.dispose();texture.dispose();
 setWorldCamouflageBiome('desert');
});
test('existing offline HQ, simulation footprint and animated base assembly remain unchanged',()=>{
 assert.ok(strategicGlbUrl('headquarters','inactive').endsWith('feldkommando_offline.glb'));
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.ok(battlefield.includes('ensureTexturedHqRadarPivot(entry.detail)'));
 assert.ok(battlefield.includes("['barracks','headquarters'].includes(kind)?"));
 const portraits=readFileSync('scripts/webgl-portraits.js','utf8');
 assert.ok(portraits.includes("strategicGlbUrl(kind,'active')"));
 const construction=readFileSync('scripts/webgl-construction-assembly.js','utf8');
 assert.ok(construction.includes("'headquarters'"));
});
