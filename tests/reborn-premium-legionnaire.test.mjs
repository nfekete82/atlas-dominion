import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const folder=new URL('../src/assets/reborn/prototype/',import.meta.url);
const asset=(name)=>new URL(name,folder);
const clips=['Idle','Run_Gun','Idle_Shoot','HitReact','Death'];

test('premium legionnaire: actual game atlases, faction distinction and GLB motion metadata',t=>{
 const a=JSON.parse(fs.readFileSync(asset('infantry-0.json'),'utf8'));
 if(a.design?.version!==3){t.skip('The locally installed premium binary assets have not been copied into this checkout');return;}
 const images=[];
 for(const team of [0,1]){
  const manifest=JSON.parse(fs.readFileSync(asset('infantry-'+team+'.json'),'utf8'));
  assert.equal(manifest.design.version,3);
  assert.deepEqual(manifest.cell,[192,192]);
  assert.equal(manifest.directions,8);
  assert.equal(manifest.timeBasedLocomotion,false);
  assert.equal(manifest.frames.length,296);
  assert.deepEqual(Object.keys(manifest.clips),['idle','walk','attack','hit','death']);
  for(const [name,num] of [['idle',6],['walk',8],['attack',6],['hit',5],['death',12]]){
    const c=manifest.clips[name];
    assert.equal(c.frames.length,8,name);
    assert.ok(c.frames.every(r=>r.length===num),name);
  }
  for(const frame of manifest.frames){
    assert.ok(frame.x>=0&&frame.y>=0&&frame.x+frame.w<=3072&&frame.y+frame.h<=3648);
    assert.ok(frame.muzzle.every(Number.isFinite));
    assert.deepEqual(frame.pivot,[96,156]);
  }
  const png=fs.readFileSync(asset('infantry-'+team+'.png'));
  assert.equal(png.subarray(1,4).toString('ascii'),'PNG');
  assert.equal(png.readUInt32BE(16),3072);
  assert.equal(png.readUInt32BE(20),3648);
  images.push(createHash('sha256').update(png).digest('hex'));
  const glb=fs.readFileSync(asset('infantry-'+team+'.glb'));
  assert.equal(glb.subarray(0,4).toString(),'glTF');
  assert.ok(glb.length>25_000_000,'do not silently replace the realistic high-poly soldier');
  const gltf=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)));
  assert.deepEqual(gltf.animations.map(c=>c.name),clips);
  assert.ok(gltf.nodes.some(n=>n.name==='soldier'));
  assert.ok(gltf.nodes.some(n=>n.name==='AtlasPremiumMotionRoot'));
  assert.ok(gltf.nodes.some(n=>n.name==='Atlas_MuzzleBore'));
  assert.ok(gltf.nodes.some(n=>n.name==='AtlasFactionPatch'));
  assert.equal(gltf.skins?.length??0,0,'avoid claiming non-existent skeletal animation');
  assert.ok(gltf.images.length>=20,'retain embedded high-resolution soldier and rifle textures');
  const root=gltf.nodes.findIndex(n=>n.name==='AtlasPremiumMotionRoot');
  assert.ok(gltf.animations.every(clip=>clip.channels.every(ch=>ch.target.node===root)));
 }
 assert.notEqual(images[0],images[1],'red and blue infantry should have different game sprites');
});
