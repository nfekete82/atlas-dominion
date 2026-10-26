import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BattlefieldEffects,createGroundDetails} from '../dist/src/reborn/battlefield-atmosphere.js';

test('battlefield decor: deterministic, varied, traversable and away from capture sites',()=>{
 for(const version of [0,2,3,4,5]){
  const game=new Simulation(75310,version),sites=[...game.territories.map(t=>t.point),...game.bases.filter(b=>b.kind==='headquarters')];
  const a=createGroundDetails(game.world,sites),b=createGroundDetails(game.world,sites);
  assert.deepEqual(a,b,'regenerating the map must preserve every decorative placement');
  assert.ok(a.length>100,'terrain should not be empty');
  const kinds=new Set(a.map(d=>d.kind));
  for(const type of ['stones','rock','crater','palm'])assert.ok(kinds.has(type),'missing '+type);
  for(const d of a){
   assert.ok(game.world.index(d)>=0&&!game.world.blocked[game.world.index(d)],'decoration placed on a blocked path');
   assert.ok(sites.every(p=>Math.hypot(d.x-p.x,d.y-p.y)>=(d.kind==='palm'?125:92)+d.radius),'decoration overlaps a control point');
  }
 }
});

test('battlefield FX: capped marks and smoke, no impact on simulation saves',()=>{
 const game=new Simulation(),state=game.save(),fx=new BattlefieldEffects();
 fx.reset(game);
 for(let i=0;i<800;i++)fx.impact({x:400+i*.05,y:800},game.time);
 assert.equal(fx.markCount,96,'old craters are capped');
 fx.blast({x:300,y:300},game.time);
 assert.equal(fx.markCount,96,'rocket explosions also respect the cap');
 assert.ok(fx.smokeCount>0&&fx.smokeCount<=32,'smoke is bounded');
 assert.deepEqual(game.save(),state,'visual effects must not mutate simulation state');
 game.time=100;fx.update(game,()=>true);
 assert.equal(fx.smokeCount,0,'expired smoke should be discarded');
 fx.reset(game);assert.equal(fx.markCount,0);assert.equal(fx.smokeCount,0);
});
