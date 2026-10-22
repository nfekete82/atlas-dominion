import {test,expect} from '@playwright/test';import {mkdir,writeFile} from 'node:fs/promises';
const evidence=new URL('./artifacts/naval/',import.meta.url).pathname;
async function frames(page){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function start(page,country='GB'){
 await page.addInitScript(()=>{Date.now=()=>1791799200000;Math.random=()=>.5;});await page.goto('/?debug');await page.locator(`[data-country="${country}"]`).click();
 await page.evaluate(()=>{__atlas.getGame().paused=true;for(const f of __atlas.getGame().factions)f.ai=false;__atlas.refresh();});
 await page.waitForFunction(()=>__atlas.renderer.topography.dataset.ready==='true');await mkdir(evidence,{recursive:true});
}
async function focus(page,lon,lat,zoom=3){await page.evaluate(({lon,lat,zoom})=>{const r=__atlas.renderer;r.fit();r.zoomBy(zoom);const x=(lon+25.5)/80.5*1600,y=(73.5-lat)/40.3*900;r.ox=r.canvas.clientWidth/2-x*r.scale;r.oy=r.canvas.clientHeight/2-y*r.scale;},{lon,lat,zoom});await frames(page);}
// Legacy AttackOrder voyages are issued explicitly through the debug API.
// RTS pointer selection and physical transports are covered by deep-rts.spec.mjs.
async function fleetFixture(page){return page.evaluate(async()=>{
 const {COASTS}=await import('/src/engine/navigation.js');const {geoToCell,cellToPoint}=await import('/src/engine/game.js');
 const nearest=(lon,lat)=>{const p=geoToCell(lon,lat);return COASTS.reduce((a,b)=>{const d=i=>(i%480-p.x)**2+(Math.floor(i/480)-p.y)**2;return d(a)<d(b)?a:b;});};
 const g=__atlas.getGame(),a=nearest(-3,53.4),b=nearest(-6.1,53.3);g.owner[a]=0;g.owner[b]=-1;g.factions[0].troops=1000;g.recount();__atlas.refresh();
 const r=__atlas.renderer,box=r.canvas.getBoundingClientRect();return {target:cellToPoint(b),x:box.left+r.ox+(b%480+.5)*1600/480*r.scale,y:box.top+r.oy+(Math.floor(b/480)+.5)*900/260*r.scale};
});}
for(const [width,height]of[[1440,900],[1920,1080]])for(const dpr of[1,2])test(`explicit legacy naval order, pause, reload and terrain at ${width}x${height} DPR ${dpr}`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page);await focus(page,-4,53,3);
 const spot=await fleetFixture(page);await page.evaluate(target=>{const result=__atlas.attack(target.x,target.y,35);if(!result.ok)throw Error(result.reason);__atlas.refresh();},spot.target);await page.mouse.move(1,1);
 const departure=await page.evaluate(()=>{const g=__atlas.getGame(),o=g.attackOrders.find(o=>o.factionId===0);return {landing:o?.landing,route:o?.seaRoute,sent:o?.remaining,tick:g.tick};});
 expect(departure.landing).toBe(true);expect(departure.route.length).toBeGreaterThan(2);expect(departure.sent).toBe(350);
 await page.evaluate(()=>{const g=__atlas.getGame(),o=g.attackOrders.find(o=>o.factionId===0&&o.seaRoute);g.paused=false;for(let i=0;i<Math.floor((o.arrivalTick-o.startedTick)/2);i++)g.step();g.paused=true;__atlas.refresh();});await frames(page);
 await page.screenshot({path:`${evidence}fleet-${width}-dpr${dpr}.jpg`,type:'jpeg',quality:92});
 const mid=await page.evaluate(()=>__atlas.getGame().exportSave());await page.waitForTimeout(350);expect(await page.evaluate(()=>__atlas.getGame().exportSave())).toEqual(mid);
 await page.evaluate(()=>__atlas.save());await page.reload();await page.waitForFunction(()=>__atlas.renderer.topography.dataset.ready==='true');expect(await page.evaluate(()=>__atlas.getGame().exportSave())).toEqual(mid);
 const result=await page.evaluate(()=>{const g=__atlas.getGame(),o=g.attackOrders.find(o=>o.factionId===0&&o.seaRoute),target=o.seaRoute.at(-1);g.paused=false;while(g.tick<o.arrivalTick)g.step();g.paused=true;__atlas.refresh();return {owner:g.owner[target],fallen:o.fallen};});expect(result.owner).toBe(0);expect(result.fallen).toBeGreaterThan(0);expect(errors).toEqual([]);
 await context.close();
});
test('paired overview, Alps/Constance and Scandinavian screenshots at several zooms preserve gameplay',async({page})=>{
 await page.setViewportSize({width:1920,height:1080});await start(page,'DE');await page.evaluate(()=>__atlas.renderer.fit());await frames(page);
 const before=await page.evaluate(()=>__atlas.getGame().exportSave());await page.evaluate(()=>__atlas.renderer.showTopography=false);await frames(page);await page.screenshot({path:`${evidence}overview-before.jpg`,type:'jpeg',quality:92});
 await page.evaluate(()=>__atlas.renderer.showTopography=true);await frames(page);await page.screenshot({path:`${evidence}overview-after.jpg`,type:'jpeg',quality:92});
 await focus(page,10,46.8,4);await page.screenshot({path:`${evidence}alps-constance.jpg`,type:'jpeg',quality:95});
 await focus(page,20,61.5,3);await page.screenshot({path:`${evidence}scandinavia-lakes.jpg`,type:'jpeg',quality:92});
 expect(await page.evaluate(()=>__atlas.getGame().exportSave())).toEqual(before);
 const alpha=await page.evaluate(()=>{const c=__atlas.renderer.topography.getContext('2d');const sample=(lon,lat)=>c.getImageData(Math.floor((lon+25.5)/80.5*3200),Math.floor((73.5-lat)/40.3*1800),1,1).data[3];return {ocean:sample(-15,50),lake:sample(9.4,47.6)};});expect(alpha.ocean).toBe(0);expect(alpha.lake).toBeGreaterThan(0);
});
test('reduced-motion still displays stationary paused fleets and renders actual route positions',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2,reducedMotion:'reduce'});const page=await context.newPage();await start(page);await focus(page,-4,53,3);const spot=await fleetFixture(page);await page.evaluate(target=>{const result=__atlas.attack(target.x,target.y,35);if(!result.ok)throw Error(result.reason);__atlas.refresh();},spot.target);
 const positions=await page.evaluate(async()=>{const {voyageGeometry,voyagePosition}=await import('/src/render/sea-voyages.js');const g=__atlas.getGame(),o=g.attackOrders.find(o=>o.factionId===0&&o.seaRoute),geom=voyageGeometry(o.seaRoute);g.paused=false;g.step();g.step();g.paused=true;__atlas.refresh();return {position:voyagePosition(o,g.tick,geom),tick:g.tick,reduced:__atlas.renderer.reducedMotion};});
 expect(positions.reduced).toBe(true);await page.waitForTimeout(300);expect(await page.evaluate(()=>__atlas.getGame().tick)).toBe(positions.tick);await page.screenshot({path:`${evidence}fleet-reduced-motion.jpg`,type:'jpeg',quality:92});await context.close();
});
test('terrain and 100 parallel fleets have bounded render cost and recorded frame timings',async({page},testInfo)=>{
 await page.setViewportSize({width:1920,height:1080});await start(page);await focus(page,-4,53,2);await fleetFixture(page);
 const metrics=await page.evaluate(async()=>{
  const {getGame,renderer:r}=__atlas,g=getGame();const target=await import('/src/engine/navigation.js');const nav=new target.MaritimeNavigation();const b=target.COASTS.find(i=>g.owner[i]===-1&&nav.route(g.owner,0,i));g.launchLanding(0,{x:b%480,y:Math.floor(b/480)},35);const original=g.attackOrders.find(o=>o.factionId===0&&o.seaRoute);
  for(let i=1;i<100;i++)g.attackOrders.push({...original,id:10000+i,seaRoute:original.seaRoute.slice(),remaining:original.remaining/100});original.remaining/=100;g.paused=false;g.step();g.paused=true;__atlas.refresh();
  const sample=async()=>{const a=[];let prev=performance.now();for(let i=0;i<45;i++)await new Promise(resolve=>requestAnimationFrame(t=>{a.push(t-prev);prev=t;resolve();}));a.sort((x,y)=>x-y);return {medianMs:a[22],p95Ms:a[42]};};
  r.showTopography=false;const baseline=await sample();r.showTopography=true;const terrain=await sample();
  const costs=[];for(let i=0;i<30;i++){const begin=performance.now();r.drawSeaVoyages(r.canvas.getContext('2d'));costs.push(performance.now()-begin);}costs.sort((a,b)=>a-b);
  return {fleets:g.attackOrders.filter(o=>o.landing).length,baseline,terrain,fleetDrawMedianMs:costs[15],fleetDrawP95Ms:costs[28]};
 });expect(metrics.fleets).toBe(100);expect(metrics.fleetDrawP95Ms).toBeLessThan(50);expect(metrics.terrain.medianMs).toBeLessThan(45);
 await writeFile(`${evidence}performance.json`,JSON.stringify(metrics,null,2)+'\n');await testInfo.attach('naval performance',{body:JSON.stringify(metrics),contentType:'application/json'});console.log('Naval performance',JSON.stringify(metrics));
});
