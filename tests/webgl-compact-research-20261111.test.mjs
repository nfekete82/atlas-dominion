import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {buildingArtScale} from '../dist/src/reborn/visual-scale.js';
import {siteExceedsMap,siteTerrainCompatible,sitesVisuallyOverlap}
 from '../dist/src/reborn/construction-spacing.js';
import {createStrategicBuilding} from '../scripts/webgl-strategic-buildings.js';
test('research footprint shrinks without changing costs or technology',()=>{
 assert.equal(BUILDINGS.research.cost,950);
 assert.equal(BUILDINGS.research.buildTime,48);
 assert.ok(BUILDINGS.research.width<=145&&BUILDINGS.research.radius<=46);
 assert.equal(buildingArtScale('research'),1);
 const model=createStrategicBuilding('research',0);
 const bounds=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
 assert.ok(bounds.x<150&&bounds.z<140,'3D model is genuinely compact');
 assert.ok(bounds.y<150&&bounds.y>95,'radar keeps an identifiable profile');
 assert.ok(model.getObjectByName('Research_Radar'));
 assert.ok(model.getObjectByName('Research_SensorArray'));
});
test('research ground validation uses the new compact foundation',()=>{
 const model=createStrategicBuilding('research',0);
 assert.equal(model.userData.compactResearch,true);
 const material=[];
 model.traverse(obj=>{if(obj.isMesh&&obj.material?.name==='SF_researchArmor')
  material.push(obj.material)});
 assert.ok(material.length>0);
 assert.ok(material.every(m=>m.map?.isDataTexture&&m.userData.sandforgeColorMapCamo));
 assert.ok(sitesVisuallyOverlap('research',{x:1000,y:1000},0,
  'research',{x:1080,y:1000},0));
 assert.ok(!sitesVisuallyOverlap('research',{x:1000,y:1000},0,
  'research',{x:1280,y:1000},0));
 assert.ok(siteExceedsMap('research',{x:30,y:30},0,3500)===false,
  'standard building placement still uses the normal build-map guard');
 const flat={walkable:()=>true,terrainHeight:()=>0,terrainSlope:()=>0};
 assert.ok(siteTerrainCompatible('research',{x:1000,y:1000},0,flat));
});
