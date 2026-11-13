import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {barracksAccessoryRegion,simplifyBarracksSilhouette,
 BARRACKS_SILHOUETTE_REVISION} from '../scripts/webgl-barracks-silhouette.js';
import {STRATEGIC_BUILDING_VISUAL_SCALE,strategicBuildingHeightScale,
 calibratedScale} from '../scripts/webgl-scale.js';
import {createBuildingYard,disposeBuildingYard}
 from '../scripts/webgl-building-yard.js';

const box=(w,h,d,x,y,z)=>{
 const g=new THREE.BoxGeometry(w,h,d);
 g.translate(x,y,z);
 return g;
};

test('remove independent barracks tower, redundant rooftop fans and ridge vent without cutting walls',()=>{
 const samples=[
  box(6,5,6,0,3,0),         // structural wall: preserve
  box(1,2,1,-7.6,7.0,5.7), // detached rear guard tower: remove
  box(1,.4,1,6.6,5.13,-.8),// first roof fan: remove
  box(1,.4,1,6.6,5.13,1.5),// centre fan: preserve
  box(1,.4,1,6.6,5.13,3.6),// third roof fan: remove
  box(.3,.4,.3,0,6.4,4.2) // duplicate ridge vent: remove
 ];
 const geometry=mergeGeometries(samples,false);
 assert.ok(geometry?.getIndex());
 const source=geometry.getIndex().count;
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 mesh.name='static__steel';
 const root=new THREE.Group();root.add(mesh);
 const removed=simplifyBarracksSilhouette(root);
 assert.equal(removed,48,'four independent box components removed');
 assert.equal(mesh.geometry.getIndex().count,source-48*3);
 assert.notEqual(mesh.geometry,geometry,'cached glTF geometry remains untouched');
 assert.equal(geometry.getIndex().count,source);
 assert.equal(root.userData.sandforgeBarracksSilhouette,BARRACKS_SILHOUETTE_REVISION);
 assert.equal(simplifyBarracksSilhouette(root),0,'idempotent across repeated scene updates');
 mesh.geometry.dispose();geometry.dispose();mesh.material.dispose();
 samples.forEach(g=>g.dispose());
});

test('apron islands disappear without removing wall-supporting blocks',()=>{
 const foundation=b=>barracksAccessoryRegion(b,'static__foundation');
 assert.equal(foundation({min:{x:-10.1,y:-.085,z:-9.125},max:{x:10.1,y:.605,z:9.125}}),'exterior-slab-or-steps');
 assert.equal(foundation({min:{x:-2.825,y:.27,z:-10.11},max:{x:2.825,y:.65,z:-8.01}}),'exterior-slab-or-steps');
 assert.equal(foundation({min:{x:-5.07,y:1.08,z:-1.69},max:{x:5.07,y:1.60,z:6.11}}),null,'foundation beneath main building survives');
 for(const name of ['static__concrete_high','static__deck','static__deck_light'])
  assert.equal(barracksAccessoryRegion({min:{x:-9,y:.7,z:-9},max:{x:9,y:1.1,z:9}},name),'exterior-apron-surface');
});

test('entirely redundant accessory meshes do not leave floating watchtower beacons',()=>{
 const geometry=box(.28,.20,.28,-7.66,8.95,5.93);
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 mesh.name='static__ice';
 const root=new THREE.Group();root.add(mesh);
 assert.equal(simplifyBarracksSilhouette(root),12);
 assert.equal(mesh.visible,false,'isolated watchtower indicator must disappear');
 assert.equal(mesh.userData.sandforgeSimplifiedAccessory,true);
 geometry.dispose();mesh.material.dispose();
});

test('large connected roof surfaces never get clipped by decorative exclusion regions',()=>{
 assert.equal(barracksAccessoryRegion({
  min:{x:-10.1,y:1,z:-9},max:{x:10.1,y:8,z:9}}),null);
 assert.equal(barracksAccessoryRegion({
  min:{x:-8.7,y:6.2,z:4.9},max:{x:-6.4,y:7.7,z:7.1}}),'tower');
 assert.equal(barracksAccessoryRegion({
  min:{x:5.9,y:4.57,z:.7},max:{x:7.4,y:5.35,z:2.2}}),null,
  'central fan remains as a recognizable detail');
 assert.equal(barracksAccessoryRegion({
  min:{x:5.9,y:4.57,z:2.85},max:{x:7.4,y:5.35,z:4.35}}),'outer-fan');
});

test('barracks is taller but does not enlarge collision, fences or gameplay footprint',()=>{
 assert.equal(STRATEGIC_BUILDING_VISUAL_SCALE.barracks,1.27);
 assert.ok(strategicBuildingHeightScale('barracks')>1.7);
 // Exact clearance is measured against the real door in the design-system suite.
 const bounds={x:20.2,y:9.055,z:20.2},width=140;
 const model=calibratedScale('barracks','building',bounds,width);
 assert.ok(Math.abs(model-(width/20.2)*1.27)<1e-7);
 assert.ok(bounds.y*model*1.28>bounds.y*model,
  'vertical lift must affect the imported building, not soldiers or gameplay');
 const code=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.ok(code.includes('strategicBuildingHeightScale(entry.kind)'));
 assert.ok(code.includes('simplifyBarracksSilhouette(model)'));
 assert.ok(code.includes('simplifyBarracksSilhouette(alternate)'));
 assert.ok(code.includes('simplifyBarracksSilhouette(model);\n   const bounds='),
  'the placement preview must have the same simplified GLB');
 const yard=createBuildingYard('barracks',width);
 try{
  assert.equal(yard.scale.x,1.27);
  assert.equal(yard.scale.y,1.27,
   'visual yard follows horizontal width but not the taller roof');
  assert.equal(yard.getObjectByName('BasePerimeter_barracks').userData.nonPlayable,true);
 }finally{disposeBuildingYard(yard);}
});

test('barracks yard is restrained: one supply cache, one lamp and one equipment rack',()=>{
 const yard=createBuildingYard('barracks',160);
 try{
  const site=yard.getObjectByName('BasePerimeter_barracks'),
   supplies=yard.getObjectByName('BaseSupplyCache'),
   kit=yard.getObjectByName('InfantryEquipment');
  assert.ok(site&&supplies&&kit);
  assert.equal(site.userData.lamps,1);
  assert.equal(site.userData.supplyCrates,1);
  assert.equal(supplies.children.filter(c=>c.name==='SupplyBarrel').length,1);
  assert.equal(supplies.children.some(c=>c.name==='SupplyPallet'),false);
  assert.equal(kit.getObjectsByProperty('name','InfantryHelmetAssembly').length,1);
  assert.equal(kit.getObjectsByProperty('name','InfantryWeaponRackRifle').length,1);
  assert.equal(kit.getObjectsByProperty('name','AmmunitionCrate').length,1);
  const fence=yard.getObjectByName('YardFencePosts');
  assert.ok(fence?.isInstancedMesh,'the perimeter fence is kept');
 }finally{disposeBuildingYard(yard);}
});
