import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rocketTubeOffset} from '../dist/src/reborn/rocket-presentation.js';
import {VEHICLE_CONTACT_SHADOWS,groundVehiclePose} from '../dist/src/reborn/unit-presentation.js';
import {UNITS,canAttack} from '../dist/src/reborn/catalog.js';

test('six different launch tube origins for each heading',()=>{
 for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI]){
  const p=Array.from({length:6},(_,i)=>rocketTubeOffset(i,angle,1.22));
  assert.equal(new Set(p.map(q=>q.x.toFixed(3)+','+q.y.toFixed(3))).size,6);
  assert.ok(p.every(q=>Math.hypot(q.x,q.y)<16));
 }
 assert.deepEqual(rocketTubeOffset(0,0),rocketTubeOffset(6,0));
 assert.deepEqual(rocketTubeOffset(-1,0),rocketTubeOffset(5,0));
});
test('rocket launcher has solid low ground contact and restrained chassis motion',()=>{
 const s=VEHICLE_CONTACT_SHADOWS.artillery;
 assert.ok(s.alpha>=.16&&s.alpha<.20);
 assert.ok(s.widthRatio>=.90);
 const args=[130,true,.9,.2,.4,10,2];
 const artillery=groundVehiclePose('artillery',...args),humvee=groundVehiclePose('rover',...args);
 assert.ok(Math.abs(artillery.heave)<Math.abs(humvee.heave));
 assert.ok(Math.abs(artillery.roll)<Math.abs(humvee.roll));
});
test('preserve siege economy and combat stats while upgrading visuals',()=>{
 assert.equal(UNITS.artillery.cost,600);
 assert.equal(UNITS.artillery.hp,340);
 assert.equal(UNITS.artillery.range,680);
 assert.equal(UNITS.artillery.damage,120);
 assert.equal(UNITS.artillery.cooldown,3.8);
 assert.equal(canAttack({kind:'artillery'},{kind:'bomber'}),false);
});
