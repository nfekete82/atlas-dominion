import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const evidence=new URL('./artifacts/screenshots/',import.meta.url).pathname;
async function frame(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function start(page,fixture=true){
  await page.addInitScript(()=>{Date.now=()=>1791799200000;Math.random=()=>0.5;});
  await page.goto('/?debug');await page.locator('[data-country="DE"]').click();
  await page.evaluate(()=>{window.__atlas.getGame().paused=true;window.__atlas.refresh();});
  if(fixture)await page.evaluate(()=>{
    const {getGame,refresh}=window.__atlas,g=getGame();g.factions[0].money=50000;
    const cx=g.cities[0].x,cy=g.cities[0].y,sites=[];
    // Controlled progressed-game territory, not a claim about natural AI growth.
    for(let y=cy-27;y<=cy+27;y++)for(let x=cx-38;x<=cx+38;x++)if(g.owner[y*480+x]>=-1)g.owner[y*480+x]=0;
    for(const [dx,dy] of [[-30,-17],[-10,-17],[10,-17],[-30,10],[-10,10],[10,10]]){
      const candidates=[];
      for(let y=cy-27;y<=cy+27;y++)for(let x=cx-38;x<=cx+38;x++)if(g.canBuild(0,{x,y},'city').ok)candidates.push({x,y});
      candidates.sort((a,b)=>(a.x-cx-dx)**2+(a.y-cy-dy)**2-((b.x-cx-dx)**2+(b.y-cy-dy)**2));
      const p=candidates[0];g.build(0,p,'city');for(let l=0;l<sites.length;l++)g.upgradeCity(0,p);sites.push(p);
    }
    g.recount();refresh();window.__sites=sites;
  });
  await page.mouse.move(1,1);await page.waitForTimeout(400);
}
async function layout(page){return page.evaluate(()=>{
  const r=window.__atlas.renderer;
  return {markers:r.visibleCityMarkers,overlays:r.overlayBounds,zoom:r.zoom,scale:r.scale,ox:r.ox,oy:r.oy,
    width:r.canvas.clientWidth,height:r.canvas.clientHeight,bitmapWidth:r.canvas.width,bitmapHeight:r.canvas.height};
});}
const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
for(const [width,height] of [[1440,900],[1920,1080],[2560,1440]])for(const dpr of [1,2])for(const zoom of [1,1.5,2,4]){
 test(`${width}x${height} DPR ${dpr} zoom ${zoom*100}%`,async({browser},testInfo)=>{
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});
   const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await start(page);await page.evaluate(z=>{const r=window.__atlas.renderer;r.fit();r.zoomBy(z);},zoom);await frame(page);
   const state=await layout(page);expect(state.zoom).toBe(zoom);expect(state.markers.length).toBeGreaterThan(0);
   expect(state.bitmapWidth).toBe(state.width*dpr);expect(state.bitmapHeight).toBe(state.height*dpr);
   for(const [i,m] of state.markers.entries()){
     expect(m.bounds.width).toBe(30);expect(m.bounds.height).toBe(30);
     for(const n of state.markers.slice(i+1))expect(overlaps(m.bounds,n.bounds)).toBe(false);
     for(const overlay of state.overlays)expect(overlaps(m.bounds,overlay)).toBe(false);
   }
   expect(errors).toEqual([]);await mkdir(evidence,{recursive:true});
   const path=`${evidence}after-${width}-${zoom*100}-dpr${dpr}.jpg`;
   await writeFile(path.replace('.jpg','.json'),JSON.stringify(state,null,2));
   if(zoom===2)expect(state.markers.map(m=>m.level).sort()).toEqual([0,1,2,3,4,5]);
   await page.screenshot({path,type:'jpeg',quality:90});await testInfo.attach('map',{path,contentType:'image/jpeg'});
   await context.close();
 });
}

