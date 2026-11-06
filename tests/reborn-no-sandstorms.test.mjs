import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {Weather} from '../dist/src/reborn/weather.js';
import {UNITS} from '../dist/src/reborn/catalog.js';

test('sandstorms are disabled for regular campaigns, regardless of seed, size or simulation time',()=>{
 for(const version of [3,4,5,6,7,8,9,10]){
  for(const seed of [1,2026,65001]){
   const game=new Simulation(seed,version),before=game.weather;
   assert.equal(before.enabled,false);
   assert.equal(before.phase,'CLEAR');
   assert.equal(before.storm,false);
   assert.equal(before.intensity,0);
   assert.equal(before.remaining,0);
   assert.deepEqual(before.update(1_000_000),[]);
   assert.equal(before.phase,'CLEAR');
   assert.equal(before.intensity,0);
   assert.deepEqual(before.artilleryOffset(101,92),{x:0,y:0});
   assert.equal(game.weather.endsAt,Infinity);
  }
 }
});

test('sandstorms cannot change normal sight, aircraft speed or produce warnings during long-running matches',()=>{
 const game=new Simulation(2026,8);
 game.aiClock=-1e8;
 game.world.blocked.fill(0);game.world.opaque.fill(0);
 const foot=game.spawn(0,{x:1900,y:2100},'infantry');
 const aircraft=game.spawn(0,{x:1900,y:2170},'scout');
 game.command([aircraft.id],{kind:'move',x:2300,y:2170});
 assert.equal(game.sight(foot),UNITS.infantry.sight);
 assert.equal(game.sight(aircraft),UNITS.scout.sight);
 game.time=6000;game.step(.05);
 assert.equal(game.weather.phase,'CLEAR');
 assert.equal(game.weather.intensity,0);
 assert.equal(game.sight(foot),UNITS.infantry.sight);
 assert.equal(game.sight(aircraft),UNITS.scout.sight);
 assert.ok(game.notices.every(m=>!m.includes('Sandsturm')&&!m.includes('Sichtbedingungen')));
 assert.ok(aircraft.x>1900,'aircraft continues normally');
});

test('pre-existing mid-storm saves safely resume in clear weather without changing their original map or positions',()=>{
 const historic=new Simulation(2026,8,true);
 const activeStorm=historic.weather.endsAt+12;
 historic.time=activeStorm;historic.weather.update(historic.time);
 assert.equal(historic.weather.phase,'SANDSTORM');
 const save=historic.save();
 const restored=Simulation.load(save);
 assert.equal(restored.weather.enabled,false);
 assert.equal(restored.weather.phase,'CLEAR');
 assert.equal(restored.weather.intensity,0);
 assert.equal(restored.world.mapVersion,historic.world.mapVersion);
 assert.deepEqual(restored.units.map(u=>[u.id,u.x,u.y]),historic.units.map(u=>[u.id,u.x,u.y]));
 restored.step(.05);
 assert.equal(restored.weather.phase,'CLEAR');
 assert.ok(restored.notices.every(m=>!m.includes('Sandsturm')));
});

test('archived storm engine remains explicitly testable for alternative future effects',()=>{
 const active=new Weather(2026),disabled=new Weather(2026,false);
 assert.equal(active.enabled,true);
 assert.ok(Number.isFinite(active.endsAt));
 assert.equal(disabled.phase,'CLEAR');
 assert.deepEqual(disabled.update(10_000),[]);
 const stormAt=active.endsAt+12;
 assert.deepEqual(active.update(stormAt),['WARNING','SANDSTORM']);
 assert.equal(active.storm,true);
});
