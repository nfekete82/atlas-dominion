import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {geometryScene,readGlb} from '../scripts/audit-building-design.mjs';
import {applyBuildingDesign,BUILDING_MATERIAL_FAMILIES,buildingTexture,buildingMaterialFamily,HQ3_TILE_SPAN} from '../scripts/webgl-building-design.js';
import {HQ3_PBR,HQ3_REFERENCE_SHA256,BUILDING_MEASUREMENTS} from '../scripts/webgl-hq3-reference.js';
import {BARRACKS_ARCHITECTURE} from '../scripts/webgl-building-profiles.js';
import {calibratedScale,strategicBuildingHeightScale,buildingFacingAngle} from '../scripts/webgl-scale.js';
import {prepareBarracksPortal,setBarracksDoorOpen,barracksExitLane} from '../scripts/webgl-barracks-portal.js';
import {prepareSiloHatch,poseSiloHatch} from '../scripts/webgl-building-motion.js';
import {prepareAuthoredAssembly,updateAuthoredAssembly,releaseAuthoredAssembly} from '../scripts/webgl-construction-assembly.js';
import {simplifyBarracksSilhouette} from '../scripts/webgl-barracks-silhouette.js';
import {renderedBuildingBounds} from '../scripts/webgl-building-bounds.js';
import {tintFactionMaterials,setWorldCamouflageBiome} from '../scripts/webgl-faction-accents.js';

const path='src/assets/reborn/buildings-3d/';
const digest=b=>createHash('sha256').update(b).digest('hex');
const shader=()=>({uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader});
async function model(kind,variant){
 const file=variant??BUILDING_MEASUREMENTS[kind].file;
 const {scene}=await geometryScene(path+file);
 const {scale,heightScale}=BUILDING_MEASUREMENTS[kind];
 scene.scale.set(scale,scale*heightScale,scale);return scene;
}

test('seven library JPEGs are byte-identical embedded HQ3 maps; all PBR scalars are audited',()=>{
 const {bytes,json,bin}=readGlb(path+'sandforge_funkzentrale_hq3_game_ready.glb');
 assert.equal(digest(bytes),HQ3_REFERENCE_SHA256);
 const names=['concrete-albedo','camouflage-albedo','camouflage-normal','metal-albedo','roof-albedo','roof-normal','door-albedo'];
 for(const [i,name] of names.entries()){
  const v=json.bufferViews[json.images[i].bufferView];
  assert.equal(digest(readFileSync(path+'hq3-materials/'+name+'.jpg')),digest(bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength)),name);
 }
 for(const m of json.materials){
  assert.equal(HQ3_PBR[m.name].roughness,m.pbrMetallicRoughness.roughnessFactor);
  assert.equal(HQ3_PBR[m.name].metalness,m.pbrMetallicRoughness.metallicFactor);
 }
 const audit=JSON.parse(readFileSync('docs/building-design-system/asset-audit.json'));
 const surface=audit.buildings.headquarters.surfaces.Desert_Camouflage_Weathered;
 assert.ok(Math.abs(Math.sqrt(surface.area/surface.uvArea)*audit.buildings.headquarters.scale-HQ3_TILE_SPAN.camouflage)<1e-9);
});

test('real barracks uses actual HQ3 albedo/normals and PBR without mutating cached sources',async()=>{
 const root=await model('barracks'),mesh=root.getObjectByName('static__olive');
 const geometry=mesh.geometry,original=mesh.material,color=original.color.clone(),uv=geometry.getAttribute('uv');
 applyBuildingDesign(root,{kind:'barracks'});
 const mat=mesh.material,compiled=shader();mat.onBeforeCompile(compiled);
 assert.equal(mat.userData.sandforgeMaterialFamily,'HQ_Desert_Camouflage');
 assert.equal(mat.roughness,.91);assert.equal(mat.metalness,.02);
 assert.equal(compiled.uniforms.sfHqMap.value,buildingTexture('camouflage-albedo'));
 assert.equal(compiled.uniforms.sfHqNormalMap.value,buildingTexture('camouflage-normal'));
 assert.equal(compiled.uniforms.sfHqRoofMap.value,buildingTexture('roof-albedo'));
 assert.equal(compiled.uniforms.sfHqRoofRoughness.value,.84);
 assert.equal(compiled.uniforms.sfHqRoofMetalness.value,.06);
 assert.ok(!compiled.fragmentShader.includes('sfPaint='),'no arbitrary colour wash over the reference pixels');
 assert.equal(geometry.getAttribute('sfBuildingPosition'),undefined);
 assert.equal(mesh.geometry.getAttribute('position'),geometry.getAttribute('position'),'reuse source GPU buffers');
 assert.equal(mesh.geometry.getAttribute('uv'),uv);assert.deepEqual(original.color,color);
 const before=mesh.geometry,paint=mesh.material;
 assert.equal(applyBuildingDesign(root,{kind:'barracks'}),0);
 assert.equal(mesh.geometry,before);assert.equal(mesh.material,paint);
 for(const facing of [0,2,1,3]){
  root.rotation.y=buildingFacingAngle(facing);root.updateWorldMatrix(true,true);
  assert.equal(mesh.geometry.getAttribute('sfBuildingPosition'),before.getAttribute('sfBuildingPosition'));
 }
});

