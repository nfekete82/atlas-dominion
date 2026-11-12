import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {STRATEGIC_GLB_MODELS,strategicGlbUrl,strategicGlbActive,
 applyStrategicGlbFinish,tintBastionCaptureSignals,centerAuthoredRadarPivot}
 from '../scripts/webgl-strategic-glb.js';

const dir='src/assets/reborn/buildings-3d/';
const files={
 'sandforge_feldkommando_offline.glb':'035236f65839396e7772eadfe6573d9571f27eaa11723767263c4367664f4968',
 'sandforge_feldkommando_betriebsbereit.glb':'96cb5b6f04fd796375e11fb2227354fd9a072ec6b13350a934b29c6eaeaede06',
 'sandforge_bastion_mk2_offline.glb':'68968b8fd2c3d681520b5a7a013a9919c914a30bbd8a1d2aa52a029b3000e141',
 'sandforge_bastion_mk2_aktiv.glb':'e2c6ab5c05aa613e7cb66df6380e393478763b6ee4162937e4b10b010773fe90'
};
test('all four ORIGINAL user-uploaded GLBs are committed unchanged',()=>{
 for(const [name,sha] of Object.entries(files)){
  const bytes=readFileSync(dir+name);
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),sha,name);
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  const names=gltf.nodes.map(n=>n.name);
  if(name.includes('feldkommando'))
   for(const pivot of ['RADAR_DISH_PIVOT','GATE_LEFT_PIVOT','GATE_RIGHT_PIVOT'])
    assert.ok(names.includes(pivot),name+' missing '+pivot);
  if(name.includes('bastion'))
   for(const pivot of ['Radar_Dish_Pivot','Door_Left_Pivot','Door_Right_Pivot'])
    assert.ok(names.includes(pivot),name+' missing '+pivot);
 }
});
test('HQ switches from offline to ready on completion, not on research',()=>{
 assert.ok(strategicGlbUrl('headquarters','inactive').endsWith('feldkommando_offline.glb'));
 assert.ok(strategicGlbUrl('headquarters','active').endsWith('feldkommando_textured_plus.glb'));
 assert.equal(strategicGlbActive('headquarters',{hp:1500,owner:0,buildRemaining:8},{}),true);
 assert.equal(strategicGlbActive('headquarters',{hp:1500,owner:0,buildRemaining:0},{}),false);
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.ok(battlefield.includes("['barracks','headquarters'].includes(kind)?"));
 assert.ok(battlefield.includes("['barracks','headquarters'].includes(task.entry.kind)?"));
});
test('Bastion model swaps on ownership and animates authored radar without fallback',()=>{
 const code=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.ok(code.includes('sandforge_bastion_mk2_'));
 assert.ok(code.includes("(activated?'aktiv':'offline')"));
 assert.ok(code.includes("getObjectByName('Radar_Dish_Pivot')"));
 assert.ok(code.includes('entry.motion.pivot.rotation.y+=dt*.35'));
 assert.ok(code.includes('releaseBastionRevision(entry)'));
 assert.ok(!code.includes("const modelPath='/src/assets/reborn/buildings-3d/bastion-'+owner+'.glb'"));
});
test('MK2 materials retain geometry but change desert armour and faction signals',()=>{
 const root=new THREE.Group();
 const geom=new THREE.BoxGeometry(1,2,3);
 const source=new THREE.MeshStandardMaterial({name:'SF_Bastion_concrete',color:'#ffffff'});
 const wall=new THREE.Mesh(geom,source);
 const light=new THREE.Mesh(new THREE.BoxGeometry(.3,.3,.3),
  new THREE.MeshStandardMaterial({name:'SF_Bastion_red',color:'#ff4137'}));
 root.add(wall,light);
 const before=new THREE.Box3().setFromObject(root);
 assert.ok(applyStrategicGlbFinish(root)>=1);
 assert.equal(wall.material.color.getHexString(),'b7a181');
 assert.notEqual(wall.material,source);
 assert.deepEqual(new THREE.Box3().setFromObject(root).max.toArray(),before.max.toArray());
 assert.ok(tintBastionCaptureSignals(root,0)>0);
 assert.equal(light.material.color.getHexString(),'347c9c');
 tintBastionCaptureSignals(root,1);
 assert.equal(light.material.color.getHexString(),'af5449');
 for(const o of [wall,light]){o.geometry.dispose();o.material.dispose();}
 source.dispose();
});

test('user-authored radar pivots rotate in place for HQ and Bastion',()=>{
 const root=new THREE.Group();
 const pivot=new THREE.Group();pivot.name='RADAR_DISH_PIVOT';
 root.add(pivot);
 const dish=new THREE.Mesh(new THREE.BoxGeometry(2,1,3),
  new THREE.MeshStandardMaterial());
 dish.position.set(10,5,7);pivot.add(dish);
 const before=new THREE.Box3().setFromObject(root);
 centerAuthoredRadarPivot(pivot);
 const after=new THREE.Box3().setFromObject(root);
 assert.deepEqual(after.min.toArray(),before.min.toArray());
 assert.deepEqual(after.max.toArray(),before.max.toArray());
 assert.ok(pivot.position.x>9&&pivot.position.z>6);
 pivot.rotation.y=Math.PI/2;
 assert.equal(centerAuthoredRadarPivot(pivot),pivot,'centering is idempotent');
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.ok(battlefield.includes("entry.variantDetail?.getObjectByName('RADAR_DISH_PIVOT')"));
 assert.ok(battlefield.includes('motion.activeRotor.rotation.y+=step'));
 dish.geometry.dispose();dish.material.dispose();
});
