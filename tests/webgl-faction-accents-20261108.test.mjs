import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync,existsSync} from 'node:fs';
import {makeFactionAccents,applyFactionAccents,FACTION_COLORS} from '../scripts/webgl-faction-accents.js';

test('blue and red materials are distinct and use low-area model-local patches, not overall texture repaint',()=>{
 assert.equal(FACTION_COLORS[0],'#2e9fc8');
 assert.equal(FACTION_COLORS[1],'#cf5e4f');
 for(const type of ['unit','building']){
  const kinds=type==='unit'
   ?['infantry','medic','engineer','heavy','rover','tank','artillery','scout','bomber']
   :['headquarters','barracks','factory','airfield','generator','turret'];
  for(const kind of kinds){
   const blue=makeFactionAccents(kind,0,type);
   const red=makeFactionAccents(kind,1,type);
   assert.ok(blue.children.length>=4,kind+' has visible team identifiers');
   assert.equal(blue.children.length,red.children.length);
   assert.equal(blue.userData.owner,0);
   assert.equal(red.userData.owner,1);
   assert.ok(blue.children.every(m=>m.isMesh&&m.userData.factionAccent
     &&m.material.isMeshStandardMaterial&&!m.castShadow&&!m.receiveShadow));
   assert.ok(blue.children.every(m=>m.material===blue.children[0].material),
    'share one material for every same-owner model, avoid GPU growth');
   assert.notEqual(blue.children[0].material,red.children[0].material);
   assert.equal(blue.children[0].material.color.getHexString(),'2e9fc8');
   assert.equal(red.children[0].material.color.getHexString(),'cf5e4f');
   assert.equal(blue.children[0].raycast.toString(),'()=>{}');
   assert.ok(blue.children.every(m=>m.scale.x>0&&m.scale.y>0&&m.scale.z>0));
  }
 }
});

test('one idempotent group per actor, real GLB dimensions replace fallback, ownership flip turns accents red',()=>{
 const root=new THREE.Group(),entry={node:root},unit={kind:'tank',owner:0};
 let g=applyFactionAccents(entry,unit,'unit',150,74);
 assert.equal(root.children.length,1);
 assert.deepEqual(g.scale.toArray(),[150,74,150]);
 assert.equal(applyFactionAccents(entry,unit,'unit',160,80),g);
 assert.equal(root.children.length,1);
 assert.deepEqual(g.scale.toArray(),[160,80,160]);
 assert.equal(g.children[0].material.color.getHexString(),'2e9fc8');
 const switched=applyFactionAccents(entry,{kind:'tank',owner:1},'unit',170,82);
 assert.notEqual(switched,g);
 assert.equal(root.children.length,1);
 assert.equal(g.parent,null);
 assert.deepEqual(switched.scale.toArray(),[170,82,170]);
 assert.equal(switched.children[0].material.color.getHexString(),'cf5e4f');
 const building={node:new THREE.Group()};
 const strips=applyFactionAccents(building,{kind:'barracks',owner:0},'building',158,110);
 assert.deepEqual(strips.scale.toArray(),[158,110,158*.70]);
 assert.equal(applyFactionAccents(building,{kind:'barracks',owner:0},'building',158,110),strips);
 assert.equal(building.node.children.length,1);
 assert.equal(makeFactionAccents('tank',-1,'unit'),null);
});

test('render-only identifiers are shipped, with consistent ownership and hidden building staging',()=>{
 const build=readFileSync('scripts/build.mjs','utf8');
 const source=readFileSync('scripts/webgl-battlefield.js','utf8');
 const actor=readFileSync('scripts/webgl-actor-presentation.js','utf8');
 assert.match(build,/cpSync\('scripts\/webgl-faction-accents\.js','dist\/webgl-faction-accents\.js'\)/);
 assert.ok(existsSync('dist/webgl-faction-accents.js'));
 assert.match(source,/applyFactionAccents\(entry,entity,type,footprint,height\)/);
 assert.match(source,/applyFactionAccents\(entry,\{kind:entry\.kind,owner:entry\.owner\},type,/);
 assert.match(source,/entry\.factionAccents\.visible=b\.buildRemaining<=0/);
 assert.match(actor,/color:owner===0\?'#64bfe3':'#ed8b77'/);
 assert.match(actor,/bar\.root\.children\[0\]\.material=outlineMats/);
 assert.doesNotMatch(source,/factionAccent\.visible=selected/);
});
