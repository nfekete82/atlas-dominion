import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {
 ensureFactionWallBanners,setFactionWallBannerOwner,setFactionWallBannerConstruction,disposeFactionWallBanners,
 SANDFORGE_BANNER_STYLE
} from '../scripts/webgl-faction-banners.js';

test('Feldkommando and Kaserne mount double wall banners without changing authored meshes',()=>{
 for(const kind of ['headquarters','barracks']){
  const node=new THREE.Group(),detail=new THREE.Group();
  node.add(detail);
  const entry={kind,node,detail};
  const group=ensureFactionWallBanners(entry,0);
  assert.equal(group.children.length,2);
  assert.equal(group.visible,false,'no early flag reveal during construction');
  assert.equal(group.userData.nonPlayable,true);
  assert.equal(group.userData.owner,0);
  assert.equal(group.getObjectByName('SF_FactionFabric').material.color.getHexString(),'284d7b');
  assert.equal(ensureFactionWallBanners(entry,0),group,'no duplicated flags');
  assert.equal(group.visible,false,'async model reload does not reveal them');
  assert.equal(setFactionWallBannerConstruction(entry,false),false,'0–99%: still under construction');
  assert.equal(group.visible,false);
  assert.equal(setFactionWallBannerConstruction(entry,true),true,'100%: flags installed at completion');
  assert.equal(group.visible,true);
  assert.equal(setFactionWallBannerConstruction(entry,false),false,'restarted construction hides them');
  assert.equal(group.visible,false);
  assert.ok(group.children[0].position.x<0&&group.children[1].position.x>0);
  assert.equal(Math.sign(group.children[0].position.z),Math.sign(SANDFORGE_BANNER_STYLE[kind].front));
  assert.equal(setFactionWallBannerOwner(entry,1),true);
  assert.equal(group.getObjectByName('SF_FactionFabric').material.color.getHexString(),'973c36');
  assert.equal(group.userData.owner,1);
  assert.equal(group.visible,false,'team recoloring must not reveal unfinished flags');
  setFactionWallBannerConstruction(entry,true);
  assert.equal(group.visible,true);
  assert.equal(node.getObjectByName('SF_FactionWallStandards'),group);
  disposeFactionWallBanners(entry);
  assert.equal(node.getObjectByName('SF_FactionWallStandards'),undefined);
  assert.equal(detail.children.length,0,'real GLB retained');
 }
});

test('main logo is 40 percent larger and lower; icon and text sit in fixed columns',()=>{
 const html=readFileSync('webgl-preview.html','utf8');
 assert.match(html,/width:min\(798px,83vw\)/);
 assert.match(html,/top:clamp\(24px,4\.2dvh,60px\)/);
 assert.match(html,/grid-template-columns:40px minmax\(0,1fr\)/);
 assert.match(html,/grid-column:2;align-self:center;text-align:left/);
 const options=html.match(/id="sf3d-main-options"[^]*?<\/button>/)?.[0];
 assert.ok(options,'settings option exists');
 const cog=options.match(/<path d="([^"]+)"\/>/);
 assert.ok(cog?.[1].length>200,'gear has a full 12-tooth outline');
 for(const id of ['sf3d-new','sf3d-main-stats','sf3d-main-credits','sf3d-main-exit'])
  assert.ok(html.includes('id="'+id+'"'));
});

test('barracks inherits the shared MK2 desert painting without touching other biomes',()=>{
 const design=readFileSync('scripts/webgl-building-design.js','utf8');
 assert.match(design,/mk2-reference-barracks-pbr-v2/);
 assert.match(design,/if\(kind==='barracks'\)/);
 assert.match(design,/HQ_Dark_Charcoal_Roof/);
 assert.match(design,/biome!=='desert'/);
});

test('battle and building gallery use real completion state for the flag reveal',()=>{
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 const gallery=readFileSync('scripts/webgl-building-gallery.js','utf8');
 assert.match(battlefield,/setFactionWallBannerConstruction\(entry,b\.buildRemaining<=0\)/);
 assert.match(gallery,/setFactionWallBannerConstruction\(entry,progress>=1\)/);
});
