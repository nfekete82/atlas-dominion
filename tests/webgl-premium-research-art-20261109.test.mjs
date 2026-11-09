import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {UPGRADE_KINDS} from '../dist/src/reborn/strategic-tech.js';
import {createResearchArtwork,RESEARCH_ARTWORK_KINDS} from '../scripts/webgl-research-artworks.js';
import {createStrategicBuilding} from '../scripts/webgl-strategic-buildings.js';

const read=path=>readFileSync(path,'utf8');
const meshes=root=>{
 const items=[];root.traverse(obj=>{if(obj.isMesh)items.push(obj);});
 return items;
};
const dispose=root=>{
 const geometries=new Set(),materials=new Set();
 root.traverse(node=>{
  if(!node.isMesh)return;
  if(node.geometry)geometries.add(node.geometry);
  for(const material of (Array.isArray(node.material)?node.material:[node.material]))
   if(material)materials.add(material);
 });
 for(const geometry of geometries)geometry.dispose();
 for(const material of materials)material.dispose();
};

test('all nine actual research upgrades have separate recognizable 3D models',()=>{
 assert.deepEqual([...RESEARCH_ARTWORK_KINDS],[...UPGRADE_KINDS]);
 const signatures=new Set();
 for(const kind of RESEARCH_ARTWORK_KINDS){
  const root=createResearchArtwork(kind);
  assert.ok(root?.isGroup,kind);
  assert.equal(root.userData.researchArtwork,true);
  const parts=meshes(root);
  assert.ok(parts.length>=12,kind+' must be a real multi-part sculpture');
  assert.ok(parts.every(part=>part.geometry&&part.material),kind+' has usable PBR geometry');
  assert.ok(parts.some(part=>part.material.isMeshStandardMaterial),kind+' uses studio-lit PBR');
  const size=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  assert.ok(size.x>15&&size.y>8&&size.z>8,kind+' needs a legible three-dimensional form');
  const signature=parts.length+':'+Math.round(size.y*100)+':'+Math.round(size.z*100);
  signatures.add(signature);
  dispose(root);
 }
 assert.ok(signatures.size>=7,'do not repeat a generic gear for different upgrades');
 assert.equal(createResearchArtwork('invalid'),null);
});

test('research center and missile silo use full-size detailed industrial 3D meshes',()=>{
 for(const kind of ['research','silo']){
  const root=createStrategicBuilding(kind,0);
  assert.ok(root?.isGroup);
  const parts=meshes(root);
  assert.ok(parts.length<=20,kind+' must batch heavy static geometry for real-time performance');
  const vertices=parts.reduce((count,item)=>count+(item.geometry.getAttribute('position')?.count??0),0);
  assert.ok(vertices>1500,kind+' should retain highly detailed facade and roof geometry');
  assert.ok(parts.some(item=>item.material.map?.isDataTexture),
   kind+' shares textured concrete/metal with the HQ design language');
  assert.ok(parts.some(item=>item.material.emissiveIntensity>.1),
   kind+' has subtle faction accents');
  const bounds=new THREE.Box3().setFromObject(root);
  assert.ok(bounds.max.y>95,kind+' has a recognizable multilayered silhouette');
  dispose(root);
 }
});

test('WebGL research deck uses actual PNG portraits at the left and all text to the right',()=>{
 const ui=read('scripts/webgl-battlefield.js');
 const portraits=read('scripts/webgl-portraits.js');
 const style=read('src/reborn/webgl-classic-hud.css');
 const build=read('scripts/build.mjs');
 assert.match(ui,/class="sf-tech-art"/);
 assert.match(ui,/data-sf-research-artwork/);
 assert.match(ui,/class="sf-tech-info sf-tech-body"/);
 assert.match(ui,/sf-tech-effect/);
 assert.match(ui,/sf-tech-meta/);
 assert.match(ui,/sf-tech-progress/);
 assert.match(ui,/if\(view\.dataset\.tab==='research'\)hydrateResearchArtworks/);
 assert.match(portraits,/createResearchArtwork\(kind\)/);
 assert.match(portraits,/renderModelPortrait\(model,renderer,\{width:256,height:256,research:true\}\)/);
 assert.match(portraits,/requestAnimationFrame/);
 assert.match(portraits,/renderer\.setRenderTarget\(oldTarget\)/);
 assert.match(portraits,/renderer\.setScissorTest\(oldScissorTest\)/);
 assert.match(style,/flex-direction:row!important/);
 assert.match(style,/\.sf-tech-art img\[data-sf-art-status="ready"\]/);
 assert.match(style,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(style,/grid-template-columns:minmax\(0,1fr\)/);
 assert.match(build,/webgl-research-artworks\.js/);
});

test('strategic launcher remains available; interceptor feature gate and initial HQ remain unchanged',()=>{
 const ui=read('scripts/webgl-battlefield.js');
 assert.match(ui,/action==='missile-target'/);
 assert.match(ui,/INTERCEPTOR_ENABLED/);
 assert.match(ui,/this\.beginPlacement\(kind\)/);
 assert.match(ui,/hydrateBuildingIcons\(slots,this\.renderer\)/);
 assert.match(ui,/buildingIcon\(buildingKind,this\.renderer\)/);
 assert.doesNotMatch(ui,/data-action="hq-bootstrap"/);
});
