import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {STRATEGIC_GLB_MODELS,isStrategicGlbKind,strategicGlbUrl,
 strategicGlbActive,applyStrategicGlbFinish} from '../scripts/webgl-strategic-glb.js';
const source=readFileSync('scripts/webgl-battlefield.js','utf8');
const build=readFileSync('scripts/build.mjs','utf8');
test('original four binary GLBs are shipped with required author nodes',()=>{
 for(const [kind,variants] of Object.entries(STRATEGIC_GLB_MODELS)){
  assert.ok(isStrategicGlbKind(kind));
  for(const [variant,url] of Object.entries(variants)){
   assert.equal(strategicGlbUrl(kind,variant),url);
   const buffer=readFileSync('src/assets/reborn/'+url.split('/reborn/')[1]);
   assert.equal(buffer.toString('ascii',0,4),'glTF');
   assert.equal(buffer.readUInt32LE(8),buffer.length);
   const json=JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)));
   const nodes=json.nodes.map(x=>x.name);
   if(kind==='research')assert.ok(nodes.includes('radar_assembly_PIVOT'));
   else if(kind==='barracks')assert.ok(nodes.includes('GATE_LEFT_PIVOT')&&nodes.includes('GATE_RIGHT_PIVOT'));
   else if(kind==='headquarters')assert.ok(nodes.includes('RADAR_DISH_PIVOT'));
   else if(variant==='active')assert.ok(nodes.some(x=>x.startsWith('missile__')));
   else assert.ok(nodes.some(x=>x.startsWith('blast_door_L__')));
  }
 }
});
test('visual state uses actual research progress and silo charge',()=>{
 const built={hp:1900,buildRemaining:0,owner:0,siloCharge:600};
 const game={research:[{active:null},{active:null}]};
 assert.equal(strategicGlbActive('silo',built,game),false);
 assert.equal(strategicGlbActive('silo',{...built,siloCharge:0},game),true);
 assert.equal(strategicGlbActive('silo',{...built,siloCharge:0,buildRemaining:6},game),false);
 assert.equal(strategicGlbActive('research',built,game),false);
 game.research[0].active='precision';
 assert.equal(strategicGlbActive('research',built,game),true);
 assert.equal(strategicGlbActive('research',{...built,hp:0},game),false);
 assert.equal(strategicGlbActive('headquarters',built,game),true);
 assert.equal(strategicGlbActive('headquarters',{...built,buildRemaining:5},game),false);
});
test('PBR recolouring preserves user-authored geometry, glow and trim',()=>{
 const root=new THREE.Group(),geometry=new THREE.BoxGeometry(7,4,3);
 const source=new THREE.MeshStandardMaterial({name:'SF_olive',roughness:.4});
 const olive=new THREE.Mesh(geometry,source);
 const glow=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),
  new THREE.MeshStandardMaterial({name:'SF_blue_glow',color:'#27acd3'}));
 root.add(olive,glow);
 const before=new THREE.Box3().setFromObject(root);
 const count=applyStrategicGlbFinish(root);
 const after=new THREE.Box3().setFromObject(root);
 assert.ok(count>0);
 assert.deepEqual(before.min.toArray(),after.min.toArray());
 assert.deepEqual(before.max.toArray(),after.max.toArray());
 assert.equal(olive.geometry,geometry);
 assert.equal(olive.material.name,'SF_olive');
 assert.notEqual(olive.material,source);
 assert.ok(olive.material.roughness>=.68);
 assert.equal(glow.material.color.getHexString(),'27acd3');
 assert.ok(root.children.length===2,'no new 3D overlays');
});
test('battlefield, runtime variants, preview and build all use the GLBs',()=>{
 assert.ok(source.includes('Promise.all([this.getModel(task.url),this.getModel(variantUrl)])'));
 assert.ok(source.includes('strategicGlbActive(b.kind,b,this.game)'));
 assert.ok(source.includes("getObjectByName('radar_assembly_PIVOT')"));
 assert.ok(source.includes('applyStrategicGlbFinish(alternate)'));
 assert.ok(source.includes('isStrategicGlbKind(kind)'));
 assert.ok(build.includes("webgl-strategic-glb.js"));
});

test('building cards render thumbnails of actual original strategic GLBs',()=>{
 const portrait=readFileSync('scripts/webgl-portraits.js','utf8');
 assert.ok(portrait.includes("strategicGlbUrl(kind,'active')"));
 assert.ok(portrait.includes('applyStrategicGlbFinish(model)'));
 assert.ok(portrait.includes('return await renderStrategicPortrait(kind,renderer)'));
 assert.ok(portrait.includes('node.geometry=node.geometry.clone()'));
});
