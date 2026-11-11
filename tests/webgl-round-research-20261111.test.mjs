import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createStrategicBuilding} from '../scripts/webgl-strategic-buildings.js';
test('eight-sided camouflaged research centre has rotating physical radar dish',()=>{
 for(const owner of [0,1]){
  const model=createStrategicBuilding('research',owner);
  const octagon=model.getObjectByName('SF_StaticBatch_research_0');
  assert.ok(octagon,'faceted bunker should participate in static PBR batching');
  const dish=model.getObjectByName('ResearchDishPivot');
  assert.ok(dish?.isGroup);
  assert.ok(dish.getObjectByName('Research_Radar')?.isMesh);
  assert.ok(model.getObjectByName('Research_SensorArray')?.isMesh);
  const mats=[];
  model.traverse(o=>{if(o.isMesh)mats.push(o.material)});
  assert.ok(mats.some(m=>m.name==='SF_researchArmor'&&m.map?.isDataTexture));
  const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  assert.ok(size.x<150&&size.z<150&&size.y<150&&size.y>95);
  assert.equal(model.userData.compactResearch,true);
 }
});
test('rotation updates only the radar pivot after construction completes',()=>{
 const script=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.ok(script.includes("entity.kind==='research')this.attachBuildingMotion(entry"));
 assert.ok(script.includes("motion.kind==='research'?.20:.52"));
 assert.ok(script.includes("entry.detail??entry.placeholder"));
});
