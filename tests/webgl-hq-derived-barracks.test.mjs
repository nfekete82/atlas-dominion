import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {deriveMk2Barracks,isMk2Barracks,arrangeMk2BarracksSupplies,MK2_BARRACKS_WIDTH_FACTOR} from '../scripts/webgl-hq-barracks.js';
import {prepareBarracksPortal,setBarracksDoorOpen,barracksExitLane,disposeBarracksPortal} from '../scripts/webgl-barracks-portal.js';
import {isFeldkommandoMk2} from '../scripts/webgl-feldkommando-mk2-polish.js';

function mk2Fixture(){
 const root=new THREE.Group(),stage=new THREE.Group();stage.rotation.x=-Math.PI/2;root.add(stage);
 const add=(name,geo,materialName='SF_steel',parent=stage)=>{
  const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({name:materialName,color:'#9d967f'}));
  mesh.name=name;parent.add(mesh);return mesh;
 };
 add('STAGE_02_Roof_and_Entrances__steel',new THREE.BoxGeometry(1,1,.2).translate(0,0,3.8));
 const roof=add('STAGE_02_Roof_and_Entrances__roof',new THREE.BoxGeometry(9,7,.2).translate(0,0,4.3));
 add('STAGE_02_Roof_and_Entrances__camo',new THREE.BoxGeometry(5,5,.2).translate(0,0,4.8));
 add('STAGE_01_Bunker_Shell__camo',new THREE.BoxGeometry(8,6,2.8).translate(0,0,1.6));
 add('STAGE_01_Bunker_Shell__camo_light',new THREE.BoxGeometry(8,6,.2).translate(0,0,3.1));
 add('STAGE_01_Bunker_Shell__sandstone',new THREE.BoxGeometry(6,6,3).translate(0,0,1.5));
 const mast=add('STAGE_03_Radar_Utilities_and_Details__steel',new THREE.BoxGeometry(.3,.3,4).translate(1.6,1.0,8.5));
 const beacon=add('STAGE_03_Radar_Utilities_and_Details__beacon',new THREE.BoxGeometry(.2,.2,.2).translate(1.6,1.0,11.3));
 const dish=new THREE.Group();dish.name='Radar_Dish_Pivot';stage.add(dish);
 add('Radar_Dish_Pivot__steel',new THREE.BoxGeometry(2,2,.2), 'SF_steel',dish);
 for(const [name,x,y,z] of [
  ['Door_Left_Pivot',-1.22,-5.77,1.6],
  ['Door_Right_Pivot',1.22,-5.77,1.6],
  ['Fence_Gate_Left_Pivot',-1.2,-7.48,0],
  ['Fence_Gate_Right_Pivot',1.2,-7.48,0]
 ]){
  const pivot=new THREE.Group();pivot.name=name;pivot.position.set(x,y,z);stage.add(pivot);
 }
 return {root,roof,mast,beacon,dish};
}

test('Kaserne is genuinely built from the HQ MK2 mesh, with all tech equipment removed',()=>{
 const {root:source}=mk2Fixture();
 const model=source.clone(true);
 assert.equal(isFeldkommandoMk2(model),true);
 assert.equal(deriveMk2Barracks(model),true);
 assert.equal(isMk2Barracks(model),true);
 assert.equal(deriveMk2Barracks(model),true,'idempotent');
 assert.equal(model.getObjectByName('Radar_Dish_Pivot').visible,false);
 assert.equal(model.getObjectByName('STAGE_03_Radar_Utilities_and_Details__beacon').visible,false);
 assert.ok(model.userData.sandforgeMk2BarracksMastTrianglesRemoved>0);
 assert.equal(model.getObjectByName('STAGE_03_Radar_Utilities_and_Details__steel').visible,false);
 assert.equal(model.getObjectByName('Fence_Gate_Left_Pivot').visible,false,
  'the barracks has an open passage in its single MK2 barbed-wire fence');
 assert.equal(model.getObjectByName('Fence_Gate_Right_Pivot').visible,false);
 assert.ok(model.getObjectByName('SF_MK2_Interior'),'real dark corridor retained');
 assert.equal(model.getObjectByName('STAGE_02_Roof_and_Entrances__roof')
  .material.color.getHexString(),'171c21');
 assert.equal(model.getObjectByName('STAGE_01_Bunker_Shell__camo')
  .material.map.name,'Sandforge_Desert002_MainCamouflage');
 assert.equal(source.getObjectByName('Radar_Dish_Pivot').visible,true,'HQ source never altered');
 assert.equal(source.getObjectByName('Fence_Gate_Left_Pivot').visible,true);
 assert.equal(MK2_BARRACKS_WIDTH_FACTOR,1.14);
});

