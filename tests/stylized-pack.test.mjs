import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {stylizedProfile,stylizedAsset} from '../scripts/webgl-stylized-pack.js';
import {prepareBarracksPortal,setBarracksDoorOpen,barracksDeparturePoint,disposeBarracksPortal} from '../scripts/webgl-barracks-portal.js';
import {prepareAuthoredAssembly,updateAuthoredAssembly,releaseAuthoredAssembly} from '../scripts/webgl-construction-assembly.js';
import {buildingFacingAngle} from '../scripts/webgl-scale.js';

const directory=new URL('../src/assets/stylized/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',directory)));
async function load(kind,owner=0){const bytes=await readFile(new URL(kind+'-'+owner+'.glb',directory));return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}

for(const asset of manifest.models)test('self-contained GLTFLoader asset: '+asset.file,async()=>{
 const bytes=await readFile(new URL(asset.file,directory)),jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength));
 assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 assert.equal(json.buffers.length,1);assert.ok(!json.buffers[0].uri);assert.ok(!json.images?.length,'vertex colours have no texture dependencies');
 const data=await load(asset.kind,asset.owner);const profile=stylizedProfile(data.scene);
 assert.equal(profile.metresToWorld,18);assert.equal(profile.originalArtwork,true);
 let triangles=0,primitives=0;
 data.scene.traverse(mesh=>{
  if(!mesh.isMesh)return;primitives++;
  const geometry=mesh.geometry,p=geometry.attributes.position,n=geometry.attributes.normal,color=geometry.attributes.color;
  assert.ok(color&&color.count===p.count);assert.ok(mesh.material.isMeshStandardMaterial);assert.ok(mesh.material.roughness>=.25);
  for(let i=0;i<p.count;i++){
   assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite));
   assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.001,'normalized normals');
  }
  const idx=geometry.index,count=idx?.count??p.count;triangles+=count/3;
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
  for(let i=0;i<count;i+=3){a.fromBufferAttribute(p,idx?idx.getX(i):i);b.fromBufferAttribute(p,idx?idx.getX(i+1):i+1);c.fromBufferAttribute(p,idx?idx.getX(i+2):i+2);assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-16,'no degenerate triangles');}
 });
 assert.equal(triangles,asset.triangles);assert.equal(primitives,asset.primitives);assert.ok(triangles<7000);assert.ok(bytes.length<550000);
 assert.ok(new T.Box3().setFromObject(data.scene).min.y>=-.04,'ground pivot');
});

test('the old infantry and pioneer assets are the default again',()=>{
 assert.equal(stylizedAsset('infantry',0),null);
 assert.equal(stylizedAsset('infantry',1),null);
 assert.equal(stylizedAsset('engineer',0),null);
 assert.equal(stylizedAsset('engineer',1),null);
 assert.equal(stylizedAsset('infantry',0,true),'/src/assets/stylized/infantry-0.glb');
 assert.equal(stylizedAsset('engineer',1,true),'/src/assets/stylized/engineer-1.glb');
 assert.equal(stylizedAsset('rover',0),'/src/assets/stylized/rover-0.glb');
});
test('soldier exports a skin, independent clone skeleton and five working clips',async()=>{
 const data=await load('infantry'),a=clone(data.scene),b=clone(data.scene);
 const skin=a.getObjectByName('SFV1_SoldierSkin');assert.ok(skin.isSkinnedMesh);assert.ok(skin.skeleton.bones.length>=15);
 assert.notEqual(skin.skeleton,b.getObjectByName('SFV1_SoldierSkin').skeleton);
 assert.deepEqual(data.animations.map(c=>c.name).sort(),['Death','Idle','Run','Shoot','Walk']);
 for(const clip of data.animations){
  const mixer=new T.AnimationMixer(a),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1).play();
  const before=skin.skeleton.bones.map(n=>n.quaternion.clone());mixer.update(clip.duration*.17);a.updateMatrixWorld(true);
  assert.ok(skin.skeleton.bones.some((n,i)=>n.quaternion.angleTo(before[i])>.005),'clip moves rig: '+clip.name);
  const v=new T.Vector3();skin.getVertexPosition(0,v);assert.ok(v.toArray().every(Number.isFinite));
  mixer.stopAllAction();mixer.uncacheRoot(a);
 }
});

