import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {cameraBlackOverscan} from '../../scripts/webgl-map-edges.js';

test('Fog-of-war follows actual 3D soldiers without projected parallax, including movement',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
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
    exteriorOverlays:b.fogNodes.filter(n=>n.userData?.visualPerimeter||n.userData?.visualBoundary).length
   },
   perimeter:{hardVoid:a.visualPerimeter?.hardVoid,meshCount:a.visualPerimeter?.meshes?.length},
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
 expect(initial.fogMaterial.exteriorOverlays).toBe(0);
 expect(initial.perimeter).toEqual({hardVoid:true,meshCount:0});
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
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
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
  return {x:a.controls.target.x,z:a.controls.target.z,size:w.size,
   zoom:a.camera.zoom,min:a.controls.minZoom,max:a.controls.maxZoom};
 });
 // Modern 3D maps deliberately expose a bounded BLACK void, not a beige apron.
 // This must agree with the same shared overscan policy used by the renderer.
 const limit=state.size/2+cameraBlackOverscan(state.size);
 expect(Math.abs(state.x)).toBeLessThanOrEqual(limit+.01);
 expect(Math.abs(state.z)).toBeLessThanOrEqual(limit+.01);
 expect(Math.abs(state.x)).toBeGreaterThan(state.size/2);
 expect(Math.abs(state.z)).toBeGreaterThan(state.size/2);
 expect(state.zoom).toBeGreaterThanOrEqual(state.min);
 expect(state.zoom).toBeLessThanOrEqual(state.max);
});


test('legacy 3D preview URLs retain Sandforge logo, true Fog of War and empty black map perimeter',async({page})=>{
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
  // Current spacious maps intentionally contain NO exterior meshes, cover
  // tiles, rock aprons or cliff rings. The scene's solid black is the border.
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
   void:{hardVoid:v.visualPerimeter?.hardVoid,
    perimeterMeshes:v.visualPerimeter?.meshes?.length,
    perimeterCover:v.visualPerimeter?.voidCover?.length,
    hardCliffs:v.boundaryCliffs?.hardVoid,
    cliffs:v.boundaryCliffs?.cliffs?.length,
    scree:v.boundaryCliffs?.scree?.length},
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
 expect(state.void).toEqual({hardVoid:true,perimeterMeshes:0,perimeterCover:0,
  hardCliffs:true,cliffs:0,scree:0});
 await page.locator('button[data-action="fog"]').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.fogEnabled)).toBe(false);
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.fogNodes.every(n=>!n.visible))).toBe(true);
 await page.locator('button[data-action="fog"]').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.fogEnabled)).toBe(true);
 expect(pageErrors).toEqual([]);
});


test('minimap uses the exact 3D vision grid and a rotated ground-footprint outline',async({page})=>{
 test.setTimeout(125000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 const state=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game,b=a.battlefield;
  g.updateVision();b.updateFog();b.drawMinimap();
  const source=b.fogTexture.image.data,mini=b.miniFogPixels.data;
  let different=0,visible=0,unknown=0;
  for(let i=0;i<g.world.blocked.length;i++){
   if(source[i*4+3]!==mini[i*4+3])different++;
   if(source[i*4+3]===0)visible++;
   if(source[i*4+3]===255)unknown++;
  }
  const soldier=g.units.find(u=>u.owner===0&&u.hp>0&&!u.carrier);
  const index=g.world.index(soldier);
  const polygon=b.miniViewportCorners.map(p=>({...p}));
  const area=points=>Math.abs(points.reduce((total,p,i)=>{
   const next=points[(i+1)%points.length];
   return total+p.x*next.y-next.x*p.y;
  },0))*.5;
  const camera=a.camera,controls=a.controls;
  const offset=camera.position.clone().sub(controls.target);
  offset.applyAxisAngle(camera.up,Math.PI/6);
  camera.position.copy(controls.target).add(offset);
  camera.lookAt(controls.target);controls.update();b.drawMinimap();
  const rotated=b.miniViewportCorners;
  return {different,visible,unknown,sourceLen:source.length,miniLen:mini.length,
   ownCellAlpha:mini[index*4+3],corners:polygon.length,
   area:area(polygon),rotatedArea:area(rotated),
   changed:Math.hypot(rotated[0].x-polygon[0].x,rotated[0].y-polygon[0].y)};
 });
 expect(state.sourceLen).toBe(state.miniLen);
 expect(state.different).toBe(0);
 expect(state.visible).toBeGreaterThan(0);
 expect(state.unknown).toBeGreaterThan(0);
 expect(state.ownCellAlpha).toBe(0);
 expect(state.corners).toBe(4);
 expect(state.area).toBeGreaterThan(1);
 expect(state.rotatedArea).toBeGreaterThan(1);
 expect(state.changed).toBeGreaterThan(1);
});


test('near-edge RMB ray fallback reaches all four playable sides of the tilted map',async({page})=>{
 test.setTimeout(125000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 const result=await page.evaluate(()=>{
  const v=window.__sandforgeWebGL,b=v.battlefield,size=v.game.world.size,half=size/2;
  const camera=v.camera,controls=v.controls;
  const cameraOffset=camera.position.clone().sub(controls.target);
  const original=b.groundMeshes;
  const tested=[];
  try{
   // Force the "no sand triangle" branch without relying on the varied
   // hillside's accidental ray intersections. Picking without overscan
   // must remain strict; only a near-edge RMB-style request can succeed.
   b.groundMeshes=[];
   const candidates=[[-50,half],[size+50,half],[half,-50],[half,size+50]];
   const clamp=n=>Math.max(80,Math.min(size-80,n));
   const rect=b.renderer.domElement.getBoundingClientRect();
   for(const [x,z] of candidates){
    const focus=b.pos(clamp(x),clamp(z),v.heightAt(clamp(x),clamp(z))+42);
    controls.target.copy(focus);
    camera.position.copy(focus).add(cameraOffset);
    camera.lookAt(focus);controls.update();camera.updateMatrixWorld(true);
    const h=v.heightAt(clamp(x),clamp(z));
    const ndc=b.pos(x,z,h).project(camera);
    const event={clientX:rect.left+(ndc.x+1)*rect.width*.5,
     clientY:rect.top+(1-ndc.y)*rect.height*.5};
    const inside=event.clientX>rect.left&&event.clientX<rect.right&&
     event.clientY>rect.top&&event.clientY<rect.bottom;
    const strict=b.terrainPoint(event),near=b.terrainPoint(event,{snapEdge:true});
    tested.push({inside,strict,near,borderDistance:near?
     Math.min(near.x,near.y,size-near.x,size-near.y):Infinity});
   }
  }finally{b.groundMeshes=original;}
  return {size,tested};
 });
 expect(result.tested).toHaveLength(4);
 for(const side of result.tested){
  expect(side.inside).toBe(true);
  expect(side.strict).toBeNull();
  expect(side.near).not.toBeNull();
  expect(side.near.x).toBeGreaterThanOrEqual(12);
  expect(side.near.y).toBeGreaterThanOrEqual(12);
  expect(side.near.x).toBeLessThanOrEqual(result.size-12);
  expect(side.near.y).toBeLessThanOrEqual(result.size-12);
  expect(side.borderDistance).toBeLessThan(result.size*.05);
 }
});
