import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {TEAM_MARKING_COLORS,attachTeamMarkings,detachTeamMarkings}
 from '../scripts/webgl-team-markings.js';
test('all infantry roles wear blue/red armbands and a chest patch',()=>{
 assert.equal(TEAM_MARKING_COLORS[0],'#198fe0');
 assert.equal(TEAM_MARKING_COLORS[1],'#e34e43');
 for(const owner of [0,1])for(const kind of ['infantry','heavy','medic','rocket','engineer']){
  const entry={node:new THREE.Group()};
  const root=attachTeamMarkings(entry,owner,kind,32,40);
  for(const name of ['TeamArmband_Left','TeamArmband_Right','TeamChestPatch'])
   assert.ok(root.getObjectByName(name),kind+':'+name);
  assert.equal(attachTeamMarkings(entry,owner,kind,32,40),root,'reuse until model changes');
  assert.equal(root.children.every(x=>x.userData.teamMarking),true);
  detachTeamMarkings(entry);assert.equal(entry.node.children.length,0);
 }
});
test('tanks get actual flags; Humvees and helicopters get high contrast markings',()=>{
 for(const [kind,tag] of [['tank','TeamArmourFlag'],['artillery','TeamArmourFlag'],
  ['rover','TeamDoor_1'],['scout','TeamAircraftWing_1'],['bomber','TeamAircraftWing_-1']]){
  const entry={node:new THREE.Group()};
  assert.ok(attachTeamMarkings(entry,0,kind,125,50).getObjectByName(tag),kind);
  assert.equal(attachTeamMarkings(entry,1,kind,125,50).userData.owner,1);
  assert.equal(entry.node.children.length,1);
  detachTeamMarkings(entry);
 }
});
test('badges are cosmetic, never interactive and kept outside persistent game state',()=>{
 const entry={node:new THREE.Group()},group=attachTeamMarkings(entry,0,'tank');
 assert.ok(group.children.every(o=>o.userData.nonPlayable&&o.userData.visualOnly));
 assert.ok(readFileSync('scripts/webgl-battlefield.js','utf8').includes('detachTeamMarkings(e)'));
 assert.ok(readFileSync('scripts/build.mjs','utf8').includes('webgl-team-markings.js'));
 assert.equal(attachTeamMarkings(entry,0,'headquarters'),null);
});
