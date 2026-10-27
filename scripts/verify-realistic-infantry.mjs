/**
 * Verify exported GLBs AND the sprite atlases consumed by the 2D battle view.
 * Run after npm run assets:detailed-infantry.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const folder = path.resolve('src/assets/reborn/prototype');
const roles = ['infantry','heavy','medic','engineer'];
const expected = ['Atlas multicam desert woven uniform','Atlas tactical MOLLE nylon','Atlas worn desert ballistic plates'];

function readGLB(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', file+' has no GLB signature');
  assert.equal(bytes.readUInt32LE(4), 2, file+' must be glTF 2.0');
  assert.equal(bytes.readUInt32LE(8), bytes.length, file+' length mismatch');
  assert.equal(bytes.toString('ascii', 16, 20), 'JSON', file+' has no JSON chunk');
  const length = bytes.readUInt32LE(12);
  return JSON.parse(bytes.toString('utf8', 20, 20+length));
}

for (const role of roles) for (const team of [0,1]) {
  const tag = role+'-'+team, model=readGLB(path.join(folder,tag+'.glb'));
  const materials = new Set((model.materials??[]).map(m=>m.name));
  for (const name of expected)assert.ok(materials.has(name),tag+' missing '+name);
  for (const name of expected) {
    const m=model.materials.find(x=>x.name===name);
    assert.ok(m.pbrMetallicRoughness?.baseColorTexture,tag+' missing baked PBR color '+name);
    assert.ok(m.normalTexture,tag+' missing baked normal channel '+name);
    assert.ok(m.pbrMetallicRoughness?.metallicRoughnessTexture,tag+' missing roughness '+name);
  }
  assert.ok((model.animations??[]).length>=5,tag+' lost skeletal animations');
  assert.ok((model.images??[]).length>=6,tag+' has too few embedded texture maps');
  const atlas=JSON.parse(fs.readFileSync(path.join(folder,tag+'.json'),'utf8'));
  assert.equal(atlas.model,tag+'.glb',tag+' atlas references wrong GLB');
  assert.deepEqual(atlas.cell,[192,192]);
  assert.equal(atlas.directions,8);
  assert.equal(atlas.design.team,team);
  assert.ok(atlas.design.materials.includes('512px multicam'),tag+' has stale sprite atlas');
  assert.ok(atlas.design.parts>0 && atlas.design.maxGripError<.002,tag+' invalid rig');
  for(const action of ['idle','walk','attack','hit','death'])assert.equal(atlas.clips[action].frames.length,8);
  const png=fs.readFileSync(path.join(folder,tag+'.png'));
  assert.equal(png.readUInt32BE(16),3072,tag+' atlas width is wrong');
  assert.ok(png.readUInt32BE(20)>=384,tag+' atlas height is wrong');
  console.log('OK',tag,'GLB PBR textures + animated game atlas');
}
console.log('Validated 8 animated tactical-infantry GLBs and matching game atlases.');
