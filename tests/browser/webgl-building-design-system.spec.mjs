import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const artifacts=fileURLToPath(new URL('../../docs/building-design-system/qa',import.meta.url));

/** Preserve the actual boot error instead of reporting only a two-minute timeout.
 * Both entrypoints can fail before their public readiness hooks are created. */
async function openAndWaitForReady(page,url,predicate){
 const browserErrors=[];
 page.on('pageerror',error=>browserErrors.push('pageerror: '+error.message));
 page.on('console',message=>{if(message.type()==='error')browserErrors.push('console: '+message.text());});
 page.on('requestfailed',request=>browserErrors.push('request: '+request.url()+' '+(request.failure()?.errorText??'')));
 page.on('response',response=>{if(response.status()>=400)browserErrors.push('HTTP '+response.status()+' '+response.url());});
 const response=await page.goto(url);
 try{
  if(response&&response.status()>=400)throw Error('Entry returned HTTP '+response.status());
  await page.waitForFunction(predicate,null,{timeout:120000});
 }catch(error){
  const state=await page.evaluate(()=>({
   href:location.href,title:document.title,readyState:document.readyState,
   gallery:window.__sandforgeBuildingGallery
    ?{ready:window.__sandforgeBuildingGallery.ready,errors:window.__sandforgeBuildingGallery.errors,
      entries:window.__sandforgeBuildingGallery.entries?.length}:null,
   game:window.__sandforgeWebGL
    ?{loaded:window.__sandforgeWebGL.loaded}:null,
   visibleError:document.querySelector('#error')?.textContent,
   fatal:document.querySelector('#sf3d-fatal-detail')?.textContent,
   performance:document.querySelector('#performance')?.textContent,
   status:document.querySelector('#status')?.textContent,
  })).catch(e=>({inspectionError:String(e)}));
  throw new Error('Sandforge did not boot: '+error.message
   +'\nBrowser errors: '+JSON.stringify(browserErrors.slice(0,25))
   +'\nPage status: '+JSON.stringify(state));
 }
}

