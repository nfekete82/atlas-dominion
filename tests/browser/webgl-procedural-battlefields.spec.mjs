import {test,expect} from '@playwright/test';
const profiles=['open','dunes','rocky','oasis','mixed'];
async function ready(page,url){
 await page.goto(url);await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded&&window.__sandforgeWebGL.desertArtReady);
}
for(const profile of profiles){
 test(`${profile}: shared heightfield, rock collision, oases, fog/minimap, camera and visual acceptance`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewportSize({width:1440,height:900});
  await ready(page,`/?bastions=16&seed=2074&terrain=${profile}&pause=1`);
  const state=await page.evaluate(()=>{
   const a=window.__sandforgeWebGL,w=a.game.world,t=w.generated.battlefield,b=a.battlefield;let heightError=0;
   for(const mesh of b.groundMeshes){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i+=31){
    heightError=Math.max(heightError,Math.abs(p.getY(i)-w.terrainHeight(p.getX(i)+w.size/2,p.getZ(i)+w.size/2)));}}
   const fog=b.fogTexture.image.data,units=a.game.units.filter(u=>u.owner===0);
   b.drawMinimap();
   const miniature=b.miniTerrainCanvas.getContext('2d').getImageData(0,0,240,240).data;
   const obstacle=Array.from(w.blocked).findIndex(v=>v===1);
   return {version:w.mapVersion,profile:t.profile,valid:w.validation.valid,heightError,range:t.maxHeight-t.minHeight,
    fog:units.every(u=>fog[w.index(u)*4+3]===0),fogMeshes:b.fogNodes.every((m,i)=>m.geometry===b.groundMeshes[i].geometry),
    minimap:miniature[obstacle*4]===104,outline:b.miniViewportCorners.length,
    rocks:a.scene.getObjectByName('physical-battlefield-rocks')?.geometry.attributes.position.count,
    oases:a.oases.layout.length,soilCapacity:Math.max(...a.renderer.info.programs.map(p=>p.getUniforms().map.oasisCenters?.size??0)),waters:a.oases.water.map(m=>{
     const p=m.geometry.attributes.position;let error=0;
     for(let i=0;i<p.count;i++)error=Math.max(error,Math.abs(p.getY(i)-a.oases.renderedHeight(p.getX(i)+w.size/2,p.getZ(i)+w.size/2)-.2));return error;
    })};
  });
  expect(state.version).toBe(26);expect(state.profile).toBe(profile);expect(state.valid).toBe(true);
  expect(state.heightError).toBeLessThan(.001);expect(state.fog).toBe(true);expect(state.fogMeshes).toBe(true);
  expect(state.minimap).toBe(true);expect(state.outline).toBe(4);expect(state.rocks).toBeGreaterThan(0);
  expect(state.oases).toBeGreaterThan(0);if(profile==='oasis')expect(state.soilCapacity).toBeGreaterThanOrEqual(state.oases);for(const e of state.waters)expect(e).toBeLessThan(.003);
  // The real startup view includes the unmodified fog and the flat HQ region.
  await page.screenshot({path:test.info().outputPath(`${profile}-start.png`)});
  // Same camera and world focal point across profiles for direct comparison.
  await page.evaluate(()=>{
   const a=window.__sandforgeWebGL,h=a.game.world.size/2;
   a.battlefield.fogEnabled=false;a.battlefield.updateFog();
   a.controls.target.set(0,a.heightAt(h,h)+42,0);a.camera.position.copy(a.controls.target).add({x:1200,y:1110,z:1640});
   a.camera.zoom=.59;a.camera.updateProjectionMatrix();a.controls.update();
  });
  await page.waitForTimeout(200);await page.screenshot({path:test.info().outputPath(`${profile}-standard.png`)});
  await page.evaluate(()=>{const a=window.__sandforgeWebGL;a.camera.zoom=a.controls.minZoom;a.camera.updateProjectionMatrix();a.controls.update();});
  await page.waitForTimeout(200);await page.screenshot({path:test.info().outputPath(`${profile}-max-out.png`)});
  await page.locator('#rotate-right').click();await page.waitForTimeout(200);
  await page.screenshot({path:test.info().outputPath(`${profile}-rotated.png`)});
  await page.evaluate(()=>{const a=window.__sandforgeWebGL;a.camera.zoom=.85;a.camera.updateProjectionMatrix();a.controls.update();a.battlefield.drawMinimap();});
  await page.waitForTimeout(200);await page.screenshot({path:test.info().outputPath(`${profile}-central.png`)});
  await page.locator('#sf-map').screenshot({path:test.info().outputPath(`${profile}-minimap.png`)});
  if(profile==='oasis'){
   await page.evaluate(()=>{
    const a=window.__sandforgeWebGL,o=a.oases.layout[4],half=a.game.world.size/2;
    if(!o)throw Error('Fifth oasis missing');
    a.controls.target.set(o.x-half,a.heightAt(o.x,o.y)+30,o.y-half);
    a.camera.position.copy(a.controls.target).add({x:1200,y:1110,z:1640});a.camera.zoom=1.15;a.camera.updateProjectionMatrix();a.controls.update();
   });
   await page.waitForTimeout(200);await page.screenshot({path:test.info().outputPath('oasis-fifth-soil.png')});
  }
  const edge=await page.evaluate(()=>{
   const a=window.__sandforgeWebGL,w=a.game.world,s=w.size;
   a.controls.target.set(s*8,0,s*8);a.camera.position.set(s*8+1200,1110,s*8+1640);a.controls.update();
   return {size:s,black:a.scene.background.getHex(),outside:w.walkable({x:-10,y:s/2})};
  });
  await page.waitForTimeout(300);
  const clamped=await page.evaluate(()=>{const a=window.__sandforgeWebGL;return Math.max(Math.abs(a.controls.target.x),Math.abs(a.controls.target.z));});
  expect(clamped).toBeLessThan(edge.size);expect(edge.black).toBe(0);expect(edge.outside).toBe(false);
  expect(errors).toEqual([]);
 });
}

