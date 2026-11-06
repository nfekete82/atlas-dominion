import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadGeometryGLB} from '../scripts/animation/offline-building-export.mjs';

test('buildings rigs: actual exported clips move their hardware while all foundations and pivot positions remain fixed',async()=>{
 const targets={RadarSpin:['RadarDish',12],BeaconPulse:['Beacon',.5],CaptureSweep:['CaptureSweep_Rotator',3],TurretTraverse:['TurretHead',.5]};
 for(const kind of ['headquarters','factory','barracks','airfield','generator','turret','bastion'])for(const team of kind==='bastion'?[0,1,-1]:[0,1]){
  // Decode the actual shipped GLB; remove texture decoding only. This exercises
  // glTF round-trip bindings and AnimationMixer, rather than source clip arrays.
  const {scene,animations}=await loadGeometryGLB(new URL(`../src/assets/reborn/buildings-3d/${kind}-${team}.glb`,import.meta.url)),mixer=new T.AnimationMixer(scene),dynamic=new Set();
  for(const [name] of Object.values(targets))scene.getObjectByName(name)?.traverse(n=>dynamic.add(n));
  const fixed=[];scene.traverse(n=>{if(n.isMesh&&!dynamic.has(n))fixed.push(n);});assert.ok(fixed.length>0);
  for(const clip of animations){
   mixer.stopAllAction();mixer.clipAction(clip).reset().play();mixer.setTime(0);scene.updateMatrixWorld(true);
   const [name,time]=targets[clip.name],target=scene.getObjectByName(name);assert.ok(target,`${kind}: ${clip.name} pivot`);
   const before=target.matrixWorld.toArray(),position=target.getWorldPosition(new T.Vector3()),foundation=fixed.map(n=>n.matrixWorld.toArray());
   mixer.setTime(time);scene.updateMatrixWorld(true);
   assert.ok(target.matrixWorld.toArray().some((v,i)=>Math.abs(v-before[i])>1e-5),`${kind}/${team}: ${clip.name} moves its hardware`);
   assert.ok(target.getWorldPosition(new T.Vector3()).distanceTo(position)<1e-7,`${kind}: pivot stays registered`);
   for(let i=0;i<fixed.length;i++)assert.deepEqual(fixed[i].matrixWorld.toArray(),foundation[i],`${kind}: foundation does not follow ${clip.name}`);
  }
  if(kind==='turret')for(const name of ['TurretMuzzleL','TurretMuzzleR']){
   const muzzle=scene.getObjectByName(name);assert.ok(muzzle);assert.equal(muzzle.parent.name,'TurretHead');assert.ok(muzzle.getWorldPosition(new T.Vector3()).toArray().every(Number.isFinite));
  }
  mixer.uncacheRoot(scene);
 }
});
