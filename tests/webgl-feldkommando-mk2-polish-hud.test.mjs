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
 const roof=new THREE.Mesh(new THREE.BoxGeometry(6,6,.3).translate(0,0,4.4),
  new THREE.MeshStandardMaterial({name:'SF_roof',color:'#c0b9a5'}));
 roof.name='STAGE_02_Roof_and_Entrances__roof';stage.add(roof);
 for(const [name,x,y,z] of [
  ['Door_Left_Pivot',-1.22,-5.77,1.6],
  ['Door_Right_Pivot',1.22,-5.77,1.6],
  ['Fence_Gate_Left_Pivot',-1.2,-7.48,0],
  ['Fence_Gate_Right_Pivot',1.2,-7.48,0]
 ]){
  const pivot=new THREE.Group();pivot.name=name;pivot.position.set(x,y,z);stage.add(pivot);
 }
 return {root,roof,camo};
};

test('MK2 darkens rooftop using a shared textured metal material without touching base materials',()=>{
 const {root,roof,camo}=make();
 const roofOriginal=roof.material,base=camo.material;
 const yard=new THREE.Group();
 for(const name of ['YardFencePosts','YardFenceRails','YardFenceMesh']){
  const part=new THREE.Group();part.name=name;yard.add(part);
 }
 assert.equal(isFeldkommandoMk2(root),true);
 assert.equal(polishFeldkommandoMk2(root,yard),true);
 assert.notEqual(roof.material,roofOriginal);
 assert.ok(roof.material.metalness>=.6);
 assert.equal(roofOriginal.color.getHexString(),'c0b9a5');
 assert.equal(camo.material,base);
 assert.ok(root.getObjectByName('SF_MK2_AnthraciteRoof'));
 assert.equal(root.getObjectByName('SF_MK2_AnthraciteRoof').geometry.groups.length,0);
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
