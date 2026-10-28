import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const dir=path.join(root,'src/assets/reborn/animation');
function glb(team){
 const file=fs.readFileSync(path.join(dir,`bomber-${team}.glb`));
 assert.equal(file.toString('ascii',0,4),'glTF','invalid GLB magic');
 assert.equal(file.readUInt32LE(4),2,'GLB version');
 assert.equal(file.readUInt32LE(8),file.length,'GLB byte length');
 assert.equal(file.toString('ascii',16,20),'JSON','JSON chunk missing');
 const length=file.readUInt32LE(12);
 return JSON.parse(file.subarray(20,20+length).toString('utf8'));
}
test('authored Bomber GLBs have embedded PBR textures and independently animated propellers',()=>{
 for(const team of [0,1]){
  const data=glb(team),names=data.nodes.map(n=>n.name);
  assert.ok(data.images?.length>=2,'embedded texture images missing');
  assert.ok(data.materials?.some(m=>m.pbrMetallicRoughness?.baseColorTexture),'base-color map missing');
  assert.ok(data.materials?.some(m=>m.normalTexture),'normal maps missing');
  const required=['Propeller_Port_Spin','Propeller_Starboard_Spin'];
  for(const name of required)assert.ok(names.includes(name),name+' missing');
  const clip=data.animations?.find(a=>a.name==='Propellers_Continuous');
  assert.ok(clip,'continuous propeller animation missing');
  const tracks=clip.channels.map(c=>({name:names[c.target.node],path:c.target.path}));
  for(const name of required)assert.ok(tracks.some(t=>t.name===name&&t.path==='rotation'),'rotation missing: '+name);
 }
});
test('gameplay bomber sprites are regenerated from the original GLBs and expose eight rotating phases',()=>{
 for(const team of [0,1]){
  const data=JSON.parse(fs.readFileSync(path.join(dir,`bomber-${team}.json`),'utf8'));
  assert.equal(data.kind,'bomber');
  assert.equal(data.model,`bomber-${team}.glb`);
  assert.equal(data.design.source,'Sandforge authored original bomber GLB');
  assert.equal(data.directions,16);
  assert.equal(data.timeBasedLocomotion,true);
  assert.equal(data.rotor,true);
  assert.equal(data.cell[0],192);
  for(const tag of ['idle','walk']){
   const clip=data.clips[tag];
   assert.equal(clip.sourceClip,'Propellers_Continuous');
   assert.equal(clip.frames.length,16);
   assert.ok(clip.frames.every(row=>row.length===8),'missing animation phases');
   assert.ok(clip.uniquePhases.some(n=>n>1),'propeller animation not visually distinct');
  }
  const png=fs.readFileSync(path.join(dir,`bomber-${team}.png`));
  assert.equal(png.toString('ascii',1,4),'PNG');
  assert.equal(png.readUInt32BE(16),16*192);
  assert.equal(png.readUInt32BE(20),16*192);
 }
 const blue=fs.readFileSync(path.join(dir,'bomber-0.png'));
 const red=fs.readFileSync(path.join(dir,'bomber-1.png'));
 assert.equal(blue.equals(red),false,'both teams have identical sprites');
});
test('renderer uses authored GLB without exporting over it',()=>{
 const source=fs.readFileSync(path.join(root,'scripts/animation/render.js'),'utf8');
 assert.match(source,/kind==='bomber'\?await loadFactionBomber\(team\)/);
 assert.match(source,/if\(rig&&!atlasOnly&&kind!=='bomber'\)/);
 assert.match(source,/\['idle','Propellers_Continuous',8,true\]/);
 assert.match(source,/\['walk','Propellers_Continuous',8,true\]/);
});
