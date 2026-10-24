import {setupScenario} from './reborn-performance-scenarios.mjs';
import {chromium} from '../tests/browser/node_modules/@playwright/test/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {serialize} from 'node:v8';

const label=process.argv[2]??'after',seconds=Number(process.env.PERF_SECONDS??6),cpu=Number(process.env.PERF_CPU??4);
const port=process.env.PERF_PORT??'8098',base=process.env.ATLAS_BASE_URL??`http://127.0.0.1:${port}`;
const server=process.env.ATLAS_BASE_URL?null:spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:port},stdio:'ignore'});
const scenarios=['A-start','B-20-moving','C-50-moving','D-turret-battle','E-combined-ai','F-radio-events','G-camera-zoom','H-sidebar-production'];


let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,50));}
 browser=await chromium.launch({channel:process.env.ATLAS_BROWSER_CHANNEL??'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const page=await context.newPage(),session=await context.newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:cpu});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const result={label,environment:{browser:browser.version(),cpuThrottle:cpu,seconds,viewport:'1440x1000',dpr:1,seed:2026},scenarios:{},errors};
 for(const name of scenarios){
  await page.goto(`${base}/?debug&perf&perfTest&seed=2026`);
  await page.waitForFunction(()=>window.__reborn&& !document.querySelector('#loading'));
  await page.mouse.click(600,400);await page.evaluate(async()=>{await window.__reborn.audio.unlock();await window.__reborn.audio.radio.ready;});
  const fixture=await page.evaluate(setupScenario,{name});
  // Include the first movement tick: command bursts are precisely the spikes under test.
  const stats=await page.evaluate(async({name,seconds})=>{
   const a=window.__reborn,start=performance.now(),camera={...a.renderer.camera};let nextRadio=0;
   await new Promise(resolve=>{function sample(now){const elapsed=(now-start)/1000;
    if(name.startsWith('G')){a.renderer.camera.x=camera.x+Math.sin(elapsed*2)*240;a.renderer.camera.y=camera.y+Math.cos(elapsed*2)*150;a.renderer.camera.zoom=.8+Math.sin(elapsed)*.25;a.renderer.boundCamera();}
    if(name.startsWith('F')&&elapsed>=nextRadio){nextRadio+=.4;for(const [kind,unit] of [['move','infantry'],['attack','tank'],['heal','medic'],['stop','infantry']])a.audio.radio.request(kind,unit);}
    if(elapsed<seconds)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});
   a.game.paused=true;return {...a.profiler.snapshot(),audio:{...a.audio.radio.stats,active:a.audio.radio.active,peakVoices:a.audio.peakVoices,limit:a.audio.voiceLimit}};
  },{name,seconds});
  // Fresh deterministic fixture: hashes catch changes to simulation/AI/save semantics.
  await page.goto(`${base}/?debug&perf&perfTest&seed=2026`);await page.waitForFunction(()=>window.__reborn&&!document.querySelector('#loading'));
  const fixed=await page.evaluate(setupScenario,{name,fixed:true});
  const stateHash=createHash('sha256').update(serialize(fixed.save)).digest('hex');
  result.scenarios[name]={fixture,...stats,fixedTicks:{ticks:120,stateHash,phases:fixed.stats.phases,pathfinding:fixed.stats.pathfinding}};
  await mkdir('docs/performance',{recursive:true});await writeFile(`docs/performance/${label}.json`,JSON.stringify(result,null,2)+'\n');
  console.log(`${name}: p95 ${stats.frameMs.p95.toFixed(1)}, p99 ${stats.frameMs.p99.toFixed(1)}, >50 ${stats.over50}; tick max ${fixed.stats.phases.simulation.maxMs.toFixed(1)} ms`);
 }
 if(errors.length)throw Error(errors.join('\n'));
 await mkdir('docs/performance',{recursive:true});await writeFile(`docs/performance/${label}.json`,JSON.stringify(result,null,2)+'\n');
}finally{await browser?.close();server?.kill();}
