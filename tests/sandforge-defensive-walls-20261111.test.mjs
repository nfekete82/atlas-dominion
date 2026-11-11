import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BUILDINGS,buildingKinds,weaponDamage} from '../dist/src/reborn/catalog.js';
import {wallColliderSamples} from '../dist/src/reborn/defensive-wall.js';
import {infantryStructureColliders} from '../dist/src/reborn/infantry-structure-collision.js';
import {vehicleStructureColliders} from '../dist/src/reborn/vehicle-structure-collision.js';
import {sitesVisuallyOverlap,siteExceedsMap} from '../dist/src/reborn/construction-spacing.js';
import {createStrategicBuilding,isStrategicBuilding} from '../scripts/webgl-strategic-buildings.js';
test('real paid wall entity is available in the pioneer catalogue',()=>{
 assert.ok(buildingKinds.includes('wall'));
 assert.equal(BUILDINGS.wall.cost,120);
 assert.ok(BUILDINGS.wall.hp>500);
 assert.ok(isStrategicBuilding('wall'));
 const ui=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(ui,/cards\(buildingKinds\.filter/);
});
test('three true oriented navigation blockers stop infantry AND tanks',()=>{
 for(const facing of [0,1,2,3]){
  const base={kind:'wall',hp:750,x:1000,y:1000,facing};
  const colliders=wallColliderSamples(base);
  assert.equal(colliders.length,3);
  assert.ok(Math.hypot(colliders[0].x-colliders[2].x,
   colliders[0].y-colliders[2].y)>65);
  assert.deepEqual(infantryStructureColliders([base]),colliders);
  assert.equal(vehicleStructureColliders([base]).length,3);
 }
 assert.ok(siteExceedsMap('wall',{x:30,y:30},0,6240));
 assert.equal(sitesVisuallyOverlap('wall',{x:1000,y:1000},0,
  'wall',{x:1114,y:1000},0),false,'adjacent sections may form a defensive line');
 assert.equal(sitesVisuallyOverlap('wall',{x:1000,y:1000},0,
  'wall',{x:1080,y:1000},0),true,'overlapping sections are rejected');
});
test('rockets and artillery break concrete more effectively than rifle fire',()=>{
 const wall={kind:'wall',queue:[]};
 assert.ok(weaponDamage({kind:'rocket'},wall)>weaponDamage({kind:'infantry'},wall)*4);
 assert.ok(weaponDamage({kind:'artillery'},wall)>weaponDamage({kind:'heavy'},wall));
});
test('wall appearance uses one procedural model, also for translucent building preview',()=>{
 const wall=createStrategicBuilding('wall',0);
 assert.ok(wall.getObjectByName('WallArmoredPanel'));
 assert.ok(wall.getObjectByName('WallFactionBand'));
 assert.equal(wall.userData.defensiveWall,true);
 const other=createStrategicBuilding('wall',1);
 assert.ok(other.getObjectByName('WallArmoredPanel'));
 wall.traverse(n=>{if(n.isMesh){n.geometry.dispose();n.material.dispose();}});
 other.traverse(n=>{if(n.isMesh){n.geometry.dispose();n.material.dispose();}});
});
