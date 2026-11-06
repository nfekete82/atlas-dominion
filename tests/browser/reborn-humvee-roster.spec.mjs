import {test,expect} from '@playwright/test';

test('Humvee passenger portraits show exact riders and click unloads one at a time',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?debug&perfTest&seed=2026');
 await page.locator('#loading').waitFor({state:'detached'});
 const data=await page.evaluate(()=>{
  const a=window.__reborn,g=a.game;
  g.aiClock=-1e8;g.paused=false;g.units=[];g.world.blocked.fill(0);g.world.opaque.fill(0);
  const rover=g.spawn(0,{x:1900,y:2100},'rover');
  const troops=['infantry','medic','engineer','heavy','infantry'].map((kind,i)=>
   g.spawn(0,{x:1840+(i%3)*23,y:2058+Math.floor(i/3)*24},kind));
  if(g.transports.board(rover.id,troops.map(u=>u.id))!==4)throw Error('Humvee boarding failed');
  for(let i=0;i<180;i++)g.step(.05);
  g.paused=true;a.renderer.selectedBase=null;a.renderer.selected=new Set([rover.id]);
  a.renderer.camera={x:1900,y:2040,zoom:1.25};a.renderer.boundCamera();a.refresh();a.renderer.render(0);
  return {id:rover.id,passengers:troops.slice(0,4).map(u=>({id:u.id,kind:u.kind})),
   roster:rover.transport.cargo.slice()};
 });
 expect(data.roster).toEqual(data.passengers.map(u=>u.id));
 await expect(page.locator('#transport-passengers')).toBeVisible();
 await expect(page.locator('#passenger-count')).toHaveText('4 / 4');
 await expect(page.locator('#passenger-slots button.occupied')).toHaveCount(4);
 await expect(page.locator('#passenger-slots img')).toHaveCount(4);
 const thumbs=await page.locator('#passenger-slots img').evaluateAll(images=>images.map(img=>({width:img.naturalWidth,src:img.getAttribute('src')})));
 expect(thumbs.every(t=>t.width>0&&t.src.includes('/'))).toBe(true);
 const geometry=await page.evaluate(()=>{
  const box=selector=>document.querySelector(selector).getBoundingClientRect();
  const roster=box('#transport-passengers'),hud=box('#selection-panel'),selection=box('.selection-copy'),commands=box('.command-group');
  const slots=[...document.querySelectorAll('#passenger-slots button')].map(b=>b.getBoundingClientRect());
  return {
   withinHUD:roster.bottom<=hud.bottom+2&&roster.top>=hud.top-2,
   rightOfDetails:roster.left>=selection.right-2,
   leftOfCommands:roster.right<=commands.left+2,
   grid2x2:slots.length===4&&Math.abs(slots[0].top-slots[1].top)<2&&
     Math.abs(slots[2].top-slots[3].top)<2&&slots[2].top>slots[0].bottom-2&&
     slots[1].left>slots[0].right-2
  };
 });
 expect(geometry).toEqual({withinHUD:true,rightOfDetails:true,leftOfCommands:true,grid2x2:true});
 const target=data.passengers[2];
 await page.locator('[data-passenger-id="'+target.id+'"]').click();
 const targeted=await page.evaluate(id=>{
  const g=window.__reborn.game,h=g.units.find(u=>u.id===id);return {release:h.transport.release,cargo:h.transport.cargo.slice()};
 },data.id);
 expect(targeted.release).toEqual([target.id]);
 expect(targeted.cargo).toHaveLength(4);
 const result=await page.evaluate(({id,target})=>{
  const a=window.__reborn,g=a.game;g.paused=false;
  for(let i=0;i<80;i++)g.step(.05);
  g.paused=true;a.refresh();
  const h=g.units.find(u=>u.id===id),u=g.units.find(u=>u.id===target);
  return {cargo:h.transport.cargo.slice(),phase:h.transport.phase,exited:u.carrier===undefined};
 },{id:data.id,target:target.id});
 expect(result.phase).toBe('cruise');
 expect(result.exited).toBe(true);
 expect(result.cargo).toEqual(data.roster.filter(id=>id!==target.id));
 await expect(page.locator('#passenger-count')).toHaveText('3 / 4');
 await expect(page.locator('#passenger-slots button.occupied')).toHaveCount(3);
 await expect(page.locator('#passenger-slots button.empty')).toHaveCount(1);
 await expect(page.locator('[data-passenger-id="'+target.id+'"]')).toHaveCount(0);
 await page.screenshot({path:'artifacts/humvee-passengers.png'});
 expect(errors).toEqual([]);
});
