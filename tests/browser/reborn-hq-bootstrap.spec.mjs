import {test,expect} from '@playwright/test';
const evidence='../../docs/hq-bootstrap/';
async function start(page){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:1000});
 await page.goto('/?debug&perfTest&seed=2026&map=medium');await page.locator('#loading').waitFor({state:'detached'});return errors;
}
async function placeHQ(page){
 const target=await page.evaluate(()=>{
  const {game:g,renderer:r}=window.__reborn;const worker=g.units.find(u=>u.owner===0&&u.kind==='engineer');r.selected=new Set([worker.id]);r.selectedBase=null;
  for(const p of g.headquartersCandidates(0))if(!g.buildError(0,'headquarters',p)){
   r.camera.x=p.x;r.camera.y=p.y;r.boundCamera();const at=r.screen(p);
   if(at.y>120&&at.y<r.height-240&&document.elementFromPoint(at.x,at.y)?.id==='world')return p;
  }throw Error('No visible HQ site');
 });
 await page.locator('#build-mode').click();await page.locator('[data-build="headquarters"]').click();
 await expect(page.locator('#hint')).toContainText('R: GEBÄUDE DREHEN');await page.keyboard.press('r');
 const screen=await page.evaluate(p=>window.__reborn.renderer.screen(p),target),box=await page.locator('#world').boundingBox();await page.mouse.click(box.x+screen.x,box.y+screen.y);
 return page.evaluate(()=>{const b=window.__reborn.game.bases.find(b=>b.owner===0&&b.kind==='headquarters');if(!b)throw Error('HQ placement failed');return b.id;});
}
async function complete(page,id){
 await page.evaluate(id=>{const a=window.__reborn,g=a.game;g.paused=false;for(let i=0;i<1400&&g.bases.find(b=>b.id===id).buildRemaining>0;i++)g.step();g.paused=true;a.refresh();a.renderer.render(0);},id);
}
test('HQ opening: only two starting units, only HQ build menu, animated offline noise and inert minimap controls',async({page})=>{
 const errors=await start(page);
 const initial=await page.evaluate(()=>{const {game:g,renderer:r}=window.__reborn;return {bases:g.bases.length,units:[0,1].map(o=>g.units.filter(u=>u.owner===o).map(u=>u.kind).sort()),online:g.radarOnline(0),selected:[...r.selected]};});
 expect(initial.bases).toBe(0);expect(initial.units).toEqual([['engineer','infantry'],['engineer','infantry']]);expect(initial.online).toBe(false);expect(initial.selected).toHaveLength(1);
 await expect(page.locator('#radar-offline')).toBeVisible();await expect(page.locator('#radar-offline')).toContainText('RADAR OFFLINE');await expect(page.locator('#hint')).toContainText('Errichte ein Hauptquartier');
 await page.locator('#build-mode').click();await expect(page.locator('[data-build="headquarters"]')).toBeVisible();
 for(const kind of ['barracks','factory','airfield','turret'])await expect(page.locator(`[data-build="${kind}"]`)).toBeHidden();
 await page.locator('#close-build-menu').click();
 const sample=()=>page.evaluate(()=>{const c=document.querySelector('#minimap'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return {grey:p.every((v,i)=>i%4===3||v===p[i-i%4]),signature:p.reduce((s,v,i)=>s+v*(1+i%13),0)};});
 const noise=await sample();await page.waitForTimeout(180);const moved=await sample();expect(noise.grey).toBe(true);expect(moved.grey).toBe(true);expect(noise.signature).not.toBe(moved.signature);
 const before=await page.evaluate(()=>({camera:{...window.__reborn.renderer.camera},orders:window.__reborn.game.units.map(u=>u.orders)}));
 const mini=page.locator('#minimap');await mini.click({position:{x:50,y:60}});await mini.click({button:'right',position:{x:90,y:100}});
 expect(await page.evaluate(()=>({camera:{...window.__reborn.renderer.camera},orders:window.__reborn.game.units.map(u=>u.orders)}))).toEqual(before);
 const check=await page.evaluate(()=>{const a=window.__reborn,g=a.game,r=a.renderer,before=JSON.stringify(g.save());r.render(0);const renderUnchanged=before===JSON.stringify(g.save()),worker=g.units.find(u=>u.owner===0&&u.kind==='engineer');
  g.command([worker.id],{x:worker.x+90,y:worker.y,kind:'move'});g.paused=false;g.step();g.paused=true;return {renderUnchanged,moving:worker.moving,unknown:g.visible[0].some(v=>v===0)};});
 expect(check.renderUnchanged).toBe(true);expect(check.moving).toBe(true);expect(check.unknown).toBe(true);
 await page.screenshot({path:evidence+'radar-offline-start.png'});expect(errors).toEqual([]);
});
test('HQ opening: real mirrored placement stays offline through paused construction, then enables radar and all base functions once',async({page})=>{
 const errors=await start(page),id=await placeHQ(page);
 const site=await page.evaluate(id=>{const {game:g}=window.__reborn,b=g.bases.find(b=>b.id===id);g.stop(g.units.filter(u=>u.owner===0).map(u=>u.id));return {remaining:b.buildRemaining,facing:b.facing,credits:g.credits[0],online:g.radarOnline(0)};},id);
 expect(site.facing).toBe(1);expect(site.remaining).toBe(20);expect(site.credits).toBe(650);expect(site.online).toBe(false);
 await page.evaluate(()=>{const a=window.__reborn;a.game.paused=false;a.advance(3);a.game.paused=true;});
 expect(await page.evaluate(id=>window.__reborn.game.bases.find(b=>b.id===id).buildRemaining,id)).toBe(site.remaining);await expect(page.locator('#radar-offline')).toBeVisible();
 await page.evaluate(id=>{const g=window.__reborn.game,w=g.units.find(u=>u.owner===0&&u.kind==='engineer'),b=g.bases.find(b=>b.id===id);g.command([w.id],{...b,kind:'build',target:id});},id);
 await complete(page,id);await expect(page.locator('#radar-offline')).toBeHidden();await expect(page.locator('#notices')).toContainText('Hauptquartier errichtet. Radar online.');
 const online=await page.evaluate(id=>{const g=window.__reborn.game,c=document.querySelector('#minimap'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return {remaining:g.bases.find(b=>b.id===id).buildRemaining,online:g.radarOnline(0),producer:g.producer(0,'engineer')?.id,coloured:p.some((v,i)=>i%4!==3&&v!==p[i-i%4])};},id);
 expect(online).toEqual({remaining:0,online:true,producer:id,coloured:true});
 await page.locator('#build-mode').click();await expect(page.locator('[data-build="headquarters"]')).toBeHidden();await expect(page.locator('[data-build="barracks"]')).toBeVisible();await page.locator('#close-build-menu').click();
 await page.screenshot({path:evidence+'radar-online-hq.png'});expect(errors).toEqual([]);
});
test('HQ opening: AI chooses and finishes its own HQ and continues paid Tactical AI construction',async({page})=>{
 const errors=await start(page);
 const result=await page.evaluate(()=>{const a=window.__reborn,g=a.game;g.paused=false;for(let i=0;i<1800;i++)g.step();g.paused=true;a.refresh();return {hq:g.bases.filter(b=>b.owner===1&&b.kind==='headquarters').map(b=>({remaining:b.buildRemaining,x:b.x,y:b.y})),built:g.bases.some(b=>b.owner===1&&b.kind==='barracks'),online:g.radarOnline(1),playerOnline:g.radarOnline(0)};});
 expect(result.hq).toHaveLength(1);expect(result.hq[0].remaining).toBe(0);expect(result.built).toBe(true);expect(result.online).toBe(true);expect(result.playerOnline).toBe(false);
 await expect(page.locator('#radar-offline')).toBeVisible();expect(errors).toEqual([]);
});
test('HQ opening: IndexedDB saves before HQ and during construction reload without new units or premature radar',async({page})=>{
 const errors=await start(page);
 await page.evaluate(async()=>{const a=window.__reborn;await a.save();await a.load();a.game.paused=true;a.refresh();});
 expect(await page.evaluate(()=>window.__reborn.game.bases.length)).toBe(0);await expect(page.locator('#radar-offline')).toBeVisible();
 const id=await placeHQ(page);
 const saved=await page.evaluate(async id=>{const a=window.__reborn;await a.save();await a.load();a.game.paused=true;a.refresh();const b=a.game.bases.find(b=>b.id===id);return {units:a.game.units.length,remaining:b.buildRemaining,facing:b.facing};},id);
 expect(saved.units).toBe(4);expect(saved.remaining).toBeGreaterThan(0);expect(saved.facing).toBe(1);await expect(page.locator('#radar-offline')).toBeVisible();
 await complete(page,id);await page.evaluate(async()=>{const a=window.__reborn;await a.save();await a.load();a.game.paused=true;a.refresh();});
 await expect(page.locator('#radar-offline')).toBeHidden();expect(errors).toEqual([]);
});
for(const during of [false,true])test(`HQ opening: no softlock when only pioneer dies ${during?'during construction':'before HQ'}`,async({page})=>{
 const errors=await start(page);if(during)await placeHQ(page);
 const state=await page.evaluate(()=>{const a=window.__reborn,g=a.game;g.units.find(u=>u.owner===0&&u.kind==='engineer').hp=0;g.paused=false;g.step();g.paused=true;a.refresh();return {status:g.status,soldiers:g.units.filter(u=>u.owner===0&&u.kind==='infantry').length};});
 expect(state).toEqual({status:'defeat',soldiers:1});await expect(page.locator('#result-dialog')).toBeVisible();await expect(page.locator('#result-copy')).toContainText('Pionier');expect(errors).toEqual([]);
});
test('HQ opening: a legacy saved campaign with HQs loads with its normal radar and build menu',async({page})=>{
 const errors=await start(page);
 await page.evaluate(async()=>{const a=window.__reborn,{saveCampaign}=await import('/src/reborn/storage.js'),old=new a.game.constructor(2026,12);await saveCampaign(old);await a.load();a.game.paused=true;a.renderer.selected=new Set([a.game.units.find(u=>u.owner===0&&u.kind==='engineer').id]);a.refresh();});
 await expect(page.locator('#radar-offline')).toBeHidden();expect(await page.evaluate(()=>window.__reborn.game.bootstrapVersion)).toBeUndefined();
 await page.locator('#build-mode').click();await expect(page.locator('[data-build="barracks"]')).toBeVisible();await expect(page.locator('[data-build="headquarters"]')).toBeHidden();expect(errors).toEqual([]);
});

test('HQ opening: compact layout keeps offline guidance over the receiver and preserves camera keyboard control',async({page})=>{
 const errors=await start(page);await page.setViewportSize({width:900,height:850});
 await expect(page.locator('#radar-offline')).toBeVisible();
 const bounds=await page.locator('#radar-offline strong').boundingBox(),canvas=await page.locator('#minimap').boundingBox();
 expect(bounds.x).toBeGreaterThanOrEqual(canvas.x-20);expect(bounds.x+bounds.width).toBeLessThanOrEqual(canvas.x+canvas.width+20);
 expect(bounds.y).toBeGreaterThanOrEqual(canvas.y);expect(bounds.y+bounds.height).toBeLessThanOrEqual(canvas.y+canvas.height);
 const before=await page.evaluate(()=>window.__reborn.renderer.camera.x);await page.keyboard.down('ArrowRight');await page.waitForTimeout(180);await page.keyboard.up('ArrowRight');
 expect(await page.evaluate(()=>window.__reborn.renderer.camera.x)).toBeGreaterThan(before);expect(errors).toEqual([]);
});
