import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../dist/src/reborn/world.js';
import {PerformanceRecorder,profiler,setProfiler} from '../dist/src/reborn/performance.js';

const references=JSON.parse(readFileSync(new URL('./fixtures/reborn-navigation-reference.json',import.meta.url)));
test('performance: A* preserves exact legacy/generated, weighted, vehicle and air routes',()=>{
 for(const c of references){const w=new World(2026,c.mapVersion),risk=c.weighted?new Float32Array(w.blocked.length):undefined;
  if(risk)for(let i=0;i<risk.length;i++){const p=w.center(i);if(Math.hypot(p.x-1900,p.y-1900)<650)risk[i]=12;}
  assert.deepEqual(w.path(c.start,c.target,c.obstacles,c.clearance,risk,c.air),c.path);
  // Workspace reuse must neither corrupt retained routes nor retain walkability.
  w.path(c.target,c.start,[],0);assert.deepEqual(w.path(c.start,c.target,c.obstacles,c.clearance,risk,c.air),c.path);
 }
});

test('performance: subsequent paths observe changed terrain and building obstacles',()=>{
 const w=new World();w.blocked.fill(0);const from={x:1200,y:1200},to={x:1800,y:1200};
 assert.deepEqual(w.path(from,to,[],12),[to]);
 const blocker={x:1500,y:1200,radius:100},detour=w.path(from,to,[blocker],12);assert.ok(detour.length>1);
 assert.deepEqual(w.path(from,to,[],12),[to]);
 for(let y=0;y<240;y++)w.blocked[y*240+95]=1;
 assert.deepEqual(w.path(from,to,[],12),[]);
 assert.ok(detour.length>1,'returned paths own their data');
});

test('performance: disabled by default, percentiles and 1% low use uncapped frame intervals',()=>{
 assert.equal(profiler,null);const p=new PerformanceRecorder(false);setProfiler(p);
 let now=100;p.beginFrame(now);p.endFrame(now);
 for(const duration of [10,20,40,60,120]){now+=duration;p.beginFrame(now);p.record('simulation',3);p.record('pathfinding',1,25);p.endFrame(now);}
 const s=p.snapshot();assert.equal(s.frames,5);assert.equal(s.frameMs.p50,40);assert.equal(s.frameMs.p95,120);assert.equal(s.frameMs.p99,120);
 assert.equal(s.fps,20);assert.equal(s.low1Fps,1000/120);assert.equal(s.over33,3);assert.equal(s.over50,2);assert.equal(s.over100,1);
 assert.equal(s.phases.simulation.meanMs,3);assert.deepEqual(s.pathfinding,{calls:5,nodes:125});
 p.reset();assert.equal(p.snapshot().frames,0);assert.equal(p.snapshot().pathfinding.calls,0);p.dispose();setProfiler(null);
});

test('performance: frame history is bounded and profiling leaves path results unchanged',()=>{
 const p=new PerformanceRecorder(false);let now=100;
 for(let i=0;i<4000;i++){p.beginFrame(now);p.endFrame(now);now+=10;}
 assert.equal(p.snapshot().frames,3600);assert.equal(p.snapshot().frameMs.p99,10);
 const w=new World(),c=references[0],before=w.path(c.start,c.target,c.obstacles,c.clearance);setProfiler(p);
 assert.deepEqual(w.path(c.start,c.target,c.obstacles,c.clearance),before);assert.ok(p.snapshot().pathfinding.nodes>0);setProfiler(null);p.dispose();
});
