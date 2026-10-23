import {test,expect} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const evidence=new URL('../../docs/art-direction/screenshots/',import.meta.url).pathname;

test('pixel-art integration: atlases, exact bounds, dense construction, selection, marching, real contact and sea exclusion at DPR1/2',async({browser})=>{
 test.setTimeout(90000);await mkdir(evidence,{recursive:true});
 const reports=[];
 for(const dpr of [1,2]){
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:dpr});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/pixel-art/'))requests.push(r.url());});
  await page.addInitScript(()=>{
   window.__artDraws={};window.__artBadSmoothing=0;
   const original=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
    if(image instanceof HTMLImageElement&&image.src.includes('/pixel-art/')){
     const name=image.src.split('/').pop(),key=`${name}:${args[0]},${args[1]}`;
     window.__artDraws[key]=(window.__artDraws[key]??0)+1;
     if(this.imageSmoothingEnabled)window.__artBadSmoothing++;
    }
    return original.call(this,image,...args);
   };
  });
  await page.goto('/?debug');await page.locator('[data-country="DE"]').click();
  await page.evaluate(async()=>{
   const {Game}=await import('/src/engine/game.js');const api=window.__atlas,g=api.getGame();
   Object.assign(g,new Game(20261022,49,'DE','balanced',true));g.paused=true;g.factions.forEach(f=>f.ai=false);
   g.factions[0].money=100000;g.seedTerritory(0,g.cities[0],31);
   const center=g.cities[0];window.__sites=[];
   for(const [dx,dy,type,level] of [[0,-12,'city',0],[3,-12,'city',1],[6,-12,'city',2],[-6,-6,'city',3],[-3,-6,'city',4],[0,-6,'city',5],[8,8,'factory',0],[-8,8,'barracks',0],[0,12,'tower',0]]){
    let index=-1,best=Infinity;
    for(let i=0;i<g.owner.length;i++)if(g.owner[i]===0&&!g.buildings[i]&&!g.capitalSites.has(i)){
     const distance=(i%480-center.x-dx)**2+(Math.floor(i/480)-center.y-dy)**2;
     if(distance<best){best=distance;index=i;}
    }
    const point={x:index%480,y:Math.floor(index/480)};const result=g.build(0,point,type);if(!result.ok)throw Error(result.reason);
    for(let i=0;i<level;i++)if(!g.upgradeCity(0,point).ok)throw Error('Upgrade failed');
    window.__sites.push({...point,index:point.y*480+point.x,type,level});
   }
   api.renderer.setGame(g);api.refresh();api.renderer.focusOnPoint(center,4);
   const realCities=g.cities.filter(c=>g.owner[c.index]===0).length+g.buildings.reduce((n,code,i)=>n+(code===1&&g.owner[i]===0?1:0),0);
   if(api.renderer.military[0].cities!==realCities)throw Error('Capital graphics duplicated military city counts');
  });
  await expect.poll(()=>page.evaluate(()=>document.querySelector('#battleCanvas')&&window.__atlas.renderer.terrain.detail.dataset.ready)).toBe('true');
  const lod=[];
  for(const zoom of [1,1.25,1.8,4]){
   await page.evaluate(z=>{const a=window.__atlas;a.renderer.fit();a.renderer.zoomBy(z);a.renderer.focusOnPoint(a.getGame().cities[0],z);},zoom);
   await page.waitForTimeout(100);
   const checked=await page.evaluate(()=>{
    const {renderer:r,getGame}=window.__atlas,g=getGame(),box=r.canvas.getBoundingClientRect(),markers=r.visibleCityMarkers.filter(m=>g.owner[m.index]===0);
    const overlaps=[];let matches=0;
    for(const [i,m] of markers.entries()){
     const b=m.bounds;
     for(const [dx,dy] of [[1,1],[b.width-1,1],[1,b.height-1],[b.width-1,b.height-1],[b.width/2,b.height/2]]){
      const p=r.cellAt(box.left+b.x+dx,box.top+b.y+dy,false);
      if(!p||p.y*480+p.x!==m.index)throw Error(`Hit bounds miss ${m.index} at ${dx}/${dy}`);matches++;
     }
     for(const other of markers.slice(i+1)){
      const a=other.bounds;if(b.x<a.x+a.width&&b.x+b.width>a.x&&b.y<a.y+a.height&&b.y+b.height>a.y)overlaps.push([m.index,other.index]);
     }
    }
    return {zoom:r.zoom,markers:markers.length,matches,overlaps};
   });
   expect(checked.markers).toBeGreaterThan(5);expect(checked.overlaps).toEqual([]);lod.push(checked);
  }
  await page.screenshot({path:`${evidence}after-dense-dpr${dpr}.png`});
  const city=await page.evaluate(()=>{
   const {renderer:r,getGame}=window.__atlas,g=getGame(),m=r.visibleCityMarkers.find(m=>m.level===4&&g.owner[m.index]===0),box=r.canvas.getBoundingClientRect();
   return {index:m.index,x:box.left+m.bounds.x+m.bounds.width/2,y:box.top+m.bounds.y+m.bounds.height/2};
  });
  await page.mouse.move(city.x,city.y);await expect(page.locator('#mapInfo')).toBeVisible();
  await page.mouse.click(city.x,city.y,{button:'right'});
  await expect(page.locator('#buildMenu')).toBeVisible();await expect(page.locator('[data-upgrade-city]')).toContainText('5');
  await page.locator('[data-upgrade-city]').click();
  expect(await page.evaluate(i=>window.__atlas.getGame().cityUpgrades[i],city.index)).toBe(5);
  // Real pointer construction on a clear, empty owned sector.
  const empty=await page.evaluate(()=>{
   const {renderer:r,getGame}=window.__atlas,g=getGame(),center=g.cities[0],point={x:center.x+17,y:center.y+6};r.focusOnPoint(point,4);
   window.__emptyIndex=point.y*480+point.x;const b=r.canvas.getBoundingClientRect();return {x:b.left+r.canvas.clientWidth/2,y:b.top+r.canvas.clientHeight/2};
  });
  await page.waitForTimeout(100);await page.mouse.click(empty.x,empty.y,{button:'right'});
  await page.locator('[data-build="factory"]').click();
  expect(await page.evaluate(()=>window.__atlas.getGame().buildings[window.__emptyIndex])).toBe(3);
  // Pay for two adjacent real armies, then let the engine resolve contact.
  const combat=await page.evaluate(async()=>{
   const {landNeighbors,cellToPoint}=await import('/src/engine/game.js');
   const {renderer:r,getGame,refresh}=window.__atlas,g=getGame();
   const own=g.owner.findIndex((v,i)=>v===0&&!g.buildings[i]&&!g.capitalSites.has(i)&&landNeighbors(i).some(n=>g.owner[n]===-1&&!g.buildings[n]));
   const enemy=landNeighbors(own).find(n=>g.owner[n]===-1&&!g.buildings[n]);
   g.seedTerritory(1,cellToPoint(enemy),3.4);g.factions[1].money=10000;
   for(const [id,index] of [[0,own],[1,enemy]]){
    if(!g.build(id,cellToPoint(index),'barracks').ok||!g.recruitSquad(id,cellToPoint(index),100).ok)throw Error('Paid recruitment failed');
   }
   g.paused=false;g.step();g.paused=true;refresh();r.focusOnPoint(cellToPoint(own),4);
   return {own,enemy,events:g.battleEvents.length,losses:g.battleEvents.map(e=>e.attackerLost+e.defenderLost)};
  });
  expect(combat.events).toBeGreaterThan(0);expect(combat.losses.some(x=>x>0)).toBe(true);
  await page.waitForTimeout(120);
  await page.screenshot({path:`${evidence}after-contact-dpr${dpr}.png`});
  const hit=await page.evaluate(()=>{const r=window.__atlas.renderer,b=r.canvas.getBoundingClientRect(),u=r.squadHits.find(u=>u.owner===0);return {id:u.id,x:b.left+u.x,y:b.top+u.y};});
  await page.mouse.click(hit.x,hit.y);
  expect(await page.evaluate(()=>window.__atlas.renderer.selectedSquadIds)).toEqual([hit.id]);
  const target=await page.evaluate(()=>{
   const {renderer:r,getGame}=window.__atlas,g=getGame(),unit=g.squads.find(s=>s.owner===0),box=r.canvas.getBoundingClientRect();
   for(let i=0;i<g.owner.length;i++){
    const distance=Math.hypot(i%480-unit.index%480,Math.floor(i/480)-Math.floor(unit.index/480));
    if(g.owner[i]!==0||g.buildings[i]||distance<3||distance>8)continue;
    const x=box.left+r.ox+(i%480+.5)*1600/480*r.scale,y=box.top+r.oy+(Math.floor(i/480)+.5)*900/260*r.scale;
    if(x<box.left+40||y<box.top+180||x>box.right-40||y>box.bottom-70)continue;
    const p=r.cellAt(x,y,false);if(p&&p.y*480+p.x===i)return {x,y,index:i};
   }throw Error('No visible march destination');
  });
  await page.mouse.click(target.x,target.y,{button:'right'});
  expect(await page.evaluate(id=>window.__atlas.getGame().squads.find(s=>s.id===id).destination,hit.id)).toBe(target.index);
  const march=await page.evaluate(id=>{
   const {getGame,refresh}=window.__atlas,g=getGame(),unit=g.squads.find(s=>s.id===id),before=unit.index;
   g.paused=false;g.step();g.paused=true;refresh();return {before,after:unit.index};
  },hit.id);
  expect(march.after).not.toBe(march.before);await page.waitForTimeout(120);
  await page.screenshot({path:`${evidence}after-march-dpr${dpr}.png`});
  const invariant=await page.evaluate(async()=>{
   const a=window.__atlas,g=a.getGame(),before=JSON.stringify(g.exportSave());
   await new Promise(resolve=>setTimeout(resolve,150));return before===JSON.stringify(g.exportSave());
  });expect(invariant).toBe(true);
  const art=await page.evaluate(()=>({keys:Object.keys(window.__artDraws),badSmoothing:window.__artBadSmoothing}));
  const states=await page.evaluate(async()=>{
   const {PIXEL_ART_SPRITES}=await import('/src/render/pixel-art-manifest.js');
   return [...new Set(Object.values(PIXEL_ART_SPRITES.soldiers).filter(f=>window.__artDraws[`soldiers.png:${f.x},${f.y}`]).map(f=>f.state))].sort();
  });expect(states).toEqual(['fire','idle','move']);
  for(const name of ['terrain.png','buildings.png','soldiers.png','effects.png'])expect(art.keys.some(k=>k.startsWith(name))).toBe(true);
  expect(art.badSmoothing).toBe(0);expect(requests.length).toBe(4);expect(new Set(requests).size).toBe(4);expect(errors).toEqual([]);
  // Embarked real units cannot leak into the land infantry renderer.
  const sea=await page.evaluate(()=>{
   const {renderer:r,getGame,refresh}=window.__atlas,g=getGame(),unit=g.squads.find(s=>s.owner===0);
   const water=g.owner.findIndex(v=>v===-2);unit.seaRoute=[unit.index,water,water+1];unit.seaLanding=unit.index;unit.seaTicks=1;unit.destination=null;refresh();return unit.id;
  });
  await page.waitForTimeout(100);expect(await page.evaluate(id=>window.__atlas.renderer.squadHits.some(h=>h.id===id),sea)).toBe(false);
  // Regression for crowded coastal formations displaced into the Channel.
  const campaign=JSON.parse(await readFile(new URL('../../docs/qa/deep-game-20261022/render-fixture.json',import.meta.url),'utf8'));
  await page.evaluate(async snapshot=>{
   const {Game}=await import('/src/engine/game.js');
   const {renderer:r,getGame,refresh}=window.__atlas,g=getGame();
   Object.assign(g,Game.fromSave(snapshot));g.paused=false;for(let i=0;i<9;i++)g.step();g.paused=true;
   r.setGame(g);refresh();r.focusOnPoint({x:153,y:140},4);
  },campaign);
  await page.waitForTimeout(120);
  const coastal=await page.evaluate(()=>{
   const r=window.__atlas.renderer;
   return [...r.squadHits,...r.squadClusterHits].filter(h=>!r.landAtScreen(h.x,h.y));
  });expect(coastal).toEqual([]);expect(errors).toEqual([]);
  reports.push({dpr,lod,combat,march,soldierStates:states,atlasRequests:requests.length,stateUnchanged:invariant,coastalLandMarkers:true,errors});
  await context.close();
 }
 await writeFile(`${evidence}integration-results.json`,JSON.stringify(reports,null,2));
});
