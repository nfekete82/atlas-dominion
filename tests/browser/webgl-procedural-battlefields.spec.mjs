import {test,expect} from '@playwright/test';
const profiles=['open','dunes','rocky','oasis','mixed'];
async function ready(page,url){
 await page.goto(url);await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded&&window.__sandforgeWebGL.desertArtReady);
}
async function preferLite(page){
 // These cases verify menu/save metadata, not art. Keep the selected graphics
 // preference stable when the menu navigates or resumes a saved campaign.
 await page.addInitScript(()=>localStorage.setItem('sandforge:webgl:options',JSON.stringify({quality:'lite'})));
}
async function centerView(page,zoom,rotated=false){
 await page.evaluate(({zoom,rotated})=>{
  const a=window.__sandforgeWebGL,h=a.game.world.size/2;
  a.battlefield.fogEnabled=false;a.battlefield.updateFog();
  a.controls.target.set(0,a.heightAt(h,h)+42,0);
  a.camera.position.copy(a.controls.target).add({x:1200,y:1110,z:1640});
  if(rotated){const offset=a.camera.position.clone().sub(a.controls.target);offset.applyAxisAngle({x:0,y:1,z:0},Math.PI/4);a.camera.position.copy(a.controls.target).add(offset);}
  a.camera.zoom=zoom==='min'?a.controls.minZoom:zoom;a.camera.updateProjectionMatrix();a.controls.update();
 },{zoom,rotated});
 await page.waitForTimeout(200);
}
// Software WebGL can spend several seconds capturing one full-detail frame.
// Keep each independent view under the unchanged 45s test budget and share
// only its already-loaded, paused scene. A failure remains a failing profile.
for(const profile of profiles)test.describe(`${profile} full-detail terrain`,()=>{
 test.describe.configure({mode:'serial'});
 let page,context;const errors=[];
 test.beforeAll(async({browser},info)=>{
  context=await browser.newContext({baseURL:info.project.use.baseURL,viewport:{width:1440,height:900}});
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await ready(page,`/?bastions=16&seed=2074&terrain=${profile}&pause=1`);
 });
 test.afterAll(async()=>{await context?.close();});
 test.afterEach(()=>{expect(errors).toEqual([]);});
 test('authoritative height, collision, water, soil, fog, minimap and startup view',async()=>{
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
  await page.screenshot({path:test.info().outputPath(`${profile}-start.png`)});
 });
 test('standard zoom',async()=>{
  await centerView(page,.59);await page.screenshot({path:test.info().outputPath(`${profile}-standard.png`)});
 });
 test('maximum zoom out',async()=>{
  await centerView(page,'min');await page.screenshot({path:test.info().outputPath(`${profile}-max-out.png`)});
 });
 test('rotated camera',async()=>{
  await centerView(page,'min');
  const before=await page.evaluate(()=>window.__sandforgeWebGL.camera.position.toArray());
  await page.locator('#rotate-right').click();await page.waitForTimeout(200);
  expect(await page.evaluate(()=>window.__sandforgeWebGL.camera.position.toArray())).not.toEqual(before);
  await page.screenshot({path:test.info().outputPath(`${profile}-rotated.png`)});
 });
 test('central relief and matching minimap',async()=>{
  await centerView(page,.85,true);
  await page.evaluate(()=>window.__sandforgeWebGL.battlefield.drawMinimap());
  await page.screenshot({path:test.info().outputPath(`${profile}-central.png`)});
  await page.locator('#sf-map').screenshot({path:test.info().outputPath(`${profile}-minimap.png`)});
 });
 test('camera clamp and black exterior',async()=>{
  const edge=await page.evaluate(()=>{
   const a=window.__sandforgeWebGL,w=a.game.world,s=w.size;
   a.controls.target.set(s*8,0,s*8);a.camera.position.set(s*8+1200,1110,s*8+1640);a.controls.update();
   return {black:a.scene.background.getHex(),outside:w.walkable({x:-10,y:s/2})};
  });
  await page.waitForFunction(()=>{const a=window.__sandforgeWebGL;return Math.max(Math.abs(a.controls.target.x),Math.abs(a.controls.target.z))<a.game.world.size;});
  expect(edge.black).toBe(0);expect(edge.outside).toBe(false);
 });
 if(profile==='oasis')test('fifth grove soil blend',async()=>{
  await page.evaluate(()=>{
   const a=window.__sandforgeWebGL,o=a.oases.layout[4],half=a.game.world.size/2;
   if(!o)throw Error('Fifth oasis missing');
   a.controls.target.set(o.x-half,a.heightAt(o.x,o.y)+30,o.y-half);
   a.camera.position.copy(a.controls.target).add({x:1200,y:1110,z:1640});a.camera.zoom=1.15;a.camera.updateProjectionMatrix();a.controls.update();
  });
  await page.waitForTimeout(200);await page.screenshot({path:test.info().outputPath('oasis-fifth-soil.png')});
 });
});

