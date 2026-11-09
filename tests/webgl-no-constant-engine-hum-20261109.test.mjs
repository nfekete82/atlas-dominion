import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {vehicleSoundMix,measuredEngineSpeed,ENGINE_KINDS} from '../dist/src/reborn/vehicle-soundscape.js';
import {ambientActivity} from '../dist/src/reborn/audio.js';
import {RULES} from '../dist/src/reborn/config.js';

const u=(kind,id,extras={})=>({
 id,kind,owner:0,hp:500,x:100,y:100,previousX:100,previousY:100,
 carrier:null,moving:false,...extras
});
const mix=(units,camera={x:100,y:100},visible=()=>true)=>
 vehicleSoundMix({units},camera,visible,500);
const physical=(kind,id,speed,extras={})=>
 u(kind,id,{moving:true,x:100+speed*RULES.tick,driveSpeed:speed,...extras});

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

test('stalled and turning tanks stay silent even if movement flag and driveSpeed say moving',()=>{
 for(const speed of [0,1.6,24,80]){
  const stalled=u('tank',1,{moving:true,driveSpeed:speed});
  assert.equal(measuredEngineSpeed(stalled),0);
  assert.equal(mix([stalled]).tank.level,0,'driveSpeed '+speed);
 }
 assert.equal(mix([u('tank',2,{moving:true,driveSpeed:24,
  x:100.01,y:100.01})]).tank.level,0,'tiny jitter is below acoustic threshold');
 assert.equal(mix([physical('tank',3,24,{moving:false})]).tank.level,0,
  'position delta alone is not a drive when movement flag was cleared');
});

test('only measured displacement of nearby visible vehicles generates motor audio',()=>{
 const tank=physical('tank',1,27);
 assert.ok(Math.abs(measuredEngineSpeed(tank)-27)<1e-9,'physical speed should be 27 within floating-point tolerance');
 const nearby=mix([tank]);
 assert.ok(nearby.tank.level>0&&nearby.tank.level<1);
 assert.equal(mix([tank],{x:1100,y:1100}).tank.level,0);
 assert.equal(mix([tank],{x:100,y:100},()=>false).tank.level,0);
 assert.equal(mix([physical('tank',1,27,{hp:0})]).tank.level,0);
 assert.equal(mix([physical('rover',2,24,{carrier:9})]).rover.level,0);
 assert.ok(mix([physical('rover',2,24)]).rover.level>0);
 assert.ok(mix([physical('scout',3,22)]).scout.level>0);
 assert.ok(mix([physical('bomber',4,22)]).bomber.level>0);
 assert.equal(mix([physical('infantry',5,80)]).rover.level,0);
});

test('motor sound ceases instantly at rest, ignores missing history and teleportation',()=>{
 const moving=physical('tank',1,27);
 assert.ok(mix([moving]).tank.level>0);
 const stopped={...moving,previousX:moving.x,previousY:moving.y,moving:false};
 assert.equal(mix([stopped]).tank.level,0);
 assert.equal(mix([u('tank',2,{moving:true,driveSpeed:30,
  previousX:undefined,previousY:undefined})]).tank.level,0,
  'no speed may be invented when the simulation has not ticked yet');
 assert.equal(mix([u('tank',3,{moving:true,driveSpeed:30,x:2000})]).tank.level,0,
  'teleports and positional repairs are not driving');
 assert.equal(mix([physical('tank',4,.5)]).tank.level,0,'no idle hum');
 assert.ok(mix([physical('artillery',5,18)]).artillery.level>0);
});

test('ambientActivity uses exactly the same measured ground vehicle movement',()=>{
 const tank=u('tank',1,{moving:true,driveSpeed:30});
 assert.equal(ambientActivity({units:[tank],bases:[]},{x:100,y:100},()=>true).motors,0);
 tank.x+=30*RULES.tick;
 assert.ok(ambientActivity({units:[tank],bases:[]},{x:100,y:100},()=>true).motors>0);
});

test('engine layers never start from opening a production gate or clicking infantry',()=>{
 const audio=readFileSync('src/reborn/audio.ts','utf8');
 const previews=readFileSync('scripts/webgl-preview.js','utf8');
 const settings=readFileSync('scripts/webgl-title-menu.js','utf8');
 const vehicle=readFileSync('src/reborn/vehicle-soundscape.ts','utf8');
 const production=audio.split("  productionGate(kind:")[1]?.split("  select():void")[0];
 assert.ok(production);
 assert.doesNotMatch(production,/\bcreateOscillator\s*\(|\bsawtooth\b|frequency\.setValueAtTime/,
  'opening the production gate must not synthesize an engine oscillator');
 assert.match(production,/short mechanical latch/);
 assert.match(audio,/ambientSounding&&this.engineSoundsEnabled\?vehicleSoundMix/);
 assert.match(audio,/measuredEngineSpeed\(u\)>=2/);
 assert.match(audio,/level>voice.gain.gain.value \? \.13 : \.023/);
 assert.match(audio,/pause\(\):void\{[\s\S]*?this\.silenceAmbientNodes\(\)/);
 assert.match(audio,/silenceScene\(\):void\{[\s\S]*?this\.silenceAmbientNodes\(\)/);
 assert.match(audio,/if\(this\.game===g\)return;this\.silence\(\);this\.silenceAmbientNodes\(\)/);
 assert.match(audio,/voice\.gain\.gain\.cancelScheduledValues\(now\)/);
 assert.match(vehicle,/if\(physicalSpeed<2\|\|physicalSpeed>profile.speed\*3\)continue/);
 assert.match(previews,/engineSoundsEnabled!==false/);
 assert.match(settings,/options.engineSoundsEnabled!==false/);
 assert.doesNotMatch(audio,/motor\.type='sawtooth';motor\.frequency\.value=55/);
 assert.doesNotMatch(audio,/plant\.type='triangle';plant\.frequency\.value=71/);
 assert.match(audio,/this\.music\?\.update/);
 assert.match(audio,/this\.announceUnitLost/);
});