test('rover Drive rotates wheels without translating the actor',async()=>{
 const data=await load('rover'),root=data.scene,wheel=root.getObjectByName('Wheel_LF'),rest=wheel.quaternion.clone();
 const mixer=new T.AnimationMixer(root);mixer.clipAction(data.animations.find(c=>c.name==='Drive')).play();mixer.update(.23);
 assert.ok(wheel.quaternion.angleTo(rest)>1);assert.deepEqual(root.position.toArray(),[0,0,0]);
 assert.ok(root.getObjectByName('WeaponMuzzle'));assert.equal(stylizedAsset('rover',1),'/src/assets/stylized/rover-1.glb');
});

test('barracks is a true unobstructed portal at every facing; door clears the full soldier',async()=>{
 const data=await load('barracks');
 for(const facing of [0,2,1,3]){
  const root=clone(data.scene);Object.assign(root.userData,stylizedProfile(root));
  const actor=new T.Group();actor.rotation.y=buildingFacingAngle(facing);actor.add(root);root.scale.setScalar(18);
  const entry={detail:root},portal=prepareBarracksPortal(entry,{});assert.ok(portal.stylized);
  const closedL=portal.left.position.x,closedR=portal.right.position.x;
  setBarracksDoorOpen(portal,0);assert.ok(portal.left.position.x<closedL-1);assert.ok(portal.right.position.x>closedR+1);
  actor.updateMatrixWorld(true,true);
  const start=root.localToWorld(new T.Vector3(0,1.2,-5)),direction=new T.Vector3(0,0,1).transformDirection(root.matrixWorld);
  const intersections=new T.Raycaster(start,direction).intersectObject(root,true);
  assert.ok(intersections.length>0);assert.ok(intersections[0].distance>5*18,'no invisible wall or shut door in the exit aperture');
  for(let i=0;i<=20;i++){const p=barracksDeparturePoint(portal,i/20);assert.equal(p.x,0);assert.ok(p.y>=0&&p.y<=.026);}
  assert.ok(root.userData.portal.clearHeight>2.07*1.15);
  setBarracksDoorOpen(portal,1);assert.equal(portal.left.position.x,closedL);assert.equal(portal.right.position.x,closedR);
  disposeBarracksPortal(entry);
 }
});

test('new barracks supports incremental construction and restores shared geometry',async()=>{
 const {scene}=await load('barracks'),root=clone(scene);let original=0;root.traverse(n=>{if(n.isMesh)original+=(n.geometry.index?.count??n.geometry.attributes.position.count);});
 const assembly=prepareAuthoredAssembly(root);assert.ok(assembly?.meshes.length);
 let last=0;for(const p of [0,.18,.35,.55,.75,.95,1]){
  updateAuthoredAssembly(assembly,p);const count=assembly.meshes.reduce((s,m)=>s+m.geometry.drawRange.count,0);assert.ok(count>=last);if(p===0)assert.equal(count,0);last=count;
 }
 assert.equal(last,original);const rows=[...assembly.meshes];releaseAuthoredAssembly(assembly);
 assert.ok(rows.every(r=>r.mesh.geometry===r.source));
});

test('new barracks ground geometry stays inside existing infantry avoidance clearance',async()=>{
 const {scene}=await load('barracks');scene.updateMatrixWorld(true);
 // Existing catalog: 158 width × 1.26 visual footprint × .43 avoidance,
 // with a northward centre offset of 19.908 and infantry radius 11.
 const width=158*1.26,avoidance=width*.43+11,offset=Math.min(26,width*.10);
 const p=new T.Vector3();let tested=0;
 scene.traverse(mesh=>{if(!mesh.isMesh)return;const positions=mesh.geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
   p.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
   if(p.y>.45)continue;tested++;
   assert.ok(Math.hypot(p.x*18,p.z*18+offset)<=avoidance+.1,'ground wall cannot protrude through the existing avoidance boundary');
  }
 });assert.ok(tested>100);
});

