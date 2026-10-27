import {test,expect} from '@playwright/test';

async function start(page){
 await page.setViewportSize({width:1440,height:1000});await page.goto('/?debug&legacy');await page.locator('#loading').waitFor({state:'detached'});
 await page.evaluate(()=>{const api=window.__reborn;api.game.paused=true;api.game.aiClock=-1e8;api.game.credits[0]=5000;api.refresh();});
}
async function advance(page,seconds){await page.evaluate(seconds=>{const api=window.__reborn,g=api.game;g.paused=false;for(let i=0;i<Math.round(seconds/.05);i++)g.step();g.paused=true;api.refresh();api.renderer.render(0);},seconds);}
async function clickWorld(page,p,button='left'){const at=await page.evaluate(p=>window.__reborn.renderer.screen(p),p);await page.mouse.click(at.x,at.y,{button});}
async function center(page,p){await page.evaluate(p=>{const r=window.__reborn.renderer;r.camera.x=p.x;r.camera.y=p.y;r.boundCamera();r.render(0);},p);}

test('support HUD: empty click hides all context, targeted buildings and groups have correct actions, global production stays usable',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 await expect(page.locator('#selection-panel')).toBeHidden();await expect(page.locator('#production')).toBeVisible();
 await page.locator('[data-unit="engineer"]').click();await expect(page.locator('#queue')).toContainText('1 IM AUFTRAG');await expect(page.locator('#selection-panel')).toBeHidden();
 await page.locator('#select-base').click();await expect(page.locator('#selection-title')).toHaveText('Hauptquartier');await expect(page.locator('[data-context-unit="engineer"]')).toBeVisible();
 await page.mouse.click(500,350);await expect(page.locator('#selection-panel')).toBeHidden();await expect(page.locator('#production')).toBeVisible();
 const units=await page.evaluate(()=>{const {game:g,renderer:r}=window.__reborn;const u=g.units[0];g.units=[u];const w=g.spawn(0,{x:u.x+65,y:u.y},'engineer');r.camera.x=u.x;r.camera.y=u.y;r.render(0);return [u,w].map(u=>r.screen({x:u.x,y:u.y-18}));});
 await page.mouse.move(units[0].x-35,units[0].y-40);await page.mouse.down();await page.mouse.move(units[1].x+35,units[1].y+40,{steps:5});await page.mouse.up();
 await expect(page.locator('#selection-title')).toHaveText('2 Einheiten');await expect(page.locator('#selection-detail')).toContainText('Ingenieur');await expect(page.locator('#build-mode')).toBeVisible();
 expect(errors).toEqual([]);
});

test('support HUD: medic right-click heals infantry, exposes heal/move/hold/stop and renders distinct animated equipment',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 const state=await page.evaluate(()=>{const {game:g,renderer:r}=window.__reborn,p=g.units[0];p.hp=30;const m=g.spawn(0,{x:p.x+100,y:p.y},'medic'),w=g.spawn(0,{x:p.x+180,y:p.y+60},'engineer');r.camera.x=p.x+80;r.camera.y=p.y;r.render(0);return {m:{x:m.x,y:m.y-18},s:{x:p.x,y:p.y-18},id:m.id,soldier:p.id};});
 await clickWorld(page,state.m);await expect(page.locator('#selection-title')).toHaveText('Sanitäter');await expect(page.locator('#heal-mode')).toBeVisible();await expect(page.locator('#build-mode')).toBeHidden();
 for(const id of ['move-mode','hold','stop'])await expect(page.locator('#'+id)).toBeVisible();
 await clickWorld(page,state.s,'right');expect(await page.evaluate(id=>window.__reborn.game.units.find(u=>u.id===id).orders[0].kind,state.id)).toBe('heal');
 await advance(page,3);expect(await page.evaluate(id=>window.__reborn.game.units.find(u=>u.id===id).hp,state.soldier)).toBeGreaterThan(30);
 const sources=await page.evaluate(()=>['infantry','medic','engineer'].map(k=>{const a=window.__reborn.renderer.units.asset(k);return {src:a.image.src,frames:a.data.frames.length,role:a.data.design.role};}));
 expect(new Set(sources.map(a=>a.src)).size).toBe(3);expect(sources.map(a=>a.frames)).toEqual([296,296,296]);expect(sources[1].role).toBe('medic');expect(sources[2].role).toBe('engineer');
 await page.locator('#hold').click();expect(await page.evaluate(id=>window.__reborn.game.units.find(u=>u.id===id).hold,state.id)).toBe(true);
 await page.screenshot({path:'artifacts/reborn/support-medic.png'});expect(errors).toEqual([]);
});