test('right-click builds a city, upgrades five times immediately, and reload preserves the version 1 save',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await start(page);
 const spot=await page.evaluate(()=>{
   const {getGame,renderer:r}=window.__atlas,g=getGame();r.fit();r.zoomBy(2);
   const p={x:window.__sites[0].x+7,y:window.__sites[0].y+5};
   if(!g.canBuild(0,p,'city').ok)throw Error('Invalid build fixture');
   const b=r.canvas.getBoundingClientRect();
   return {p,x:b.left+r.ox+(p.x+.5)*1600/480*r.scale,y:b.top+r.oy+(p.y+.5)*900/260*r.scale};
 });
 await frame(page);await page.mouse.click(spot.x,spot.y,{button:'right'});
 await expect(page.locator('#buildMenu')).toBeVisible();await page.locator('[data-build="city"]').click();
 await frame(page);
 let previous='';
 for(let level=0;level<=5;level++){
   const marker=await page.evaluate(p=>window.__atlas.renderer.visibleCityMarkers.find(m=>m.index===p.y*480+p.x),spot.p);
   expect(marker?.level).toBe(level);
   const bytes=await page.evaluate(m=>{
     const r=window.__atlas.renderer,dpr=r.canvas.width/r.canvas.clientWidth;
     return Array.from(r.canvas.getContext('2d').getImageData(m.bounds.x*dpr,m.bounds.y*dpr,30*dpr,30*dpr).data).join(',');
   },marker);
   expect(bytes).not.toBe(previous);previous=bytes;
   // Use the right-hand part of the badge, outside the real sector hitbox.
   await page.mouse.click(spot.x+12,spot.y+8,{button:'right'});
   await expect(page.locator('[data-upgrade-city]')).toContainText(`${level}/5`);
   if(level<5){await page.locator('[data-upgrade-city]').click();await frame(page);}
   else await expect(page.locator('[data-upgrade-city]')).toBeDisabled();
 }
 await page.keyboard.press('Escape');await page.evaluate(()=>window.__atlas.save());
 const saved=await page.evaluate(()=>window.__atlas.getGame().exportSave());
 await page.reload();await expect(page.locator('#countryPicker')).toBeHidden();
 expect(await page.evaluate(()=>window.__atlas.getGame().exportSave())).toEqual(saved);
});

test('contextmenu-only trackpad event and secondary pointer fallback each open the city menu',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await start(page);await frame(page);
 const marker=(await layout(page)).markers[0];
 const canvas=page.locator('#battleCanvas'),box=await canvas.boundingBox();
 await canvas.evaluate((element,{x,y})=>element.dispatchEvent(new MouseEvent('contextmenu',{clientX:x,clientY:y,button:2,bubbles:true,cancelable:true})),{x:box.x+marker.x,y:box.y+marker.y});
 await expect(page.locator('#buildMenu')).toBeVisible();await page.keyboard.press('Escape');
 await canvas.dispatchEvent('pointerup',{clientX:box.x+marker.x,clientY:box.y+marker.y,button:2,pointerId:42,bubbles:true});
 await expect(page.locator('#buildMenu')).toBeVisible();
});

test('hover selects the city badge, keeps tooltip in bounds and clear of the building',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await start(page);await frame(page);
 const marker=(await layout(page)).markers.find(m=>m.level===5);
 expect(marker).toBeTruthy();await page.mouse.move(marker.x+12,marker.y+66+8);
 await expect(page.locator('#hoverOwner')).toBeVisible();
 await expect(page.locator('#hoverMilitary')).toContainText('Mobil');
 const tip=await page.locator('#mapInfo').boundingBox(),canvas=await page.locator('#battleCanvas').boundingBox();
 expect(tip.x).toBeGreaterThanOrEqual(canvas.x);expect(tip.y).toBeGreaterThanOrEqual(canvas.y);
 expect(tip.x+tip.width).toBeLessThanOrEqual(canvas.x+canvas.width);
 expect(tip.y+tip.height).toBeLessThanOrEqual(canvas.y+canvas.height);
 expect(overlaps({x:tip.x-canvas.x,y:tip.y-canvas.y,width:tip.width,height:tip.height},marker.bounds)).toBe(false);
 await page.screenshot({path:`${evidence}tooltip.jpg`,type:'jpeg',quality:90});
});

