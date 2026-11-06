import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rocketSuspensionPose,rocketWheelPhase} from '../dist/src/reborn/unit-presentation.js';
import {unitArtScale} from '../dist/src/reborn/visual-scale.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';

test('launcher visual size increases to 122 percent without altering hitbox, cost, range or armor',()=>{
 assert.equal(unitArtScale('artillery'),1.22);
 assert.deepEqual([UNITS.artillery.width,UNITS.artillery.hp,UNITS.artillery.cost,UNITS.artillery.range,UNITS.artillery.damage],[94,340,600,680,120]);
});
test('suspension responds to real driving speed, cornering and braking; stationary truck never drives itself',()=>{
 const parked=rocketSuspensionPose(100,false,0,0,0,5,0);
 assert.deepEqual(parked,{heave:0,roll:0,pitch:0,recoil:0});
 const idle=rocketSuspensionPose(100,false,0,0,0,5,.25);
 assert.ok(Math.abs(idle.heave)<.12,'sub-pixel engine idle vibration only');
 const rolling=rocketSuspensionPose(28,true,1,0,0,5,0);
 const steering=rocketSuspensionPose(28,true,1,1,0,5,0);
 const braking=rocketSuspensionPose(28,true,1,0,-1,5,0);
 assert.ok(Math.abs(rolling.heave)>.4,'suspension actually travels on rough ground');
 assert.ok(Math.abs(steering.roll-rolling.roll)>.02,'body noticeably leans into turns');
 assert.ok(Math.abs(braking.pitch-rolling.pitch)>.01,'front axle loads up under braking');
 assert.deepEqual(rocketSuspensionPose(28,true,1,1,0,5,0),steering,'no random impulses');
 for(const distance of [0,3,18,200,Infinity,NaN])for(const speed of [-1,0,0.5,1,2]){
  const p=rocketSuspensionPose(distance,true,speed,1,1,5,10);
  assert.ok(Number.isFinite(p.roll)&&Number.isFinite(p.pitch)&&Number.isFinite(p.recoil));
  if(Number.isFinite(distance))assert.ok(Math.abs(p.heave)<=3);
 }
});
test('launcher recoil peaks after launch, then settles; no barrel jump when idling',()=>{
 const atLaunch=rocketSuspensionPose(0,false,0,0,0,0,0);
 const afterLaunch=rocketSuspensionPose(0,false,0,0,0,.11,0);
 const recovered=rocketSuspensionPose(0,false,0,0,0,.95,0);
 assert.equal(atLaunch.recoil,0);
 assert.ok(afterLaunch.recoil>2,'rocket kick must actually be visible');
 assert.equal(recovered.recoil,0);
});
test('wheel interpolator cycles four baked frames smoothly without changing animation metadata',()=>{
 const phases=[0,9.75,19.5,39,58.5,78,87.75].map(d=>rocketWheelPhase(d,78,4));
 assert.deepEqual(phases.map(x=>x.index),[0,0,1,2,3,0,0]);
 assert.deepEqual(phases[1],{index:0,next:1,blend:.5});
 assert.deepEqual(phases[4],{index:3,next:0,blend:0});
 assert.deepEqual(rocketWheelPhase(20,0,4),{index:0,next:0,blend:0});
 const atlas=JSON.parse(readFileSync('src/assets/reborn/animation/artillery-0.json','utf8'));
 assert.ok(atlas.clips.walk.frames.every(row=>row.length===4));
 assert.ok(atlas.clips.walk.uniquePhases.every(n=>n>=4));
});
test('wheeled rocket truck creates real tyre trails, does not accidentally leave tank tread stripes',()=>{
 const source=readFileSync('src/reborn/battlefield-atmosphere.ts','utf8');
 assert.match(source,/u\.kind==='rover'\|\|u\.kind==='artillery'\?'wheel':'tread'/);
 const g=new Simulation(2026,14),before=g.save();
 const artillery=g.spawn(0,{x:1900,y:2100},'artillery');
 artillery.walkDistance+=24;
 assert.deepEqual(g.save().units.find(u=>u.id===artillery.id).walkDistance,24);
 assert.notDeepEqual(g.save(),before);
 const copy=Simulation.load(g.save());
 assert.equal(copy.units.find(u=>u.id===artillery.id).walkDistance,artillery.walkDistance);
});
