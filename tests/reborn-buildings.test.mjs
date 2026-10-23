import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const kinds=['headquarters','bastion','barracks','factory','airfield','generator','turret'];
const load=(kind,team)=>JSON.parse(fs.readFileSync(new URL('../src/assets/reborn/buildings-3d/'+kind+'-'+team+'.json',import.meta.url)));
test('buildings: every existing building has real geometry in both factions and neutral bastions have a white light material',()=>{
 for(const kind of kinds)for(const team of kind==='bastion'?[0,1,-1]:[0,1]){
  const a=load(kind,team),bytes=fs.readFileSync(new URL('../src/assets/reborn/buildings-3d/'+a.model,import.meta.url));assert.equal(bytes.subarray(0,4).toString(),'glTF');assert.equal(bytes.readUInt32LE(4),2);
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());assert.equal(gltf.meshes.length,a.design.parts);assert.ok(a.design.parts>=14);const triangles=gltf.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+gltf.accessors[p.indices??p.attributes.POSITION].count/3,0);assert.equal(Math.round(triangles),a.design.triangles);assert.ok(triangles>1000);assert.deepEqual(a.body.pivot,[256,382]);assert.ok(a.body.solidBounds.w>50);assert.ok(a.body.solidBounds.y+a.body.solidBounds.h<512);assert.equal(a.bakedShadow,true);
  const light=gltf.materials.find(m=>m.name==='Atlas faction emission');assert.ok(light);if(team===-1)assert.deepEqual(light.emissiveFactor,[1,1,1]);else assert.ok(light.emissiveFactor[team===1?0:2]>light.emissiveFactor[team===1?2:0]*2);
 }
});
test('buildings: moving radar layers retain the exact ground registration and carry a full slowly turning 3D clip',()=>{
 for(const kind of ['headquarters','bastion'])for(const team of kind==='bastion'?[0,1,-1]:[0,1]){
  const a=load(kind,team),layer=a.activity;assert.equal(layer.frames.length,64);assert.equal(layer.period,48);assert.ok(a.clips.some(c=>c.name==='RadarSpin'&&c.duration===48));
  assert.deepEqual(layer.pivot,[a.body.pivot[0]-layer.originalBounds.x,a.body.pivot[1]-layer.originalBounds.y]);assert.ok(layer.frames.every(f=>f.w===layer.originalBounds.w&&f.h===layer.originalBounds.h));
  assert.ok(layer.frames[0].w*layer.frames[0].h<512*512/4,'runtime radar layers should be cropped rather than duplicate whole building frames');
 }
});