test('resizing preserves zoom and the world point at the camera center; wheel zoom and dragging work',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await start(page);
 await page.evaluate(()=>{window.__atlas.renderer.fit();window.__atlas.renderer.zoomBy(2);});await frame(page);
 const before=await layout(page);await page.setViewportSize({width:1920,height:1080});await frame(page);
 const after=await layout(page);expect(after.zoom).toBe(2);
 expect((after.width/2-after.ox)/after.scale).toBeCloseTo((before.width/2-before.ox)/before.scale,5);
 expect((after.height/2-after.oy)/after.scale).toBeCloseTo((before.height/2-before.oy)/before.scale,5);
 await page.mouse.move(700,500);await page.mouse.wheel(0,-100);await frame(page);expect((await layout(page)).zoom).toBeGreaterThan(2);
 const dragBefore=await layout(page);await page.mouse.move(700,500);await page.mouse.down();await page.mouse.move(780,550,{steps:5});await page.mouse.up();
 const dragAfter=await layout(page);expect(dragAfter.ox-dragBefore.ox).toBeCloseTo(80,0);expect(dragAfter.oy-dragBefore.oy).toBeCloseTo(50,0);
});

test('DPR 3 keeps native canvas resolution, and small screens keep cities usable',async({browser})=>{
 const context=await browser.newContext({viewport:{width:768,height:1024},deviceScaleFactor:3});const page=await context.newPage();await start(page);
 const state=await layout(page);expect(state.bitmapWidth).toBe(state.width*3);expect(state.markers.length).toBeGreaterThan(0);
 await page.screenshot({path:`${evidence}tablet-dpr3.jpg`,type:'jpeg',quality:90});await context.close();
});

test('dense adjacent towns never overlap',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await start(page);
 await page.evaluate(()=>{
 const {getGame,refresh,renderer:r}=window.__atlas,g=getGame();g.factions[0].money=100000;
 const p=window.__sites[3];for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)if(g.canBuild(0,{x:p.x+dx,y:p.y+dy},'city').ok)g.build(0,{x:p.x+dx,y:p.y+dy},'city');
 refresh();r.fit();r.zoomBy(2);
 });await frame(page);
 const state=await layout(page);for(const [i,m]of state.markers.entries())for(const n of state.markers.slice(i+1))expect(overlaps(m.bounds,n.bounds)).toBe(false);
});

