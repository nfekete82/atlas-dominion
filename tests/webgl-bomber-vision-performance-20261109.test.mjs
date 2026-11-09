import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';

test('opt-in bomber vision profiling preserves exact explored/visible masks and save format',()=>{
 const control=Simulation.campaign(2074,19);
 const measured=Simulation.campaign(2074,19);
 const flyer=control.units.find(u=>u.owner===0&&u.hp>0);
 assert.ok(flyer,'campaign fixture must contain player forces');
 const bomber={
  ...flyer,id:999001,kind:'bomber',hp:240,carrier:null,
  x:control.world.size*.35,y:control.world.size*.38,
  previousX:control.world.size*.35,previousY:control.world.size*.38,
  flightHeight:1,moving:true
 };
 control.units.push({...bomber});
 measured.units.push({...bomber});
 measured.profileVision=true;
 for(let step=0;step<8;step++){
  for(const sim of [control,measured]){
   const u=sim.units.find(u=>u.id===999001);
   u.x+=47.25;u.y+=24.5;
   sim.time+=.2;
   sim.updateVision();
  }
  assert.deepEqual(measured.visible,control.visible,
   'instrumentation must not change airborne sight or fog-of-war');
  assert.deepEqual(measured.explored,control.explored,
   'instrumentation must not leak/lose exploration history');
  assert.deepEqual(measured.save(),control.save(),
   'profiling metrics must never enter serialized game state');
 }
 assert.equal(control.profileVision,false);
 assert.equal(measured.visionCompletedAt,measured.time);
 assert.ok(Number.isFinite(measured.visionDurationMs)&&measured.visionDurationMs>=0);
 assert.ok(measured.maxVisionMs>=measured.visionDurationMs);
});

test('inactive profiler does not timestamp regular vision passes',()=>{
 const sim=new Simulation(2074,19);
 assert.equal(sim.profileVision,false);
 const initial=sim.visionCompletedAt;
 sim.updateVision();
 assert.equal(sim.visionCompletedAt,initial);
});
