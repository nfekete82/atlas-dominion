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

test('silo retains its actual three-tone camouflage texture while interceptor stays unchanged',()=>{
 const silo=createStrategicBuilding('silo',0),material=colors(silo);
 assert.equal(material.get('SF_base'),'#f3efe3',
  'near-white binder must preserve actual khaki/sand/olive albedo colors');
 assert.equal(material.get('SF_metal'),'#626b69');
 assert.equal(material.get('SF_black'),'#252b29');
 assert.equal(material.get('SF_camoOlive'),'#7f846b');
 assert.equal(material.has('SF_camoSand'),false);
 const base=silo.getObjectByName('SF_StaticBatch_silo_base');
 let camoMap=null;
 silo.traverse(o=>{if(!o.isMesh)return;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  for(const mat of mats)if(mat.name==='SF_base')camoMap=mat.map;
 });
 assert.ok(camoMap,'silo must use an actual camouflage albedo map');
 assert.equal(camoMap.name,'Sandforge silo desert khaki olive camouflage');
 const interceptor=colors(createStrategicBuilding('interceptor',0));
 assert.equal(interceptor.get('SF_base'),'#968b73');
 assert.equal(interceptor.get('SF_metal'),'#626b69');
 assert.equal(interceptor.get('SF_black'),'#252b29');
 assert.equal(interceptor.has('SF_camoOlive'),false);
 assert.equal(interceptor.has('SF_camoSand'),false);
});