test('support HUD: real worker placement, cancellation, two completed buildings, barracks training/rally, repair and durable orders',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 const worker=await page.evaluate(()=>{const {game:g}=window.__reborn,w=g.units.find(u=>u.owner===0&&u.kind==='engineer');return {id:w.id,x:w.x,y:w.y-18};});
 await center(page,worker);await clickWorld(page,worker);await expect(page.locator('#selection-title')).toHaveText('Ingenieur');
 const credits=await page.evaluate(()=>window.__reborn.game.credits[0]);
 await page.locator('#build-mode').click();await page.locator('[data-build="barracks"]').click();await page.keyboard.press('Escape');expect(await page.evaluate(()=>window.__reborn.renderer.placement)).toBe(null);
 await page.locator('#build-mode').click();await page.locator('[data-build="turret"]').click();await page.mouse.click(600,400,{button:'right'});expect(await page.evaluate(()=>window.__reborn.renderer.placement)).toBe(null);expect(await page.evaluate(()=>window.__reborn.game.credits[0])).toBe(credits);
 for(const kind of ['turret','barracks']){
  const p=await page.evaluate(kind=>{const g=window.__reborn.game;for(let y=2100;y<3450;y+=28)for(let x=220;x<1750;x+=28)if(!g.buildError(0,kind,{x,y}))return {x,y};throw Error('No site');},kind);
  const w=await page.evaluate(id=>{const u=window.__reborn.game.units.find(u=>u.id===id);return {x:u.x,y:u.y-18};},worker.id);await center(page,w);await clickWorld(page,w);
  await page.locator('#build-mode').click();await page.locator(`[data-build="${kind}"]`).click();
  if(kind==='turret'){
   const b=await page.evaluate(()=>{const b=window.__reborn.game.bases[0];return {x:b.x,y:b.y};});await center(page,b);await clickWorld(page,b);expect(await page.evaluate(()=>window.__reborn.game.bases.length)).toBe(2);expect(await page.evaluate(()=>window.__reborn.game.credits[0])).toBe(credits);
  }
  await center(page,p);const at=await page.evaluate(p=>window.__reborn.renderer.screen(p),p);await page.mouse.move(at.x,at.y);await page.screenshot({path:`artifacts/reborn/support-${kind}-preview.png`});await page.mouse.click(at.x,at.y);
  expect(await page.evaluate(()=>window.__reborn.renderer.placement)).toBe(null);expect(await page.evaluate(kind=>window.__reborn.game.bases.find(b=>b.kind===kind).buildRemaining,kind)).toBeGreaterThan(0);
  await advance(page,25);expect(await page.evaluate(kind=>window.__reborn.game.bases.find(b=>b.kind===kind).buildRemaining,kind)).toBe(0);
 }
 const b=await page.evaluate(()=>{const b=window.__reborn.game.bases.find(b=>b.kind==='barracks');return {id:b.id,x:b.x,y:b.y-40};});await center(page,b);await clickWorld(page,b);
 await expect(page.locator('#selection-title')).toHaveText('Kaserne');await expect(page.locator('[data-context-unit]')).toHaveCount(3);
 await page.locator('[data-context-unit="medic"]').click();const rally={x:b.x+160,y:b.y+150};await clickWorld(page,rally,'right');await advance(page,8);
 expect(await page.evaluate(id=>{const g=window.__reborn.game,b=g.bases.find(b=>b.id===id);return {queue:b.queue.length,medics:g.units.filter(u=>u.kind==='medic').length,rally:!!b.rally};},b.id)).toEqual({queue:0,medics:1,rally:true});
 const repair=await page.evaluate(id=>{const api=window.__reborn,g=api.game,b=g.bases.find(b=>b.id===id),w=g.units.find(u=>u.kind==='engineer');b.hp=400;api.renderer.camera.x=(w.x+b.x)/2;api.renderer.camera.y=(w.y+b.y)/2;api.renderer.boundCamera();api.renderer.render(0);return {worker:{x:w.x,y:w.y-18},building:{x:b.x,y:b.y-35}};},b.id);
 await clickWorld(page,repair.worker);await clickWorld(page,repair.building,'right');expect(await page.evaluate(()=>window.__reborn.game.units.find(u=>u.kind==='engineer').orders[0].kind)).toBe('repair');
 await page.evaluate(async()=>{await window.__reborn.save();await window.__reborn.load();window.__reborn.game.paused=true;window.__reborn.refresh();});
 expect(await page.evaluate(()=>window.__reborn.game.units.find(u=>u.kind==='engineer').orders[0].kind)).toBe('repair');await advance(page,4);expect(await page.evaluate(id=>window.__reborn.game.bases.find(b=>b.id===id).hp,b.id)).toBeGreaterThan(400);
 await center(page,b);await clickWorld(page,b);await page.screenshot({path:'artifacts/reborn/support-barracks.png'});expect(errors).toEqual([]);
});
