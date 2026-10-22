import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const evidence=new URL('./artifacts/deep-rts/',import.meta.url).pathname;
async function start(page){
 await page.setViewportSize({width:1440,height:1000});await page.goto('/?debug');
 await page.locator('[data-country="DE"]').click();
 await page.evaluate(()=>{const g=window.__atlas.getGame();g.paused=true;g.factions.forEach(f=>f.ai=false);window.__atlas.refresh();});
}
async function formation(page){
 return page.evaluate(()=>{
  const {getGame,renderer:r,refresh}=window.__atlas,g=getGame();g.factions[0].money=5000;
  const site=g.owner.findIndex((owner,tile)=>owner===0&&tile%480<475&&
   [tile+1,tile+2,tile+3,tile+4,tile+480,tile+481].every(n=>g.owner[n]===0)&&
   g.canBuild(0,{x:tile%480,y:Math.floor(tile/480)},'barracks').ok);
  if(site<0)throw Error('Missing owned tactical fixture');
  const point={x:site%480,y:Math.floor(site/480)};
  if(!g.build(0,point,'barracks').ok||!g.recruitSquad(0,point,100).ok)throw Error('Paid recruitment failed');
  refresh();r.focusOnPoint(point,3);const box=r.canvas.getBoundingClientRect();
  const at=index=>({x:box.left+r.ox+(index%480+.5)*1600/480*r.scale,
   y:box.top+r.oy+(Math.floor(index/480)+.5)*900/260*r.scale});
  return {site,id:g.squads[0].id,from:at(site),destination:site+4,to:at(site+4)};
 });
}

test('RTS selection, right-click movement, shift context and deselection work through real pointer events',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page);const f=await formation(page);
 await expect(page.locator('#troopCount')).toHaveText('190');
 await expect(page.locator('#rtsMilitaryField')).toHaveText('100');
 expect(await page.evaluate(()=>window.__atlas.renderer.military[0].total)).toBe(190);
 await expect(page.locator('#incomeCount')).toHaveText('+0');
 await page.mouse.click(f.from.x,f.from.y);
 expect(await page.evaluate(()=>window.__atlas.renderer.selectedSquadIds)).toEqual([f.id]);
 await page.mouse.click(f.to.x,f.to.y,{button:'right'});
 expect(await page.evaluate(()=>window.__atlas.getGame().squads[0].destination)).toBe(f.destination);
 expect(await page.evaluate(()=>window.__atlas.getGame().attackOrders.length)).toBe(0);
 await page.keyboard.down('Shift');await page.mouse.click(f.to.x,f.to.y,{button:'right'});await page.keyboard.up('Shift');
 await expect(page.locator('#buildMenu')).toBeVisible();await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>window.__atlas.getGame().squads[0].destination)).toBe(f.destination);
 await page.mouse.click(f.to.x,f.to.y);
 expect(await page.evaluate(()=>window.__atlas.renderer.selectedSquadIds)).toEqual([]);
 expect(errors).toEqual([]);
});

test('batched territory has pixel-identical ownership coverage, contours and holes',async({page})=>{
 await start(page);
 const result=await page.evaluate(async()=>{
  const {getGame,renderer:r,refresh}=window.__atlas,g=getGame();
  // A progressed map with neutral holes and all country boundaries.
  for(let i=0;i<360;i++){g.paused=false;g.status='playing';g.factions.slice(1).forEach(f=>f.ai=true);g.step();}g.paused=true;refresh();
  const before=JSON.stringify(g.exportSave());
  const {territoryContours,contourRings}=await import('/src/render/territory-contours.js');
  const {pixelGridEdges}=await import('/src/render/pixel-grid.js');
  const reference=document.createElement('canvas');reference.width=1600;reference.height=900;
  const c=reference.getContext('2d'),xe=pixelGridEdges(480,1600),ye=pixelGridEdges(260,900);
  let sectors=0;for(let i=0;i<g.owner.length;i++){
   const id=g.owner[i];if(id<0)continue;sectors++;
   const x=i%480,y=Math.floor(i/480);c.fillStyle=g.factions[id].color+'9a';c.fillRect(xe[x],ye[y],xe[x+1]-xe[x],ye[y+1]-ye[y]);
  }
  c.save();c.lineCap='round';c.lineJoin='round';
  const contours=territoryContours(g.owner,480);
  for(const faction of g.factions){
   const segments=contours.get(faction.id);if(!segments?.length)continue;const path=new Path2D();
   for(const ring of contourRings(segments)){
    path.moveTo(ring[0]*1600/480,ring[1]*900/260);
    for(let j=2;j<ring.length;j+=2)path.lineTo(ring[j]*1600/480,ring[j+1]*900/260);path.closePath();
   }
   c.strokeStyle='rgba(6,19,27,.52)';c.lineWidth=2.2;c.stroke(path);
   c.strokeStyle=faction.color+'a0';c.lineWidth=1.15;c.stroke(path);
   c.strokeStyle='rgba(236,246,224,.24)';c.lineWidth=.55;c.stroke(path);
  }c.restore();
  const ctx=r.overlay.getContext('2d'),fill=ctx.fillRect;let calls=0;
  ctx.fillRect=function(...args){calls++;return fill.apply(this,args);};r.updateTerritory();ctx.fillRect=fill;
  const actual=ctx.getImageData(0,0,1600,900).data,expected=c.getImageData(0,0,1600,900).data;
  let different=0;for(let i=0;i<actual.length;i++)if(actual[i]!==expected[i])different++;
  return {different,calls,sectors,unchanged:before===JSON.stringify(g.exportSave())};
 });
 expect(result.different).toBe(0);expect(result.calls).toBeLessThan(result.sectors/3);expect(result.unchanged).toBe(true);
});

