import {test,expect} from '@playwright/test';

test('Atmosphere 1.0: palms, ambient details and existing tracks render without touching campaign state',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?debug&perfTest&seed=2026&map=medium');
 await page.locator('#loading').waitFor({state:'detached'});
 const check=await page.evaluate(async()=>{
  const a=window.__reborn,g=a.game,r=a.renderer;
  const before=JSON.stringify(g.save());
  const {palmCrownSway}=await import('/src/reborn/palm-grove.js');
  const {ambientDust}=await import('/src/reborn/desert-atmosphere.js');
  r.render(0);
  const moved=palmCrownSway(10,600,700,.3)!==palmCrownSway(18,600,700,.3);
  const settings={palms:r.palms.count,animations:moved,disabledStorm:!g.weather.enabled,
   atmosphere:!!r.atmosphere,tracks:!!r.battlefield};
  const after=JSON.stringify(g.save());
  return {...settings,unchanged:before===after,eddyDeterministic:JSON.stringify(ambientDust(200,400,8,g.seed))===
   JSON.stringify(ambientDust(200,400,8,g.seed))};
 });
 expect(check.palms).toBeGreaterThan(0);
 expect(check).toMatchObject({animations:true,disabledStorm:true,atmosphere:true,tracks:true,unchanged:true,eddyDeterministic:true});
 await page.screenshot({path:'artifacts/reborn/atmosphere-v1.png'});
 expect(errors).toEqual([]);
});
