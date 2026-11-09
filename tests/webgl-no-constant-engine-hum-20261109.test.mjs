import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {vehicleSoundMix,ENGINE_KINDS} from '../dist/src/reborn/vehicle-soundscape.js';
import {ambientActivity} from '../dist/src/reborn/audio.js';

const u=(kind,id,extras={})=>({
 id,kind,owner:0,hp:500,x:100,y:100,carrier:null,moving:false,
 ...extras
});
const mix=(units,camera={x:100,y:100},visible=()=>true)=>
 vehicleSoundMix({units},camera,visible,500);

test('all parked tanks, rovers and hovering helicopters are absolutely silent',()=>{
 const units=[u('tank',1),u('rover',2),u('artillery',3),
   u('scout',4),u('bomber',5)];
 const m=mix(units);
 for(const kind of ENGINE_KINDS){
  assert.equal(m[kind].level,0,kind+' must not idle forever');
  assert.equal(m[kind].count,0);
 }
 assert.equal(ambientActivity({units,bases:[]},{x:100,y:100},()=>true).motors,0);
});

test('a stalled tank with a movement order emits no engine rumble',()=>{
 assert.equal(mix([u('tank',1,{moving:true,driveSpeed:0})]).tank.level,0);
 assert.equal(mix([u('tank',1,{moving:true,driveSpeed:1.6})]).tank.level,0);
 assert.ok(mix([u('tank',1,{moving:true,driveSpeed:24})]).tank.level>0);
});

test('only physically moving nearby visible vehicles produce attenuated audio',()=>{
 const tank=u('tank',1,{moving:true,driveSpeed:27});
 const nearby=mix([tank]);
 assert.ok(nearby.tank.level>0&&nearby.tank.level<1);
 assert.equal(mix([tank],{x:1100,y:1100}).tank.level,0);
 assert.equal(mix([tank],{x:100,y:100},()=>false).tank.level,0);
 assert.equal(mix([u('tank',1,{...tank,hp:0})]).tank.level,0);
 assert.equal(mix([u('rover',2,{moving:true,carrier:9})]).rover.level,0);
 assert.ok(mix([u('rover',2,{moving:true})]).rover.level>0);
 assert.ok(mix([u('scout',3,{moving:true})]).scout.level>0);
});

test('sound design removes both permanent motor and power plant tone, limits moving engines',()=>{
 const audio=readFileSync('src/reborn/audio.ts','utf8');
 const vehicle=readFileSync('src/reborn/vehicle-soundscape.ts','utf8');
 assert.doesNotMatch(audio,/motor\.type='sawtooth';motor\.frequency\.value=55/);
 assert.doesNotMatch(audio,/plant\.type='triangle';plant\.frequency\.value=71/);
 assert.doesNotMatch(audio,/motorGain\?\.gain\.setTargetAtTime/);
 assert.doesNotMatch(audio,/generatorGain\?\.gain\.setTargetAtTime/);
 assert.match(vehicle,/if\(u\.hp<=0\|\|u\.carrier\|\|!u\.moving/);
 assert.match(vehicle,/if\(physicalSpeed<2\)return/);
 assert.match(audio,/Math\.min\(560,Math\.max\(r\.width,r\.height\)/);
 assert.match(audio,/level\*profile\.volume\*\.50/);
 assert.match(audio,/this\.music\?\.update/);
 assert.match(audio,/this\.announceUnitLost/);
});