test('real player battles retain front particles and counters without city collisions',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await start(page);
 const target=await page.evaluate(()=>{
  const {getGame,renderer:r,refresh}=window.__atlas,g=getGame();g.factions[0].troops=5000;
  for(const faction of g.factions.slice(1))faction.ai=false;
  const p=window.__sites[5];
  for(let dy=-4;dy<=4;dy++)for(let dx=4;dx<=11;dx++){
    const i=(p.y+dy)*480+p.x+dx;g.owner[i]=1;g.frontline[i]=100;
  }
  g.factions[1].troops=5000;g.recount();refresh();r.fit();r.zoomBy(2);
  const box=r.canvas.getBoundingClientRect();
  return {x:box.x+r.ox+(p.x+6.5)*1600/480*r.scale,y:box.y+r.oy+(p.y+.5)*900/260*r.scale};
 });await frame(page);await page.mouse.click(target.x,target.y);await page.mouse.move(1,1);
 const result=await page.evaluate(()=>{
  const {getGame,renderer:r,refresh}=window.__atlas,g=getGame();g.paused=false;g.step();g.paused=true;refresh();
  return {events:g.battleEvents.length,groups:r.frontGroups.filter(group=>group.playerBattle).length,orders:g.attackOrders.filter(o=>o.factionId===0).length};
 });expect(result.events).toBeGreaterThan(0);expect(result.groups).toBeGreaterThan(0);expect(result.orders).toBeGreaterThan(0);
 await frame(page);
 const front=await page.evaluate(()=>{
  const r=window.__atlas.renderer,group=r.frontGroups.find(group=>group.playerBattle);
  const x=r.ox+group.x*1600/480*r.scale,y=r.oy+group.y*900/260*r.scale;
  return {x,y,width:r.canvas.clientWidth,height:r.canvas.clientHeight};
 });expect(front.x).toBeGreaterThan(16);expect(front.x).toBeLessThan(front.width-16);expect(front.y).toBeGreaterThan(55);expect(front.y).toBeLessThan(front.height-32);
 expect(await page.evaluate(()=>{const r=window.__atlas.renderer;return r.visibleCityMarkers.every(m=>{const other=new (r.occupancy.constructor)();for(const group of r.frontGroups){const x=r.ox+group.x*1600/480*r.scale,y=r.oy+group.y*900/260*r.scale;other.reserve({x:x-24,y:y-24,width:48,height:48});}return !other.intersects(m.bounds);});})).toBe(true);
 await page.screenshot({path:`${evidence}battle.jpg`,type:'jpeg',quality:90});
 await page.waitForTimeout(120);
 await page.screenshot({path:`${evidence}battle-next-frame.jpg`,type:'jpeg',quality:90});
});

test('many-city layout remains bounded and records actual frame timings',async({page},testInfo)=>{
 await page.setViewportSize({width:1920,height:1080});await start(page);
 const metrics=await page.evaluate(async()=>{
  const {getGame,renderer:r,refresh}=window.__atlas,g=getGame();let count=0;
  for(let i=0;i<g.owner.length&&count<1500;i+=7)if(g.owner[i]>=-1&&!g.cities.some(c=>c.index===i)){g.owner[i]=0;g.buildings[i]=1;g.cityUpgrades[i]=count++%6;}
  g.recount();refresh();r.fit();r.zoomBy(2);
  const samples=[];let last=performance.now();for(let i=0;i<40;i++)await new Promise(resolve=>requestAnimationFrame(t=>{samples.push(t-last);last=t;resolve();}));
  const timings=[];for(let i=0;i<30;i++){r.occupancy.clear();const begin=performance.now();r.drawBuildings(r.canvas.getContext('2d'));timings.push(performance.now()-begin);}
  samples.sort((a,b)=>a-b);timings.sort((a,b)=>a-b);
  return {count,visible:r.visibleCityMarkers.length,frameMedianMs:samples[20],frameP95Ms:samples[38],layoutMedianMs:timings[15],layoutP95Ms:timings[28]};
 });expect(metrics.count).toBe(1500);expect(metrics.visible).toBeGreaterThan(0);expect(metrics.layoutP95Ms).toBeLessThan(50);
 await testInfo.attach('performance',{body:JSON.stringify(metrics,null,2),contentType:'application/json'});
 console.log('City performance',JSON.stringify(metrics));
});

test('actual raster bounds stay within 30 CSS pixels and level zero paints no number at DPR 1, 2 and 3',async({page})=>{
 await page.goto('/?debug');
 const results=await page.evaluate(async()=>{
   const {drawCityMarker}=await import('/src/render/building-markers.js');
   const results=[];
   for(const dpr of [1,2,3])for(let level=0;level<=5;level++){
     const canvas=document.createElement('canvas');canvas.width=canvas.height=64*dpr;
     const c=canvas.getContext('2d'),labels=[],fillText=c.fillText.bind(c);
     c.fillText=(text,...args)=>{labels.push(text);fillText(text,...args);};
     c.scale(dpr,dpr);drawCityMarker(c,32,32,level,0);
     const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;let minX=Infinity,minY=Infinity,maxX=-1,maxY=-1;
     for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]){
       minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
     }
     results.push({level,dpr,labels,minX,minY,maxX,maxY,width:maxX-minX+1});
   }
   return results;
 });
 for(const r of results){
   expect(r.labels).toEqual(r.level?[String(r.level)]:[]);
   expect(r.width).toBeGreaterThanOrEqual(26*r.dpr);expect(r.width).toBeLessThanOrEqual(30*r.dpr);
   expect(r.minX).toBeGreaterThanOrEqual(17*r.dpr);expect(r.minY).toBeGreaterThanOrEqual(17*r.dpr);
   expect(r.maxX).toBeLessThan(47*r.dpr);expect(r.maxY).toBeLessThan(47*r.dpr);
 }
});

