import {test,expect} from '@playwright/test';

async function start(page){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});await page.goto('/?debug&legacy');await page.locator('#loading').waitFor({state:'detached'});
 await page.evaluate(()=>{const a=window.__reborn;a.game.paused=true;a.game.aiClock=-1e8;a.game.units=[];a.game.credits=[10000,10000];a.audio.setEnabled(false);a.renderer.camera={x:2300,y:2100,zoom:1};a.renderer.boundCamera();a.renderer.render(0);});return errors;
}
async function clickLocal(page,p,button='left'){
 const rect=await page.locator('#world').boundingBox(),q={x:rect.x+p.x,y:rect.y+p.y};expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id,q)).toBe('world');await page.mouse.click(q.x,q.y,{button});
}
async function screen(page,p){return page.evaluate(p=>window.__reborn.renderer.screen(p),p);}

test('layout: canvas and sidebar own disjoint columns at desktop, tablet and phone sizes, including fractional widths and layout-only resizing',async({page})=>{
 const errors=await start(page);
 for(const size of [{width:1440,height:1000},{width:1200,height:900},{width:900,height:700},{width:620,height:740},{width:390,height:740}]){
  await page.setViewportSize(size);await expect.poll(()=>page.evaluate(()=>Math.abs(window.__reborn.renderer.width-document.querySelector('#world').getBoundingClientRect().width))).toBeLessThan(.01);
  const v=await page.evaluate(()=>{const a=window.__reborn,c=document.querySelector('#world').getBoundingClientRect(),s=document.querySelector('#sidebar').getBoundingClientRect(),p={x:c.width-3,y:c.height*.5},world=a.renderer.world(p),back=a.renderer.screen(world);return {canvas:{x:c.x,y:c.y,right:c.right,width:c.width,height:c.height},sidebar:{x:s.x,right:s.right,width:s.width},width:a.renderer.width,height:a.renderer.height,pixels:a.renderer.canvas.width,dpr:Math.min(2,devicePixelRatio||1),back,p,hit:document.elementFromPoint(c.right-3,c.y+c.height*.5)?.id,body:document.body.scrollWidth,win:innerWidth};});
  expect(v.canvas.right).toBeLessThanOrEqual(v.sidebar.x+.01);expect(v.sidebar.right).toBeCloseTo(size.width,1);expect(v.canvas.x).toBe(0);expect(v.canvas.y).toBe(0);expect(v.canvas.width+v.sidebar.width).toBeCloseTo(size.width,1);expect(v.width).toBeCloseTo(v.canvas.width,5);expect(v.height).toBe(size.height);expect(v.pixels).toBe(Math.round(v.width*v.dpr));expect(v.hit).toBe('world');expect(v.body).toBeLessThanOrEqual(v.win);expect(v.back.x).toBeCloseTo(v.p.x,6);expect(v.back.y).toBeCloseTo(v.p.y,6);
 }
 await page.setViewportSize({width:1200,height:900});await page.evaluate(()=>document.querySelector('#app').style.setProperty('--side','317.5px'));await expect.poll(()=>page.evaluate(()=>window.__reborn.renderer.width)).toBeCloseTo(858.5,1);
 await page.evaluate(()=>{document.querySelector('#app').style.removeProperty('--side');const a=window.__reborn;a.renderer.home();a.game.spawn(0,a.renderer.world({x:a.renderer.width-45,y:420}));a.game.updateVision();a.renderer.render(0);});await page.screenshot({path:'artifacts/reborn/separate-sidebar-desktop.png'});expect(errors).toEqual([]);
});

