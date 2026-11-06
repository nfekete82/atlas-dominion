import {chromium} from '../tests/browser/node_modules/@playwright/test/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const results={};
try{
for(const [label,url]of [['pr240',process.env.SANDFORGE_BASELINE_URL??'http://127.0.0.1:8132'],['gates',process.env.SANDFORGE_FEATURE_URL??'http://127.0.0.1:8134']]){
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.goto(`${url}/?bastions=4&seed=2074&pause=1&lite=1`);await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded,null,{timeout:120000});
 results[label]=await page.evaluate(async()=>{
  const w=window.__sandforgeWebGL,g=w.game,bf=w.battlefield;
  g.paused=true;const origin=g.units[0];g.units=[];
  for(let i=0;i<96;i++)g.spawn(i%2,{x:origin.x+(i%12)*70,y:origin.y+Math.floor(i/12)*70},i%3===0?'tank':i%3===1?'rover':'artillery');
  bf.sync(true);await new Promise(r=>setTimeout(r,2000));
  const measure=()=>{
   const samples=[],start=performance.now();
   for(let n=0;n<600;n++){const at=performance.now();bf.sync(false,.016,false);samples.push(performance.now()-at);}
   const elapsed=performance.now()-start;samples.sort((a,b)=>a-b);w.renderer.render(w.scene,w.camera);
   return {actors:bf.units.size,meanMs:elapsed/600,p95Ms:samples[570],drawCalls:w.renderer.info.render.calls,triangles:w.renderer.info.render.triangles,geometries:w.renderer.info.memory.geometries};
  };
  const empty=measure();
  let site=null;
  for(let dx=-700;dx<=-200&&!site;dx+=50)for(let dy=-700;dy<=-200&&!site;dy+=50){
   const p={x:origin.x+dx,y:origin.y+dy};
   if([0,80,160,220].every(z=>[-30,0,30].every(x=>g.world.walkable({x:p.x+x,y:p.y+z},[],40))))site=p;
  }
  if(!site)throw Error('No clear factory benchmark lane');
  const base={id:900,kind:'factory',radius:70,production:0,cooldown:0,owner:0,x:site.x,y:site.y,facing:0,buildRemaining:0,hp:1100,queue:[],queueTypes:[],queueCosts:[]};g.bases.push(base);bf.sync(true);
  await bf.getModel(bf.asset('factory',0,'building'));
  for(let i=0;i<100&&!bf.bases.get(base.id)?.detail;i++)await new Promise(r=>setTimeout(r,50));
  const closedFactory=measure();
  let active=null;
  if(bf.productionGates){
   g.units.pop();const unit=g.spawn(0,{x:base.x+112,y:base.y+82},'tank');bf.sync(true);
   g.productionReleases.push({unitId:unit.id,baseId:base.id,owner:0,kind:'tank',at:g.time,from:{x:base.x,y:base.y},to:{x:unit.x,y:unit.y}});bf.sync(true);
   g.time+=2;bf.sync(true);active={...measure(),active:bf.productionGates.active.size};
   if(active.active!==1)throw Error('Benchmark rollout was interrupted; no active measurement');
  }
  return {empty,closedFactory,active};
 });console.log(label,results[label]);await page.close();
}
await writeFile('docs/production-gates/performance.json',JSON.stringify(results,null,2)+'\n');
}finally{await browser.close();}
