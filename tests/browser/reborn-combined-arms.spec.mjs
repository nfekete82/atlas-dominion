import {test,expect} from '@playwright/test';
async function start(page){const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});await page.goto('/?debug&legacy');await page.locator('#loading').waitFor({state:'detached'});await page.evaluate(()=>{const a=window.__reborn;a.game.paused=true;a.game.aiClock=-1e8;a.game.units=[];});return errors;}
async function advance(page,seconds){await page.evaluate(s=>{const a=window.__reborn;a.game.paused=false;a.game.aiClock=-1e8;for(let i=0;i<Math.round(s/.05);i++){a.game.step();a.renderer.render(.05);}a.game.paused=true;a.refresh();a.renderer.render(0);},seconds);}
async function clickWorld(page,p,button='left'){const q=await page.evaluate(p=>window.__reborn.renderer.screen(p),p);expect(await page.evaluate(q=>document.elementFromPoint(q.x,q.y)?.id,q)).toBe('world');await page.mouse.click(q.x,q.y,{button});}
async function clickHeli(page){const p=await page.evaluate(async()=>{const {unitSelectionPoint}=await import('/src/reborn/unit-presentation.js');const h=window.__reborn.game.units.find(u=>u.kind==='scout');return unitSelectionPoint(h);});await clickWorld(page,p);}

test('combined arms: transport has real loading commands, lands for ten soldiers, saves during descent, unloads safely and takes off',async({page})=>{
 const errors=await start(page);
 const points=await page.evaluate(()=>{const {game:g,renderer:r}=window.__reborn,h=g.spawn(0,{x:1900,y:2100},'scout'),troops=[];for(let i=0;i<10;i++)troops.push(g.spawn(0,{x:1830+(i%3)*26,y:2110+Math.floor(i/3)*25}));r.camera={x:2150,y:2180,zoom:1.45};r.boundCamera();r.render(0);return troops.map(u=>r.screen(u));});
 await page.mouse.move(Math.min(...points.map(p=>p.x))-12,Math.min(...points.map(p=>p.y))-12);await page.mouse.down();await page.mouse.move(Math.max(...points.map(p=>p.x))+12,Math.max(...points.map(p=>p.y))+12,{steps:6});await page.mouse.up();await expect(page.locator('#selection-title')).toHaveText('10 Einheiten');
 const heli=await page.evaluate(async()=>{const {unitSelectionPoint}=await import('/src/reborn/unit-presentation.js');return unitSelectionPoint(window.__reborn.game.units.find(u=>u.kind==='scout'));});await clickWorld(page,heli,'right');await advance(page,.5);
 expect(await page.evaluate(()=>{const h=window.__reborn.game.units.find(u=>u.kind==='scout');return h.flightHeight;})).toBeLessThan(1);
 await page.evaluate(async()=>{const a=window.__reborn;await a.save();await a.load();a.game.paused=true;a.game.aiClock=-1e8;a.renderer.camera={x:2150,y:2180,zoom:1.45};a.renderer.boundCamera();a.renderer.render(0);});await advance(page,1.1);await clickHeli(page);await expect(page.locator('#selection-title')).toHaveText('Transportheli');
 const landed=await page.evaluate(()=>{const h=window.__reborn.game.units.find(u=>u.kind==='scout');return {height:h.flightHeight,phase:h.transport.phase,cargo:h.transport.cargo.length};});expect(landed.height).toBe(0);expect(landed.phase).toBe('loading');await page.screenshot({path:'artifacts/reborn/combined-transport-landed.png'});
 await advance(page,8);await expect(page.locator('#selection-detail')).toContainText('10 / 10');expect(await page.evaluate(()=>({count:window.__reborn.game.count(0),passengers:window.__reborn.game.units.filter(u=>u.carrier).length}))).toEqual({count:11,passengers:10});
 await page.locator('#unload-mode').click();await clickWorld(page,{x:2200,y:2180});await advance(page,12);
 const unloaded=await page.evaluate(()=>{const g=window.__reborn.game,h=g.units.find(u=>u.kind==='scout');return {cargo:h.transport.cargo.length,height:h.flightHeight,phase:h.transport.phase,foot:g.units.filter(u=>u.kind==='infantry'&&!u.carrier&&g.world.walkable(u,g.obstacles())).length};});expect(unloaded).toEqual({cargo:0,height:1,phase:'cruise',foot:10});await page.screenshot({path:'artifacts/reborn/combined-transport-unloaded.png'});expect(errors).toEqual([]);
});

test('combined arms: real rocket vehicle launches a visible travelling rocket from beyond turret range',async({page})=>{
 const errors=await start(page);
 await page.evaluate(()=>{const {game:g,renderer:r}=window.__reborn;const u=g.spawn(0,{x:1900,y:2100},'artillery'),b={...g.bases[1],id:1500,x:2550,y:2100,kind:'turret',hp:650,radius:30,queue:[],queueTypes:[],cooldown:0};g.bases.push(b);g.updateVision();r.camera={x:2325,y:2150,zoom:1.2};r.boundCamera();r.selected=new Set([u.id]);r.render(0);g.command([u.id],{x:b.x,y:b.y,kind:'attack',target:b.id});window.__reborn.refresh();});
 await expect(page.locator('#selection-title')).toHaveText('Raketenwerfer');await advance(page,.6);
 expect(await page.evaluate(()=>({missiles:window.__reborn.game.missiles.length,hp:window.__reborn.game.bases.find(b=>b.id===1500).hp,rocket:window.__reborn.renderer.units.asset('artillery',0).data.design.tubes}))).toEqual({missiles:1,hp:650,rocket:12});
 await page.screenshot({path:'artifacts/reborn/combined-rocket-flight.png'});await advance(page,1.3);expect(await page.evaluate(()=>window.__reborn.game.bases.find(b=>b.id===1500).hp)).toBe(530);expect(await page.evaluate(()=>window.__reborn.game.units.find(u=>u.kind==='artillery').hp)).toBe(340);expect(errors).toEqual([]);
});
