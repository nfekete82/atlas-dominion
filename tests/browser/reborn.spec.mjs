import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const evidence=new URL('../../docs/reborn/',import.meta.url).pathname;
async function start(page,width=1440,height=1000){
 await page.setViewportSize({width,height});await page.goto('/?debug');await page.locator('#loading').waitFor({state:'detached'});
 await page.evaluate(()=>{window.__reborn.game.paused=true;});
}
async function advance(page,seconds){return page.evaluate(seconds=>{
 const api=window.__reborn,g=api.game;g.paused=false;let fought=false;
 for(let i=0;i<Math.round(seconds/.05);i++){g.step();if(g.shots.some(s=>g.canSee(0,s.from)||g.canSee(0,s.to)))fought=true;}
 g.paused=true;api.refresh();api.renderer.render(0);return {fought,status:g.status,blue:g.count(0),red:g.count(1)};
},seconds);}
async function screen(page,p){return page.evaluate(p=>window.__reborn.renderer.screen(p),p);}
async function focus(page,p){
 const box=await page.locator('#minimap').boundingBox();await page.mouse.click(box.x+p.x/3762*box.width,box.y+p.y/3762*box.height);
}
async function order(page,p,{attack=false,shift=false}={}){
 await focus(page,p);const at=await screen(page,p);if(attack)await page.keyboard.press('a');if(shift)await page.keyboard.down('Shift');
 await page.mouse.click(at.x,at.y,{button:'right'});if(shift)await page.keyboard.up('Shift');
}
async function selectArmy(page){
 await page.locator('#home').click();const positions=await page.evaluate(()=>window.__reborn.game.units.filter(u=>u.owner===0).map(u=>window.__reborn.renderer.screen(u)));
 const xs=positions.map(p=>p.x),ys=positions.map(p=>p.y);await page.mouse.move(Math.min(...xs)-30,Math.min(...ys)-65);await page.mouse.down();await page.mouse.move(Math.max(...xs)+30,Math.max(...ys)+16,{steps:12});await page.mouse.up();
}

