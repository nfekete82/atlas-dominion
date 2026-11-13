import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync,existsSync} from 'node:fs';
import {strategicGlbUrl,HQ3_FALLBACK_URL} from '../scripts/webgl-strategic-glb.js';
import {prepareHeadquartersPortal,setHeadquartersDoorOpen,disposeHeadquartersPortal} from '../scripts/webgl-production-gates.js';

test('preferred headquarters is MK2 and the proven HQ3 still exists as fallback',()=>{
 assert.equal(strategicGlbUrl('headquarters','active'),
  '/src/assets/reborn/buildings-3d/sandforge_feldkommando_mk2.glb');
 assert.equal(strategicGlbUrl('headquarters','inactive'),strategicGlbUrl('headquarters','active'));
 assert.equal(HQ3_FALLBACK_URL,'/src/assets/reborn/buildings-3d/sandforge_funkzentrale_hq3_game_ready.glb');
});

test('MK2 uses its actual four sliding pivots, without adding synthetic HQ3 shutters',()=>{
 const root=new THREE.Group(),axis=new THREE.Group();root.add(axis);
 axis.rotation.x=-Math.PI/2;
 for(const [name,x,y,z] of [
  ['Door_Left_Pivot',-1.22,-5.77,1.60],
  ['Door_Right_Pivot',1.22,-5.77,1.60],
  ['Fence_Gate_Left_Pivot',-1.20,-7.48,0],
  ['Fence_Gate_Right_Pivot',1.20,-7.48,0]
 ]){
  const node=new THREE.Group();node.name=name;node.position.set(x,y,z);axis.add(node);
 }
 const entry={kind:'headquarters',detail:root};
 const portal=prepareHeadquartersPortal(entry);
 assert.ok(portal?.authored);
 assert.equal(portal.leaves.length,4);
 assert.equal(root.getObjectByName('HQ3FrontEntrancePortal'),undefined);
 assert.ok(root.userData.portal.outside[2]>root.userData.portal.inside[2]);
 setHeadquartersDoorOpen(portal,1);
 assert.ok(Math.abs(root.getObjectByName('Door_Left_Pivot').position.x+2.58)<1e-5);
 assert.ok(Math.abs(root.getObjectByName('Door_Right_Pivot').position.x-2.58)<1e-5);
 assert.ok(Math.abs(root.getObjectByName('Fence_Gate_Left_Pivot').position.x+3.65)<1e-5);
 assert.ok(Math.abs(root.getObjectByName('Fence_Gate_Right_Pivot').position.x-3.65)<1e-5);
 setHeadquartersDoorOpen(portal,0);
 assert.ok(Math.abs(root.getObjectByName('Door_Left_Pivot').position.x+1.22)<1e-5);
 assert.ok(Math.abs(root.getObjectByName('Fence_Gate_Right_Pivot').position.x-1.2)<1e-5);
 disposeHeadquartersPortal(entry);
 assert.equal(entry.headquartersPortal,undefined);
});

test('optional MK2 asset, if installed, preserves all 4 clips and required nodes',()=>{
 const file='src/assets/reborn/buildings-3d/sandforge_feldkommando_mk2.glb';
 if(!existsSync(file))return;
 const bytes=readFileSync(file);
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const obj=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 const clips=obj.animations.map(a=>a.name);
 for(const name of ['Doors_Open','Doors_Close','Doors_Cycle','Radar_Scan'])assert.ok(clips.includes(name));
});