test('layout: real selection, right click, rectangle selection and captured gestures work at the visible right edge without HUD click-through',async({page})=>{
 const errors=await start(page);
 const target=await page.evaluate(()=>{const {game:g,renderer:r}=window.__reborn;g.world.blocked.fill(0);g.world.opaque.fill(0);const p=r.world({x:r.width-25,y:r.height*.45});const u=g.spawn(0,p);g.updateVision();r.render(0);return {id:u.id,p};});
 await clickLocal(page,await screen(page,{x:target.p.x,y:target.p.y-20}));await expect(page.locator('#selection-title')).toHaveText('Infanteriesoldat');
 const dest=await page.evaluate(()=>{const r=window.__reborn.renderer;return r.world({x:r.width-5,y:r.height*.58});});await clickLocal(page,await screen(page,dest),'right');
 const command=await page.evaluate(id=>window.__reborn.game.units.find(u=>u.id===id).orders[0],target.id);expect(command.kind).toBe('move');expect(Math.hypot(command.x-dest.x,command.y-dest.y)).toBeLessThan(20);
 await page.mouse.move(400,400);const drag=await page.evaluate(()=>{const {game:g,renderer:r}=window.__reborn;g.units=[];r.selected.clear();r.selectedBase=null;const points=[{x:r.width-75,y:440},{x:r.width-22,y:495}];for(const p of points)g.spawn(0,r.world(p));const hidden=g.spawn(0,r.world({x:r.width+80,y:470}));g.updateVision();r.render(0);return {width:r.width,hidden:hidden.id,ids:g.units.filter(u=>u.id!==hidden.id).map(u=>u.id)};});
 const canvas=await page.locator('#world').boundingBox();await page.mouse.move(canvas.x+drag.width-100,canvas.y+415);await page.mouse.down();await page.mouse.move(canvas.x+drag.width-1,canvas.y+520,{steps:6});await page.mouse.up();expect(await page.evaluate(()=>[...window.__reborn.renderer.selected].sort((a,b)=>a-b))).toEqual(drag.ids);
 // A selection dragged into the rail is clamped; hidden world coordinates are never selected.
 await page.mouse.move(canvas.x+drag.width-100,canvas.y+415);await page.mouse.down();await page.mouse.move(canvas.x+drag.width+140,canvas.y+520,{steps:6});await page.mouse.up();expect(await page.evaluate(()=>[...window.__reborn.renderer.selected].sort((a,b)=>a-b))).toEqual(drag.ids);
 const before=await page.evaluate(()=>window.__reborn.game.units.map(u=>({id:u.id,orders:structuredClone(u.orders)})));await page.locator('#tab-territories').click();const side=await page.locator('#sidebar').boundingBox();await page.mouse.click(side.x+8,side.y+side.height*.7,{button:'right'});expect(await page.evaluate(()=>window.__reborn.game.units.map(u=>({id:u.id,orders:u.orders})))).toEqual(before);
 expect(errors).toEqual([]);
});

test('layout: building placement, building selection and rally targets use the rightmost visible map area, and releases over the sidebar cannot build',async({page})=>{
 const errors=await start(page);
 const setup=await page.evaluate(()=>{const {game:g,renderer:r}=window.__reborn;g.world.blocked.fill(0);g.world.opaque.fill(0);g.explored[0].fill(1);const p=r.world({x:r.width-65,y:450}),w=g.spawn(0,{x:p.x-160,y:p.y},'engineer');r.selected=new Set([w.id]);window.__reborn.refresh();return {p,id:w.id};});
 await page.locator('#build-mode').click();await page.locator('[data-build="turret"]').click();await clickLocal(page,await screen(page,setup.p));
 const placed=await page.evaluate(p=>{const b=window.__reborn.game.bases.find(b=>b.kind==='turret'&&Math.hypot(b.x-p.x,b.y-p.y)<2);return b?{id:b.id,x:b.x,y:b.y}:null;},setup.p);expect(placed).toBeTruthy();
 await clickLocal(page,await screen(page,{x:placed.x,y:placed.y-25}));expect(await page.evaluate(()=>window.__reborn.renderer.selectedBase)).toBe(placed.id);
 // An actual factory/headquarters rally point is set by a right-click near the map edge.
 const rally=await page.evaluate(()=>{const {game:g,renderer:r}=window.__reborn;r.selected.clear();r.selectedBase=g.bases[0].id;const p=r.world({x:r.width-8,y:600});return {p,id:g.bases[0].id};});await clickLocal(page,await screen(page,rally.p),'right');
 expect(await page.evaluate(id=>window.__reborn.game.bases.find(b=>b.id===id).rally,rally.id)).toEqual(rally.p);
 await page.evaluate(id=>{const a=window.__reborn;a.renderer.selectedBase=null;a.renderer.selected=new Set([id]);a.renderer.placement='barracks';a.refresh();},setup.id);
 const box=await page.locator('#world').boundingBox(),count=await page.evaluate(()=>window.__reborn.game.bases.length);await page.mouse.move(box.x+box.width-120,550);await page.mouse.down();await page.mouse.move(box.x+box.width+35,580,{steps:5});await page.mouse.up();expect(await page.evaluate(()=>window.__reborn.game.bases.length)).toBe(count);expect(await page.evaluate(()=>window.__reborn.renderer.placement)).toBe('barracks');expect(errors).toEqual([]);
});

