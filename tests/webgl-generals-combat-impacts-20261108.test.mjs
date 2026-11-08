import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {hitResponseFor,tracerWindow,impactHeight,damagedVehicleIntensity,HIT_RESPONSE}
 from '../scripts/webgl-hit-response.js';

test('C&C-inspired hits distinguish physical armor, sand/infantry and ordnance',()=>{
 for(const weapon of ['machinegun','rifle','pistol','heavy','turret']){
  const armor=hitResponseFor({weapon,armored:true});
  assert.strictEqual(armor,HIT_RESPONSE.armor);
  assert.ok(armor.sparkCount>=6,'ricochet should sparkle');
  assert.ok(armor.chipCount>=2,'armor chips must be visible');
  assert.equal(armor.dustCount,1,'armored hit is not a giant dust plume');
  const infantry=hitResponseFor({weapon,armored:false,targetClass:'infantry'});
  assert.strictEqual(infantry,HIT_RESPONSE.flesh,'infantry is not an explosion');
  const sand=hitResponseFor({weapon,armored:false,targetClass:'sand'});
  assert.strictEqual(sand,HIT_RESPONSE.sand);
  assert.ok(sand.dustCount>armor.dustCount);
 }
 for(const weapon of ['rocket','cannon','bomb'])
  assert.strictEqual(hitResponseFor({weapon}),HIT_RESPONSE.explosion);
 assert.equal(impactHeight({impactElevation:75}),75);
 assert.equal(impactHeight({impactElevation:999}),185);
 assert.equal(impactHeight({impactElevation:-20}),6);
 assert.equal(impactHeight({armored:true}),43);
 assert.equal(impactHeight({armored:false}),18);
});

test('short realistic tracers move along shot path, do not turn into colored lasers',()=>{
 assert.equal(tracerWindow({weapon:'rocket',life:.2}),null);
 assert.equal(tracerWindow({weapon:'bomb',life:.2}),null);
 const shots=[.65,.60,.50,.40,.25,.05].map(life=>
  tracerWindow({weapon:'machinegun',life}));
 for(const w of shots){
  assert.ok(w.to>=w.from);
  assert.ok(w.to-w.from<=.106,'each round draws a short moving streak');
  assert.ok(w.to<=1&&w.from>=0);
 }
 for(let i=1;i<shots.length;i++)
  assert.ok(shots[i].to>=shots[i-1].to,'tracer advances to impact');
 assert.ok(tracerWindow({weapon:'cannon',life:.35}).to-
  tracerWindow({weapon:'cannon',life:.35}).from>.10,
  'a large tank shell gets a slightly longer streak');
});

test('damaged vehicle smoke appears below half health, never on infantry/air',()=>{
 assert.equal(damagedVehicleIntensity({kind:'tank',hp:1000},1000),0);
 assert.equal(damagedVehicleIntensity({kind:'tank',hp:600},1000),0);
 assert.ok(damagedVehicleIntensity({kind:'tank',hp:400},1000)>0);
 assert.ok(damagedVehicleIntensity({kind:'rover',hp:50},295)>.5);
 assert.equal(damagedVehicleIntensity({kind:'rover',hp:0},295),0);
 assert.equal(damagedVehicleIntensity({kind:'infantry',hp:10},100),0);
 assert.equal(damagedVehicleIntensity({kind:'scout',hp:10},360),0);
 assert.equal(damagedVehicleIntensity({kind:'tank',hp:200},0),0);
});

test('VFX uses existing bounded GPU pools with surface-aware bursts and visible-only engine smoke',()=>{
 const vfx=readFileSync('scripts/webgl-combat-vfx.js','utf8');
 const field=readFileSync('scripts/webgl-battlefield.js','utf8');
 const sim=readFileSync('src/reborn/simulation.ts','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(vfx,/this\.impactAt\(shot\)/);
 assert.match(vfx,/this\.damagedVehicleSmoke\(this\.game\.units\)/);
 assert.match(vfx,/const height=this\.heightAt\(p\.x,p\.y\)\+\(armored\?impactHeight\(shot\):7\)/);
 assert.match(vfx,/this\.game\.canSee\(0,\{x:p\.x,y:p\.y\}\)/);
 assert.match(vfx,/if\(\+\+emitted>=6\)break/);
 assert.match(vfx,/this\.particle\(this\.debris/);
 assert.match(field,/tracerWindow\(shot\)/);
 assert.doesNotMatch(field,/shot\.owner===0\?\[\.55,\.89,1\]/);
 assert.match(sim,/targetClass:'queue' in target\?'structure'/);
 assert.match(sim,/impactElevation:'queue' in target/);
 assert.match(build,/cpSync\('scripts\/webgl-hit-response\.js','dist\/webgl-hit-response\.js'\)/);
 assert.ok(existsSync('dist/webgl-hit-response.js'));
});
