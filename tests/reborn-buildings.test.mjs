import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const kinds=['headquarters','bastion','barracks','factory','airfield','generator','turret'];
const load=(kind,team)=>JSON.parse(fs.readFileSync(new URL('../src/assets/reborn/buildings-3d/'+kind+'-'+team+'.json',import.meta.url)));
test('buildings: every existing building has real geometry in both factions and neutral bastions have a white light material',()=>{
 for(const kind of kinds)for(const team of kind==='bastion'?[0,1,-1]:[0,1]){
  const a=load(kind,team),bytes=fs.readFileSync(new URL('../src/assets/reborn/buildings-3d/'+a.model,import.meta.url));assert.equal(bytes.subarray(0,4).toString(),'glTF');assert.equal(bytes.readUInt32LE(4),2);
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString()),instances=gltf.nodes.filter(n=>n.mesh!==undefined);assert.equal(instances.length,a.design.parts);assert.ok(a.design.parts>=14);const triangles=instances.flatMap(n=>gltf.meshes[n.mesh].primitives).reduce((n,p)=>n+gltf.accessors[p.indices??p.attributes.POSITION].count/3,0);assert.equal(Math.round(triangles),a.design.triangles);assert.ok(triangles>1000);assert.deepEqual(a.body.pivot,[256,382]);assert.ok(a.body.solidBounds.w>50);assert.ok(a.body.solidBounds.y+a.body.solidBounds.h<512);assert.equal(a.bakedShadow,true);
  const light=gltf.materials.find(m=>m.name==='Atlas faction emission');assert.ok(light);if(team===-1)assert.deepEqual(light.emissiveFactor,[1,1,1]);else assert.ok(light.emissiveFactor[team===1?0:2]>light.emissiveFactor[team===1?2:0]*2);
 }
});

test('buildings: the user-refined headquarters retains its geometry and restored rig under the desert PBR finish',()=>{
 const read=path=>{const bytes=fs.readFileSync(new URL('../'+path,import.meta.url));return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());};
 const source=read('tools/building-sources/headquarters-refined.glb'),triangles=g=>g.nodes.filter(n=>n.mesh!==undefined).flatMap(n=>g.meshes[n.mesh].primitives).reduce((sum,p)=>sum+g.accessors[p.indices??p.attributes.POSITION].count/3,0);
 assert.equal(source.animations?.length??0,0,'the supplied file has no authored animation clips');
 for(const team of [0,1]){
  const a=load('headquarters',team),g=read('src/assets/reborn/buildings-3d/'+a.model);
  const original={...g,nodes:g.nodes.filter(n=>!n.name?.startsWith('AtlasUpgrade_'))};
  assert.equal(triangles(original),triangles(source),'retexturing and adding hardware must preserve every original triangle');assert.equal(g.images.length,3,'embed shared albedo, normal and ORM maps');
  assert.equal(a.design.source,'tools/building-sources/headquarters-refined.glb');assert.deepEqual(a.design.attachedDetails,{radar:8,beacon:1});
  assert.equal(g.nodes.filter(n=>n.extras?.atlasDesign).length,1,'replace the stale pre-edit part count with one authoritative design description');
  for(const material of source.materials){
   if(team===1&&['Atlas faction enamel','Atlas faction emission','Atlas armoured glass'].includes(material.name))continue;
   const exported=g.materials.find(m=>m.name===material.name&&!!m.doubleSided===!!material.doubleSided);assert.ok(exported,material.name);
   if(material.name!=='Atlas faction emission'){assert.ok(exported.pbrMetallicRoughness.baseColorTexture);assert.ok(exported.normalTexture);assert.ok(exported.occlusionTexture);}
  }
  const below=name=>{const out=[];const visit=i=>{out.push(g.nodes[i]);for(const child of g.nodes[i].children??[])visit(child);};visit(g.nodes.findIndex(n=>n.name===name));return out;};
  assert.ok(below('RadarDish').some(n=>n.name==='AtlasRefined_trim_radar'));assert.ok(below('RadarDish').some(n=>n.name==='AtlasRefined_panel_radar'));assert.ok(below('Beacon').some(n=>n.name==='AtlasRefined_blue_beacon'));
  assert.deepEqual(g.animations.map(a=>a.name).sort(),['BeaconPulse','RadarSpin']);
 }
});
test('buildings: moving radar layers retain the exact ground registration and carry a full slowly turning 3D clip',()=>{
 for(const kind of ['headquarters','bastion'])for(const team of kind==='bastion'?[0,1,-1]:[0,1]){
  const a=load(kind,team),layer=a.activity;assert.equal(layer.frames.length,64);assert.equal(layer.period,48);assert.ok(a.clips.some(c=>c.name==='RadarSpin'&&c.duration===48));
  assert.deepEqual(layer.pivot,[a.body.pivot[0]-layer.originalBounds.x,a.body.pivot[1]-layer.originalBounds.y]);assert.ok(layer.frames.every(f=>f.w===layer.originalBounds.w&&f.h===layer.originalBounds.h));
  assert.ok(layer.frames[0].w*layer.frames[0].h<512*512/4,'runtime radar layers should be cropped rather than duplicate whole building frames');
 }
});

test('buildings: the refined bastion retains all surfaces, geometry and three authored animation groups in every faction',()=>{
 const read=path=>{const bytes=fs.readFileSync(new URL('../'+path,import.meta.url));return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());};
 const source=read('tools/building-sources/bastion-refined.glb'),usedMaterials=new Set(source.meshes.flatMap(m=>m.primitives.map(p=>p.material)));
 const below=(g,name)=>{const nodes=[];const visit=i=>{nodes.push(g.nodes[i].name);for(const child of g.nodes[i].children??[])visit(child);};visit(g.nodes.findIndex(n=>n.name===name));return nodes;};
 for(const team of [0,1,-1]){
  const a=load('bastion',team),g=read('src/assets/reborn/buildings-3d/'+a.model);
  assert.equal(a.design.source,'tools/building-sources/bastion-refined.glb');assert.deepEqual(a.design.sourceGeometry,{parts:47,triangles:34380});assert.ok(a.design.parts>47);assert.ok(a.design.triangles>34380);
  assert.equal(g.nodes.filter(n=>n.extras?.atlasDesign).length,1);assert.ok(g.images.length>0);
  for(const material of source.materials.filter((_,i)=>usedMaterials.has(i))){
   if(team!==0&&material.name==='Atlas faction emission')continue;
   const exported=g.materials.find(m=>m.name===material.name&&!!m.doubleSided===!!material.doubleSided);assert.ok(exported,material.name);
   if(material.name!=='Atlas faction emission'){assert.ok(exported.pbrMetallicRoughness.baseColorTexture);assert.ok(exported.pbrMetallicRoughness.metallicRoughnessTexture);assert.ok(exported.normalTexture);}
  }
  assert.deepEqual(g.animations.map(c=>c.name).sort(),source.animations.map(c=>c.name).sort());
  for(const name of ['RadarDish','Beacon','CaptureSweep_Rotator'])assert.deepEqual(below(g,name),below(source,name),name+' keeps its attached details');
  assert.equal(a.sweep.period,12);assert.equal(a.sweep.frames.length,64);
  assert.deepEqual(a.sweep.pivot,[a.body.pivot[0]-a.sweep.originalBounds.x,a.body.pivot[1]-a.sweep.originalBounds.y]);
  assert.ok(fs.existsSync(new URL('../src/assets/reborn/buildings-3d/'+a.sweep.image,import.meta.url)));
 }
});
