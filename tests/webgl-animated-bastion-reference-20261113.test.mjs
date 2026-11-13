import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {ANIMATED_BASTION_GLB_URL,createAnimatedBastionController} from '../scripts/webgl-bastion-animated.js';

const glbPath=new URL('../src/assets/reborn/buildings-3d/sandforge_bastion_animated.glb',import.meta.url);
const expectedAnimations=['FlagWave','RadarRotate','CapturePulse','FlagRaise','FlagLower','GateOpen','GateClose','Idle'];
const requiredNames=['Bastion_ROOT','RadarPivot','CaptureRing_Capturing','CaptureRing_Neutral','CaptureRing_Blue','CaptureRing_Red',
 'Flag_Neutral','Flag_Blue','Flag_Red','Emblem_Neutral','Emblem_Blue','Emblem_Red',
 ...Array.from({length:16},(_,i)=>'CaptureSegment_'+String(i).padStart(2,'0'))];

test('reference Bastion GLB is the exact, valid asset with required nodes/clips',()=>{
 const bytes=readFileSync(glbPath);
 assert.equal(ANIMATED_BASTION_GLB_URL,'/src/assets/reborn/buildings-3d/sandforge_bastion_animated.glb');
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 assert.equal(bytes.length,4053040);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),
  '9996713d27eadf4bbed6e49cc379089932667f1d594086258bf90554b1d2d340');
 const len=bytes.readUInt32LE(12);
 assert.equal(bytes.toString('ascii',16,20),'JSON');
 const gltf=JSON.parse(bytes.subarray(20,20+len).toString('utf8'));
 const names=new Set(gltf.nodes.map(n=>n.name));
 for(const name of requiredNames)assert.ok(names.has(name),'Missing scene node '+name);
 for(const name of expectedAnimations)
  assert.ok(gltf.animations.some(a=>a.name===name),'Missing animation '+name);
 assert.ok(gltf.textures.length>=18);
});

const names=['Bastion_ROOT','CaptureRing_Capturing','CaptureRing_Neutral','CaptureRing_Blue','CaptureRing_Red',
 'Flag_Neutral','Flag_Blue','Flag_Red','Emblem_Neutral','Emblem_Blue','Emblem_Red',
 ...Array.from({length:16},(_,i)=>'CaptureSegment_'+String(i).padStart(2,'0'))];

function mockScene(){
 const scene=new THREE.Group(),core=new THREE.Group();
 core.name='Bastion_ROOT';scene.add(core);
 for(const name of names.slice(1)){
  const part=new THREE.Group();
  part.name=name;
  (name.startsWith('CaptureSegment_')?core.getObjectByName('CaptureRing_Capturing'):core).add(part);
 }
 const clips=['Idle','FlagWave','RadarRotate','CapturePulse','FlagRaise','FlagLower']
  .map(name=>new THREE.AnimationClip(name,1,[]));
 return {scene,core,clips};
}

test('capture and ownership visuals are driven without touching simulation',()=>{
 const {scene,core,clips}=mockScene();
 const controller=createAnimatedBastionController(scene,clips,-1);
 assert.equal(core.getObjectByName('Flag_Neutral').visible,true);
 assert.equal(core.getObjectByName('Flag_Blue').visible,false);
 controller.setCaptureProgress(.5,0);
 assert.equal(core.getObjectByName('CaptureRing_Capturing').visible,true);
 assert.equal(core.getObjectByName('CaptureSegment_07').visible,true);
 assert.equal(core.getObjectByName('CaptureSegment_08').visible,false);
 controller.setOwner(0);
 assert.equal(core.getObjectByName('Flag_Blue').visible,true);
 assert.equal(core.getObjectByName('Emblem_Neutral').visible,false);
 assert.equal(controller.progress,0);
 controller.setOwner(1);
 assert.equal(core.getObjectByName('Flag_Red').visible,true);
 assert.equal(core.getObjectByName('Flag_Blue').visible,false);
 controller.update(.12);
 controller.dispose();
});

test('separate Bastion instances retain independent team state',()=>{
 const a=mockScene(),b=mockScene();
 const left=createAnimatedBastionController(a.scene,a.clips,0);
 const right=createAnimatedBastionController(b.scene,b.clips,1);
 left.setCaptureProgress(.25,1);
 assert.equal(a.core.getObjectByName('CaptureRing_Capturing').visible,true);
 assert.equal(b.core.getObjectByName('CaptureRing_Capturing').visible,false);
 assert.equal(b.core.getObjectByName('Flag_Red').visible,true);
 left.dispose();right.dispose();
});
