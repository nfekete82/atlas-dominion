import {test,expect} from '@playwright/test';

for(const dpr of [1,2])test('raised, crisp helicopter renders independent soft shadow and grounded selection at DPR '+dpr,async({browser})=>{
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:dpr});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('/?debug&seed=2026');
  await page.locator('#loading').waitFor({state:'detached'});
  const r=await page.evaluate(async()=>{
   const a=window.__reborn,g=a.game,renderer=a.renderer;
   const {unitVisualLift,unitSelectionPoint,AIR_GROUND_SHADOWS}=await import('/src/reborn/unit-presentation.js');
   const {unitArtScale}=await import('/src/reborn/visual-scale.js');
   g.paused=true;g.aiClock=-1e8;g.units=[];
   const heli=g.spawn(0,{x:1900,y:2100},'scout');
   const infantry=g.spawn(0,{x:2050,y:2100},'infantry');
   renderer.selected=new Set([heli.id]);renderer.selectedBase=null;
   renderer.camera={x:1940,y:2020,zoom:1.1};renderer.boundCamera();
   g.updateVision();a.refresh();renderer.render(0);
   const asset=renderer.units.asset('scout',0),shadow=asset.groundShadow;
   const calls=[],oldDraw=renderer.context.drawImage,ellipse=[],oldEllipse=renderer.context.ellipse;
   const state={smoothing:renderer.context.imageSmoothingEnabled,quality:renderer.context.imageSmoothingQuality,filter:renderer.context.filter};
   renderer.context.drawImage=function(...args){calls.push(args);return oldDraw.apply(this,args);};
   renderer.context.ellipse=function(...args){ellipse.push(args);return oldEllipse.apply(this,args);};
   try{renderer.drawUnit(heli);}finally{renderer.context.drawImage=oldDraw;renderer.context.ellipse=oldEllipse;}
   const groundCall=calls.find(x=>x[0]===shadow.image),bodyCall=calls.find(x=>x[0]===asset.image);
   const canvas=shadow.image,c=canvas.getContext('2d'),center=c.getImageData(canvas.width/2,canvas.height/2,1,1).data[3],
     corner=c.getImageData(0,0,1,1).data[3],edge=c.getImageData(canvas.width-1,canvas.height/2,1,1).data[3];
   const inspect=renderer.screen(unitSelectionPoint(heli));
   return {lift:unitVisualLift(heli),scale:unitArtScale('scout'),soldier:unitArtScale('infantry'),
    shadow:{center,corner,edge,width:shadow.width,height:shadow.height,x:shadow.offsetX,y:shadow.offsetY},
    hasSeparatedShadow:!!shadow&&!asset.shadow,groundFirst:calls.indexOf(groundCall)<calls.indexOf(bodyCall),
    groundY:groundCall?.[2]+groundCall?.[4]/2,bodyY:bodyCall?.[6],
    selectedEllipseY:ellipse[0]?.[1],point:inspect,world:{x:heli.x,y:heli.y},
    unchanged:state.smoothing===renderer.context.imageSmoothingEnabled&&state.quality===renderer.context.imageSmoothingQuality&&state.filter===renderer.context.filter,
    save:g.save().units.find(u=>u.id===heli.id)?.kind,selected:[...renderer.selected]};
  });
  expect(r.scale).toBe(1.52);expect(r.soldier).toBe(.73);expect(r.lift).toBe(82);
  expect(r.hasSeparatedShadow).toBe(true);expect(r.groundFirst).toBe(true);
  expect(r.shadow.center).toBeGreaterThan(35);expect(r.shadow.center).toBeLessThan(90);
  expect(r.shadow.corner).toBe(0);expect(r.shadow.edge).toBeLessThanOrEqual(2);
  expect(r.shadow.width).toBeGreaterThan(100);
  expect(r.selectedEllipseY).toBe(r.world.y);
  expect(r.groundY).toBeCloseTo(r.world.y+22);
  expect(r.unchanged).toBe(true);expect(r.save).toBe('scout');expect(r.selected).toHaveLength(1);
  await page.screenshot({path:'artifacts/heli-dpr'+dpr+'.png'});
  expect(errors).toEqual([]);
 }finally{await context.close();}
});