test('layout: right edge scroll reaches the full world boundary, stops in the sidebar, minimap still pans, and mouse-anchored zoom remains exact',async({page})=>{
 const errors=await start(page);const box=await page.locator('#world').boundingBox();await page.mouse.move(box.x+box.width-2,box.y+box.height*.5);const before=await page.evaluate(()=>window.__reborn.renderer.camera.x);
 await expect.poll(()=>page.evaluate(()=>window.__reborn.renderer.camera.x)).toBeGreaterThan(before+30);
 const side=await page.locator('#sidebar').boundingBox();await page.mouse.move(side.x+side.width*.5,side.y+side.height*.5);const stopped=await page.evaluate(()=>window.__reborn.renderer.camera.x);await page.waitForTimeout(180);expect(await page.evaluate(()=>window.__reborn.renderer.camera.x)).toBeCloseTo(stopped,5);
 await page.evaluate(()=>{const r=window.__reborn.renderer;r.camera.x=window.__reborn.game.world.size-r.width/2-20;});await page.mouse.move(box.x+box.width-2,box.y+box.height*.5);await expect.poll(()=>page.evaluate(()=>{const r=window.__reborn.renderer;return r.world({x:r.width,y:r.height/2}).x-window.__reborn.game.world.size;})).toBeCloseTo(0,6);
 const mini=await page.locator('#minimap').boundingBox();await page.mouse.move(mini.x+mini.width*.3,mini.y+mini.height*.4);await page.mouse.down();await page.mouse.move(mini.x+mini.width*.65,mini.y+mini.height*.55,{steps:6});await page.mouse.up();const camera=await page.evaluate(()=>window.__reborn.renderer.camera);expect(camera.x).toBeCloseTo(3762*.65,-1);expect(camera.y).toBeCloseTo(3762*.55,-1);
 const anchor={x:Math.floor(box.width-25),y:Math.floor(box.height*.6)};await page.mouse.move(box.x+anchor.x,box.y+anchor.y);const zoom=await page.evaluate(p=>({world:window.__reborn.renderer.world(p),zoom:window.__reborn.renderer.camera.zoom}),anchor);await page.mouse.wheel(0,-230);await expect.poll(()=>page.evaluate(()=>window.__reborn.renderer.camera.zoom)).toBeGreaterThan(zoom.zoom);const after=await page.evaluate(p=>window.__reborn.renderer.world(p),anchor);expect(after.x).toBeCloseTo(zoom.world.x,4);expect(after.y).toBeCloseTo(zoom.world.y,4);
 const home=await page.evaluate(()=>{const a=window.__reborn;a.renderer.home();const b=a.game.bases[0];return {p:a.renderer.screen(b),w:a.renderer.width,h:a.renderer.height};});expect(home.p.x).toBeGreaterThan(50);expect(home.p.x).toBeLessThan(home.w-50);expect(home.p.y).toBeGreaterThan(80);expect(home.p.y).toBeLessThan(home.h-200);expect(errors).toEqual([]);
});

test('layout: Retina backing pixels match fractional viewport dimensions without changing CSS-coordinate input',async({browser})=>{
 const context=await browser.newContext({deviceScaleFactor:2}),page=await context.newPage();
 try{const errors=await start(page);await page.setViewportSize({width:1200,height:900});await page.evaluate(()=>document.querySelector('#app').style.setProperty('--side','317.25px'));
  await expect.poll(()=>page.evaluate(()=>window.__reborn.renderer.width)).toBeCloseTo(858.75,2);
  const values=await page.evaluate(()=>{const r=window.__reborn.renderer,rect=r.canvas.getBoundingClientRect(),t=r.context.getTransform(),p={x:r.width-1,y:400},back=r.screen(r.world(p));return {width:r.width,height:r.height,pixels:r.canvas.width,pixelHeight:r.canvas.height,a:t.a,d:t.d,back,p,right:rect.right,side:document.querySelector('#sidebar').getBoundingClientRect().left};});
  expect(values.pixels).toBe(Math.round(values.width*2));expect(values.pixelHeight).toBe(1800);expect(values.a).toBeCloseTo(values.pixels/values.width,6);expect(values.d).toBe(2);expect(values.back).toEqual(values.p);expect(values.right).toBeCloseTo(values.side,6);expect(errors).toEqual([]);
 }finally{await context.close();}
});
