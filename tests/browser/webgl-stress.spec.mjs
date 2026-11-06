import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const artifactRoot=fileURLToPath(new URL('./artifacts/stress/',import.meta.url));
const sizes=[4,8,12,16];
const readHeap=async cdp=>{
 const result=await cdp.send('Performance.getMetrics');
 return +(((result.metrics.find(m=>m.name==='JSHeapUsedSize')?.value??0)/1048576).toFixed(2));
};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const round=(n)=>Math.round(n*100)/100;

for(const bastions of sizes)test('WebGL combat lifecycle '+bastions+' bastions: frames, heap and post-battle recovery',async({page})=>{
 test.setTimeout(220000);
 const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/?bastions='+bastions+'&seed=2074&play=1&lite=1&perf=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:120000});
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Performance.enable');
 const collect=async(label)=>{
  const values=await page.evaluate(()=>{
   const view=window.__sandforgeWebGL,stats=view.performance.snapshot();
   return {...stats,sceneChildren:view.scene.children.length,
    gameTime:view.game.time,simulationRunning:view.simulationRunning,
    renderedFrames:view.renderer.info.render.frame};
  });
  return {label,...values,heapMB:await readHeap(cdp)};
 };
 await page.waitForTimeout(3600);
 const before=await collect('idle');

 // Real Simulation.spawn/command APIs create a repeatable synthetic battle
 // without changing any authoritative balance constants or map geometry.
 const fight=await page.evaluate(bastions=>{
  const v=window.__sandforgeWebGL,g=v.game;
  const first=g.units.find(u=>u.owner===0&&u.hp>0);
  if(!first)throw Error('No player unit at start');
  const anchor=g.world.nearest({x:(first.x+g.world.size/2)/2,
    y:(first.y+g.world.size/2)/2},
   [...g.obstacles(),...g.bastionColliders()]);
  if(!anchor)throw Error('No central safe battle location');
  const ids=[[],[]];
  for(const owner of [0,1])for(let i=0;i<6+bastions;i++){
   const p=g.world.nearest({
    x:anchor.x+(owner===0?-165:165)+(owner===0?-1:1)*Math.floor(i/5)*17,
    y:anchor.y+((i%5)-2)*29+Math.floor(i/5)*9},
    [...g.obstacles(),...g.bastionColliders()]);
   if(!p)throw Error('Unable to locate synthetic combat unit '+owner+'/'+i);
   const type=i%9===0?'tank':i%6===0?'heavy':'infantry';
   ids[owner].push(g.spawn(owner,p,type).id);
  }
  for(const owner of [0,1])g.command(ids[owner],{
   x:anchor.x+(owner===0?220:-220),y:anchor.y,kind:'attackMove'});
  g.updateVision();
  // Observe the actual combat zone, not a quiet corner of a larger map.
  const focus=v.battlefield.pos(anchor.x,anchor.y);
  const delta=focus.clone().sub(v.controls.target);
  v.controls.target.add(delta);v.camera.position.add(delta);
  v.controls.update();
  return {ids,anchor,spawned:ids[0].length+ids[1].length};
 },bastions);

 await page.waitForTimeout(10000);
 const battle=await collect('battle');
 const combat=await page.evaluate(({ids})=>{
  const v=window.__sandforgeWebGL,g=v.game,known=new Set(ids.flat());
  const alive=g.units.filter(u=>known.has(u.id)&&u.hp>0);
  return {alive:alive.length,combatUnits:g.units.length,
   visibleFx:v.effects.particleCount,blasts:v.effects.stats.blasts};
 },fight);
 // Simulate the end of a heavy fight and verify that the renderer recovers
 // when battle actors disappear and their visual effects have had time to decay.
 await page.evaluate(({ids})=>{
  const g=window.__sandforgeWebGL.game,known=new Set(ids.flat());
  for(const u of g.units)if(known.has(u.id))u.hp=0;
 },fight);
 await page.waitForTimeout(9500);
 const after=await collect('post-battle');

 const report={kind:'WebGL Chromium software-rendered workload',
  bastions,seed:2074,fixture:{spawned:fight.spawned,...combat},
  before,battle,after,errors,
  warningThresholds:{postFrameP95Ratio:3,postHeapDeltaMB:160}};
 report.warnings=[
  ...(after.frameP95>Math.max(50,before.frameP95*3)
    ?['post-battle frame p95 notably above pre-battle baseline']:[]),
  ...(after.heapMB-before.heapMB>160
    ?['post-battle JS heap increase >160 MB; review allocation history']:[]),
  ...(before.fps<5
    ?['GitHub software WebGL baseline under 5 FPS; absolute FPS is NOT representative of hardware GPU performance']:[])
 ];
 await mkdir(artifactRoot,{recursive:true});
 await writeFile(fileURLToPath(new URL('./artifacts/stress/webgl-'+bastions+'.json',import.meta.url)),
  JSON.stringify(report,null,2)+'\n');
 await page.screenshot({path:fileURLToPath(new URL('./artifacts/stress/webgl-'+bastions+'.png',import.meta.url))});
 console.log('[webgl stress]',bastions+' bastions',
  'FPS idle/battle/post='+[before.fps,battle.fps,after.fps].map(round).join('/'),
  'frame p95='+[before.frameP95,battle.frameP95,after.frameP95].map(round).join('/'),
  'draw='+[before.drawCalls,battle.drawCalls,after.drawCalls].join('/'),
  'heap='+[before.heapMB,battle.heapMB,after.heapMB].join('/'),
  'warnings='+report.warnings.length);

 expect(errors).toEqual([]);
 expect(fight.spawned).toBe(2*(6+bastions));
 for(const result of [before,battle,after]){
  expect(result.simulationRunning).toBe(true);
  expect(result.fps).toBeGreaterThan(0);
  expect(result.frameP95).toBeGreaterThan(0);
  expect(result.drawCalls).toBeGreaterThan(0);
  expect(result.sceneChildren).toBeGreaterThan(0);
  expect(result.heapMB).toBeGreaterThan(0);
 }
 expect(battle.gameTime).toBeGreaterThan(before.gameTime);
 expect(after.gameTime).toBeGreaterThan(battle.gameTime);
 // CPU-only Chromium may render this 3D scene at 1-3 FPS even at idle.
 // A fixed 500ms limit would fail when the *post-battle* FPS improved.
 // Gate only a catastrophic relative regression against this same runner.
 expect(after.frameP95).toBeLessThan(Math.max(1250,before.frameP95*2.5));
 expect(after.heapMB).toBeLessThan(1100);
});
