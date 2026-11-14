import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {
 polishFeldkommandoMk2,isFeldkommandoMk2,hideMk2DuplicateFence,
 disposeFeldkommandoMk2Polish
} from '../scripts/webgl-feldkommando-mk2-polish.js';

const make=()=>{
 const root=new THREE.Group(),stage=new THREE.Group();root.add(stage);
 const steel=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),
  new THREE.MeshStandardMaterial({name:'SF_steel',color:'#777777'}));
 steel.name='STAGE_02_Roof_and_Entrances__steel';stage.add(steel);
 const camo=new THREE.Mesh(new THREE.BoxGeometry(5,5,.5).translate(0,0,4),
  new THREE.MeshStandardMaterial({name:'SF_camo',color:'#b2a187'}));
 camo.name='STAGE_01_Bunker_Shell__camo';stage.add(camo);
 const light=new THREE.Mesh(new THREE.BoxGeometry(4,4,.5).translate(0,0,2.75),
  new THREE.MeshStandardMaterial({name:'SF_camo_light',color:'#e6d5b0'}));
 light.name='STAGE_01_Bunker_Shell__camo_light';stage.add(light);
 const roof=new THREE.Mesh(new THREE.BoxGeometry(6,6,.3).translate(0,0,4.4),
  new THREE.MeshStandardMaterial({name:'SF_roof',color:'#c0b9a5'}));
 roof.name='STAGE_02_Roof_and_Entrances__roof';stage.add(roof);
 const topCamo=new THREE.Mesh(new THREE.BoxGeometry(4,4,.4).translate(0,0,4.7),
  new THREE.MeshStandardMaterial({name:'SF_top_camo',color:'#b9b495'}));
 topCamo.name='STAGE_02_Roof_and_Entrances__camo';stage.add(topCamo);
 const outerSteel=new THREE.Mesh(new THREE.BoxGeometry(.4,.4,2.0).translate(8.1,-7.5,1.15),
  new THREE.MeshStandardMaterial({name:'SF_outer_steel',color:'#596062'}));
 outerSteel.name='STAGE_03_Radar_Utilities_and_Details__steel';stage.add(outerSteel);
 const outerStone=new THREE.Mesh(new THREE.BoxGeometry(.7,.7,.4).translate(8.1,-7.5,.25),
  new THREE.MeshStandardMaterial({name:'SF_outer_stone',color:'#b2aa90'}));
 outerStone.name='STAGE_03_Radar_Utilities_and_Details__sandstone';stage.add(outerStone);
 for(const [name,x,y,z] of [
  ['Door_Left_Pivot',-1.22,-5.77,1.6],
  ['Door_Right_Pivot',1.22,-5.77,1.6],
  ['Fence_Gate_Left_Pivot',-1.2,-7.48,0],
  ['Fence_Gate_Right_Pivot',1.2,-7.48,0]
 ]){
  const pivot=new THREE.Group();pivot.name=name;pivot.position.set(x,y,z);stage.add(pivot);
 }
 return {root,roof,camo,light,topCamo,outerSteel,outerStone};
};

