import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

test('Fog-of-war follows actual 3D soldiers without projected parallax, including movement',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:95000});
 const initial=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game,b=a.battlefield,w=g.world;
  const units=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier);
  const fog=b.fogTexture.image.data,half=w.size/2;
  const camera=a.camera;
  const screen=p=>{
   const v=p.clone().project(camera);
   return {x:(v.x+1)*.5*1440,y:(1-v.y)*.5*900};
  };
  const measures=units.map(u=>{
   const ground=a.battlefield.pos(u.x,u.y);
   const sheet=ground.clone();sheet.y+=3;
   const before=screen(ground),after=screen(sheet);
   return {id:u.id,canSee:g.canSee(0,u),
    alpha:fog[w.index(u)*4+3],
    screenOffset:Math.hypot(after.x-before.x,after.y-before.y)};
  });
  return {
   measures,
   fogLayers:b.fogNodes.length,
   fogGroundHeight:b.fogNodes[0].material.vertexShader.includes('p.y+=3.0'),
   fogMaterial:{
    depthTest:b.fogNodes[0].material.depthTest,
    order:b.fogNodes[0].renderOrder,
    perimeter:b.fogNodes.filter(n=>n.geometry===a.visualPerimeter.meshes[0].geometry).length
   },
   fogEnabled:b.fogEnabled
  };
 });
 expect(initial.measures.length).toBeGreaterThanOrEqual(2);
 for(const unit of initial.measures){
  expect(unit.canSee).toBe(true);
  expect(unit.alpha).toBe(0);
  expect(unit.screenOffset).toBeLessThan(5);
 }
 expect(initial.fogLayers).toBe(16);
 expect(initial.fogGroundHeight).toBe(true);
 expect(initial.fogMaterial.depthTest).toBe(false);
 expect(initial.fogMaterial.order).toBeGreaterThan(100);
 expect(initial.fogMaterial.perimeter).toBe(0);
 expect(initial.fogEnabled).toBe(true);
 const movement=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game,b=a.battlefield,w=g.world;
  const u=g.units.find(u=>u.owner===0&&u.hp>0&&!u.carrier);
  const origin={x:u.x,y:u.y};
  const target=w.generated?.ruins?.map(r=>({x:r.x,y:r.y}))
   .find(p=>w.walkable(p)&&!g.hasExplored(0,p)) ??
   Array.from({length:w.blocked.length},(_,i)=>w.center(i))
    .find(p=>w.walkable(p)&&!g.hasExplored(0,p)&&Math.hypot(p.x-u.x,p.y-u.y)>300);
  if(!target)throw Error('No undiscovered accessible fog target');
  const oldCell=w.index(target),before=b.fogTexture.image.data[oldCell*4+3];
  u.x=target.x;u.y=target.y;u.previousX=u.x;u.previousY=u.y;
  g.updateVision();b.sync(true);
  const after=b.fogTexture.image.data[oldCell*4+3];
  return {before,after,visible:g.canSee(0,u),explored:g.hasExplored(0,u),
   changed:Math.hypot(u.x-origin.x,u.y-origin.y)};
 });
 expect(movement.before).toBe(255);
 expect(movement.after).toBe(0);
 expect(movement.visible).toBe(true);
 expect(movement.explored).toBe(true);
 expect(movement.changed).toBeGreaterThan(300);
 expect(errors).toEqual([]);
 const dir=fileURLToPath(new URL('./artifacts/',import.meta.url));
 await mkdir(dir,{recursive:true});
 await page.screenshot({path:dir+'webgl-fog-ground-aligned.png',fullPage:true});
});

