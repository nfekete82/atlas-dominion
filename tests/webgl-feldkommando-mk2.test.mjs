import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync,existsSync} from 'node:fs';
import {strategicGlbUrl,HQ3_FALLBACK_URL} from '../scripts/webgl-strategic-glb.js';
import {prepareHeadquartersPortal,setHeadquartersDoorOpen,disposeHeadquartersPortal,SandforgeProductionGates,GATE_TIMING} from '../scripts/webgl-production-gates.js';
import {buildingFacingAngle} from '../scripts/webgl-scale.js';

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

for(const facing of [0,2,1,3])test('MK2 visual pioneer exits through gate without a sideways jump: facing '+facing,()=>{
 const base={id:70,kind:'headquarters',owner:0,hp:1200,x:500,y:500,facing};
 const forwardAngle=buildingFacingAngle(facing);
 const target=new THREE.Vector3(Math.sin(forwardAngle)*133,0,Math.cos(forwardAngle)*133);
 const unit={id:71,kind:'engineer',owner:0,hp:110,orders:[],fire:0,angle:0,
  x:500+target.x,y:500+target.z};
 const game={time:10,bases:[base],units:[unit],productionReleases:[],
  stageWebGLProduction:true};
 const node=new THREE.Group();node.rotation.y=forwardAngle;
 const detail=new THREE.Group();detail.scale.setScalar(14);node.add(detail);
 const stage=new THREE.Group();stage.rotation.x=-Math.PI/2;detail.add(stage);
 for(const [name,x,y,z] of [
  ['Door_Left_Pivot',-1.22,-5.77,1.6],
  ['Door_Right_Pivot',1.22,-5.77,1.6],
  ['Fence_Gate_Left_Pivot',-1.2,-7.48,0],
  ['Fence_Gate_Right_Pivot',1.2,-7.48,0]
 ]){
  const pivot=new THREE.Group();pivot.name=name;pivot.position.set(x,y,z);stage.add(pivot);
 }
 const actor={node:new THREE.Group()},entry={kind:'headquarters',node,detail};
 const bf={game,world:{size:1000,walkable:()=>true},bases:new Map([[base.id,entry]]),
  units:new Map([[unit.id,actor]]),heightAt:()=>0,
  entityPosition:()=>target.clone()};
 const gates=new SandforgeProductionGates(bf);
 game.productionReleases.push({unitId:unit.id,baseId:base.id,kind:'engineer',owner:0,
  at:10,from:{x:base.x,y:base.y},to:{x:unit.x,y:unit.y}});
 const tick=age=>{
  game.time=10+age;actor.node.visible=true;actor.node.position.copy(target);
  actor.productionMotion=null;gates.update();
  return actor.node.position.clone();
 };
 const hidden=tick(0);
 assert.ok(actor.node.visible===false);
 assert.ok(hidden.distanceTo(target)<.01);
 const open=tick(GATE_TIMING.warning+GATE_TIMING.opening+.1);
 assert.ok(actor.node.visible);
 const duration=gates.active.get(base.id).duration;
 const cleared=tick(GATE_TIMING.warning+GATE_TIMING.opening+1.65);
 const finish=tick(GATE_TIMING.warning+GATE_TIMING.opening+duration-.001);
 assert.ok(open.distanceTo(target)>8,'emergence must start inside, not at the simulation spawn');
 assert.ok(cleared.distanceTo(target)<10,'fence gate must align with real exterior slot');
 assert.ok(finish.distanceTo(target)<.01,'handoff matches the authoritative stop position');
 assert.ok(Math.abs((finish.x-base.x+500)*0+finish.x-target.x)<.01);
 assert.deepEqual(unit.orders,[],'no rally is invented');
 gates.dispose();
});
