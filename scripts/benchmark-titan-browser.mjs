#!/usr/bin/env node
/** Real Chromium frames, separately from Node tick measurements. Both revisions
 * use the same UI/assets, paid tower policy, fixed initial world and CPU rate.
 * Example: node scripts/benchmark-titan-browser.mjs --before /tmp/atlas-titan-baseline --output /tmp/titan-browser.json */
import {chromium} from '../tests/browser/node_modules/@playwright/test/index.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>i%2?a:[...a,[v.slice(2),all[i+1]]],[]));
if(!args.before)throw Error('--before requires the immutable reference checkout/compiled archive');
const seconds=Number(args.seconds??8),cpu=Number(args.cpu??4),warmup=Number(args.warmup??240),seed=Number(args.seed??2026);
if(seconds<2||seconds>120||cpu<1||warmup<0||warmup>900)throw Error('Invalid measurement parameters');
const port=args.port??'8104',base=process.env.ATLAS_BASE_URL??`http://127.0.0.1:${port}`;
const output=resolve(args.output??'docs/benchmarks/titan-browser.json'),reference=resolve(args.before);
const policySource=(await readFile('scripts/tower-rush-opponent.mjs','utf8')).replace('export function rushPolicy','function rushPolicy');
const scenarios=[{map:'small',towers:1},{map:'medium',towers:1},{map:'large',towers:6}].filter(s=>!args.maps||args.maps.split(',').includes(s.map));
if(args.maps&&args.maps.split(',').some(m=>!['small','medium','large'].includes(m)))throw Error('Unknown browser map');
const report={complete:false,scope:'Chromium animation frames: rendered paid modern campaigns, including paid BLUE controller; excludes accelerated warmup',reference,environment:{seed,seconds,warmup,cpuThrottle:cpu,viewport:'1440x1000',dpr:1},results:[],errors:[]};
const persist=async()=>{await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');};
const server=process.env.ATLAS_BASE_URL?null:spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:port},stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,50));}
 browser=await chromium.launch({channel:process.env.ATLAS_BROWSER_CHANNEL??'chrome',headless:true});report.environment.browser=browser.version();
 for(const label of ['before','after'])for(const scenario of scenarios){
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  if(label==='before')await context.route('**/src/reborn/*.js',async route=>{
   const filename=new URL(route.request().url()).pathname.slice(1);
   try{await route.fulfill({contentType:'text/javascript',body:await readFile(join(reference,'dist',filename))});}
   catch{if(filename.endsWith('.worker.js'))await route.fulfill({contentType:'text/javascript',body:await readFile(join(reference,filename))});else throw Error('Missing immutable reference module '+filename);}
  });
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(`${label}/${scenario.map}: ${e.message}`));
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});
  await page.goto(`${base}/?debug&perf&perfTest&seed=${seed}&map=${scenario.map}`);await page.waitForFunction(()=>window.__reborn&&!document.querySelector('#loading'));
  const initial=await page.evaluate(async({policySource,towers})=>{
   const a=window.__reborn,g=a.game,{UNITS,BUILDINGS}=await import('/src/reborn/catalog.js');
   const initial=g.save();delete initial.ai;
   const rush={towersOrdered:0,blueTowerCredits:0,peakTowers:0,allTowersReadyAt:null,turretHits:0,turretDamage:0,immediateResponses:0,responseLatency:[]};
   const policy=new Function(`${policySource};return rushPolicy;`)()(towers,rush,UNITS);let ticks=0;
   // Same 60 fixed-tick / 3-second BLUE cadence as the Node tower benchmark.
   const step=g.step.bind(g);g.step=(dt)=>{if(!g.paused&&g.status==='playing'&&ticks++%60===0)policy(g);return step(dt);};
   window.__titanRush=rush;window.__titanWarmTo=to=>{g.paused=false;while(g.time+1e-8<to&&g.status==='playing')g.step();g.paused=true;};
   return {initial,catalog:{UNITS,BUILDINGS}};
  },{policySource,towers:scenario.towers});
  const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
  for(let t=10;t<=warmup;t+=10)await page.evaluate(t=>window.__titanWarmTo(t),t);
  if(warmup%10)await page.evaluate(t=>window.__titanWarmTo(t),warmup);
  const stats=await page.evaluate(async seconds=>{
   const a=window.__reborn,g=a.game,home=g.bases.find(b=>b.owner===0&&b.kind==='turret')??g.bases.find(b=>b.owner===0);
   if(home){a.renderer.camera.x=home.x;a.renderer.camera.y=home.y;a.renderer.boundCamera();}
   a.refresh();a.renderer.render(0);
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   a.profiler.reset();g.paused=false;
   const start=performance.now();await new Promise(resolve=>{function sample(now){if(now-start<seconds*1000)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});
   g.paused=true;return {stats:a.profiler.snapshot(),time:g.time,status:g.status,units:g.units.length,rush:window.__titanRush};
  },seconds);
  const result={label,...scenario,initialStateHash:hash(initial.initial),catalogHash:hash(initial.catalog),...stats};
  const pair=report.results.find(x=>x.map===scenario.map&&x.towers===scenario.towers);
  if(pair&&(pair.initialStateHash!==result.initialStateHash||pair.catalogHash!==result.catalogHash))throw Error('Unequal browser initial worlds/catalog');
  report.results.push(result);await persist();console.log(label,scenario.map,scenario.towers,'p95/p99',stats.stats.frameMs.p95.toFixed(2),stats.stats.frameMs.p99.toFixed(2),'paths',stats.stats.pathfinding.calls);
  await context.close();
 }
 if(report.errors.length)throw Error(report.errors.join('\n'));report.complete=true;await persist();
}finally{await browser?.close();server?.kill();}