test('diagonal formations interpolate smoothly and reduced motion uses the actual position',async({page})=>{
 await start(page);const f=await formation(page);
 const result=await page.evaluate(f=>{
  const {renderer:r,getGame}=window.__atlas,g=getGame(),unit=g.squads[0],c=r.canvas.getContext('2d');
  r.selectedSquadIds=[unit.id];r.squadVisuals.clear();g.paused=false;r.drawSquads(c,1000);
  unit.index=f.site+481;r.drawSquads(c,1010);
  const before=JSON.stringify(g.exportSave()),ellipse=c.ellipse,points=[];
  c.ellipse=function(...args){points.push(args.slice(0,2));return ellipse.apply(this,args);};
  r.drawSquads(c,1095);const halfway=points[0];points.length=0;
  r.reducedMotion=true;r.drawSquads(c,1095);const reduced=points[0];c.ellipse=ellipse;g.paused=true;
  return {halfway,reduced,from:r.squadVisuals.get(unit.id).from,
   expectedHalf:[r.ox+(f.site%480+1)*1600/480*r.scale,r.oy+(Math.floor(f.site/480)+1)*900/260*r.scale],
   expectedEnd:[r.ox+(unit.index%480+.5)*1600/480*r.scale,r.oy+(Math.floor(unit.index/480)+.5)*900/260*r.scale],
   unchanged:before===JSON.stringify({...g.exportSave(),paused:false})};
 },f);
 expect(result.from).toBe(f.site);expect(result.unchanged).toBe(true);
 for(let axis=0;axis<2;axis++){
  expect(result.halfway[axis]).toBeCloseTo(result.expectedHalf[axis],4);
  expect(result.reduced[axis]).toBeCloseTo(result.expectedEnd[axis],4);
 }
});

test('sailing formations have one ship, no land cluster and no ghost port selection',async({page})=>{
 await start(page);const f=await formation(page);
 await page.evaluate(async()=>{
  const {getGame,renderer:r,refresh}=window.__atlas,g=getGame(),unit=g.squads[0];
  const {MaritimeNavigation,COASTS}=await import('/src/engine/navigation.js');
  const port=COASTS.find(tile=>g.owner[tile]===-1);g.owner[port]=0;g.recount();const nav=new MaritimeNavigation();
  const target=COASTS.find(tile=>g.owner[tile]===-1&&nav.route(g.owner,0,tile));
  const route=nav.route(g.owner,0,target);
  unit.index=route.cells[0];unit.destination=null;unit.seaRoute=route.cells;unit.seaLanding=route.cells.at(-1);unit.seaTicks=2;
  r.selectedSquadIds=[];refresh();r.focusOnPoint({x:unit.index%480,y:Math.floor(unit.index/480)},3);
 });
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const result=await page.evaluate(()=>{
  const {getGame,renderer:r}=window.__atlas,g=getGame(),unit=g.squads[0],box=r.canvas.getBoundingClientRect();
  return {land:r.squadVisuals.has(unit.id),clusters:r.squadClusterHits.flatMap(c=>c.ids),
   x:box.left+r.ox+(unit.index%480+.5)*1600/480*r.scale,y:box.top+r.oy+(Math.floor(unit.index/480)+.5)*900/260*r.scale};
 });
 expect(result.land).toBe(false);expect(result.clusters).not.toContain(f.id);
 await page.mouse.click(result.x,result.y);
 expect(await page.evaluate(()=>window.__atlas.renderer.selectedSquadIds)).toEqual([]);
});

test('real contact battles remain individually visible and rendering leaves all game state unchanged',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 await page.evaluate(async()=>{
  const {getGame,renderer:r,refresh}=window.__atlas,g=getGame();
  const {landNeighbors}=await import('/src/engine/game.js');
  const start=g.owner.findIndex((id,tile)=>id===0&&landNeighbors(tile).some(n=>g.owner[n]===-1));
  const target=landNeighbors(start).find(n=>g.owner[n]===-1);g.owner[target]=1;
  const unit=(id,owner,index)=>({id,owner,index,troops:100,destination:null,attackTarget:null,campaignTarget:null,campaignOwner:null});
  g.squads.push(unit(9001,0,start),unit(9002,0,start),unit(9003,1,target));
  g.tick=10;g.resolveSquadContacts();g.recount();refresh();r.selectedSquadIds=[9001];
  r.focusOnPoint({x:start%480,y:Math.floor(start/480)},3);
  window.__renderBefore=JSON.stringify(g.exportSave());
 });
 await page.waitForTimeout(400);
 const result=await page.evaluate(()=>{
  const {getGame,renderer:r}=window.__atlas,g=getGame();
  return {events:g.battleEvents.length,clusters:r.squadClusterHits.flatMap(c=>c.ids),
   hits:[...r.squadBattles.values()].filter(v=>v.hit).length,unchanged:window.__renderBefore===JSON.stringify(g.exportSave())};
 });
 expect(result.events).toBeGreaterThan(0);expect(result.hits).toBe(3);
 expect(result.clusters).not.toContain(9002);expect(result.unchanged).toBe(true);expect(errors).toEqual([]);
 const marker=await page.evaluate(()=>{
  const r=window.__atlas.renderer,hit=r.squadHits.find(h=>h.id===9002),box=r.canvas.getBoundingClientRect();
  return {x:box.left+hit.x,y:box.top+hit.y};
 });
 await page.mouse.click(marker.x,marker.y);
 expect(await page.evaluate(()=>window.__atlas.renderer.selectedSquadIds)).toEqual([9002]);
 await mkdir(evidence,{recursive:true});await page.screenshot({path:evidence+'after-contact.png'});
});