test('barracks uses original MK2 sliding doors for an animated front (+Z) infantry exit',()=>{
 const model=mk2Fixture().root.clone(true);
 deriveMk2Barracks(model);
 const entry={kind:'barracks',detail:model};
 const portal=prepareBarracksPortal(entry);
 assert.ok(portal?.mk2&&portal?.authored);
 assert.equal(portal.left.name,'Door_Left_Pivot');
 assert.equal(portal.right.name,'Door_Right_Pivot');
 const lane=barracksExitLane(portal);
 assert.ok(lane.inside.z<lane.threshold.z&&lane.threshold.z<lane.outside.z);
 const closedLeft=portal.left.position.x,closedRight=portal.right.position.x;
 setBarracksDoorOpen(portal,0);
 assert.equal(portal.left.position.x,closedLeft-1.36);
 assert.equal(portal.right.position.x,closedRight+1.36);
 setBarracksDoorOpen(portal,1);
 assert.equal(portal.left.position.x,closedLeft);
 assert.equal(portal.right.position.x,closedRight);
 disposeBarracksPortal(entry);
 assert.equal(entry.barracksPortal,undefined);
});

test('MK2 barracks keeps one fence and changes only its own supply arrangement',()=>{
 const yard=new THREE.Group();
 const depot=new THREE.Group();depot.name='BaseSupplyCache';
 depot.position.set(56,0,-25);yard.add(depot);
 const equipment=new THREE.Group();equipment.name='InfantryEquipment';
 equipment.position.set(62,0,44);yard.add(equipment);
 for(const name of ['YardFencePosts','YardFenceRails','YardFenceMesh']){
  const part=new THREE.Group();part.name=name;yard.add(part);
 }
 assert.equal(arrangeMk2BarracksSupplies(yard),true);
 assert.ok(depot.position.x<0);
 assert.ok(equipment.position.x>0);
 assert.ok(equipment.position.z<0,'equipment moved to a different rear corner');
 assert.ok(yard.children.filter(o=>o.name.startsWith('YardFence')).every(o=>!o.visible));
 assert.equal(arrangeMk2BarracksSupplies(yard),false);
});

test('same MK2 source path drives construction, finished Kaserne and preview',()=>{
 const battle=readFileSync('scripts/webgl-battlefield.js','utf8');
 const gallery=readFileSync('scripts/webgl-building-gallery.js','utf8');
 const gates=readFileSync('scripts/webgl-production-gates.js','utf8');
 const simulation=readFileSync('src/reborn/simulation.ts','utf8');
 assert.match(battle,/kind==='barracks'[\s\S]*?return strategicGlbUrl\('headquarters','active'\)/);
 assert.match(battle,/deriveMk2Barracks\(model\)/);
 assert.match(gallery,/deriveMk2Barracks\(model\)/);
 assert.match(gates,/barracks&&gate\.portal\.mk2/);
 assert.match(simulation,/stagedMk2Barracks/);
 assert.ok(!battle.includes("previewSource=this.asset(kind,0,'building')"),'actual preview source is recorded');
});

test('optional local MK2 GLB has all nodes needed for the Kaserne',()=>{
 const path='src/assets/reborn/buildings-3d/sandforge_feldkommando_mk2.glb';
 if(!existsSync(path))return;
 const bytes=readFileSync(path);
 const data=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 const names=new Set(data.nodes.map(node=>node.name));
 for(const key of ['Radar_Dish_Pivot','Door_Left_Pivot','Door_Right_Pivot',
  'Fence_Gate_Left_Pivot','Fence_Gate_Right_Pivot',
  'STAGE_03_Radar_Utilities_and_Details__steel'])
  assert.ok(names.has(key),key);
});
