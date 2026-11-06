import {test,expect} from '@playwright/test';

test('production: a real trained pioneer emerges outside the headquarters, with untouched painted facade',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?debug&perfTest&legacy');
 await page.locator('#loading').waitFor({state:'detached'});
 const result=await page.evaluate(async()=>{
  const a=window.__reborn,g=a.game,r=a.renderer;
  g.paused=true;g.aiClock=-1e8;g.credits[0]=5000;
  const hq=g.bases.find(b=>b.kind==='headquarters'&&b.owner===0);
  if(!hq||!g.recruit(hq.id,'engineer'))throw Error('Cannot queue test engineer');
  g.paused=false;
  for(let i=0;i<150&&g.productionReleases.length===0;i++)g.step();
  g.paused=true;
  const release=g.productionReleases.at(-1),unit=g.units.find(u=>u.id===release?.unitId);
  if(!release||!unit)throw Error('No actual production release recorded');
  r.camera={x:hq.x+100,y:hq.y,zoom:1.05};r.boundCamera();
  const draws=[],original=r.units.draw.bind(r.units);
  r.units.draw=(c,u,p)=>{if(u.id===unit.id)draws.push({alpha:c.globalAlpha,x:p.x,y:p.y});
   original(c,u,p);};
  r.render(0);r.units.draw=original;
  return {release,position:{x:unit.x,y:unit.y},draws,
    untouchedFacade:typeof r.structures.drawProductionGate==='undefined',
    savedHasEvents:'productionReleases' in g.save()};
 });
 expect(result.release.kind).toBe('engineer');
 expect(result.draws.length).toBeGreaterThan(0);
 expect(result.draws[0].alpha).toBeLessThan(1);
 expect(result.untouchedFacade).toBe(true);
 expect(result.savedHasEvents).toBe(false);
 expect(Math.hypot(result.release.to.x-result.position.x,result.release.to.y-result.position.y)).toBeLessThan(1);
 await page.screenshot({path:'artifacts/reborn/clean-production-exit.png'});
 expect(errors).toEqual([]);
});
