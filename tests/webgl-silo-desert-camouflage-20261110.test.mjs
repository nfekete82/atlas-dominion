import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStrategicBuilding} from '../scripts/webgl-strategic-buildings.js';
import {tintFactionMaterials,DESERT_FINISH_REVISION}
 from '../scripts/webgl-faction-accents.js';

const meshes=root=>{
 const out=[];
 root.traverse(n=>{if(n.isMesh)out.push(n);});
 return out;
};
const dispose=root=>{
 const geometry=new Set(),materials=new Set();
 for(const node of meshes(root)){
  geometry.add(node.geometry);
  for(const mat of Array.isArray(node.material)?node.material:[node.material])
   materials.add(mat);
 }
 for(const obj of geometry)obj?.dispose();
 for(const obj of materials)obj?.dispose();
};

test('missile silo and research center share desert khaki and olive PBR paint',()=>{
 for(const owner of [0,1]){
  const silo=createStrategicBuilding('silo',owner);
  const research=createStrategicBuilding('research',owner);
  const painted=meshes(silo).filter(n=>n.material.userData.sandforgeColorMapCamo);
  assert.ok(painted.length>=2,'silo wall and hatch armor need camouflage');
  assert.ok(painted.some(n=>n.material.name==='SF_base'));
  assert.ok(painted.some(n=>n.material.name==='SF_armor'));
  const camo=painted[0].material.map;
  assert.ok(camo.isDataTexture);
  assert.equal(camo.name,'Sandforge silo desert khaki olive camouflage');
  assert.equal(camo.image.width,256);
  assert.equal(camo.image.height,256);
  assert.equal(camo.repeat.x,3);
  assert.ok(painted.every(n=>n.material.map===camo),
   'large silo components must share one GPU texture');
  const colors=new Set();
  for(let i=0;i<camo.image.data.length;i+=64*4){
   const p=camo.image.data;
   colors.add(`${p[i] >> 4}:${p[i+1] >> 4}:${p[i+2] >> 4}`);
  }
  assert.ok(colors.size>3,'camouflage must contain visible varied three-tone paint');
  for(const materialName of ['SF_camoOlive','SF_camoSand']){
   assert.ok(meshes(silo).some(n=>n.material.name===materialName),
    materialName+' paint accents must be present');
   assert.ok(meshes(research).some(n=>n.material.name===materialName),
    'research lab camouflage must remain available');
  }
  assert.ok(meshes(silo).length<=20,'static wall patches must remain batched');
  assert.ok(silo.getObjectByName('Silo_RocketBody'));
  assert.ok(silo.getObjectByName('Silo_RocketNose'));
  assert.ok(silo.getObjectByName('Silo_RocketStageSeam'));
  dispose(silo);dispose(research);
 }
});

test('faction tint preserves the silo painted texture, rocket and signal equipment',()=>{
 const silo=createStrategicBuilding('silo',0);
 const rocket=silo.getObjectByName('Silo_RocketBody');
 const rocketColor=rocket.material.color.getHex();
 const nose=silo.getObjectByName('Silo_RocketNose');
 const noseColor=nose.material.color.getHex();
 const before=meshes(silo).filter(n=>n.material.userData.sandforgeColorMapCamo);
 const texture=before[0].material.map;
 const count=tintFactionMaterials(silo,0,'silo','building');
 assert.ok(count>0);
 const after=meshes(silo).filter(n=>n.material.userData.sandforgeColorMapCamo);
 assert.ok(after.length>=2);
 assert.ok(after.every(n=>n.material.map===texture));
 assert.ok(after.every(n=>n.material.userData.sandforgeFactionTint),
  'camouflage must still receive ordinary team ownership tint');
 assert.ok(after.every(n=>n.material.userData.sandforgeDesertFinish!==DESERT_FINISH_REVISION),
  'the generic shader must not repaint the authored camouflage map');
 assert.equal(rocket.material.color.getHex(),rocketColor);
 assert.equal(nose.material.color.getHex(),noseColor);
 assert.ok(meshes(silo).some(n=>n.material.name==='SF_glow'&&n.material.emissiveIntensity>.4),
  'blue/red team indicators must remain visible');
 dispose(silo);
});
