import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';

function crowdedMatch(){
 const game=new Simulation(2026,4);
 game.time=80;
 game.aiClock=-1e8; // isolate movement/collision/path from tactical decisions
 game.units=[];
 game.world.blocked.fill(0);game.world.opaque.fill(0);
 const size=game.world.size;
 const blue=[];
 for(let i=0;i<24;i++){
  const kind=i%6===0?'tank':i%4===0?'heavy':'infantry';
  const u=game.spawn(0,{x:size*.28+(i%8)*32,y:size*.27+Math.floor(i/8)*31},kind);
  blue.push(u.id);
 }
 for(let i=0;i<12;i++){
  const u=game.spawn(1,{x:size*.63+(i%6)*26,y:size*.64+Math.floor(i/6)*26},'infantry');
  u.hold=true;
 }
 assert.ok(game.command(blue.slice(0,12),{kind:'attackMove',x:size*.60,y:size*.61})>0);
 assert.ok(game.command(blue.slice(12),{kind:'attackMove',x:size*.59,y:size*.58})>0);
 return game;
}

test('36-unit crowd: opt-in profiling changes neither physics, combat, pathfinding nor saves',()=>{
 const control=crowdedMatch(),diagnostic=crowdedMatch();
 diagnostic.profileSquadWork=true;diagnostic.world.profilePaths=true;
 for(let i=0;i<24;i++){
  control.step(.05);
  diagnostic.step(.05);
 }
 assert.deepEqual(diagnostic.save(),control.save(),
  'timing and indexed march lookups must preserve deterministic game state');
 assert.equal(control.squadUnitMs,0);
 assert.equal(control.squadCollisionMs,0);
 assert.ok(Number.isFinite(diagnostic.squadUnitMs)&&diagnostic.squadUnitMs>=0);
 assert.ok(Number.isFinite(diagnostic.squadCollisionMs)&&diagnostic.squadCollisionMs>=0);
 assert.ok(diagnostic.world.pathCalls>=1,'at least one route is requested by movers');
 assert.ok(diagnostic.world.pathCostMs>=0);
 assert.ok(diagnostic.world.pathVisitedNodes>=0);
 assert.ok(diagnostic.world.pathMaxMs>=0);
 assert.ok(diagnostic.world.pathCostMs>=diagnostic.world.pathMaxMs,
  'total route-search cost includes the slowest individual search');
 const cleanSave=diagnostic.save();
 assert.ok(!('profileSquadWork' in cleanSave));
 assert.ok(!('squadUnitMs' in cleanSave));
 assert.ok(!('pathCalls' in cleanSave));
});

test('path counters reset independently without clearing routes, navigation workspace or units',()=>{
 const game=crowdedMatch();
 game.world.profilePaths=true;game.profileSquadWork=true;
 game.step(.05);
 const count=game.world.pathCalls,units=game.units;
 assert.ok(count>0);
 const sameUnits=game.units.map(u=>({id:u.id,x:u.x,y:u.y,orders:u.orders}));
 game.world.resetPathProfile();game.resetSquadProfile();
 assert.equal(game.world.pathCalls,0);
 assert.equal(game.world.pathCostMs,0);
 assert.equal(game.world.pathVisitedNodes,0);
 assert.equal(game.squadUnitMs,0);
 assert.equal(game.squadCollisionMs,0);
 assert.equal(game.units,units);
 assert.deepEqual(game.units.map(u=>({id:u.id,x:u.x,y:u.y,orders:u.orders})),sameUnits);
});
