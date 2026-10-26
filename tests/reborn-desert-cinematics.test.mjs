import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {createDesertInfrastructure} from '../dist/src/reborn/desert-infrastructure.js';
import {BattlefieldEffects} from '../dist/src/reborn/battlefield-atmosphere.js';

test('wilderness routes and roadside props are deterministic and never block map geometry',()=>{
 for(const version of [0,2,3,4,5]){
  const sim=new Simulation(75310,version);
  const sites=sim.territories.map(t=>t.point);
  const a=createDesertInfrastructure(sim.world,sites);
  const b=createDesertInfrastructure(sim.world,sites);
  assert.deepEqual(a,b,'same seed must produce same routes and props');
  assert.ok(a.roads.length>=2,'expected meaningful sandy routes on map '+version);
  assert.ok(a.props.length<=38,'roadside object budget');
  for(const prop of a.props){
   const idx=sim.world.index(prop);
   assert.ok(idx>=0&&!sim.world.blocked[idx],'blocked prop on map '+version);
   assert.ok(sites.every(s=>Math.hypot(s.x-prop.x,s.y-prop.y)>=110),'prop obscures capture point on map '+version);
  }
  for(const road of a.roads)assert.ok(road.width>=38&&road.width<=53);
 }
});

test('moving wheeled and tracked vehicles make finite marks; idle and aircraft do not',()=>{
 const game=new Simulation(75310,2);
 game.units=[];game.aiClock=-1e8;
 const rover=game.spawn(0,{x:1200,y:1350},'rover');
 const tank=game.spawn(0,{x:1250,y:1300},'tank');
 const flying=game.spawn(0,{x:1280,y:1320},'scout');
 const fx=new BattlefieldEffects();
 fx.reset(game);
 game.time=.2;
 rover.x+=25;tank.x+=26;flying.x+=30;
 fx.update(game,()=>true);
 assert.equal(fx.trackCount,2,'rover and tank should leave ground marks, helicopter should not');
 const retained=fx.trackCount;
 game.time=.3;fx.update(game,()=>true);
 assert.equal(fx.trackCount,retained,'stationary units must not spawn marks');
 for(let i=0;i<1000;i++){
  rover.x+=14;game.time+=.2;fx.update(game,()=>true);
 }
 assert.ok(fx.trackCount<=660,'tracks remain bounded in long battles');
 game.time+=181;fx.update(game,()=>true);
 assert.equal(fx.trackCount,0,'old tracks weather away');
 fx.reset(game);assert.equal(fx.trackCount,0);
});

test('rocket and destroyed vehicle explosions stay bounded and do not affect authoritative save data',()=>{
 const game=new Simulation(2026,2),snapshot=game.save();
 const fx=new BattlefieldEffects();fx.reset(game);
 for(let i=0;i<38;i++)fx.blast({x:500+i,y:700},game.time);
 assert.equal(fx.burstCount,18);
 assert.ok(fx.smokeCount<=32);
 assert.deepEqual(game.save(),snapshot);
 game.time=2;fx.update(game,()=>true);
 assert.equal(fx.burstCount,0);
 game.time=190;fx.update(game,()=>true);
 assert.equal(fx.smokeCount,0);
});