test('reborn: complete browser loop from one soldier through capture, production, multi-unit expansion, combat and durable resume',async({page})=>{
 test.setTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page);await mkdir(evidence,{recursive:true});
 await page.screenshot({path:evidence+'initial.png'});
 await expect(page.locator('#credits')).toHaveText('500');
 expect(await page.evaluate(()=>window.__reborn.game.count(0))).toBe(1);
 const initial=await page.evaluate(()=>({unit:{...window.__reborn.game.units[0]},base:{...window.__reborn.game.bases[0]},target:{...window.__reborn.game.territories[20].point},explored:window.__reborn.game.explored[0].reduce((a,b)=>a+b,0)}));
 const u=await screen(page,{x:initial.unit.x,y:initial.unit.y-18});await page.mouse.click(u.x,u.y);
 await expect(page.locator('#selection-title')).toHaveText('Infanteriesoldat');
 await order(page,initial.target);await advance(page,14);
 expect(await page.evaluate(()=>window.__reborn.game.territories[20].owner)).toBe(0);await expect(page.locator('#income')).toHaveText('+40');
 expect(await page.evaluate(()=>window.__reborn.game.explored[0].reduce((a,b)=>a+b,0))).toBeGreaterThan(initial.explored);
 await order(page,{x:initial.base.x+140,y:initial.base.y+100});await advance(page,7);
 await page.locator('#home').click();const b=await screen(page,{x:initial.base.x,y:initial.base.y-90});await page.mouse.click(b.x,b.y);
 await expect(page.locator('#production')).toBeVisible();
 for(let i=0;i<4;i++)await page.locator('#recruit').click();await expect(page.locator('#queue')).toContainText('4 IM AUFTRAG');
 await advance(page,20);expect(await page.evaluate(()=>window.__reborn.game.count(0))).toBe(5);
 await page.screenshot({path:evidence+'production.png'});
 await selectArmy(page);expect(await page.evaluate(()=>window.__reborn.renderer.selected.size)).toBe(5);
 let fought=false,enemyCapture=false;
 for(const id of [14,8,9,10,4]){
   const target=await page.evaluate(id=>({point:window.__reborn.game.territories[id].point,owner:window.__reborn.game.territories[id].owner}),id);
   await order(page,target.point,{attack:true});const result=await advance(page,23);fought||=result.fought;
   const owner=await page.evaluate(id=>window.__reborn.game.territories[id].owner,id);if(target.owner===1&&owner===0)enemyCapture=true;
   if(fought&&enemyCapture)break;
   if(result.blue===0)break;
 }
 expect(fought).toBe(true);expect(enemyCapture).toBe(true);
 await page.screenshot({path:evidence+'campaign.png'});
 await page.locator('#save').click();await expect(page.locator('#notices')).toContainText('Kampagne lokal gespeichert');
 const snapshot=await page.evaluate(()=>{const s=window.__reborn.game.save();return {credits:s.credits,owners:s.territories.map(t=>t.owner),units:s.units.map(u=>({id:u.id,hp:u.hp,x:u.x,y:u.y})),explored:s.explored,time:s.time};});
 await page.reload();await page.locator('#loading').waitFor({state:'detached'});await page.locator('#load').click();await expect(page.locator('#notices')).toContainText('Kampagne geladen');
 await page.evaluate(()=>{window.__reborn.game.paused=true;});
 const restored=await page.evaluate(()=>{const s=window.__reborn.game.save();return {credits:s.credits,owners:s.territories.map(t=>t.owner),ids:s.units.map(u=>u.id),explored:s.explored,time:s.time};});
 expect(restored.credits).toEqual(snapshot.credits);expect(restored.owners).toEqual(snapshot.owners);expect(restored.ids).toEqual(snapshot.units.map(u=>u.id));
 expect(restored.time).toBeGreaterThanOrEqual(snapshot.time);expect(restored.time-snapshot.time).toBeLessThan(.5);expect(restored.explored[0].reduce((a,b)=>a+b,0)).toBeGreaterThanOrEqual(snapshot.explored[0].reduce((a,b)=>a+b,0));
 expect(errors).toEqual([]);
});

test('reborn: minimap drag, anchored zoom, keyboard camera, shift orders, attack mode and stop use real input',async({page})=>{
 await start(page);await page.locator('#select-unit').click();
 const p1={x:1400,y:2600},p2={x:1650,y:2600};await order(page,p1);await order(page,p2,{shift:true});
 expect(await page.evaluate(()=>window.__reborn.game.units[0].orders.length)).toBe(2);
 await page.keyboard.press('s');expect(await page.evaluate(()=>window.__reborn.game.units[0].orders.length)).toBe(0);
 const beforeHold=await page.evaluate(()=>window.__reborn.renderer.camera.y);await page.keyboard.down('s');await page.waitForTimeout(350);await page.keyboard.up('s');
 expect(await page.evaluate(()=>window.__reborn.renderer.camera.y)).toBeGreaterThan(beforeHold);
 await page.keyboard.press('a');await expect(page.locator('#hint')).toContainText('ANGRIFFSBEWEGUNG');
 const point=await screen(page,{x:1500,y:2400});await page.mouse.click(point.x,point.y);expect(await page.evaluate(()=>window.__reborn.game.units[0].orders[0].kind)).toBe('attackMove');
 await page.mouse.click(340,400);expect(await page.evaluate(()=>window.__reborn.renderer.selected.size)).toBe(0);
 const before=await page.evaluate(()=>window.__reborn.renderer.camera.x);await page.keyboard.down('ArrowRight');await page.waitForTimeout(200);await page.keyboard.up('ArrowRight');expect(await page.evaluate(()=>window.__reborn.renderer.camera.x)).toBeGreaterThan(before);
 const mini=await page.locator('#minimap').boundingBox();await page.mouse.move(mini.x+mini.width*.3,mini.y+mini.height*.3);await page.mouse.down();await page.mouse.move(mini.x+mini.width*.65,mini.y+mini.height*.55,{steps:8});await page.mouse.up();
 const cam=await page.evaluate(()=>window.__reborn.renderer.camera);expect(cam.x).toBeCloseTo(3762*.65,-1);expect(cam.y).toBeCloseTo(3762*.55,-1);
 await page.mouse.move(700,450);const zoom=await page.evaluate(()=>({zoom:window.__reborn.renderer.camera.zoom,p:window.__reborn.renderer.world({x:700,y:450})}));await page.mouse.wheel(0,-250);
 await expect.poll(()=>page.evaluate(()=>window.__reborn.renderer.camera.zoom)).toBeGreaterThan(zoom.zoom);
 const after=await page.evaluate(()=>window.__reborn.renderer.world({x:700,y:450}));expect(after.x).toBeCloseTo(zoom.p.x,3);expect(after.y).toBeCloseTo(zoom.p.y,3);
 await page.locator('#overlay').click();expect(await page.evaluate(()=>window.__reborn.renderer.overlay)).toBe(true);
 await page.keyboard.press('Space');await expect(page.locator('#pause-label')).toBeHidden();await page.keyboard.press('Space');await expect(page.locator('#pause-label')).toBeVisible();
});

