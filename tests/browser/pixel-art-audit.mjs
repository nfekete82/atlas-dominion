import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const phase=process.argv[2]??'after';
const out=new URL('../../docs/art-direction/screenshots/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
try {
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.goto((process.env.ATLAS_BASE_URL??'http://127.0.0.1:8106')+'/?debug');
await page.locator('[data-country="DE"]').click();
await page.evaluate(async()=>{
 const {Game}=await import('/src/engine/game.js');
 const api=window.__atlas,g=api.getGame();Object.assign(g,new Game(20261022,49,'DE','balanced',true));
 g.paused=true;g.factions.forEach(f=>f.ai=false);api.renderer.setGame(g);api.refresh();api.renderer.fit();
});
async function shot(name){await page.waitForTimeout(220);await page.screenshot({path:new URL(`${phase}-${name}.png`,out).pathname});}
await shot('europe');
await page.evaluate(()=>{const a=window.__atlas;a.renderer.focusOnPoint(a.getGame().cities[0],1.5);});
await shot('normal');
// Real construction and upgrades, with an explicitly funded QA fixture.
const buildings=await page.evaluate(()=>{
 const {getGame,renderer:r,refresh}=window.__atlas,g=getGame();g.factions[0].money=100000;
 const center=g.cities[0],used=[];g.seedTerritory(0,center,31);
 for(const [code,level] of [['city',0],['city',1],['city',2],['city',3],['city',4],['city',5],['factory',0],['barracks',0],['tower',0]]){
  const candidates=[];
  for(let i=0;i<g.owner.length;i++)if(g.owner[i]===0&&!g.buildings[i]&&!g.capitalSites.has(i)){
   const x=i%480,y=Math.floor(i/480);
   if(used.every(u=>Math.hypot(x-u.x,y-u.y)>11))candidates.push({x,y,index:i,d:Math.hypot(x-center.x,y-center.y)});
  }
  candidates.sort((a,b)=>a.d-b.d);const p=candidates[0];if(!p)throw Error('No construction site');
  const result=g.build(0,p,code);if(!result.ok)throw Error(result.reason);
  for(let n=0;n<level;n++){const result=g.upgradeCity(0,p);if(!result.ok)throw Error(result.reason);}
  used.push({...p,code,level});
 }
 refresh();r.focusOnPoint(center,4);return used;
});
await shot('buildings');
const measured=await page.evaluate(async()=>{
 const {renderer:r,getGame}=window.__atlas,g=getGame();
 const initial=JSON.stringify(g.exportSave()),costs=[],rebuilds=[];
 const old=r.frame;r.frame=function(...args){const t=performance.now();const result=old.apply(this,args);costs.push(performance.now()-t);return result;};
 for(let i=0;i<3;i++)r.updateTerritory();
 for(let i=0;i<15;i++){const t=performance.now();r.updateTerritory();rebuilds.push(performance.now()-t);}
 const raf=[];let prev;
 await new Promise(resolve=>{const sample=t=>{if(prev!==undefined)raf.push(t-prev);prev=t;if(raf.length>=120)resolve();else requestAnimationFrame(sample);};requestAnimationFrame(sample);});
 r.frame=old;
 const q=a=>{a.sort((a,b)=>a-b);return {samples:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)]};};
 return {frame:q(costs),territory:q(rebuilds),raf:q(raf),stateUnchanged:initial===JSON.stringify(g.exportSave()),visible:r.visibleCityMarkers};
});
// The same saved, simulated campaign used in the project's preceding QA.
const save=JSON.parse(await readFile(new URL('../../docs/qa/deep-game-20261022/render-fixture.json',import.meta.url),'utf8'));
await page.evaluate(async snapshot=>{
 const {Game}=await import('/src/engine/game.js');const {groupBattles}=await import('/src/render/front-battles.js');
 const a=window.__atlas,g=a.getGame();Object.assign(g,Game.fromSave(snapshot));g.paused=false;
 let contact;
 for(let i=0;i<100;i++){g.step();contact=groupBattles(g.battleEvents,g.owner,480).find(b=>b.defender>0);if(contact)break;}
 g.paused=true;if(!contact)throw Error('Expected a real simulated combat event after tick 500');
 a.renderer.setGame(g);a.refresh();a.renderer.focusOnPoint(contact,4);
},save);
await shot('battle');
const campaign=await page.evaluate(async()=>{
 const {renderer:r,getGame}=window.__atlas,g=getGame();
 async function sample(live){
  const costs=[],intervals=[],updates=[],old=r.frame,update=r.updateTerritory,startTick=g.tick;
  r.frame=function(...args){const t=performance.now(),result=old.apply(this,args);costs.push(performance.now()-t);return result;};
  r.updateTerritory=function(...args){const t=performance.now(),result=update.apply(this,args);updates.push(performance.now()-t);return result;};
  if(!live){for(let i=0;i<3;i++)r.updateTerritory();updates.length=0;for(let i=0;i<15;i++)r.updateTerritory();}
  g.paused=!live;let previous;
  await new Promise(resolve=>{const next=t=>{if(previous!==undefined)intervals.push(t-previous);previous=t;if(intervals.length===120)resolve();else requestAnimationFrame(next);};requestAnimationFrame(next);});
  g.paused=true;r.frame=old;r.updateTerritory=update;
  const q=a=>{a.sort((a,b)=>a-b);return {samples:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)]};};
  return {frame:q(costs),raf:q(intervals),territory:q(updates),advancedTicks:g.tick-startTick};
 }
 const initial={tick:g.tick,factions:g.factions.filter(f=>f.alive).length,squads:g.squads.length,events:g.battleEvents.length};
 const paused=await sample(false),live=await sample(true);return {initial,paused,live};
});
await writeFile(new URL(`${phase}-metrics.json`,out),JSON.stringify({phase,seed:20261022,viewport:{width:1440,height:1000,dpr:1},reducedMotion:true,buildings,measured,campaign,errors},null,2));
console.log(JSON.stringify({phase,measured:{...measured,visible:measured.visible.length},campaign,errors},null,2));
if(errors.length||!measured.stateUnchanged)throw Error('Browser errors or renderer mutated simulation');
} finally {await browser.close();}
