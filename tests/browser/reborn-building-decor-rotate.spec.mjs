import {test,expect} from '@playwright/test';

test('construction: R and the HUD switch mirrored façade without changing terrain, then it is saved',async({page})=>{
 const errors=[],requested=[];page.on('request',r=>requested.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
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
    if(!g.buildError(0,'turret',p)){point=p;break;}
   }
  if(point){r.camera.x=point.x;r.camera.y=point.y;r.boundCamera();}
  a.refresh();return point;
 });
 expect(target).not.toBeNull();
 await page.locator('#build-mode').click();
 await page.locator('[data-build="turret"]').click();
 await expect(page.locator('#rotate-building')).toBeVisible();
 await expect(page.locator('#hint')).toContainText('R: GEBÄUDE DREHEN');
 // The build hint is also drawn beside the cursor, not just in the lower HUD.
 const source=await page.evaluate(async()=>{
   const response=await fetch('/src/reborn/renderer.js');
   return response.ok?await response.text():'';
 });
 expect(source).toContain('GEBÄUDE DREHEN');
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
  const drawn=[],originalDraw=r.propAtlas.draw.bind(r.propAtlas);
  r.propAtlas.draw=(...args)=>{drawn.push(args[1]);originalDraw(...args);};
  // A completed site must use the new atlas in the actual building renderer.
  site.buildRemaining=0;r.drawBase(site);r.propAtlas.draw=originalDraw;
  const restored=window.__reborn.game.constructor.load(g.save());
  return {site:{facing:site.facing,x:site.x,y:site.y,radius:site.radius},
   restored:restored.bases.find(b=>b.id===site.id).facing,
   props:r.decor.spriteCount,drawn,oldBases:old.bases.length,newBases:g.bases.length};
 },target);
 expect(result.site).not.toBeNull();
 expect(result.site.facing).toBe(1);
 expect(result.restored).toBe(1);
 expect(result.newBases).toBe(result.oldBases+1);
 expect(result.props).toBe(32);
 expect(result.drawn).toContain('military-crate');
 expect(requested.some(url=>url.includes('/props-3d/props.png'))).toBe(true);
 expect(requested.some(url=>url.endsWith('/battlefield/palm.png'))).toBe(false);
 expect(requested.some(url=>url.endsWith('.glb'))).toBe(false);
 expect(errors).toEqual([]);
});

test('3D prop pack: actual base sprites, mirrored yards and sparse environment render without save changes',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1600,height:1000});
 await page.goto('/?debug&perfTest&legacy');
 await page.locator('#loading').waitFor({state:'detached'});
 const result=await page.evaluate(async()=>{
  const {BUILDINGS}=await import('/src/reborn/catalog.js');
  const {environmentPropVisible}=await import('/src/reborn/prop-placement.js');
  const a=window.__reborn,g=a.game,r=a.renderer;
  g.paused=true;g.visible[0].fill(1);g.explored[0].fill(1);g.revision++;g.world.blocked.fill(0);
  const prototype=g.bases.find(b=>b.owner===0),kinds=['headquarters','barracks','factory','airfield','generator','turret'];
  g.bases=kinds.flatMap((kind,i)=>[0,1].map(facing=>({...prototype,id:5000+i*2+facing,kind,facing,
   x:900+(i%3)*640,y:900+Math.floor(i/3)*850+facing*390,radius:BUILDINGS[kind].radius,
   hp:BUILDINGS[kind].hp,buildRemaining:0,queue:[]})));
  g.territories=[];g.units=[];g.spawn(0,{x:1350,y:1510},'tank');g.spawn(0,{x:1670,y:1500},'rover');
  r.groundDetails=[{kind:'palm',x:1180,y:1400,radius:32,rotation:0,variant:.1},
   {kind:'palm',x:1810,y:2090,radius:30,rotation:0,variant:.7},
   {kind:'skull',x:1240,y:1800,radius:8,rotation:0,variant:.4}];
  r.palms.reset(r.groundDetails,g);
  r.camera={x:1550,y:1430,zoom:.58};
  const save=JSON.stringify(g.save()),drawn=[],original=r.propAtlas.draw.bind(r.propAtlas);
  r.propAtlas.draw=(c,kind,...rest)=>{drawn.push(kind);original(c,kind,...rest);};
  r.render(0);r.propAtlas.draw=original;
  return {unchanged:save===JSON.stringify(g.save()),kinds:[...new Set(drawn)],sprites:r.decor.spriteCount,
   environmentClear:r.groundDetails.every(d=>environmentPropVisible(d,g))};
 });
 expect(result.unchanged).toBe(true);expect(result.sprites).toBe(32);expect(result.environmentClear).toBe(true);
 for(const kind of ['military-crate','military-crate-stack','service-lamp','service-terminal','fuel-barrels','palm-tree','desert-skull'])expect(result.kinds).toContain(kind);
 await page.screenshot({path:'artifacts/reborn/3d-prop-pack-runtime.png'});
 expect(errors).toEqual([]);
});
