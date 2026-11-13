import {test} from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/src/reborn/world.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('unreachable goal behind fully closed dynamic ring stops bounded A* before 54,000 expansions',()=>{
 const world=new World(3035439572,24,'open');
 const goal={...world.generated.sites[0]};
 const from={x:goal.x+450,y:goal.y};
 const blockers=Array.from({length:20},(_,i)=>{
  const a=i*Math.PI/10;
  return {x:goal.x+145*Math.cos(a),y:goal.y+145*Math.sin(a),radius:62};
 });
 assert.ok(world.walkable(from,blockers),'source must be free');
 assert.ok(world.walkable(goal,blockers),'target itself free but surrounded by dynamic buildings');
 assert.equal(world.line(from,goal,blockers),false,'all straight lines to ring blocked');
 world.profilePaths=true;
 world.resetPathProfile();
 const strategic=world.path(from,goal,blockers,0,undefined,false,false,false);
 assert.deepEqual(strategic,[],'a strategic reachability check must never mistake a partial route for target access');
 assert.ok(world.pathVisitedNodes<=4200,
  'strategic search must not traverse whole 57,600-cell map');
 assert.ok(world.pathMaxMs>=0);
 world.resetPathProfile();
 const partial=world.path(from,goal,blockers,0,undefined,false,false,true);
 assert.ok(world.pathVisitedNodes<=2600,
  'unit movement is limited to 2600 expanded nodes');
 // Every partial waypoint is a physically passable path segment.
 let last=from;
 for(const next of partial){
  assert.equal(world.line(last,next,blockers),true,
   'partial search must never permit clipping through buildings or cliffs');
  last=next;
 }
 assert.ok(!partial.length||Math.hypot(last.x-goal.x,last.y-goal.y)>80,
  'an unreachable ring cannot be entered by partial route');
 world.resetPathProfile();
 const exact=world.path(from,goal,blockers,0,undefined,false,true,true);
 assert.ok(world.pathVisitedNodes<=1600,
  'exact-path retry must also be bounded; previously it doubled frame freezes');
 last=from;
 for(const next of exact){
  assert.equal(world.line(last,next,blockers),true);
  last=next;
 }
});

test('normal reachable route still completes exactly at requested destination',()=>{
 const world=new World(2074,24,'open');
 const goal={...world.generated.sites[0]},from={x:goal.x-220,y:goal.y};
 assert.ok(world.walkable(from));
 assert.ok(world.walkable(goal));
 world.profilePaths=true;world.resetPathProfile();
 const p=world.path(from,goal,[],0,undefined,false,false,true);
 assert.ok(p.length,'passable direct routes cannot be truncated');
 assert.deepEqual(p.at(-1),goal);
 assert.equal(world.line(from,goal),true);
 assert.ok(world.pathVisitedNodes<=2600);
});

test('legacy campaign maps retain original unlimited path search behaviour',()=>{
 const oldWorld=new World(2074,19);
 const modern=new World(2074,24,'open');
 const sourceCode=source('src/reborn/world.ts');
 assert.match(sourceCode,/this\.mapVersion>=23/);
 assert.match(sourceCode,/\:Infinity/);
 assert.ok(oldWorld.generated.battlefield===undefined);
 assert.equal(modern.generated.battlefield.generatorVersion,2);
});

test('real simulation only uses bounded progress for actual movement, not AI reachability',()=>{
 const simSource=source('src/reborn/simulation.ts');
 const aiSource=source('src/reborn/tactical-ai.ts');
 assert.match(simSource,/this\.world\.path\(u,target,routeObstacles,clearance,risk,spec\.flying,u\.exactPath,true\)/);
 assert.match(simSource,/this\.world\.path\(u,target,routeObstacles,clearance,risk,false,true,true\)/);
 assert.match(simSource,/this\.world\.mapVersion>=23\?2\.8:1\.4/);
 assert.match(aiSource,/this\.g\.world\.path\(from,to,this\.obstacles\(\),5,this\.field\(\)\)/);
 const game=new Simulation(20261111,24);
 assert.equal(game.world.mapVersion,24);
 assert.equal(game.world.generated.battlefield.generatorVersion,2);
});
