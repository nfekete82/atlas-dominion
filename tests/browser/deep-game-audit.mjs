import {chromium} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const phase=process.argv[2]??'before';
const out=new URL('../../docs/qa/deep-game-20261022/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto((process.env.ATLAS_BASE_URL??'http://127.0.0.1:8097')+'/?debug');
await page.locator('[data-country="DE"]').click();
await page.evaluate(()=>{window.__atlas.getGame().paused=true;});
async function contactScreenshot(){
 await page.evaluate(async()=>{
  const {Game,landNeighbors}=await import('/src/engine/game.js');
  const {getGame,renderer:r,refresh}=window.__atlas,g=getGame();
  Object.assign(g,new Game(20261022,49,'DE','balanced',true));
  g.paused=true;g.factions.forEach(f=>f.ai=false);
  const start=g.owner.findIndex((id,tile)=>id===0&&landNeighbors(tile).some(n=>g.owner[n]===-1));
  const target=landNeighbors(start).find(n=>g.owner[n]===-1);g.owner[target]=1;
  const unit=(id,owner,index)=>({id,owner,index,troops:100,destination:null,attackTarget:null,campaignTarget:null,campaignOwner:null});
  g.squads.push(unit(9001,0,start),unit(9002,0,start),unit(9003,1,target));
  g.tick=10;g.resolveSquadContacts();g.recount();r.setGame(g);refresh();r.selectedSquadIds=[9001];
  r.focusOnPoint({x:start%480,y:Math.floor(start/480)},3);
 });
 await page.waitForTimeout(400);await page.screenshot({path:new URL(phase+'-battle.png',out).pathname});
}
if(process.argv.includes('--contact-only')){
 await contactScreenshot();console.log(JSON.stringify({phase,errors}));await browser.close();process.exit(0);
}
let snapshot;
if(phase==='before'){
 snapshot=await page.evaluate(async()=>{
  const {Game}=await import('/src/engine/game.js');
  const g=new Game(20261022,49,'DE','balanced',true);
  for(let i=0;i<500;i++){g.status='playing';g.step();}
  g.paused=true;return g.exportSave();
 });
 await writeFile(new URL('render-fixture.json',out),JSON.stringify(snapshot));
}else snapshot=JSON.parse(await readFile(new URL('render-fixture.json',out),'utf8'));
await page.evaluate(async snapshot=>{
 const {Game}=await import('/src/engine/game.js');
 const api=window.__atlas,g=api.getGame();Object.assign(g,Game.fromSave(snapshot));
 g.paused=true;api.renderer.setGame(g);api.refresh();
 const r=api.renderer;r.fit();r.zoomBy(1.5);
},snapshot);
await page.waitForTimeout(500);
await page.screenshot({path:new URL(phase+'-map.png',out).pathname});
const overview=await page.evaluate(()=>{
 const g=window.__atlas.getGame();return {squads:g.squads.length,events:g.battleEvents.length,factions:g.factions.filter(f=>f.alive).length};
});
async function liveMetrics(){
 return page.evaluate(async()=>{
  const {getGame,renderer:r}=window.__atlas,g=getGame(),tick=g.tick;
  const costs=[],updates=[],frames=[];let previous;
  const frame=r.frame,update=r.updateTerritory;
  r.frame=function(...args){const start=performance.now();const result=frame.apply(this,args);costs.push(performance.now()-start);return result;};
  r.updateTerritory=function(...args){const start=performance.now();const result=update.apply(this,args);updates.push(performance.now()-start);return result;};
  g.paused=false;
  await new Promise(resolve=>{
   const sample=t=>{if(previous!==undefined)frames.push(t-previous);previous=t;
    if(frames.length===300)resolve();else requestAnimationFrame(sample);};requestAnimationFrame(sample);
  });
  g.paused=true;r.frame=frame;r.updateTerritory=update;
  const q=a=>{a.sort((x,y)=>x-y);return {samples:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)]};};
  return {advancedTicks:g.tick-tick,squads:g.squads.length,battles:g.battleEvents.length,frame:q(costs),territory:q(updates),raf:q(frames)};
 });
}
const metrics=await page.evaluate(async()=>{
 const r=window.__atlas.renderer;
 const timings={};const originals={};
 for(const name of ['frame','drawSquads','drawBuildings','drawTroopBadges','drawLiveBattles','updateTerritory']){
  originals[name]=r[name];timings[name]=[];
  r[name]=function(...args){const start=performance.now();const result=originals[name].apply(this,args);timings[name].push(performance.now()-start);return result;};
 }
 // Warm all layers, then collect measured refreshes and real RAF intervals.
 for(let i=0;i<5;i++)r.updateTerritory();
 for(const values of Object.values(timings))values.length=0;
 for(let i=0;i<20;i++)r.updateTerritory();
 const intervals=[];let previous;
 await new Promise(resolve=>{
  const frame=t=>{if(previous!==undefined)intervals.push(t-previous);previous=t;
   if(intervals.length>=120)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);
 });
 const q=values=>{values.sort((a,b)=>a-b);return {samples:values.length,median:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],p99:values[Math.floor(values.length*.99)]};};
 for(const [name,original] of Object.entries(originals))r[name]=original;
 return {methods:Object.fromEntries(Object.entries(timings).map(([n,v])=>[n,q(v)])),raf:q(intervals)};
});
// Comparable close-up with visible physical armies from the same saved world.
await page.evaluate(()=>{
 const {renderer:r,getGame}=window.__atlas,g=getGame();
 const squad=g.squads.find(u=>g.squads.some(e=>e.owner!==u.owner&&
  Math.abs(e.index%480-u.index%480)+Math.abs(Math.floor(e.index/480)-Math.floor(u.index/480))<=4))??g.squads[0];
 r.focusOnPoint({x:squad.index%480,y:Math.floor(squad.index/480)},3);
});
await page.waitForTimeout(300);await page.screenshot({path:new URL(phase+'-front.png',out).pathname});
const live=process.argv.includes('--live')?await liveMetrics():undefined;
const result={phase,viewport:{width:1440,height:1000,dpr:1},overview,metrics,live,errors};
await writeFile(new URL(phase+'-render.json',out),JSON.stringify(result,null,2));
await contactScreenshot();console.log(JSON.stringify(result,null,2));await browser.close();
