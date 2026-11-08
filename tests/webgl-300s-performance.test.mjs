import test from 'node:test';
import assert from 'node:assert/strict';
import {SandforgePerformanceWatch} from '../scripts/webgl-perf-watch.js';

test('opt-in profiler records bounded 15-second evidence beyond 300 seconds without retaining scene objects',()=>{
 const locationBefore=globalThis.location;
 try{
  globalThis.location={search:''}; // no DOM in Node; enable after setup
  const game={time:0,status:'playing',paused:false,units:[],notices:[]};
  const battlefield={scene:{children:[{id:1}]},units:new Map(),selectedRings:new Map()};
  const renderer={info:{render:{calls:24,triangles:300000},memory:{geometries:111,textures:31}}};
  const effects={particleCount:0,emitters:[],stats:{blasts:0,wrecks:0}};
  const groundTracks={activeTracks:0};
  const watch=new SandforgePerformanceWatch({game,renderer,effects,groundTracks,battlefield});
  watch.enabled=true;watch.element={textContent:''};watch.lastRender=0;
  for(let second=1;second<=360;second++){
   game.time=second;
   watch.begin(second*1000);
   watch.simulation(2.5);
   watch.presentation(3.2);
   watch.render(1.3);
   watch.end(second*1000);
  }
  const history=watch.history();
  assert.ok(history.some(x=>x.clock>=60&&x.clock<=75));
  assert.ok(history.some(x=>x.clock>=180&&x.clock<=195));
  assert.ok(history.some(x=>x.clock>=300&&x.clock<=315));
  assert.ok(history.length<=64,'bounded even after hundreds of game seconds');
  assert.ok(history.every(x=>x.geometries===111&&x.textures===31));
  assert.ok(history.every(x=>x.syncP95>0&&x.simP95>0&&x.renderP95>0));
  assert.ok(history.every(x=>x.sceneChildren===1&&x.actors3d===0));
  const copy=watch.history();copy[0].clock=99999;
  assert.notEqual(watch.history()[0].clock,99999,'snapshots are read-only copies');
  assert.ok(JSON.stringify(history).length<50000,'no WebGL objects held in history');
  game.time=2;watch.begin(361000);watch.end(361000);
  assert.ok(watch.history().every(x=>x.clock<300),'time reset drops stale history');
 }finally{
  if(locationBefore===undefined)delete globalThis.location;
  else globalThis.location=locationBefore;
 }
});

test('GPU selection rings are disposed when deselected, not merely removed from the scene',async()=>{
 const {readFileSync}=await import('node:fs');
 const js=readFileSync(new URL('../scripts/webgl-battlefield.js',import.meta.url),'utf8');
 const block=js.slice(js.indexOf('updateSelectionRings(){'),js.indexOf('// Selection is the source of truth'));
 assert.match(block,/this\.scene\.remove\(ring\)/);
 assert.match(block,/ring\.geometry\.dispose\(\)/);
 assert.match(block,/ring\.material\.dispose\(\)/);
});
