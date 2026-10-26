import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {UNITS} from '../dist/src/reborn/catalog.js';

const readJson=path=>JSON.parse(readFileSync(new URL('../src/assets/reborn/'+path,import.meta.url),'utf8'));
const gltf=kind=>{
 const b=readFileSync(new URL('../src/assets/reborn/buildings-3d/'+kind+'.glb',import.meta.url));
 return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
};
test('field finish: HQ silhouette and rotating dish preserved, barracks has extra service details',()=>{
 for(const team of [0,1]){
  const h=readJson('buildings-3d/headquarters-'+team+'.json');
  const b=readJson('buildings-3d/barracks-'+team+'.json');
  assert.deepEqual(h.body.pivot,[256,382]);
  assert.deepEqual(b.body.pivot,[256,382]);
  assert.equal(h.activity.frames.length,64);
  assert.equal(h.design.source,'tools/building-sources/headquarters-refined.glb');
  assert.ok(b.design.parts>=145,'new roof bolts, cooling slits and structural seams must be in 3D export');
  for(const name of ['headquarters','barracks']){
   const g=gltf(name+'-'+team);
   const materials=g.materials.filter(m=>/ceramic|bronze|steel|enamel|trim/i.test(m.name));
   assert.ok(materials.some(m=>m.pbrMetallicRoughness?.metallicRoughnessTexture),
    name+' '+team+': exported texture should carry baked brushed/sandblasted roughness');
   assert.ok(g.materials.some(m=>m.name==='Atlas faction enamel'),'faction palette retained');
  }
 }
});

test('vehicle scale: HD sprite footprints exactly match current gameplay catalog widths',()=>{
 for(const kind of ['rover','tank','artillery','scout','gunship','bomber']){
  const spec=UNITS[kind];
  for(const team of [0,1]){
   const atlas=readJson('animation/'+kind+'-'+team+'.json');
   assert.deepEqual(atlas.cell,[192,192]);
   assert.ok(Math.abs(atlas.nativeScale*atlas.cell[0]/96*72-spec.width)<.01,
    kind+' '+team+': visual width must match '+spec.width+'px without changing physical stats');
   assert.ok(atlas.frames.every(f=>f.pivot[0]===96&&f.pivot[1]===156),
    kind+' '+team+': all animation orientations must remain ground anchored');
   assert.equal(atlas.model,kind+'-'+team+'.glb');
  }
 }
});
