import {test,expect} from '@playwright/test';
async function start(page){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});await page.goto('/?debug&perfTest&seed=2026');await page.locator('#loading').waitFor({state:'detached'});
 await page.evaluate(()=>{window.__reborn.game.aiClock=-1e8;window.__reborn.refresh();});return errors;
}
async function build(page,kind){
 const site=await page.evaluate(kind=>{const a=window.__reborn,g=a.game,hq=g.bases[0],w=g.units.find(u=>u.owner===0&&u.kind==='engineer');a.renderer.selected=new Set([w.id]);a.renderer.selectedBase=null;a.refresh();
  for(let radius=180;radius<650;radius+=25)for(let i=0;i<32;i++){const p={x:hq.x+Math.cos(i*Math.PI/16)*radius,y:hq.y+Math.sin(i*Math.PI/16)*radius};if(!g.buildError(0,kind,p)){a.renderer.camera.x=p.x;a.renderer.camera.y=p.y;a.renderer.boundCamera();const at=a.renderer.screen(p);if(at.y>130&&at.y<a.renderer.height-270&&document.elementFromPoint(at.x,at.y)?.id==='world')return p;}}throw Error('No legal site');},kind);
 await page.locator('#build-mode').click();await page.locator(`[data-build="${kind}"]`).click();const at=await page.evaluate(p=>window.__reborn.renderer.screen(p),site),box=await page.locator('#world').boundingBox();await page.mouse.click(box.x+at.x,box.y+at.y);
 return page.evaluate(kind=>{const b=window.__reborn.game.bases.find(b=>b.kind===kind);return {id:b.id,remaining:b.buildRemaining};},kind);
}
async function finish(page,id){await page.evaluate(id=>{const a=window.__reborn,g=a.game;g.paused=false;for(let i=0;i<2400&&g.bases.find(b=>b.id===id).buildRemaining>0;i++)g.step();g.paused=true;a.refresh();a.renderer.render(0);},id);}

test('production: worker and soldier start; HQ trains only workers; actual barracks construction unlocks soldiers and durable queues',async({page})=>{
 const errors=await start(page);expect(await page.evaluate(()=>window.__reborn.game.units.filter(u=>u.owner===0).map(u=>u.kind).sort())).toEqual(['engineer','infantry']);
 await expect(page.locator('#catalog-units [data-unit]:visible')).toHaveCount(1);await expect(page.locator('[data-unit="engineer"]')).toBeVisible();await expect(page.locator('[data-unit="infantry"]')).toBeHidden();
 await page.locator('#select-base').click();await expect(page.locator('[data-context-unit]')).toHaveCount(1);await expect(page.locator('[data-context-unit="engineer"]')).toBeVisible();await expect(page.locator('#recruit')).toHaveAttribute('data-kind','engineer');
 await page.locator('#recruit').click();expect(await page.evaluate(()=>window.__reborn.game.bases[0].queueTypes)).toEqual(['engineer']);await page.locator('#cancel').click();await expect(page.locator('#credits')).toHaveText('500');
 const barracks=await build(page,'barracks');expect(barracks.remaining).toBeGreaterThan(0);await expect(page.locator('[data-unit="infantry"]')).toBeHidden();await finish(page,barracks.id);
 await expect(page.locator('#catalog-units [data-unit]:visible')).toHaveCount(4);for(const kind of ['infantry','medic','heavy'])await expect(page.locator(`[data-unit="${kind}"]`)).toBeVisible();await expect(page.locator('[data-unit="tank"]')).toBeHidden();
 await page.locator('[data-unit="infantry"]').click();expect(await page.evaluate(id=>window.__reborn.game.bases.find(b=>b.id===id).queueTypes,barracks.id)).toEqual(['infantry']);
 await page.evaluate(async()=>{const a=window.__reborn;await a.save();await a.load();a.game.paused=true;a.game.aiClock=-1e8;a.refresh();});await expect(page.locator('[data-unit="infantry"]')).toBeVisible();
 const produced=await page.evaluate(()=>{const a=window.__reborn,g=a.game;g.paused=false;for(let i=0;i<101;i++)g.step();g.paused=true;a.refresh();return g.units.filter(u=>u.owner===0&&u.kind==='infantry').length;});expect(produced).toBe(2);expect(errors).toEqual([]);
});

