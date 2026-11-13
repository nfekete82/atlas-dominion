import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {HIGH_GROUND_SIGHT_MULTIPLIER} from '../dist/src/reborn/rolling-hills.js';
import {RULES} from '../dist/src/reborn/config.js';

const game=()=>{
 const g=new Simulation(2074,19);
 g.highGroundEnabled=false;
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 // Simulate a real, gentle high-ground plateau using the same actual
 // height/slope interfaces as production generated terrain.
 g.world.terrainHeight=()=>68;
 g.world.terrainSlope=()=>.04;
 g.tactical.observe=()=>{};
 return g;
};
test('ground infantry, rocket soldiers and tanks get a modest +16% high-ground sight bonus',()=>{
 const g=game();
 assert.equal(HIGH_GROUND_SIGHT_MULTIPLIER,1.16);
 for(const kind of ['infantry','rocket','tank','rover']){
  const u={kind,owner:0,x:g.world.size*.5,y:g.world.size*.5};
  const before=g.sight(u);
  g.highGroundEnabled=true;
  assert.ok(g.onHighGround(u),kind);
  assert.ok(Math.abs(g.sight(u)/before-1.16)<1e-12,kind);
  g.highGroundEnabled=false;
 }
});
test('no hill advantage for aircraft, slopes or flat/low terrain',()=>{
 const g=game();
 const u={kind:'infantry',owner:0,x:g.world.size*.5,y:g.world.size*.5};
 const airborne={...u,kind:'scout'};
 const airBase=g.sight(airborne),footBase=g.sight(u);
 g.highGroundEnabled=true;
 assert.equal(g.sight(airborne),airBase);
 g.world.terrainHeight=()=>15;
 assert.equal(g.sight(u),footBase);
 g.world.terrainHeight=()=>68;g.world.terrainSlope=()=>.25;
 assert.equal(g.sight(u),footBase);
 g.world.terrainSlope=()=>.04;
 assert.ok(g.sight(u)>footBase);
 g.highGroundEnabled=false;
 assert.equal(g.sight(u),footBase,'classic/headless simulation remains unchanged');
});
test('Fog of War expands on high ground but still respects opaque cliffs',()=>{
 const g=game(),u=g.units.find(u=>u.owner===0&&!u.carrier&&!['scout','bomber'].includes(u.kind));
 assert.ok(u);
 u.x=g.world.size*.5;u.y=g.world.size*.5;
 g.units=[u];g.bases=[];for(const t of g.territories)t.owner=1;
 g.updateVision();
 const old=g.visible[0].reduce((n,x)=>n+x,0);
 g.highGroundEnabled=true;
 g.updateVision();
 const expanded=g.visible[0].reduce((n,x)=>n+x,0);
 assert.ok(expanded>old,'new cells are visible from an elevated observation point');
 // An opaque continuous ridge still blocks cells behind it, despite
 // the range bonus and the vision cache's clear-rectangle optimization.
 const gx=Math.floor(u.x/g.world.cell)+2;
 const gy=Math.floor(u.y/g.world.cell);
 for(let y=0;y<RULES.grid;y++)g.world.opaque[y*RULES.grid+gx]=1;
 g.updateVision();
 const behind={x:(gx+4)*g.world.cell,y:(gy+.5)*g.world.cell};
 assert.equal(g.canSee(0,behind),false);
 g.highGroundEnabled=false;
 g.world.opaque.fill(0);
 g.updateVision();
 assert.equal(g.visible[0].reduce((n,x)=>n+x,0),old,
  'cache shrinks visibility after leaving elevated terrain');
});