test('reborn: hidden enemies leave no main-map or minimap pixels, and terrain stays remembered',async({page})=>{
 await start(page);
 const hidden=await page.evaluate(()=>{
   const {game:g,renderer:r}=window.__reborn;const enemy=g.units.find(u=>u.owner===1),base=g.bases.find(b=>b.owner===1);
   r.camera.x=enemy.x;r.camera.y=enemy.y;r.boundCamera();r.render(0);
   const p=r.screen(enemy),d=window.devicePixelRatio||1,c=r.context;
   const pixel=Array.from(c.getImageData(Math.round(p.x*d),Math.round(p.y*d),1,1).data);
   const m=Array.from(r.mini.getImageData(Math.floor(enemy.x/3762*224),Math.floor(enemy.y/3762*224),1,1).data);
   return {canSee:g.canSee(0,enemy),explored:g.hasExplored(0,base),pixel,m};
 });
 expect(hidden.canSee).toBe(false);expect(hidden.explored).toBe(false);expect(hidden.pixel.slice(0,3).every(v=>v<12)).toBe(true);expect(hidden.m.slice(0,3).every(v=>v<12)).toBe(true);
 await page.locator('#home').click();await page.locator('#select-unit').click();await order(page,{x:1567.5,y:2633.4});await advance(page,14);await order(page,{x:940.5,y:1881});await advance(page,13);
 const known=await page.evaluate(()=>({known:window.__reborn.game.hasExplored(0,window.__reborn.game.territories[20].point),visible:window.__reborn.game.canSee(0,window.__reborn.game.territories[20].point)}));expect(known).toEqual({known:true,visible:false});
});

test('reborn: compact viewport, instructions, pause and new campaign preserve a usable playfield',async({page})=>{
 await start(page,800,650);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(800);
 await page.locator('#help').click();await expect(page.locator('#help-dialog')).toBeVisible();await expect(page.locator('#pause-label')).toBeVisible();await page.getByRole('button',{name:'VERSTANDEN — INS FELD'}).click();
 await page.locator('#select-unit').click();await expect(page.locator('#unit-commands')).toBeVisible();await page.screenshot({path:evidence+'compact.png'});
 await page.keyboard.press('Escape');await page.locator('#new').click();await page.locator('#new-dialog [value="new"]').click();
 await expect(page.locator('#credits')).toHaveText('500');expect(await page.evaluate(()=>window.__reborn.game.count(0))).toBe(1);
 await advance(page,10);const credits=await page.locator('#credits').textContent();await page.locator('#new').click();await page.keyboard.press('Escape');await expect(page.locator('#credits')).toHaveText(credits);
});
