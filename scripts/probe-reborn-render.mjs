// Detailed diagnostic only: wrappers add overhead, so use the main benchmark for FPS.
import {chromium} from '../tests/browser/node_modules/@playwright/test/index.mjs';
import {setupScenario} from './reborn-performance-scenarios.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const label=process.argv[2]??'after',port=process.env.PERF_PORT??'8098',base=process.env.ATLAS_BASE_URL??`http://127.0.0.1:${port}`;
const server=process.env.ATLAS_BASE_URL?null:spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:port},stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,50));}
 browser=await chromium.launch({channel:process.env.ATLAS_BROWSER_CHANNEL??'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),cdp=await page.context().newCDPSession(page);
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:Number(process.env.PERF_CPU??4)});
 await page.goto(`${base}/?debug&perf&perfTest&seed=2026`);await page.waitForFunction(()=>window.__reborn);
 await page.evaluate(setupScenario,{name:'D-turret-battle'});
 const stats=await page.evaluate(async()=>{
  const {game:g,renderer:r}=window.__reborn,stats={};
  for(const [obj,key] of [[r,'render'],[r.units,'advance'],[r.units,'draw'],[r.units,'drawCorpses'],[r,'drawUnit'],[r,'drawBase'],[r,'paintSandWind'],[r,'paintCliffs'],[r.units.particles,'draw'],[r.context,'drawImage'],[r.context,'fillRect'],[r.context,'save'],[r.context,'restore'],[r.context,'stroke'],[r.context,'ellipse']]){
   const original=obj[key],label=(obj===r.context?'ctx.':obj===r.units?'units.':'')+key;stats[label]={calls:0,total:0,max:0};
   obj[key]=function(...args){const at=performance.now(),value=original.apply(this,args),t=performance.now()-at,s=stats[label];s.calls++;s.total+=t;s.max=Math.max(s.max,t);return value;};
  }
  await new Promise(done=>setTimeout(done,6000));g.paused=true;return stats;
 });
 await mkdir('docs/performance',{recursive:true});await writeFile(`docs/performance/render-${label}.json`,JSON.stringify(stats,null,2)+'\n');console.log(stats);
}finally{await browser?.close();server?.kill();}
