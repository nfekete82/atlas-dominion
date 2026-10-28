// Paired browser measurement using the existing profiler and identical seeded armies.
import {chromium} from '../tests/browser/node_modules/@playwright/test/index.mjs';
import {setupScenario} from './reborn-performance-scenarios.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const base=process.env.ATLAS_BASE_URL??'http://127.0.0.1:8095';
const label=process.argv[2]??'gameplay-weather',seconds=Number(process.env.PERF_SECONDS??5);
const browser=await chromium.launch({channel:process.env.ATLAS_BROWSER_CHANNEL??'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2});
 const page=await context.newPage(),cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const results={label,revision:process.env.PERF_REVISION??'working-tree',environment:{browser:browser.version(),viewport:'1440x900',dpr:2,cpuThrottle:4,seconds,seed:2026},scenarios:{},errors:[]};page.on('pageerror',e=>results.errors.push(e.message));
 for(const [scenario,weather] of [['C-50-moving',false],['E-combined-ai',false],['E-combined-ai',true]]){
  await page.goto(`${base}/?debug&perf&perfTest&seed=2026`);await page.waitForFunction(()=>window.__reborn&&!document.querySelector('#loading'));
  await page.evaluate(setupScenario,{name:scenario});
  const supported=await page.evaluate(storm=>{
   const a=window.__reborn,g=a.game;if(storm){if(!g.weather)return false;g.time=g.weather.endsAt+12+8;g.weather.update(g.time);g.updateVision();}
   a.profiler.reset();g.paused=false;return true;
  },weather);
  if(!supported){results.scenarios[scenario+'-storm']={unavailable:true};continue;}
  await page.waitForTimeout(seconds*1000);
  const stats=await page.evaluate(()=>{const a=window.__reborn;a.game.paused=true;return {...a.profiler.snapshot(),units:a.game.units.length,weather:a.game.weather?.phase??'CLEAR'};});
  const key=scenario+(weather?'-storm':'-clear');results.scenarios[key]=stats;
  console.log(`${key}: frame p95=${stats.frameMs.p95.toFixed(2)}ms, render mean=${stats.phases.render.meanMs.toFixed(2)}ms, simulation mean=${stats.phases.simulation.meanMs.toFixed(2)}ms, paths=${stats.pathfinding.calls}`);
 }
 await mkdir('docs/performance',{recursive:true});await writeFile(`docs/performance/${label}.json`,JSON.stringify(results,null,2)+'\n');if(results.errors.length)throw Error(results.errors.join('\n'));
}finally{await browser.close();}