test('source geometry and library maps are shared by matching clones and retained across capture',async()=>{
 setWorldCamouflageBiome('desert');
 const template=(await geometryScene(path+'factory-0.glb')).scene;
 const a=template.clone(true),b=template.clone(true);
 tintFactionMaterials(a,0,'factory','building');tintFactionMaterials(b,1,'factory','building');
 const ma=a.getObjectByName('Atlas_CeramicHull_3'),mb=b.getObjectByName('Atlas_CeramicHull_3');
 assert.equal(ma.geometry,mb.geometry,'same source transform shares projection geometry');
 const s1=shader(),s2=shader();ma.material.onBeforeCompile(s1);mb.material.onBeforeCompile(s2);
 assert.equal(s1.uniforms.sfHqMap.value,s2.uniforms.sfHqMap.value);
 const owned=ma.material;tintFactionMaterials(a,1,'factory','building');
 assert.equal(ma.material,owned);assert.equal(owned.color.getHex(),0xffffff,'capture does not multiply the HQ3 texture by legacy paint');
 assert.equal(template.getObjectByName('Atlas_CeramicHull_3').geometry.getAttribute('sfBuildingPosition'),undefined);
});

test('HQ3 and non-desert biome coatings remain untouched; glass/signals/hardware are classified explicitly',async()=>{
 const root=await model('headquarters'),materials=[];root.traverse(m=>{if(m.isMesh)materials.push(m.material);});
 assert.equal(applyBuildingDesign(root,{kind:'headquarters'}),0);
 let i=0;root.traverse(m=>{if(m.isMesh)assert.equal(m.material,materials[i++]);});
 assert.equal(applyBuildingDesign(await model('barracks'),{kind:'barracks',biome:'snow'}),0);
 assert.equal(applyBuildingDesign(await model('barracks'),{kind:'barracks',biome:'jungle'}),0);
 for(const name of ['SF_glass','SF_blue_glow','SF_team_blue','Wing_Unit_Insignia','HQ3_Stencil','Hazard_Yellow'])
  assert.equal(buildingMaterialFamily('barracks',{name},'static__'+name),null,name);
 assert.equal(buildingMaterialFamily('barracks',{name:'SF_olive_light'},'static__olive_light'),'HQ_Desert_Camouflage');
 assert.equal(buildingMaterialFamily('airfield',{name:''},'HangarCamoArch_0'),'HQ_Dark_Charcoal_Roof');
 assert.equal(buildingMaterialFamily('silo',{name:'SF_olive'},'blast_door_L__olive'),'HQ_Dark_Charcoal_Roof');
 assert.equal(Object.keys(BUILDING_MATERIAL_FAMILIES).length,8);
});

test('actual ready GLB doors close across the entrance, clear a standing soldier and open outward at four facings',async()=>{
 for(const facing of [0,2,1,3]){
  const root=await model('barracks');root.rotation.y=buildingFacingAngle(facing);
  const portal=prepareBarracksPortal({detail:root},{localClippingEnabled:true});
  root.updateWorldMatrix(true,true);
  const leftCenter=root.worldToLocal(new THREE.Box3().setFromObject(portal.left).getCenter(new THREE.Vector3()));
  const rightCenter=root.worldToLocal(new THREE.Box3().setFromObject(portal.right).getCenter(new THREE.Vector3()));
  assert.ok(Math.abs(leftCenter.x+.94)<1e-5,'ready model must be CLOSED at idle');
  assert.ok(Math.abs(rightCenter.x-.94)<1e-5);
  const sourceDoor=BARRACKS_ARCHITECTURE.sourceDoorHeight;
  const actual=sourceDoor*root.scale.y;
  assert.ok(Math.abs(actual-BARRACKS_ARCHITECTURE.soldierHeight*1.10)<1e-5);
  const closed=portal.left.position.x;setBarracksDoorOpen(portal,0);assert.ok(portal.left.position.x<closed-1);
  const lane=barracksExitLane(portal),delta=root.localToWorld(lane.outside).sub(root.localToWorld(lane.inside));delta.y=0;delta.normalize();
  assert.ok(Math.abs(delta.x+Math.sin(buildingFacingAngle(facing)))<1e-5);
  assert.ok(Math.abs(delta.z+Math.cos(buildingFacingAngle(facing)))<1e-5);
 }
});

