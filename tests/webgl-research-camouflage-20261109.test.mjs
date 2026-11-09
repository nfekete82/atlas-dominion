import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStrategicBuilding} from '../scripts/webgl-strategic-buildings.js';

function colors(root) {
 const result=new Map();
 root.traverse(node=>{
  if(!node.isMesh)return;
  for(const material of Array.isArray(node.material)?node.material:[node.material]){
   if(material?.isMeshStandardMaterial&&material.name)
    result.set(material.name,'#'+material.color.getHexString());
  }
 });
 return result;
}

test('research lab uses authored beige/olive three-tone PBR camouflage for both factions',()=>{
 for(const owner of [0,1]){
  const model=createStrategicBuilding('research',owner);
  assert.ok(model?.isGroup);
  assert.equal(model.name,'Strategic_research');
  assert.ok(model.getObjectByName('Research_Radar'),'radar silhouette must remain');
  const material=colors(model);
  assert.equal(material.get('SF_base'),'#bba882');
  assert.equal(material.get('SF_panel'),'#999477');
  assert.equal(material.get('SF_metal'),'#766f5b');
  assert.equal(material.get('SF_black'),'#585345');
  assert.equal(material.get('SF_camoOlive'),'#7f846b');
  assert.equal(material.get('SF_camoSand'),'#d1bd93');
  assert.equal(material.get('SF_glow'),owner===0?'#63b9de':'#ffab79',
   'faction identification must remain visible on service beacons');
  assert.ok([...model.children].some(child=>child.name.startsWith('SF_StaticBatch_research_')),
   'new camouflage plates must share the existing static material batching');
 }
});

test('research camouflage does not recolor silo or interceptor strategic assets',()=>{
 for(const kind of ['silo','interceptor']){
  const material=colors(createStrategicBuilding(kind,0));
  assert.equal(material.get('SF_base'),'#968b73');
  assert.equal(material.get('SF_metal'),'#626b69');
  assert.equal(material.get('SF_black'),'#252b29');
  assert.equal(material.has('SF_camoOlive'),false);
  assert.equal(material.has('SF_camoSand'),false);
 }
});