test('new-game menu selects all profiles, randomizes blank seeds, reproduces explicit seeds and restores the selected geometry',async({page})=>{
 await page.goto('/');await page.locator('#sf3d-new').click();
 expect(await page.locator('#sf3d-terrain option').count()).toBe(6);
 await page.locator('#sf3d-map-size').selectOption('4');await page.locator('#sf3d-terrain').selectOption('dunes');
 await page.locator('#sf3d-seed').fill('0');await page.locator('#sf3d-new-confirm').click();
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded);
 const initial=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL;a.battlefield.saveGame();
  return {seed:a.game.seed,profile:a.terrain.battlefield.profile,heights:Array.from(a.terrain.battlefield.heights),blocked:Array.from(a.game.world.blocked)};
 });
 expect(initial.seed).toBe(0);expect(initial.profile).toBe('dunes');
 await page.goto('/');await page.locator('#sf3d-continue').click();
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded);
 const restored=await page.evaluate(()=>{const a=window.__sandforgeWebGL;return {seed:a.game.seed,profile:a.terrain.battlefield.profile,heights:Array.from(a.terrain.battlefield.heights),blocked:Array.from(a.game.world.blocked)};});
 expect(restored).toEqual(initial);
 const seeds=[];
 for(let i=0;i<2;i++){
  await page.goto('/');await page.locator('#sf3d-new').click();await page.locator('#sf3d-new-confirm').click();
  await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded);seeds.push(await page.evaluate(()=>window.__sandforgeWebGL.game.seed));
 }
 expect(seeds[0]).not.toBe(seeds[1]);
});

test('separate seeds visibly change the actual dune mesh; all four starts and sizes reach the browser',async({page})=>{
 const fields=[];
 for(const [i,count] of [4,8,12,16].entries()){
  await ready(page,`/?bastions=${count}&seed=${i}&terrain=dunes&pause=1&lite=1`);
  const result=await page.evaluate(()=>{const a=window.__sandforgeWebGL,g=a.game;return {version:g.world.mapVersion,sites:g.territories.length,units:g.units.map(u=>({owner:u.owner,x:u.x,y:u.y})),center:g.startRegions[0].center,heights:Array.from(a.terrain.battlefield.heights).filter((_,i)=>i%100===0)};});
  expect(result.version).toBe(23+i);expect(result.sites).toBe(count);fields.push(result.heights);
  const half=await page.evaluate(()=>window.__sandforgeWebGL.game.world.size/2);
  expect(result.center.x<half).toBe(i===0||i===2);expect(result.center.y<half).toBe(i===1||i===2);
 }
 for(let i=1;i<fields.length;i++)expect(fields[i]).not.toEqual(fields[i-1]);
});

test('historical v19–22 saves resume with original geometry after leaving and reopening the game',async({page})=>{
 for(const [version,count] of [[19,4],[20,8],[21,12],[22,16]]){
  await ready(page,`/?bastions=${count}&seed=2074&pause=1&lite=1`);
  const initial=await page.evaluate(()=>{
   const a=window.__sandforgeWebGL;a.battlefield.saveGame();return {version:a.game.world.mapVersion,geometry:JSON.stringify(a.terrain),blocked:Array.from(a.game.world.blocked)};
  });
  await page.goto('/');await page.locator('#sf3d-continue').click();await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded);
  const restored=await page.evaluate(()=>{const a=window.__sandforgeWebGL;return {version:a.game.world.mapVersion,geometry:JSON.stringify(a.terrain),blocked:Array.from(a.game.world.blocked)};});
  expect(restored.version).toBe(version);expect(restored).toEqual(initial);
 }
});

test('same-sized dune maps have different relief under identical cameras for two reproducible seeds',async({page})=>{
 const fields=[];
 await page.setViewportSize({width:1440,height:900});
 for(const seed of [2074,2075]){
  await ready(page,`/?bastions=16&seed=${seed}&terrain=dunes&pause=1&fog=off`);
  fields.push(await page.evaluate(()=>{
   const a=window.__sandforgeWebGL,h=a.game.world.size/2;
   a.controls.target.set(0,80,0);a.camera.position.set(1200,1190,1640);a.camera.zoom=.46;a.camera.updateProjectionMatrix();a.controls.update();
   return Array.from(a.terrain.battlefield.heights);
  }));
  await page.waitForTimeout(200);await page.screenshot({path:test.info().outputPath(`dunes-seed-${seed}.png`)});
 }
 const meanDifference=fields[0].reduce((n,h,i)=>n+Math.abs(h-fields[1][i]),0)/fields[0].length;
 expect(meanDifference).toBeGreaterThan(15);
});