test('right-click menu maxes a single city in one paid action',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await start(page);await frame(page);
 const setup=await page.evaluate(()=>{
   const g=window.__atlas.getGame();g.factions[0].money=50000;
   window.__atlas.refresh();
   const site=window.__sites[0],index=site.y*480+site.x;
   return {index,level:g.cityUpgrades[index],gold:g.factions[0].money};
 });
 const marker=await page.evaluate(index=>{
   const r=window.__atlas.renderer;
   const m=r.visibleCityMarkers.find(m=>m.index===index);
   if(!m)throw Error('Expected an onscreen player city marker');
   const b=r.canvas.getBoundingClientRect();
   return {x:b.left+m.bounds.x+12,y:b.top+m.bounds.y+12};
 },setup.index);
 await page.mouse.click(marker.x,marker.y,{button:'right'});
 await expect(page.locator('[data-upgrade-max]')).toBeEnabled();
 await expect(page.locator('[data-upgrade-all]')).toBeVisible();
 const expected=await page.evaluate(index=>window.__atlas.getGame().previewCityUpgrades(
   0,'single',{x:index%480,y:Math.floor(index/480)}),setup.index);
 await expect(page.locator('[data-upgrade-max]')).toContainText(String(expected.finalLevel));
 await page.locator('[data-upgrade-max]').click();
 await expect(page.locator('#buildMenu')).toBeHidden();
 const actual=await page.evaluate(index=>{
   const g=window.__atlas.getGame();
   return {level:g.cityUpgrades[index],gold:g.factions[0].money};
 },setup.index);
 expect(actual.level).toBe(5);
 expect(actual.gold).toBe(setup.gold-expected.cost);
});

test('right-click global upgrade spends only affordable gold and maxes all player cities',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await start(page);await frame(page);
 const before=await page.evaluate(()=>{
   const g=window.__atlas.getGame();g.factions[0].money=50000;
   window.__atlas.refresh();
   return {gold:g.factions[0].money,preview:g.previewCityUpgrades(0,'all'),
     levels:window.__sites.map(p=>g.cityLevelAt(p))};
 });
 const marker=await page.evaluate(()=>{
   const r=window.__atlas.renderer,p=window.__sites[0],i=p.y*480+p.x;
   const m=r.visibleCityMarkers.find(m=>m.index===i);
   if(!m)throw Error('Expected city marker');
   const b=r.canvas.getBoundingClientRect();
   return {x:b.left+m.bounds.x+12,y:b.top+m.bounds.y+12};
 });
 await page.mouse.click(marker.x,marker.y,{button:'right'});
 await expect(page.locator('[data-upgrade-all]')).toBeEnabled();
 await expect(page.locator('[data-upgrade-all]')).toContainText(String(before.preview.cities));
 await page.locator('[data-upgrade-all]').click();
 await expect(page.locator('#buildMenu')).toBeHidden();
 const after=await page.evaluate(()=>{
   const g=window.__atlas.getGame();
   return {gold:g.factions[0].money,levels:window.__sites.map(p=>g.cityLevelAt(p))};
 });
 expect(after.gold).toBe(before.gold-before.preview.cost);
 expect(after.levels).toEqual(before.levels.map(()=>5));
});
