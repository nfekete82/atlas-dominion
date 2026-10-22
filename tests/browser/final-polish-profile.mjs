import {chromium} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const phase=process.argv[2]??'before';
const profiling=!process.argv.includes('--no-profile');
const out=new URL('../../docs/qa/final-polish-20261022/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const interval=window.setInterval.bind(window);window.__cycles=[];
  window.setInterval=(fn,ms,...args)=>interval(typeof fn==='function'&&ms===250?function(...values){
   const start=performance.now();const value=fn(...values);
   if(performance.now()-start>1)window.__cycles.push({start,end:performance.now()});return value;
  }:fn,ms,...args);
 });
 await page.goto((process.env.ATLAS_BASE_URL??'http://127.0.0.1:8097')+'/?debug');
 await page.locator('[data-country="DE"]').click();
 const snapshot=JSON.parse(await readFile(new URL('../../docs/qa/deep-game-20261022/render-fixture.json',import.meta.url),'utf8'));
 await page.evaluate(async snapshot=>{
  const {Game}=await import('/src/engine/game.js');const api=window.__atlas,g=api.getGame();
  Object.assign(g,Game.fromSave(snapshot));g.paused=true;api.renderer.setGame(g);api.refresh();
  const u=g.squads.find(u=>g.squads.some(e=>e.owner!==u.owner&&Math.abs(e.index%480-u.index%480)+Math.abs(Math.floor(e.index/480)-Math.floor(u.index/480))<=4))??g.squads[0];
  api.renderer.focusOnPoint({x:u.index%480,y:Math.floor(u.index/480)},3);
 },snapshot);
 await page.waitForTimeout(350);
 const overlay=await page.evaluate(async()=>{
  const canvas=window.__atlas.renderer.overlay,context=canvas.getContext('2d');
  const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const r=window.__atlas.renderer,times=[];
  for(let i=0;i<5;i++)r.updateTerritory();
  for(let i=0;i<20;i++){const start=performance.now();r.updateTerritory();times.push(performance.now()-start);}
  times.sort((a,b)=>a-b);
  return {hash,png:canvas.toDataURL(),update:{samples:times.length,median:times[10],p95:times[19]}};
 });
 await writeFile(new URL(phase+'-overlay.png',out),Buffer.from(overlay.png.split(',')[1],'base64'));delete overlay.png;
 const cdp=await page.context().newCDPSession(page);
 if(profiling){await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:100});await cdp.send('Profiler.start');}
 const metrics=await page.evaluate(async()=>{
  const {getGame,renderer:r}=window.__atlas,g=getGame(),tick=g.tick;
  const methods={step:[],updateTerritory:[],frame:[]},originals=[];
  for(const [obj,name] of [[g,'step'],[r,'updateTerritory'],[r,'frame']]){
   const original=obj[name];originals.push(()=>obj[name]=original);
   obj[name]=function(...args){const start=performance.now(),result=original.apply(this,args);methods[name].push({start,end:performance.now()});return result;};
  }
  window.__cycles.length=0;const frames=[];let previous;
  g.paused=false;
  await new Promise(resolve=>{
   const sample=t=>{if(previous!==undefined)frames.push({start:previous,end:t,ms:t-previous});previous=t;
    if(frames.length===360)resolve();else requestAnimationFrame(sample);};requestAnimationFrame(sample);
  });
  g.paused=true;originals.forEach(restore=>restore());
  const q=a=>{a.sort((x,y)=>x-y);return {samples:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)]};};
  const cycles=window.__cycles,slow=frames.filter(f=>f.ms>25);
  return {ticks:g.tick-tick,methods:Object.fromEntries(Object.entries(methods).map(([n,v])=>[n,q(v.map(e=>e.end-e.start))])),
   cycle:q(cycles.map(e=>e.end-e.start)),raf:q(frames.map(f=>f.ms)),slowFrames:slow.length,
   slowFramesOverlappingCycle:slow.filter(f=>cycles.some(c=>c.start<f.end&&c.end>f.start)).length,cycles,frames};
 });
 const {profile}=profiling?await cdp.send('Profiler.stop'):{profile:{nodes:[],samples:[],timeDeltas:[]}};
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map();for(const n of profile.nodes)for(const child of n.children??[])parents.set(child,n.id);
 const self=new Map(),total=new Map();
 for(let i=0;i<profile.samples.length;i++){
  let id=profile.samples[i],dt=profile.timeDeltas[i];self.set(id,(self.get(id)??0)+dt);
  while(id!==undefined){total.set(id,(total.get(id)??0)+dt);id=parents.get(id);}
 }
 const ranked=map=>[...map].sort((a,b)=>b[1]-a[1]).slice(0,35).map(([id,us])=>({ms:us/1000,...nodes.get(id).callFrame}));
 const result={phase,profiling,viewport:{width:1440,height:1000,dpr:1},overlay,metrics,profile:{self:ranked(self),inclusive:ranked(total)},errors};
 await writeFile(new URL(phase+'-profile.json',out),JSON.stringify(result,null,2));
 if(profiling)await writeFile(new URL(phase+'.cpuprofile',out),JSON.stringify(profile));
 await page.screenshot({path:new URL(phase+'-front.png',out).pathname});
 console.log(JSON.stringify({...result,metrics:{...metrics,cycles:undefined,frames:undefined}}));
} finally {await browser.close();}
