import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {TEAM_MARKING_COLORS,attachTeamMarkings,detachTeamMarkings}
 from '../scripts/webgl-team-markings.js';
test('ground troops keep blue/red armbands',()=>{
 assert.equal(TEAM_MARKING_COLORS[0],'#198fe0');
 assert.equal(TEAM_MARKING_COLORS[1],'#e34e43');
 for(const owner of [0,1])for(const kind of ['infantry','rocket','engineer']){
  const entry={node:new THREE.Group()};
  const root=attachTeamMarkings(entry,owner,kind,32,40);
  assert.ok(root.getObjectByName('TeamArmband_Left'));
  assert.ok(root.getObjectByName('TeamArmband_Right'));
  assert.equal(attachTeamMarkings(entry,owner,kind,32,40),root);
  detachTeamMarkings(entry);
 }
});
test('all vehicle marks lie on real 3D surfaces, never on poles or floating panels',()=>{
 for(const [kind,mark] of [['tank','TeamTurretRoofMark'],
  ['artillery','TeamTurretRoofMark'],['rover','TeamHumveeRoof'],
  ['bomber','TeamAircraftWing_-1'],['scout','TeamHelicopterRoof']]){
  const node=new THREE.Group();
  const detail=new THREE.Mesh(new THREE.BoxGeometry(120,40,100),
   new THREE.MeshStandardMaterial());
  detail.position.y=20;node.add(detail);
  const entry={node,detail};
  const group=attachTeamMarkings(entry,0,kind,120,40);
  const patch=group.getObjectByName(mark);
  assert.ok(patch,kind+' should be projected to the surface');
  assert.equal(patch.userData.attachedToSurface,true);
  assert.ok(!group.getObjectByName('TeamFlagpole'),'no floating flags');
  assert.ok(Math.abs(patch.position.y-40)<2,'mark rests on actual roof plane');
  assert.equal(attachTeamMarkings(entry,0,kind,120,40),group);
  assert.notEqual(attachTeamMarkings(entry,1,kind,120,40),group);
  detachTeamMarkings(entry);
 }
});
test('existing game selectors and art continue to be noninteractive',()=>{
 const src=readFileSync('scripts/webgl-team-markings.js','utf8');
 assert.ok(src.includes('mesh.raycast=()=>{}'));
 assert.ok(!src.includes('new THREE.CylinderGeometry(.72'));
 assert.ok(readFileSync('scripts/build.mjs','utf8').includes('webgl-team-markings.js'));
 const visual=readFileSync('src/reborn/visual-scale.ts','utf8');
 assert.ok(visual.includes("kind==='bomber'?1.57"));
});
