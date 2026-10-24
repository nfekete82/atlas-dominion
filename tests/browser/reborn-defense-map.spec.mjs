import {test,expect} from '@playwright/test';
async function start(page){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});await page.goto('/?debug');await page.locator('#loading').waitFor({state:'detached'});
 await page.evaluate(()=>{window.__reborn.game.paused=true;window.__reborn.refresh();});return errors;
}
async function advance(page,s){await page.evaluate(s=>{const a=window.__reborn;a.game.paused=false;for(let i=0;i<Math.round(s/.05);i++)a.game.step();a.game.paused=true;a.refresh();a.renderer.render(0);},s);}
async function clickWorld(page,p){const at=await page.evaluate(p=>window.__reborn.renderer.screen(p),p);expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id,at)).toBe('world');await page.mouse.click(at.x,at.y);}

test('defense map: new campaign has 16 sectors and both old map versions load through the real save store with correct HUD and catalog',async({page})=>{
 const errors=await start(page);await expect(page.locator('#territories')).toHaveText('2 / 16');await expect(page.locator('#catalog-territories button')).toHaveCount(16);await expect(page.locator('#campaign-goal')).toContainText('2 roten Startgebiete');
 const original=await page.evaluate(()=>window.__reborn.game.save());await page.keyboard.press('F5');await expect(page.locator('#notices')).toContainText('Kampagne lokal gespeichert');
 for(const version of [0,1]){
  await page.evaluate(async version=>{
   const {Simulation}=await import('/src/reborn/simulation.js');const g=new Simulation(2026,version);g.credits[0]=2000;g.recruit(g.bases[0].id,'engineer');
   const worker=g.units.find(u=>u.owner===0&&u.kind==='engineer');let site;
   for(let y=2100;y<3450&&!site;y+=28)for(let x=220;x<1750;x+=28)if(!g.buildError(0,'barracks',{x,y})){site={x,y};break;}
   if(!g.build(0,'barracks',site,[worker.id]))throw Error('Legacy construction fixture failed');
   const raw=g.save();if(version===0)delete raw.mapVersion;
   await new Promise((resolve,reject)=>{const req=indexedDB.open('atlas-dominion-reborn',1);req.onsuccess=()=>{const db=req.result,tx=db.transaction('campaigns','readwrite');tx.objectStore('campaigns').put(raw,'campaign');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);});
   await window.__reborn.load();window.__reborn.game.paused=true;window.__reborn.refresh();
  },version);
  await expect(page.locator('#territories')).toHaveText('3 / 30');await expect(page.locator('#catalog-territories button')).toHaveCount(30);await expect(page.locator('#campaign-goal')).toContainText('3 roten Startgebiete');
  expect(await page.evaluate(()=>{const g=window.__reborn.game;return {version:g.world.mapVersion,count:g.territories.length,queue:g.bases[0].queueTypes,build:g.units.find(u=>u.kind==='engineer').orders[0].kind,credits:g.credits[0]};})).toEqual({version,count:30,queue:['engineer'],build:'build',credits:1600});
 }
 await page.evaluate(async raw=>{await new Promise((resolve,reject)=>{const req=indexedDB.open('atlas-dominion-reborn',1);req.onsuccess=()=>{const db=req.result,tx=db.transaction('campaigns','readwrite');tx.objectStore('campaigns').put(raw,'campaign');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});await window.__reborn.load();window.__reborn.game.paused=true;window.__reborn.refresh();},original);
 await expect(page.locator('#territories')).toHaveText('2 / 16');await expect(page.locator('#catalog-territories button')).toHaveCount(16);expect(await page.evaluate(()=>window.__reborn.game.seed)).toBe(original.seed);
 await page.locator('#menu').click();await page.locator('#to-main').click();await page.locator('#new').click();await page.locator('#new-dialog [value="new"]').click();await expect.poll(()=>page.evaluate(()=>window.__reborn.game.seed)).not.toBe(original.seed);await expect(page.locator('#territories')).toHaveText('2 / 16');
 await page.locator('#tab-territories').click();await expect(page.locator('[data-territory]')).toHaveCount(16);await expect(page.locator('[data-territory="0"] strong')).not.toBeEmpty();await page.screenshot({path:'artifacts/reborn/defense-map-16.png'});expect(errors).toEqual([]);
});

test('defense map: selected turret draws exactly 600 range and fights a unit beside a bastion at 500 while tracking through reload',async({page})=>{
 const errors=await start(page);
 const b=await page.evaluate(()=>{
  const {game:g,renderer:r}=window.__reborn;g.paused=true;g.aiClock=-1e8;g.units=[];const target=g.territories[6].point,from=g.territories[5].point,length=Math.hypot(target.x-from.x,target.y-from.y),h={x:(target.x-from.x)/length,y:(target.y-from.y)/length};
  const p={x:target.x-h.x*500,y:target.y-h.y*500},tower={...g.bases[0],...p,id:1500,kind:'turret',radius:30,hp:650,queue:[],queueTypes:[],cooldown:1.5,turretAngle:Math.PI};g.bases.push(tower);
  const enemy=g.spawn(1,target,'tank');enemy.cooldown=1000;g.stop([enemy.id],true);g.updateVision();r.camera={x:p.x-60,y:p.y,zoom:.6};r.boundCamera();r.render(0);return {x:p.x,y:p.y-25,id:tower.id,enemy:enemy.id};
 });
 await clickWorld(page,b);await expect(page.locator('#selection-title')).toHaveText('Geschützturm');await expect(page.locator('#selection-detail')).toContainText('600 M Reichweite');
 const circle=await page.evaluate(()=>{
  const r=window.__reborn.renderer,b=r.game.bases.find(b=>b.id===1500),original=r.context,c=document.createElement('canvas').getContext('2d'),arcs=[],arc=c.arc.bind(c);c.arc=(...args)=>{arcs.push(args);arc(...args);};
  try{r.context=c;r.drawRange(b);}finally{r.context=original;}return arcs.map(a=>({x:a[0],y:a[1],radius:a[2]}));
 });
 expect(circle).toHaveLength(1);expect(circle[0].radius).toBe(600);await advance(page,.05);
 expect(await page.evaluate(()=>{const g=window.__reborn.game,b=g.bases.find(b=>b.id===1500);return {target:b.turretTarget,rotated:b.turretAngle!==Math.PI,shots:g.shots.filter(s=>s.source===1500).length};})).toEqual({target:b.enemy,rotated:true,shots:0});
 await advance(page,2);expect(await page.evaluate(id=>window.__reborn.game.units.find(u=>u.id===id).hp,b.enemy)).toBeLessThan(620);
 const paused=await page.evaluate(()=>{const a=window.__reborn,b=a.game.bases.find(b=>b.id===1500),angle=b.turretAngle;for(let i=0;i<20;i++)a.game.step();return b.turretAngle===angle;});expect(paused).toBe(true);
 await page.screenshot({path:'artifacts/reborn/defense-turret-range.png'});expect(errors).toEqual([]);
});

test('defense map: new campaign capture updates income, minimap ownership and the 16-sector counter',async({page})=>{
 const errors=await start(page);
 const state=await page.evaluate(()=>{
  const a=window.__reborn,g=a.game;g.aiClock=-1e8;const t=g.territories.find(t=>t.owner===-1&&t.neighbors.some(i=>g.territories[i].owner===0)),u=g.units[0];
  g.command([u.id],{...t.point,kind:'move'});return {target:t.id,income:t.income};
 });
 await advance(page,30);expect(await page.evaluate(id=>window.__reborn.game.territories[id].owner,state.target)).toBe(0);await expect(page.locator('#territories')).toHaveText('3 / 16');await expect(page.locator('#income')).toHaveText('+'+(35+state.income));
 const before=await page.evaluate(()=>({seed:window.__reborn.game.seed,credits:window.__reborn.game.credits,time:window.__reborn.game.time}));await page.evaluate(async()=>{const a=window.__reborn;await a.save();await a.load();a.game.paused=true;a.refresh();});
 await expect(page.locator('#territories')).toHaveText('3 / 16');expect(await page.evaluate(()=>({seed:window.__reborn.game.seed,credits:window.__reborn.game.credits,time:window.__reborn.game.time}))).toEqual(before);expect(errors).toEqual([]);
});
