import {test,expect} from '@playwright/test';

test('3D campaign parity: black fog, engineer HQ bootstrap and blocked production',async({page})=>{
 test.setTimeout(125000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:95000});
 const initial=await page.evaluate(()=>{
  const {game,battlefield,controls}=window.__sandforgeWebGL;
  const fog=battlefield.fogTexture.image.data;
  let unexplored=0,black=0,visible=0;
  for(let i=0;i<game.world.blocked.length;i++){
   if(!game.explored[0][i]){unexplored++;if(fog[i*4+3]===255)black++;}
   if(game.visible[0][i])visible++;
  }
  return {bootstrap:game.bootstrapVersion,needsHQ:game.needsHeadquarters(0),
   bases:game.bases.length,engineers:game.units.filter(u=>u.owner===0&&u.kind==='engineer').length,
   unknown:unexplored,black,visible,
   minZoom:controls.minZoom,maxZoom:controls.maxZoom,zoom:controls.object.zoom,
   cameraDistance:Math.hypot(
    controls.target.x-(game.units.filter(u=>u.owner===0).reduce((sum,u)=>sum+u.x,0)/2-game.world.size/2),
    controls.target.z-(game.units.filter(u=>u.owner===0).reduce((sum,u)=>sum+u.y,0)/2-game.world.size/2))};
 });
 expect(initial.bootstrap).toBe(1);
 expect(initial.needsHQ).toBe(true);
 expect(initial.bases).toBe(0);
 expect(initial.engineers).toBe(1);
 expect(initial.unknown).toBeGreaterThan(0);
 expect(initial.black).toBe(initial.unknown);
 expect(initial.visible).toBeGreaterThan(0);
 expect(initial.cameraDistance).toBeLessThan(100);
 expect(initial.minZoom).toBeCloseTo(.46,2);
 expect(initial.maxZoom).toBeLessThanOrEqual(3.5);
 await expect(page.locator('[data-unit="infantry"]')).toBeDisabled();
 await expect(page.locator('[data-tab="buildings"]')).toBeHidden();
 await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const worker=game.units.find(u=>u.owner===0&&u.kind==='engineer');
  battlefield.selected=new Set([worker.id]);battlefield.selectedBase=null;
  battlefield.drawInterface();
 });
 await expect(page.locator('[data-tab="buildings"]')).toBeVisible();
 await page.locator('[data-tab="buildings"]').click();
 await expect(page.locator('[data-build="barracks"]')).toBeDisabled();
 await expect(page.locator('[data-build="factory"]')).toBeDisabled();
 await expect(page.locator('[data-build="airfield"]')).toBeDisabled();
 await expect(page.locator('[data-build="headquarters"]')).toBeEnabled();
 const built=await page.evaluate(()=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const worker=game.units.find(u=>u.owner===0&&u.kind==='engineer');
  const site=game.headquartersCandidates(0).find(p=>game.buildError(0,'headquarters',p)===null);
  if(!site)throw Error('No legal HQ site');
  const b=game.build(0,'headquarters',site,[worker.id]);
  if(!b)throw Error('HQ build command unexpectedly rejected');
  battlefield.sync(true);
  return {id:b.id,remaining:b.buildRemaining,hq:game.hasHeadquarters(0)};
 });
 expect(built.remaining).toBeGreaterThan(0);
 expect(built.hq).toBe(false);
 await expect(page.locator('[data-build="barracks"]')).toBeDisabled();
 const completion=await page.evaluate(id=>{
  const {game,battlefield}=window.__sandforgeWebGL;
  const base=game.bases.find(b=>b.id===id);
  base.buildRemaining=0;base.hp=800;
  game.updateVision();battlefield.sync(true);
  return {hq:game.hasHeadquarters(0),newAllowed:!document.querySelector('[data-build="barracks"]').disabled,
   infantryLocked:document.querySelector('[data-unit="infantry"]').disabled};
 },built.id);
 expect(completion.hq).toBe(true);
 expect(completion.newAllowed).toBe(true);
 expect(completion.infantryLocked).toBe(true); // Kaserne has not been built.
 expect(errors).toEqual([]);
});

test('3D camera maximum zoom-out stays inside tactical framing',async({page})=>{
 test.setTimeout(115000);
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:95000});
 const state=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL;
  a.camera.zoom=.1;a.controls.update();
  return {minimum:a.controls.minZoom,actual:a.camera.zoom,maximum:a.controls.maxZoom};
 });
 expect(state.minimum).toBeCloseTo(.46,2);
 expect(state.actual).toBeGreaterThanOrEqual(state.minimum);
 expect(state.actual).toBeLessThanOrEqual(state.maximum);
});
