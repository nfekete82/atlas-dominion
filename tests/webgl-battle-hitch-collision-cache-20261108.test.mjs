import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {SandforgePerformanceWatch} from '../scripts/webgl-perf-watch.js';

test('static collision lists are allocated only once per 20Hz simulation tick',()=>{
 const game=new Simulation(2074,23);
 let queries=0;
 const original=game.obstacles.bind(game);
 game.obstacles=()=>{queries++;return original();};
 const first=game.movingColliders();
 assert.equal(queries,1);
 assert.equal(first.at,game.time);
 for(let i=0;i<50;i++)assert.strictEqual(game.movingColliders(),first);
 assert.equal(queries,1,'no repeat collider allocations for dozens of actors');
 assert.ok(first.vehicle.length>=first.buildings.length);
 assert.ok(first.infantry.length>=first.buildings.length);
 game.time+=.05;
 const second=game.movingColliders();
 assert.notStrictEqual(first,second);
 assert.equal(queries,2);
 assert.equal(second.at,game.time);
});

test('destroyed base invalidates cached collision footprints immediately',()=>{
 const game=new Simulation(2074,23);
 const before=game.movingColliders();
 const building=game.bases.find(b=>b.owner===1);
 assert.ok(building?.hp>0);
 const attacker=game.units.find(u=>u.owner===0);
 game.strike(attacker,building,1e9);
 assert.equal(building.hp,0);
 assert.equal(game.movementCollision,undefined);
 const after=game.movingColliders();
 assert.notStrictEqual(after,before);
 assert.ok(!after.buildings.some(b=>b.id===building.id));
 assert.equal(after.vehicle.some(b=>b.id===building.id),false);
});

test('separation uses one shared infantry/vehicle collider array, not one per pair',()=>{
 const source=readFileSync('src/reborn/simulation.ts','utf8');
 assert.match(source,/const separationInfantry=\[\.\.\.separationBuildings,\.\.\.separationInfantryFacade,\.\.\.separationTowers\]/);
 assert.match(source,/const separationVehicles=\[\.\.\.separationBuildings,\.\.\.separationVisual,\.\.\.separationDecor,\.\.\.separationTowers\]/);
 assert.match(source,/const colliders=unitSpec\(a\)\.group==='Fahrzeuge'\?separationVehicles:/);
 assert.match(source,/this\.movementCollision=undefined;target\.hp=0/);
});

test('real strategy simulation remains deterministic after collision memoization',()=>{
 const a=new Simulation(2074,23),b=new Simulation(2074,23);
 a.aiClock=b.aiClock=-10000;
 const idA=a.units.find(u=>u.owner===0&&u.kind==='engineer').id;
 const idB=b.units.find(u=>u.owner===0&&u.kind==='engineer').id;
 const point={kind:'move',x:a.world.size*.6,y:a.world.size*.55};
 assert.equal(a.command([idA],point),b.command([idB],point));
 for(let i=0;i<120;i++){a.step(.05);b.step(.05);}
 assert.deepEqual(a.save(),b.save());
});

test('opt-in profiler attributes expensive post-sync VFX separately from render and simulation',()=>{
 const originalLocation=globalThis.location,originalDocument=globalThis.document;
 try{
  globalThis.location={search:'?perf=1'};
  globalThis.document={createElement:()=>({style:{},setAttribute(){},textContent:''}),
   body:{append(){}}};
  const game={aiPlanCompletedAt:-1,aiPlanDurationMs:0,time:0,status:'playing',
   paused:false,units:[],notices:[]};
  const renderer={info:{render:{calls:4,triangles:12},memory:{geometries:1,textures:1}}};
  const effects={particleCount:0,emitters:[],stats:{blasts:0,wrecks:0}};
  const monitor=new SandforgePerformanceWatch({
   game,renderer,effects,groundTracks:{activeTracks:0}
  });
  assert.equal(monitor.enabled,true);
  monitor.begin(1200);
  monitor.simulation(4);
  monitor.presentation(3);
  monitor.effectsCost(8);
  monitor.auxiliary(12);
  monitor.render(2);
  monitor.end(1216);
  const s=monitor.snapshot();
  assert.equal(s.effectsP95,8);
  assert.equal(s.auxP95,12);
  assert.equal(s.renderP95,2);
  assert.equal(s.simP95,4);
  assert.equal(s.syncP95,3);
  assert.equal(typeof monitor.spikeHistory,'function');
  const code=readFileSync('scripts/webgl-preview.js','utf8');
  assert.match(code,/performanceWatch\.effectsCost\(performance\.now\(\)-beforeEffects\)/);
  assert.match(code,/performanceWatch\.auxiliary\(performance\.now\(\)-beforeAux\)/);
 }finally{
  if(originalLocation===undefined)delete globalThis.location;
  else globalThis.location=originalLocation;
  if(originalDocument===undefined)delete globalThis.document;
  else globalThis.document=originalDocument;
 }
});