test('gallery compiles real building PBR, compares sizes, animates doors and supports all biomes',async({page})=>{
 test.setTimeout(180000);const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/shader|gltf|webgl/i.test(m.text()))errors.push(m.text());});
 await page.setViewportSize({width:1600,height:1100});
 await openAndWaitForReady(page,'/building-gallery.html',()=>window.__sandforgeBuildingGallery?.ready);
 expect(await page.evaluate(()=>__sandforgeBuildingGallery.errors)).toEqual([]);
 await expect(page.locator('.card')).toHaveCount(11);
 await page.selectOption('#filter','pair');
 await page.waitForTimeout(300);
 await mkdir(artifacts,{recursive:true});
 await page.screenshot({path:artifacts+'/hq3-barracks-desert.png'});
 const sizes=await page.evaluate(()=>__sandforgeBuildingGallery.entries.map(e=>({kind:e.kind,render:e.renderSize,area:e.areaSize})));
 expect(sizes.every(e=>e.render.every(n=>Number.isFinite(n)&&n>0))).toBe(true);
 const barracks=page.locator('[data-kind="barracks"]');
 const coordinates=[];
 for(let i=0;i<4;i++){
  coordinates.push(await page.evaluate(()=>{
   const entry=__sandforgeBuildingGallery.entries.find(e=>e.kind==='barracks');
   const attr=entry.detail.getObjectByName('static__olive').geometry.getAttribute('sfBuildingPosition');
   return {facing:entry.facing,sample:Array.from(attr.array.slice(0,30))};
  }));
  await barracks.locator('[data-action="rotate"]').click();
 }
 expect(new Set(coordinates.map(c=>c.facing)).size).toBe(4);
 expect(coordinates.every(c=>JSON.stringify(c.sample)===JSON.stringify(coordinates[0].sample))).toBe(true);
 await page.evaluate(()=>__sandforgeBuildingGallery.setProgress(0));
 const zero=await page.evaluate(()=>__sandforgeBuildingGallery.entries.flatMap(e=>e.assemblies.flatMap(a=>a?.meshes.map(m=>m.geometry.drawRange.count)??[])));
 expect(zero.length).toBeGreaterThan(100);expect(zero.every(n=>n===0)).toBe(true);
 await page.screenshot({path:artifacts+'/construction-zero.png'});
 await page.evaluate(()=>__sandforgeBuildingGallery.setProgress(.5));
 await page.screenshot({path:artifacts+'/construction-half.png'});
 await page.evaluate(()=>__sandforgeBuildingGallery.setProgress(1));
 await barracks.locator('[data-action="animate"]').click();
 await page.waitForFunction(()=>{
  const e=__sandforgeBuildingGallery.entries.find(e=>e.kind==='barracks');
  return e.age>1.4&&e.departing.visible;
 });
 await page.screenshot({path:artifacts+'/barracks-walkout.png'});
 await barracks.locator('[data-action="animate"]').click();
 // Every card must actually render; offscreen cells are drawn on demand.
 await page.selectOption('#filter','all');
 for(const kind of ['airfield','silo','bastion','generator','turret','interceptor','wall']){
  const card=page.locator(`[data-kind="${kind}"]`);await card.scrollIntoViewIfNeeded();await page.waitForTimeout(80);
 }
 await page.screenshot({path:artifacts+'/defense-family.png'});
 await page.selectOption('#filter','silo');
 await page.locator('[data-kind="silo"] [data-action="animate"]').click();
 await page.waitForFunction(()=>__sandforgeBuildingGallery.entries.find(e=>e.kind==='silo').strategicHatch?.open>.99);
 await page.screenshot({path:artifacts+'/silo-open.png'});
 for(const biome of ['snow','jungle','desert']){
  await page.selectOption('#biome',biome);
  await page.waitForFunction(()=>__sandforgeBuildingGallery.ready&&!document.querySelector('#biome').disabled);
  expect(await page.evaluate(()=>__sandforgeBuildingGallery.errors)).toEqual([]);
  await page.selectOption('#filter','pair');
  await page.screenshot({path:artifacts+'/hq3-barracks-'+biome+'.png'});
  await page.selectOption('#filter','all');
  for(const kind of ['airfield','research','silo','bastion','turret','wall']){
   await page.locator(`[data-kind="${kind}"]`).scrollIntoViewIfNeeded();await page.waitForTimeout(60);
  }
 }
 expect(errors).toEqual([]);
 await page.evaluate(()=>scrollTo(0,0));
 await page.waitForTimeout(100);
 const frame=await page.evaluate(()=>__sandforgeBuildingGallery.lastFrame);
 await writeFile(artifacts+'/gallery-browser-result.json',JSON.stringify({sizes,frame,errors,facings:coordinates.map(c=>c.facing)},null,2));
});

