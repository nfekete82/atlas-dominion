import {test,expect} from '@playwright/test';

test('cliff fog: a seen sandstone wall stays lit while the terrain behind stays hidden',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1400,height:900});
 await page.goto('/?debug&perfTest&seed=2026&map=medium');
 await page.locator('#loading').waitFor({state:'detached'});
 const check=await page.evaluate(()=>{
  const r=window.__reborn.renderer,g=window.__reborn.game,world=g.world;
  g.paused=true;g.aiClock=-1e8;
  const choice=world.generated.mesas.map((m,id)=>({m,id,cells:world.cliffCells[id]}))
    .find(v=>v.cells.length>25&&v.m.columns.length>2);
  if(!choice)throw Error('Generated map has no testable mesa');
  const {m,id,cells}=choice,column=m.columns.at(-1);
  const center=column.top.reduce((p,q)=>({x:p.x+q.x/column.top.length,y:p.y+q.y/column.top.length}),{x:0,y:0});
  const behind={x:Math.min(world.size-35,center.x+380),y:Math.min(world.size-35,center.y+180)};
  g.visible[0].fill(0);g.explored[0].fill(0);
  // The rock has already been discovered, but only one of its blocked
  // surface cells is currently visible. All terrain BEHIND remains unknown.
  for(const cell of cells)g.explored[0][cell]=1;
  g.visible[0][cells[0]]=1;
  g.explored[0][cells[0]]=1;
  g.revision++;
  r.camera={x:center.x,y:center.y,zoom:.9};r.boundCamera();
  const px=(point)=>{
   const p=r.screen(point),dpr=r.canvas.width/r.width;
   const x=Math.floor(p.x*dpr),y=Math.floor(p.y*dpr);
   if(x<0||y<0||x>=r.canvas.width||y>=r.canvas.height)
    throw Error('Sample point offscreen: '+JSON.stringify(point));
   const v=r.context.getImageData(x,y,1,1).data;
   return {rgb:[v[0],v[1],v[2]],light:(v[0]+v[1]+v[2])/3};
  };
  const original=r.revealVisibleCliffs.bind(r);
  r.revealVisibleCliffs=()=>{};
  r.render(0);
  const shaded=px(center),unknownBefore=px(behind);
  r.revealVisibleCliffs=original;
  r.render(0);
  const illuminated=px(center),unknownAfter=px(behind);
  return {shaded,illuminated,unknownBefore,unknownAfter,
    behindVisible:g.canSee(0,behind),
    seenRock:g.visible[0][cells[0]]===1,
    mesaCount:world.generated.mesas.length};
 });
 expect(check.seenRock).toBe(true);
 expect(check.behindVisible).toBe(false);
 expect(check.illuminated.light-check.shaded.light).toBeGreaterThan(18);
 expect(Math.abs(check.unknownBefore.light-check.unknownAfter.light)).toBeLessThan(3);
 expect(check.mesaCount).toBeGreaterThan(0);
 await page.screenshot({path:'artifacts/reborn/visible-cliff-faces.png'});
 expect(errors).toEqual([]);
});