test('engineer keeps soldier-sized skinned rig, wrench gear and build/repair animation',async()=>{
 const data=await load('engineer');
 const model=clone(data.scene),skin=model.getObjectByName('SFV1_EngineerSkin');
 assert.ok(skin?.isSkinnedMesh,'engineer skin exists');
 assert.ok(skin.skeleton.bones.length>=15,'same articulated skeleton as infantry');
 const clips=data.animations.map(c=>c.name);
 for(const name of ['Idle','Walk','Run','Death','Build','Repair'])
  assert.ok(clips.includes(name),'missing pioneer animation '+name);
 const repair=data.animations.find(c=>c.name==='Repair'),before=skin.skeleton.bones.map(b=>b.quaternion.clone());
 const mixer=new T.AnimationMixer(model);mixer.clipAction(repair).play();mixer.update(.33);
 assert.ok(skin.skeleton.bones.some((b,i)=>b.quaternion.angleTo(before[i])>.05),'tool hand must animate');
 assert.equal(stylizedAsset('engineer',0),null);
 assert.equal(stylizedAsset('engineer',0,true),'/src/assets/stylized/engineer-0.glb');
});

test('stylized headquarters opens its own real doors and preserves production lane',async()=>{
 const data=await load('headquarters');
 const model=clone(data.scene);Object.assign(model.userData,stylizedProfile(model));
 const left=model.getObjectByName('HQ_GATE_LEFT'),right=model.getObjectByName('HQ_GATE_RIGHT');
 const radar=model.getObjectByName('HQ_RADAR_PIVOT');
 assert.ok(left&&right&&radar,'authored mechanical pivots must be part of the GLB');
 assert.ok(data.animations.some(c=>c.name==='RadarSpin'));
 assert.ok(data.animations.some(c=>c.name==='ProductionDoor'));
 const {prepareHeadquartersPortal,setHeadquartersDoorOpen,disposeHeadquartersPortal}=
  await import('../scripts/webgl-production-gates.js');
 const host=new T.Group();host.add(model);
 const entry={detail:model},portal=prepareHeadquartersPortal(entry);
 assert.equal(portal.authored,true,'do not overlay the HQ3 fake doorway');
 const before=[left.position.x,right.position.x];
 setHeadquartersDoorOpen(portal,1);
 assert.ok(left.position.x<before[0]-1&&right.position.x>before[1]+1);
 setHeadquartersDoorOpen(portal,0);
 assert.equal(left.position.x,before[0]);assert.equal(right.position.x,before[1]);
 assert.ok(model.userData.portal.clearHeight>2.07*1.15);
 const start=new T.Vector3(...model.userData.portal.inside),end=new T.Vector3(...model.userData.portal.outside);
 assert.ok(end.z>start.z+2,'HQ exits through its +Z doors');
 disposeHeadquartersPortal(entry);
 assert.ok(model.parent,'detaching a gate must not remove its owning model');
});

test('low-poly desert decoration is deterministic, instanced and has no collider',async()=>{
 const {addStylizedDesertWorld}=await import('../scripts/webgl-stylized-world.js');
 const world={size:1000,blocked:[],index:()=>0,walkable:()=>true};
 const props={world,terrain:{sites:[{x:500,y:500}],ruins:[]},game:{units:[]},heightAt:()=>0,seed:1337,lowQuality:true};
 const first=addStylizedDesertWorld({...props,scene:new T.Scene()});
 const second=addStylizedDesertWorld({...props,scene:new T.Scene()});
 assert.deepEqual([first.rocks,first.palms,first.bushes],[second.rocks,second.palms,second.bushes]);
 assert.ok(first.rocks>0&&first.palms>0&&first.bushes>0);
 assert.ok(first.meshes.every(mesh=>mesh.isInstancedMesh&&mesh.userData.visualOnly&&mesh.userData.nonPlayable));
 for(const mesh of first.meshes)mesh.raycast(); // disabled clicking through scenery
});
