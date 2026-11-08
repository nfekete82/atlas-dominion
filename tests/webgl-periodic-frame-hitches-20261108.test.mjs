import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {nextPeriodicRefresh,WEBGL_REFRESH_MS} from '../scripts/webgl-frame-scheduling.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES,distance} from '../dist/src/reborn/config.js';

test('periodic UI/fog/minimap updates never coincide on a frame, with bounded delay',()=>{
 assert.deepEqual(WEBGL_REFRESH_MS,{fog:350,ui:280,minimap:700});
 let last={fog:0,ui:0,minimap:0};
 const counts={fog:0,ui:0,minimap:0};
 const delays={fog:0,ui:0,minimap:0};
 for(let frame=1;frame<=1800;frame++){
  const now=frame*1000/60;
  const old={...last};
  const due=nextPeriodicRefresh(now,last);
  if(due!==null){
   assert.ok(Object.hasOwn(last,due));
   assert.ok(now-last[due]>WEBGL_REFRESH_MS[due]);
   counts[due]++;
   delays[due]=Math.max(delays[due],now-last[due]-WEBGL_REFRESH_MS[due]);
   last[due]=now;
  }
  assert.deepEqual(Object.keys(last),Object.keys(old));
 }
 for(const task of Object.keys(counts)){
  assert.ok(counts[task]>=18,'cannot starve '+task);
  assert.ok(delays[task]<=1000/60*3,'refresh is bounded for '+task);
 }
 assert.equal(nextPeriodicRefresh(Number.NaN,last),null);
 assert.equal(nextPeriodicRefresh(Number.POSITIVE_INFINITY,last),null);
});

test('new HUD pacing remains opt-in to periodic work and force still refreshes all',()=>{
 const script=readFileSync('scripts/webgl-battlefield.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(script,/if\(force\)\s*\{\s*this\.updateFog\(\);this\.fogLast=now;/);
 assert.match(script,/this\.drawInterface\(\);this\.uiLast=now;/);
 assert.match(script,/this\.drawMinimap\(\);this\.miniLast=now;/);
 assert.match(script,/const due=nextPeriodicRefresh\(now,/);
 assert.match(script,/else if\(due==='minimap'\)/);
 assert.match(build,/cpSync\('scripts\/webgl-frame-scheduling\.js','dist\/webgl-frame-scheduling\.js'\)/);
 assert.ok(existsSync('dist/webgl-frame-scheduling.js'));
});

test('AI risk-field optimization remains bit-identical to old cell-center algorithm',()=>{
 const g=new Simulation(2074,23);
 const ai=g.tactical;
 const extra=[
  {id:30001,x:1694,y:2409,range:RULES.turret.range,seenAt:g.time,hp:900},
  {id:30002,x:2403,y:1790,range:RULES.turret.range,seenAt:g.time,hp:500},
 ];
 ai.state.knownTurrets=extra;
 ai.state.losses=[
  {id:40301,x:1850,y:1890,at:g.time,strength:1},
  {id:40302,x:1860,y:1910,at:g.time,strength:1},
 ];
 const zones=ai.zones();
 const w=g.world,ref=new Float32Array(RULES.grid**2);
 for(const z of zones)
  for(let y=Math.max(0,Math.floor((z.y-z.radius)/w.cell));y<=Math.min(RULES.grid-1,Math.floor((z.y+z.radius)/w.cell));y++)
   for(let x=Math.max(0,Math.floor((z.x-z.radius)/w.cell));x<=Math.min(RULES.grid-1,Math.floor((z.x+z.radius)/w.cell));x++){
    const i=y*RULES.grid+x,p=w.center(i),d=distance(p,z);
    if(d<=z.radius)ref[i]+=z.cost*(.65+.35*(1-d/z.radius));
   }
 const fast=ai.field();
 assert.equal(fast.length,ref.length);
 for(let i=0;i<fast.length;i++)assert.equal(fast[i],ref[i],'index '+i);
 assert.equal(ai.field(),fast,'reuse existing threat buffer within same tick');
});

test('AI planning measures its 3-second step without writing new save fields',()=>{
 const g=new Simulation(2074,19);
 let runs=0;
 g.tactical.plan=()=>{runs++;};
 g.time=28.5;
 g.think();
 assert.equal(runs,1);
 assert.equal(g.aiPlanCompletedAt,28.5);
 assert.ok(Number.isFinite(g.aiPlanDurationMs)&&g.aiPlanDurationMs>=0);
 const save=g.save();
 assert.equal(Object.hasOwn(save,'aiPlanDurationMs'),false);
 assert.equal(Object.hasOwn(save,'aiPlanCompletedAt'),false);
});

test('WebGL performance diagnostic exposes bounded slow-frame trace and AI duration',()=>{
 const perf=readFileSync('scripts/webgl-perf-watch.js','utf8');
 assert.match(perf,/this\.hitches\.length>32/);
 assert.match(perf,/aiPlanDurationMs/);
 assert.match(perf,/spikeHistory\(\)/);
 assert.match(perf,/this\.enabled/);
 assert.match(perf,/performance\.now\(\)-this\.started/);
});