test('production: real factory and airfield unlock their own menus only after completion, destroyed facilities hide them again',async({page})=>{
 const errors=await start(page);await page.evaluate(()=>window.__reborn.game.credits[0]=5000);
 for(const [building,roles] of [['factory',['rover','tank','artillery']],['airfield',['scout','gunship','bomber']]]){
  const b=await build(page,building);for(const kind of roles)await expect(page.locator(`[data-unit="${kind}"]`)).toBeHidden();await finish(page,b.id);
  for(const kind of roles)await expect(page.locator(`[data-unit="${kind}"]`)).toBeVisible();
  await page.evaluate(id=>{const a=window.__reborn;a.renderer.selected.clear();a.renderer.selectedBase=id;a.refresh();},b.id);await expect(page.locator('[data-context-unit]')).toHaveCount(3);
  await page.locator(`[data-context-unit="${roles[0]}"]`).click();expect(await page.evaluate(id=>window.__reborn.game.bases.find(b=>b.id===id).queueTypes,b.id)).toEqual([roles[0]]);
 }
 await expect(page.locator('[data-unit="infantry"]')).toBeHidden();
 await page.evaluate(()=>{const a=window.__reborn;a.game.bases.find(b=>b.owner===0&&b.kind==='factory').hp=0;a.refresh();});for(const kind of ['rover','tank','artillery'])await expect(page.locator(`[data-unit="${kind}"]`)).toBeHidden();await expect(page.locator('[data-unit="scout"]')).toBeVisible();expect(errors).toEqual([]);
});

test('production: full queues disable available cards without hiding their category; enemy buildings do not unlock it',async({page})=>{
 await start(page);await page.evaluate(()=>{const a=window.__reborn,g=a.game;g.credits[0]=10000;const b={...g.bases[0],id:1800,kind:'barracks',hp:800,queue:[],queueTypes:[],queueCosts:[]};g.bases.push(b);for(let i=0;i<8;i++)g.recruit(b.id,'infantry');a.refresh();});
 await expect(page.locator('[data-unit="infantry"]')).toBeVisible();await expect(page.locator('[data-unit="infantry"]')).toBeDisabled();await expect(page.locator('[data-production-building="barracks"]')).toBeVisible();
 await page.evaluate(()=>{const a=window.__reborn;a.game.bases.find(b=>b.id===1800).owner=1;a.refresh();});await expect(page.locator('[data-production-building="barracks"]')).toBeHidden();
 await page.screenshot({path:'artifacts/reborn/production-hq-workers-only.png'});
});

test('production: old paid HQ queues migrate through IndexedDB without free starting units or repeated refunds',async({page})=>{
 await start(page);const loaded=await page.evaluate(async()=>{
  const a=window.__reborn,{saveCampaign}=await import('/src/reborn/storage.js'),raw=a.game.save();delete raw.productionVersion;raw.units=raw.units.filter(u=>u.kind==='infantry');raw.credits[0]=50;
  Object.assign(raw.bases[0],{queue:[5,7,15],queueTypes:['infantry','engineer','tank'],queueCosts:[100,200,450],production:2});
  await saveCampaign({save:()=>raw});await a.load();a.game.paused=true;a.game.aiClock=-1e8;a.refresh();
  const first={credits:a.game.credits[0],units:a.game.count(0),queue:[...a.game.bases[0].queueTypes]};await a.save();await a.load();a.game.paused=true;a.refresh();return {first,second:{credits:a.game.credits[0],units:a.game.count(0),queue:a.game.bases[0].queueTypes}};
 });
 expect(loaded.first).toEqual({credits:600,units:1,queue:['engineer']});expect(loaded.second).toEqual(loaded.first);await expect(page.locator('[data-unit="infantry"]')).toBeHidden();await expect(page.locator('[data-unit="engineer"]')).toBeVisible();
});
