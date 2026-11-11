import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {vehicleDustEligible,vehicleDustTail,VEHICLE_DUST_CAP,VEHICLE_DUST_CAP_LITE}
 from '../scripts/webgl-vehicle-dust.js';
const moving={kind:'tank',moving:true,dx:8,dz:0,visible:true,biome:'desert',
 enabled:true,distanceToCamera:200,lite:false,tick:3,id:0};
test('dust follows real movement and never appears for parked, airborne or distant actors',()=>{
 assert.equal(vehicleDustEligible(moving),true);
 for(const change of [{moving:false},{dx:0,dz:0},{kind:'infantry'},
  {kind:'bomber'},{visible:false},{biome:'snow'},{biome:'jungle'},
  {enabled:false},{dx:300},{distanceToCamera:1900},{tick:4}])
  assert.equal(vehicleDustEligible({...moving,...change}),false,JSON.stringify(change));
 assert.equal(vehicleDustEligible({...moving,lite:true,distanceToCamera:1180}),false);
 assert.equal(vehicleDustEligible({...moving,kind:'rover'}),true);
 assert.equal(vehicleDustEligible({...moving,kind:'artillery'}),true);
});
test('dust originates behind a moving vehicle, not on its turret',()=>{
 assert.ok(vehicleDustTail({x:800,y:800},10,0,100).x<800);
 assert.ok(vehicleDustTail({x:800,y:800},-10,0,100).x>800);
 assert.deepEqual(vehicleDustTail({x:800,y:800},0,0),{x:800,y:800});
});
test('instanced 120/28-particle budgets and ?dust=off A/B toggle',()=>{
 assert.equal(VEHICLE_DUST_CAP,120);assert.equal(VEHICLE_DUST_CAP_LITE,28);
 const vfx=readFileSync('scripts/webgl-combat-vfx.js','utf8');
 assert.ok(vfx.includes('visual-moving-vehicle-dust'));
 assert.ok(vfx.includes('this.trailDust.particles.length>=this.trailDust.max'));
 assert.ok(vfx.includes('this.lastUnitPollTime===this.game.time'));
 assert.ok(readFileSync('scripts/webgl-preview.js','utf8').includes("query.get('dust')!=='off'"));
 assert.ok(readFileSync('scripts/build.mjs','utf8').includes('webgl-vehicle-dust.js'));
});
