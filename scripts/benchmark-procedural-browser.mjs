#!/usr/bin/env node
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(new URL('../tests/browser/package.json',import.meta.url));
const {chromium}=require('playwright');
const browser=await chromium.launch({channel:process.env.ATLAS_BROWSER_CHANNEL??'chrome',headless:true});
const base=process.env.BATTLEFIELD_BASE_URL??'http://127.0.0.1:8133',before=process.env.BATTLEFIELD_REFERENCE_URL??'http://127.0.0.1:8128';
const rows=[],counts=(process.env.BATTLEFIELD_BENCH_COUNTS??'4,16').split(',').map(Number),repetitions=Number(process.env.BATTLEFIELD_BENCH_REPEATS??1);
const scenes=(process.env.BATTLEFIELD_BENCH_SCENES??'terrain,96-units').split(',');
try{
 for(let repeat=0;repeat<repetitions;repeat++)for(const count of counts)for(const scene of scenes)for(const profile of ['reference','open','dunes','rocky','oasis','mixed']){
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${profile==='reference'?before:base}/?bastions=${count}&seed=2074&pause=1&fog=off${profile==='reference'?'':'&terrain='+profile}`);
  await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded&&window.__sandforgeWebGL.desertArtReady);
  const row=await page.evaluate(async({scene,profile,count})=>{
   const a=window.__sandforgeWebGL,g=a.game,w=g.world,h=w.size/2;
   let x=h,y=h;
   if(scene==='96-units'){
    const home=g.startRegions[0].center;x=home.x;y=home.y;
    while(g.units.length<96){const i=g.units.length,kind=['infantry','tank','rover','heavy'][i%4];
     const p=w.nearest({x:home.x+(i%12-5.5)*55,y:home.y+(Math.floor(i/12)-3.5)*60},[],g.units);
     g.spawn(i%2,p,kind);}
   }
   a.controls.target.set(x-h,a.heightAt(x,y)+42,y-h);a.camera.position.copy(a.controls.target).add({x:1200,y:1110,z:1640});
   a.camera.zoom=.59;a.camera.updateProjectionMatrix();a.controls.update();a.battlefield.sync(true);
   // Let local GLB loading, material compilation and animation settle.
   await new Promise(resolve=>setTimeout(resolve,1200));
   const until=performance.now()+25000;
   while((a.battlefield.loadingCount||a.battlefield.modelQueue.length)&&performance.now()<until)await new Promise(resolve=>setTimeout(resolve,100));
   const intervals=[];let last;
   await new Promise(resolve=>{let frame=0;function sample(now){if(last!==undefined)intervals.push(now-last);last=now;if(++frame<121)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});
   intervals.sort((a,b)=>a-b);
   const gl=a.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
   return {count,scene,profile,seed:g.seed,version:w.mapVersion,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
    calls:a.renderer.info.render.calls,triangles:a.renderer.info.render.triangles,geometries:a.renderer.info.memory.geometries,textures:a.renderer.info.memory.textures,
    frameMedian:intervals[Math.floor(intervals.length*.5)],frameP95:intervals[Math.floor(intervals.length*.95)],
    detailedUnits:[...a.battlefield.units.values()].filter(e=>e.detail).length,
    heightfieldBytes:w.generated.battlefield?.heights.byteLength??0};
  },{scene,profile,count});
  rows.push({...row,repeat,errors});console.log(JSON.stringify(row));await page.close();
 }
}finally{await browser.close();}
mkdirSync('docs/qa/procedural-battlefields',{recursive:true});
writeFileSync(`docs/qa/procedural-battlefields/browser-performance${process.env.BATTLEFIELD_BENCH_SUFFIX??''}.json`,JSON.stringify({scope:'Apple Silicon Chrome; same seed, 1440×900, paused, .59 zoom, centered terrain or 96 visible units at the spawn; old PR #239 Docker reference vs new generator. RAF intervals are display-synchronized, not uncapped GPU timings.',rows},null,2)+'\n');
if(rows.some(r=>r.errors.length))process.exitCode=1;