test('MK2 darkens rooftop using a shared textured metal material without touching base materials',()=>{
 const {root,roof,camo,light,topCamo,outerSteel,outerStone}=make();
 const roofOriginal=roof.material,base=camo.material;
 const lightOriginal=light.material,lightGeometry=light.geometry;
 const yard=new THREE.Group();
 for(const name of ['YardFencePosts','YardFenceRails','YardFenceMesh']){
  const part=new THREE.Group();part.name=name;yard.add(part);
 }
 assert.equal(isFeldkommandoMk2(root),true);
 assert.equal(polishFeldkommandoMk2(root,yard),true);
 assert.notEqual(roof.material,roofOriginal);
 assert.ok(roof.material.metalness>=.6);
 assert.equal(roofOriginal.color.getHexString(),'c0b9a5');
 assert.notEqual(camo.material,base,'wall camouflage gets an owned copy of its reference coating');
 assert.equal(camo.material.map.name,'Sandforge_Desert002_MainCamouflage','user-provided master artwork');
 assert.equal(camo.material.color.getHexString(),'ffffff','preserve full master texture colours');
 assert.notEqual(light.material,lightOriginal,'walls get a reference-toned material clone');
 assert.equal(light.material.map,camo.material.map,'wall material shares the same reference texture');
 assert.notEqual(light.geometry,lightGeometry,'the tan roof triangles are separated');
 assert.ok(light.geometry.index.count<lightGeometry.index.count,'only top-facing roof triangles removed');
 assert.equal(lightOriginal.color.getHexString(),'e6d5b0');
 assert.ok(root.getObjectByName('SF_MK2_AnthraciteRoof'));
 assert.equal(root.getObjectByName('SF_MK2_AnthraciteRoof').geometry.groups.length,0);
 assert.equal(root.getObjectByName('SF_MK2_AnthraciteRoof').material.color.getHexString(),'171c21');
 assert.equal(topCamo.material,roof.material,'top tier has solid anthracite metal with the same PBR map');
 assert.equal(topCamo.material.metalness,.58);
 assert.equal(topCamo.material.color.getHexString(),'171c21');
 assert.equal(root.getObjectByName('STAGE_01_Bunker_Shell__sandstone').material.map,camo.material.map);
 const steel=outerSteel.geometry.getAttribute('position'),stone=outerStone.geometry.getAttribute('position');
 assert.ok(steel.getX(0)>9,'perimeter steel moved outward');
 assert.ok(stone.getY(0)<-8,'fence concrete also moves outward');
 assert.ok(Math.abs(root.getObjectByName('Fence_Gate_Left_Pivot').position.y+8.83)<1e-5,'gate travels with fence');
 for(const name of ['YardFencePosts','YardFenceRails','YardFenceMesh'])
  assert.equal(yard.getObjectByName(name).visible,false);
 assert.ok(root.getObjectByName('SF_MK2_Interior'));
 assert.ok(root.getObjectByName('SF_MK2_HallBack'));
 assert.equal(polishFeldkommandoMk2(root,yard),true,'idempotent');
 assert.equal(root.getObjectByName('SF_MK2_Interior').parent.children.filter(n=>n.name==='SF_MK2_Interior').length,1);
 disposeFeldkommandoMk2Polish(root);
 assert.equal(root.getObjectByName('SF_MK2_Interior'),undefined);
 assert.ok(roof.geometry);
});

test('Non-MK2 assets and environment stay completely untouched',()=>{
 const world=new THREE.Group(),original=world.children.length;
 assert.equal(isFeldkommandoMk2(world),false);
 assert.equal(polishFeldkommandoMk2(world),false);
 assert.equal(hideMk2DuplicateFence(null),0);
 assert.equal(world.children.length,original);
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 for(const path of ['webgl-desert-art','webgl-oases','webgl-rock-materials','webgl-stylized-world'])
  assert.ok(!battlefield.includes('polishFeldkommandoMk2('+path));
});

test('Persistent queue and tactical pause retain their original functional IDs',()=>{
 const css=readFileSync('src/reborn/webgl-hud-showcase.css','utf8');
 const hud=readFileSync('scripts/webgl-classic-hud.js','utf8');
 const html=readFileSync('webgl-preview.html','utf8');
 assert.match(css,/Sandforge tactical dock v5/);
 assert.match(css,/grid-column:4!important/);
 assert.match(css,/--sf-hud-queue:/);
 assert.match(css,/--sf-hud-h:clamp\(172px,19\.3vh,196px\)/);
 assert.match(hud,/dock\.append\(panel\.querySelector\('#sf-production'\)\)/);
 for(const id of ['sf3d-pause-resume','sf3d-pause-save','sf3d-pause-load',
  'sf3d-pause-options','sf3d-pause-new','sf3d-pause-main'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/#sf3d-pause-dialog\.pause-menu\{/);
 assert.match(html,/TAKTISCHE PAUSE/);
});
