import {test,expect} from '@playwright/test';

for(const dpr of [1,2])test(`bomber shadow: diffuse ground ellipse, separate height, unchanged helicopter and selection at DPR ${dpr}`,async({browser})=>{
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:dpr});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('/?debug&legacy');await page.locator('#loading').waitFor({state:'detached'});
  const result=await page.evaluate(async()=>{
   const a=window.__reborn,g=a.game,r=a.renderer;
   const {unitVisualLift,unitSelectionPoint}=await import('/src/reborn/unit-presentation.js');
   const {UNITS}=await import('/src/reborn/catalog.js');
   g.paused=true;g.aiClock=-1e8;g.units=[];
   const bomber=g.spawn(0,{x:1900,y:2100},'bomber'),heli=g.spawn(0,{x:2130,y:2100},'scout');
   r.selected.clear();r.selectedBase=null;r.camera={x:2000,y:2030,zoom:1.4};r.boundCamera();g.updateVision();a.refresh();
   const before=JSON.stringify(g.save());r.render(0);r.render(.1);
   const blue=r.units.asset('bomber',0),red=r.units.asset('bomber',1),scout=r.units.asset('scout',0),s=blue.groundShadow,c=s.image.getContext('2d'),w=s.image.width,h=s.image.height;
   const alpha=(x,y)=>c.getImageData(x,y,1,1).data[3];
   const calls=[],draw=r.context.drawImage;r.context.drawImage=function(...args){calls.push(args);return draw.apply(this,args);};
   const state={alpha:r.context.globalAlpha,filter:r.context.filter,smoothing:r.context.imageSmoothingEnabled};
   try{r.units.draw(r.context,bomber,bomber);}finally{r.context.drawImage=draw;}
   const groundCall=calls.find(v=>v[0]===s.image),bodyCall=calls.find(v=>v[0]===blue.image);
   const selectedPoint=r.screen(unitSelectionPoint(bomber));
   return {widthRatio:s.width/UNITS.bomber.width,heightRatio:s.height/UNITS.bomber.width,x:s.offsetX,y:s.offsetY,alpha:alpha(w/2,h/2),mid:alpha(Math.floor(w*.8),h/2),edge:alpha(w-1,h/2),corner:alpha(0,0),shared:s===red.groundShadow,noDoubleShadow:!blue.shadow&&!red.shadow,helicopterUnchanged:!!scout.shadow&&!scout.groundShadow,groundFirst:calls.indexOf(groundCall)<calls.indexOf(bodyCall),groundRect:groundCall.slice(1),lift:unitVisualLift(bomber),selection:unitSelectionPoint(bomber),world:bomber,selectedPoint,unchanged:before===JSON.stringify(g.save()),stateUnchanged:state.alpha===r.context.globalAlpha&&state.filter===r.context.filter&&state.smoothing===r.context.imageSmoothingEnabled};
  });
  expect(result.widthRatio).toBeCloseTo(.6*1.4);expect(result.heightRatio).toBeCloseTo(.24*1.4);expect(result.x).toBe(10);expect(result.y).toBe(42);
  expect(result.alpha/255).toBeGreaterThanOrEqual(.18);expect(result.alpha/255).toBeLessThanOrEqual(.26);expect(result.mid).toBeGreaterThan(0);expect(result.mid).toBeLessThan(result.alpha);expect(result.edge).toBeLessThanOrEqual(2);expect(result.corner).toBe(0);
  for(const key of ['shared','noDoubleShadow','helicopterUnchanged','groundFirst','unchanged','stateUnchanged'])expect(result[key],key).toBe(true);
  expect(result.groundRect[0]+result.groundRect[2]/2).toBeCloseTo(result.world.x+10);expect(result.groundRect[1]+result.groundRect[3]/2).toBeCloseTo(result.world.y+42);
  expect(result.lift).toBe(56);expect(result.selection).toEqual({x:result.world.x,y:result.world.y-111});
  const bounds=await page.locator('#world').boundingBox();await page.mouse.click(bounds.x+result.selectedPoint.x,bounds.y+result.selectedPoint.y);
  expect(await page.evaluate(()=>[...window.__reborn.renderer.selected])).toEqual([result.world.id]);
  await expect(page.locator('#selection-title')).toHaveText('Bomber');await expect(page.locator('#selection-health')).toContainText('700 / 700');
  await page.evaluate(()=>{const a=window.__reborn;a.renderer.selected.clear();a.renderer.selectedBase=null;a.refresh();a.renderer.render(0);});
  await page.screenshot({path:`artifacts/bomber-shadow-dpr${dpr}.png`});expect(errors).toEqual([]);
 }finally{await context.close();}
});