test('Camera clamps a forced off-map pan before revealing the flat scene boundary',async({page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:95000});
 await page.evaluate(()=>{
  const a=window.__sandforgeWebGL;
  const amount=a.game.world.size*10;
  a.camera.position.x+=amount;
  a.camera.position.z+=amount;
  a.controls.target.x+=amount;
  a.controls.target.z+=amount;
 });
 await page.waitForTimeout(550);
 const state=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,w=a.game.world;
  const bound=w.size/2+280;
  return {x:a.controls.target.x,z:a.controls.target.z,limit:bound,
   zoom:a.camera.zoom,min:a.controls.minZoom,max:a.controls.maxZoom};
 });
 expect(Math.abs(state.x)).toBeLessThan(state.limit);
 expect(Math.abs(state.z)).toBeLessThan(state.limit);
 expect(state.zoom).toBeGreaterThanOrEqual(state.min);
 expect(state.zoom).toBeLessThanOrEqual(state.max);
});


test('legacy 3D preview links show original logo, dark Fog of War and black fading map rim',async({page})=>{
 test.setTimeout(125000);
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 // Older shared preview URLs used fog=0 to reveal the terrain. Player-facing
 // links must now start with the authentic black war fog instead.
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1&fog=0',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 await page.locator('#sf-classic-root .top .sandforge-hud-logo')
  .evaluate(async img=>{if(!img.complete)await img.decode();});
 const state=await page.evaluate(()=>{
  const v=window.__sandforgeWebGL,b=v.battlefield;
  const logo=document.querySelector('#sf-classic-root .top .sandforge-hud-logo');
  const near=[],far=[],half=v.game.world.size/2,size=v.game.world.size;
  for(const mesh of v.visualPerimeter.meshes){
   const pos=mesh.geometry.getAttribute('position');
   const colors=mesh.geometry.getAttribute('color');
   for(let i=0;i<pos.count;i++){
    const x=pos.getX(i)+half,z=pos.getZ(i)+half;
    const outside=Math.max(0,-x,x-size,-z,z-size);
    const light=(colors.getX(i)+colors.getY(i)+colors.getZ(i))/3;
    if(outside>=35&&outside<=145)near.push(light);
    if(outside>=550)far.push(light);
   }
  }
  const average=values=>values.reduce((a,n)=>a+n,0)/values.length;
  const undiscovered=v.game.visible[0].filter(i=>!i).length;
  return {
   logo:{
    url:logo?.getAttribute('src'),loaded:logo?.naturalWidth>0,
    height:logo?.getBoundingClientRect().height,
    name:logo?.alt
   },
   fog:b.fogEnabled,visibleOverlay:b.fogNodes.every(n=>n.visible),
   fogTint:b.fogNodes[0].material.fragmentShader.includes('vec4(0.018,0.023,0.026,a)'),
   darkBackground:v.scene.background.getHexString(),
   unexploredCells:undiscovered,
   samples:{near:near.length,far:far.length,nearLight:average(near),farLight:average(far)},
   button:b.panel.querySelector('button[data-action="fog"]')?.textContent
  };
 });
 expect(state.logo.url).toBe('/src/assets/reborn/sandforge-logo-transparent.webp');
 expect(state.logo.loaded).toBe(true);
 expect(state.logo.height).toBeGreaterThan(20);
 expect(state.logo.name).toContain('Sandforge');
 expect(state.fog).toBe(true);
 expect(state.visibleOverlay).toBe(true);
 expect(state.fogTint).toBe(true);
 expect(state.button).toContain('NEBEL AN');
 expect(state.darkBackground).toBe('000000');
 expect(state.unexploredCells).toBeGreaterThan(100);
 expect(state.samples.near).toBeGreaterThan(0);
 expect(state.samples.far).toBeGreaterThan(0);
 expect(state.samples.nearLight).toBeGreaterThan(state.samples.farLight+.1);
 await page.locator('button[data-action="fog"]').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.fogEnabled)).toBe(false);
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.fogNodes.every(n=>!n.visible))).toBe(true);
 await page.locator('button[data-action="fog"]').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.fogEnabled)).toBe(true);
 expect(pageErrors).toEqual([]);
});