test('menu offers all profiles and starts the explicitly seeded selection',async({page})=>{
 await preferLite(page);await page.goto('/');await page.locator('#sf3d-new').click();
 expect(await page.locator('#sf3d-terrain option').count()).toBe(6);
 await page.locator('#sf3d-map-size').selectOption('4');await page.locator('#sf3d-terrain').selectOption('dunes');
 await page.locator('#sf3d-seed').fill('0');await page.locator('#sf3d-new-confirm').click();
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded);
 expect(await page.evaluate(()=>({seed:window.__sandforgeWebGL.game.seed,profile:window.__sandforgeWebGL.terrain.battlefield.profile}))).toEqual({seed:0,profile:'dunes'});
});
test('selected profile and complete geometry survive save and menu resume',async({page})=>{
 await preferLite(page);await ready(page,'/?bastions=4&seed=0&terrain=dunes&pause=1&lite=1');
 const initial=await page.evaluate(()=>{const a=window.__sandforgeWebGL;a.battlefield.saveGame();return {seed:a.game.seed,profile:a.terrain.battlefield.profile,heights:Array.from(a.terrain.battlefield.heights),blocked:Array.from(a.game.world.blocked)};});
 await page.goto('/');await page.locator('#sf3d-continue').click();await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded);
 const restored=await page.evaluate(()=>{const a=window.__sandforgeWebGL;return {seed:a.game.seed,profile:a.terrain.battlefield.profile,heights:Array.from(a.terrain.battlefield.heights),blocked:Array.from(a.game.world.blocked)};});
 expect(restored).toEqual(initial);
});
test('two real new menu games with blank seeds use different random seeds',async({page})=>{
 await preferLite(page);const seeds=[];
 for(let i=0;i<2;i++){
  await page.goto('/');await page.locator('#sf3d-new').click();await page.locator('#sf3d-map-size').selectOption('4');await page.locator('#sf3d-new-confirm').click();
  await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded);seeds.push(await page.evaluate(()=>window.__sandforgeWebGL.game.seed));
 }
 expect(seeds[0]).not.toBe(seeds[1]);
});
for(const [i,count] of [4,8,12,16].entries())test(`${count} bastions and start orientation ${i} reach the browser`,async({page})=>{
 await ready(page,`/?bastions=${count}&seed=${i}&terrain=dunes&pause=1&lite=1`);
 const result=await page.evaluate(()=>{const a=window.__sandforgeWebGL,g=a.game;return {version:g.world.mapVersion,sites:g.territories.length,center:g.startRegions[0].center,half:g.world.size/2};});
 expect(result.version).toBe(23+i);expect(result.sites).toBe(count);
 expect(result.center.x<result.half).toBe(i===0||i===2);expect(result.center.y<result.half).toBe(i===1||i===2);
});
for(const [version,count] of [[19,4],[20,8],[21,12],[22,16]])test(`historical v${version} save resumes with original geometry`,async({page})=>{
 await preferLite(page);await ready(page,`/?bastions=${count}&seed=2074&pause=1&lite=1`);
 const initial=await page.evaluate(()=>{const a=window.__sandforgeWebGL;a.battlefield.saveGame();return {version:a.game.world.mapVersion,geometry:JSON.stringify(a.terrain),blocked:Array.from(a.game.world.blocked)};});
 await page.goto('/');await page.locator('#sf3d-continue').click();await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded);
 const restored=await page.evaluate(()=>{const a=window.__sandforgeWebGL;return {version:a.game.world.mapVersion,geometry:JSON.stringify(a.terrain),blocked:Array.from(a.game.world.blocked)};});
 expect(restored.version).toBe(version);expect(restored).toEqual(initial);
});
test.describe('same-sized dune maps under identical cameras',()=>{
 test.describe.configure({mode:'serial'});let page,context;const fields=[];
 test.beforeAll(async({browser},info)=>{context=await browser.newContext({baseURL:info.project.use.baseURL,viewport:{width:1440,height:900}});page=await context.newPage();});
 test.afterAll(async()=>{await context?.close();});
 for(const seed of [2074,2075])test(`seed ${seed} has reproducible, distinct visible relief`,async()=>{
  await ready(page,`/?bastions=16&seed=${seed}&terrain=dunes&pause=1&fog=off`);
  fields.push(await page.evaluate(()=>{const a=window.__sandforgeWebGL;a.controls.target.set(0,80,0);a.camera.position.set(1200,1190,1640);a.camera.zoom=.46;a.camera.updateProjectionMatrix();a.controls.update();return Array.from(a.terrain.battlefield.heights);}));
  await page.waitForTimeout(200);await page.screenshot({path:test.info().outputPath(`dunes-seed-${seed}.png`)});
  if(fields.length===2)expect(fields[0].reduce((n,h,i)=>n+Math.abs(h-fields[1][i]),0)/fields[0].length).toBeGreaterThan(15);
 });
});
