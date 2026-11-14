import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Read only the tiny GLB JSON chunk (no textures/geometry decode) and audit
// the actual in-game Quaternius/Atlas soldier material/mesh names.
const paths=['infantry-0.glb','engineer-0.glb','heavy-0.glb','medic-0.glb'];
for(const file of paths)test('native uniform audit: '+file,()=>{
 const bytes=readFileSync('src/assets/reborn/prototype/'+file);
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 const len=bytes.readUInt32LE(12);
 const data=JSON.parse(bytes.subarray(20,20+len).toString('utf8'));
 const mats=data.materials??[],meshes=data.meshes??[],nodes=data.nodes??[];
 const obj=nodes.filter(n=>Number.isInteger(n.mesh)).map(n=>({
  node:n.name,mesh:meshes[n.mesh]?.name??'',
  materials:[...new Set((meshes[n.mesh]?.primitives??[]).map(p=>p.material))].map(x=>mats[x]?.name??('mat'+x)),
  uv:(meshes[n.mesh]?.primitives??[]).some(p=>p.attributes?.TEXCOORD_0!==undefined)
 }));
 const list=Object.fromEntries(mats.map((m,i)=>[i,{
  name:m.name,base:m.pbrMetallicRoughness?.baseColorTexture?.index,
  factor:m.pbrMetallicRoughness?.baseColorFactor,alpha:m.alphaMode
 }]));
 console.log('SOLDIER_ASSET_AUDIT '+file+' '+JSON.stringify({materials:list,meshes:obj.slice(0,120)}));
 assert.ok(mats.length>0&&obj.length>0);
});