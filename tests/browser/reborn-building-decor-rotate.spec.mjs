import {test,expect} from '@playwright/test';

test('construction: R and the HUD switch mirrored façade without changing terrain, then it is saved',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?debug&seed=2026&map=medium');
 await page.locator('#loading').waitFor({state:'detached'});
 const target=await page.evaluate(()=>{
  const a=window.__reborn,g=a.game,r=a.renderer,hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
  const engineer=g.units.find(u=>u.owner===0&&u.kind==='engineer');
  g.credits[0]=25000;g.aiClock=-1e8;
  r.selected.clear();r.selected.add(engineer.id);r.selectedBase=null;
  let point=null;
  for(let radius=200;radius<=800&&!point;radius+=20)
   for(let i=0;i<40;i++){
    const p={x:hq.x+radius*Math.cos(i*Math.PI/20),y:hq.y+radius*Math.sin(i*Math.PI/20)};
    if(!g.buildError(0,'generator',p)){point=p;break;}
   }
  if(point){r.camera.x=point.x;r.camera.y=point.y;r.boundCamera();}
  a.refresh();return point;
 });
 expect(target).not.toBeNull();
 await page.locator('#build-mode').click();
 await page.locator('[data-build="turret"]').click();
 await expect(page.locator('#rotate-building')).toBeVisible();
 const a=await page.evaluate(()=>window.__reborn.renderer.placementFacing);
 expect(a).toBe(0);
 await page.keyboard.press('r');
 expect(await page.evaluate(()=>window.__reborn.renderer.placementFacing)).toBe(1);
 await expect(page.locator('#selection-detail')).toContainText('Gespiegelt');
 await page.locator('#rotate-building').click();
 expect(await page.evaluate(()=>window.__reborn.renderer.placementFacing)).toBe(0);
 await page.locator('#rotate-building').click();
 expect(await page.evaluate(()=>window.__reborn.renderer.placementFacing)).toBe(1);
 const result=await page.evaluate(p=>{
  const a=window.__reborn,g=a.game,r=a.renderer;
  const old=g.save(),site=g.build(0,'turret',p,[...r.selected],r.placementFacing);
  if(!site)return {site:null};
  r.placement=null;a.refresh();r.render(0);
  const restored=window.__reborn.game.constructor.load(g.save());
  return {site:{facing:site.facing,x:site.x,y:site.y,radius:site.radius},
   restored:restored.bases.find(b=>b.id===site.id).facing,
   props:r.decor.spriteCount,oldBases:old.bases.length,newBases:g.bases.length};
 },target);
 expect(result.site).not.toBeNull();
 expect(result.site.facing).toBe(1);
 expect(result.restored).toBe(1);
 expect(result.newBases).toBe(result.oldBases+1);
 expect(result.props).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});