test('live game constructs every facility from zero and releases real infantry through the authored doorway at four facings',async({page})=>{
 test.setTimeout(180000);const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/shader|gltf|webgl/i.test(m.text()))errors.push(m.text());});
 await page.setViewportSize({width:1440,height:1000});
 await openAndWaitForReady(page,'/?bastions=4&seed=2074&pause=1&lite=1',()=>window.__sandforgeWebGL?.loaded);
 await page.evaluate(async()=>{
  const w=__sandforgeWebGL,g=w.game,bf=w.battlefield;g.paused=true;g.aiClock=-1e8;g.canSee=()=>true;
  const origin=g.units[0];window.designOrigin={x:origin.x,y:origin.y};
  g.units=[];g.bases=[];bf.sync(true);
  const kinds=['headquarters','barracks','factory','airfield','research','silo','generator','turret','interceptor','wall'];
  for(const [i,kind]of kinds.entries())g.bases.push({id:900+i,kind,owner:0,x:origin.x+(i%4)*260,y:origin.y+Math.floor(i/4)*260,facing:0,buildRemaining:1,hp:5000,radius:75,production:0,cooldown:0,queue:[],queueTypes:[],queueCosts:[]});
  bf.sync(true,0,false);
  await Promise.all(kinds.filter(k=>!['interceptor','wall'].includes(k)).map(kind=>bf.getModel(bf.asset(kind,0,'building'))));
 });
 await page.waitForFunction(()=>{
  const bf=__sandforgeWebGL.battlefield;
  return [...bf.bases.values()].every(e=>['interceptor','wall'].includes(e.kind)||e.detail);
 },null,{timeout:60000});
 const state=await page.evaluate(()=>{
  const w=__sandforgeWebGL,g=w.game,bf=w.battlefield;
  const catalog=[];
  for(const base of g.bases){
   const entry=bf.bases.get(base.id);base.buildRemaining=1e9;bf.sync(true,0,false);
   const assembly=entry.construction?.authoredAssembly;
   const service=entry.construction?.serviceAssembly;
   catalog.push({kind:base.kind,zero:assembly?.meshes.every(m=>m.geometry.drawRange.count===0),service:!service||service.meshes.every(m=>m.geometry.drawRange.count===0)});
  }
  for(const base of g.bases)base.buildRemaining=0;
  bf.sync(true,0,false);return catalog;
 });
 expect(state.every(s=>s.zero&&s.service)).toBe(true);
 const departures=[];
 for(const facing of [0,2,1,3]){
  const released=await page.evaluate(facing=>{
   const w=__sandforgeWebGL,g=w.game,bf=w.battlefield;
   const base=g.bases.find(b=>b.kind==='barracks');base.facing=facing;bf.lite=false;
   g.units=[];bf.sync(true,0,false);
   base.production=0;base.queue=[.01];base.queueTypes=['infantry'];base.queueCosts=[100];
   base.rally={x:base.x+380,y:base.y+270};g.status='playing';g.paused=false;g.step(.05);g.paused=true;
   bf.sync(true,0,false);window.releaseEvent=g.productionReleases.at(-1);
   return {baseId:releaseEvent?.baseId,unitId:releaseEvent?.unitId};
  },facing);
  expect(released.baseId).toBe(901);
  await page.waitForFunction(id=>__sandforgeWebGL.battlefield.units.get(id)?.detail,released.unitId,{timeout:45000});
  const result=await page.evaluate(()=>{
   const w=__sandforgeWebGL,g=w.game,bf=w.battlefield,event=releaseEvent;
   const unit=g.units.find(u=>u.id===event.unitId),base=g.bases.find(b=>b.id===event.baseId),entry=bf.bases.get(base.id);
   const authoritative=JSON.stringify(unit),samples=[];
   // First sample creates the presentation state if the unit streamed late.
   g.time=event.at;bf.sync(true,0,false);
   const active=bf.productionGates.active.get(base.id),visualAt=active?.visualAt??event.at;
   for(const age of [0,.75,1.5,2.5,8]){
    g.time=visualAt+age;bf.sync(true,0,false);
    const actor=bf.units.get(unit.id);entry.node.updateWorldMatrix(true,true);
    samples.push({age,visible:actor.node.visible,position:actor.node.position.toArray(),left:entry.gate.portal.left.position.x});
   }
   return {facing:base.facing,samples,simulationUnchanged:JSON.stringify(unit)===authoritative,authored:entry.gate.portal.authored};
  });
  expect(result.authored).toBe(true);expect(result.simulationUnchanged).toBe(true);
  expect(result.samples[0].visible).toBe(false);expect(result.samples[2].visible).toBe(true);
  expect(result.samples[1].left).toBeLessThan(result.samples[0].left);
  expect(result.samples.at(-1).left).toBeCloseTo(result.samples[0].left,5);
  departures.push(result);
 }
 expect(errors).toEqual([]);
 await mkdir(artifacts,{recursive:true});
 await writeFile(artifacts+'/live-game-result.json',JSON.stringify({construction:state,departures,errors},null,2));
});