test('every shipped building GLB rises monotonically from zero triangles and restores shared geometry',async()=>{
 for(const kind of Object.keys(BUILDING_MEASUREMENTS)){
  const root=await model(kind);if(kind==='barracks')simplifyBarracksSilhouette(root);
  const assembly=prepareAuthoredAssembly(root);assert.ok(assembly,kind);
  updateAuthoredAssembly(assembly,0);for(const {geometry} of assembly.meshes)assert.equal(geometry.drawRange.count,0,kind);
  let previous=0;
  for(const progress of [.16,.25,.5,.75,.95,1]){
   updateAuthoredAssembly(assembly,progress);
   const count=assembly.meshes.reduce((n,p)=>n+p.geometry.drawRange.count,0);
   assert.ok(count>=previous,kind);previous=count;
  }
  for(const {geometry} of assembly.meshes)assert.equal(geometry.drawRange.count,geometry.index.count,kind);
  const originals=assembly.meshes.map(p=>[p.mesh,p.source]);releaseAuthoredAssembly(assembly);
  for(const [mesh,source] of originals)assert.equal(mesh.geometry,source);
 }
});

test('silo hatch travel is measured from closed/open GLBs; missile is hidden until the covers clear',async()=>{
 const detail=await model('silo'),variantDetail=await model('silo','silo-open.glb');
 const entry={kind:'silo',detail,variantDetail};
 const hatch=prepareSiloHatch(entry);assert.ok(hatch.parts.length>=8);assert.ok(hatch.missile.length>0);
 for(const facing of [0,2,1,3]){
  detail.rotation.y=variantDetail.rotation.y=buildingFacingAngle(facing);
  poseSiloHatch(hatch,0);for(const mesh of hatch.missile)assert.equal(mesh.visible,false);
  detail.updateWorldMatrix(true,true);variantDetail.updateWorldMatrix(true,true);
  for(const {mesh} of hatch.parts){
   const counterpart=detail.getObjectByName(mesh.name);
   const a=new THREE.Box3().setFromObject(mesh),b=new THREE.Box3().setFromObject(counterpart);
   assert.ok(a.getCenter(new THREE.Vector3()).distanceTo(b.getCenter(new THREE.Vector3()))<1e-4,mesh.name);
  }
  poseSiloHatch(hatch,1);for(const mesh of hatch.missile)assert.equal(mesh.visible,true);
  for(const part of hatch.parts)assert.ok(part.mesh.position.distanceTo(part.open)<1e-6);
 }
});

test('rendered bounds ignore removed accessories and unused vertices',async()=>{
 const root=await model('barracks');const before=renderedBuildingBounds(root).getSize(new THREE.Vector3());
 simplifyBarracksSilhouette(root);const after=renderedBuildingBounds(root).getSize(new THREE.Vector3());
 assert.ok(after.y<before.y,'guard tower no longer inflates actual rendered height');
 assert.ok(after.x>150&&after.z>150,'main military hull remains intact');
});

test('actual barracks backing is cut only inside the doorway and troops descend to the ground',async()=>{
 const {barracksDeparturePoint,updateBarracksPortalPlanes,disposeBarracksPortal}=await import('../scripts/webgl-barracks-portal.js');
 for(const facing of [0,2,1,3]){
  const root=await model('barracks'),entry={detail:root};
  const source=root.getObjectByName('static__steel_dark').material;
  root.rotation.y=buildingFacingAngle(facing);
  const portal=prepareBarracksPortal(entry,{});setBarracksDoorOpen(portal,0);
  updateBarracksPortalPlanes(portal,true);root.updateWorldMatrix(true,true);
  const point=root.localToWorld(new THREE.Vector3(0,2,-3.6));
  assert.equal(portal.planes.length,6);
  assert.ok(portal.planes.every(p=>p.distanceToPoint(point)>0),'backing in the aperture is clipped');
  const frame=root.localToWorld(new THREE.Vector3(1.8,2,-3.6));
  assert.ok(portal.planes.some(p=>p.distanceToPoint(frame)<0),'adjacent frame stays solid');
  assert.equal(source.clippingPlanes,null,'cached PBR material not changed');
  const a=barracksDeparturePoint(portal,0),b=barracksDeparturePoint(portal,.08),c=barracksDeparturePoint(portal,1);
  assert.equal(a.y,b.y,'level while crossing the door');assert.ok(c.y<a.y-1,'descend stairs');
  assert.ok(Math.abs(c.y+.065)<1e-5,'ground matches the GLB foundation');
  disposeBarracksPortal(entry);assert.equal(root.getObjectByName('static__steel_dark').material,source);
 }
});

test('compact supply caches clear the shared perimeter at all four orientations',async()=>{
 const {createBuildingYard,disposeBuildingYard}=await import('../scripts/webgl-building-yard.js');
 for(const [kind,width] of [['headquarters',225],['barracks',158],['factory',200],['research',145],['silo',185],['interceptor',172]]){
  const yard=createBuildingYard(kind,width);
  for(const facing of [0,2,1,3]){
   yard.rotation.y=buildingFacingAngle(facing);yard.updateWorldMatrix(true,true);
   const cache=yard.getObjectByName('BaseSupplyCache');
   const bounds=new THREE.Box3().setFromObject(cache).applyMatrix4(yard.matrixWorld.clone().invert());
   assert.ok(bounds.max.x<width*.65-3,kind+' cache must clear right fence');
  }
  if(kind!=='headquarters'&&kind!=='barracks')assert.equal(yard.getObjectByName('SupplyPallet'),undefined,'remove oversized redundant pallets');
  disposeBuildingYard(yard);
 }
});
