import {test,expect} from '@playwright/test';

for(const biome of ['snow','jungle']){
 test('WebGL '+biome+': distinct playable visual environment without gameplay mutation',async({page})=>{
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/webgl-preview.html?bastions=4&seed=2074&terrain=open&biome='+biome+'&play=1&pause=1&lite=1',
   {waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:100000});
  const state=await page.evaluate(()=>{
   const a=window.__sandforgeWebGL,w=a.game.world,v=a.biomeVegetation;
   const terrainMesh=a.scene.children.find(n=>n.userData.terrain);
   const trees=a.scene.children.filter(n=>n.userData.biome===a.biome);
   return {
    biome:a.biome,count:v.count,treeMeshes:trees.length,
    allCosmetic:trees.every(n=>n.userData.visualOnly&&n.userData.nonPlayable),
    treeDraws:trees.reduce((n,tree)=>n+tree.count,0),
    mapVersion:w.mapVersion,seed:a.game.seed,size:w.size,
    terrainMeshes:a.scene.children.filter(n=>n.userData.terrain).length,
    groundColor:'#'+terrainMesh.material.color.getHexString(),
    hasGroundMap:Boolean(terrainMesh.material.map),
    oases:a.oases.layout.length,
    blackVoid:a.scene.background.getHexString()==='000000',
    gameStatus:a.game.status,
    palmMeshes:a.scene.children.filter(n=>n.name==='visual-inland-palm-grove').length
   };
  });
  expect(state.biome).toBe(biome);
  expect(state.count).toBeGreaterThan(0);
  expect(state.count).toBeLessThanOrEqual(120);
  expect(state.treeMeshes).toBe(3);
  expect(state.treeDraws).toBe(state.count*3);
  expect(state.allCosmetic).toBe(true);
  expect(state.terrainMeshes).toBe(16);
  expect(state.hasGroundMap).toBe(true);
  expect(state.mapVersion).toBe(23);
  expect(state.seed).toBe(2074);
  expect(state.oases).toBe(0);
  expect(state.blackVoid).toBe(true);
  expect(state.gameStatus).toBe('playing');
  if(biome==='snow')expect(state.palmMeshes).toBe(0);
  expect(errors).toEqual([]);
 });
}
test('WebGL new-game menu offers desert, snow and jungle',async({page})=>{
 await page.goto('/webgl-preview.html');
 await page.locator('#sf3d-new').click();
 await expect(page.locator('#sf3d-biome option')).toHaveCount(3);
 await page.locator('#sf3d-biome').selectOption('jungle');
 await page.locator('#sf3d-seed').fill('2074');
 await page.locator('#sf3d-new-confirm').click();
 await expect(page).toHaveURL(/biome=jungle/);
});


test('desert starts by default and staged blast particles retire independently of simulation',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&terrain=open&play=1&pause=1&lite=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:100000});
 const state=await page.evaluate(()=>{
  const scene=window.__sandforgeWebGL,fx=scene.effects,game=scene.game;
  const unit=game.units.find(u=>u.owner===0&&u.hp>0&&!u.carrier);
  const timeBefore=game.time;
  if(!game.canSee(0,{x:unit.x,y:unit.y}))throw new Error('Player spawn must be visible');
  fx.blastAt(unit.x,unit.y,true);
  const impactHeight=scene.heightAt(unit.x,unit.y);
  const cached=fx.shocks.at(-1)?.y;
  fx.update(.06,true);
  const active={flash:fx.flash.mesh.count,smoke:fx.smoke.mesh.count,
   shock:fx.shockwave.count,scorch:fx.scorch.count};
  fx.update(.30,true);
  return {biome:scene.biome,cached,impactHeight,active,
   flashAfter:fx.flash.mesh.count,simulationTime:game.time,timeBefore,
   particleBudget:fx.flash.max,flashName:fx.flash.mesh.name};
 });
 expect(state.biome).toBe('desert');
 expect(state.cached).toBeCloseTo(state.impactHeight+3,4);
 expect(state.active.flash).toBeGreaterThan(0);
 expect(state.active.flash).toBeLessThanOrEqual(state.particleBudget);
 expect(state.active.smoke).toBeGreaterThan(0);
 expect(state.active.shock).toBeGreaterThan(0);
 expect(state.active.scorch).toBeGreaterThan(0);
 expect(state.flashAfter).toBe(0);
 expect(state.flashName).toBe('visual-combat-flash');
 expect(state.simulationTime).toBe(state.timeBefore);
 expect(errors).toEqual([]);
});


test('desert uses terrain-hugging crater decals and solid faceted rocks',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&terrain=dunes&biome=desert&play=1&pause=1&lite=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:100000});
 const state=await page.evaluate(()=>{
  const scene=window.__sandforgeWebGL.scene;
  const craters=scene.getObjectByName('visual-desert-craters');
  const rims=scene.getObjectByName('visual-crater-eroded-rims');
  const stones=scene.children.filter(n=>n.isInstancedMesh&&n.geometry?.userData?.sedimentaryLedges);
  if(!craters)throw Error('Conforming crater terrain decals were not rendered');
  const canvas=craters.material.map.image;
  const image=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  const alpha=(x,y)=>image[(y*canvas.width+x)*4+3];
  return {
   craterCount:craters.userData.craterCount,rimsRemoved:!rims,
   groundConforming:craters.userData.groundConforming&&craters.geometry.userData.groundConforming,
   craterVertices:craters.geometry.getAttribute('position').count,
   indexed:!!craters.geometry.index,
   width:canvas.width,height:canvas.height,
   centerAlpha:alpha(128,128),cornerAlpha:alpha(0,0),
   textured:craters.material.map.isCanvasTexture,
   raycastIgnored:craters.raycast.toString()==='()=>{}',
   cosmetic:craters.userData.nonPlayable&&craters.userData.visualOnly,
   stoneBatches:stones.length,
   stoneVertices:stones[0]?.geometry.getAttribute('position').count??0,
   terrainCount:scene.children.filter(n=>n.userData?.terrain).length
  };
 });
 expect(state.craterCount).toBeGreaterThan(0);
 expect(state.rimsRemoved).toBe(true);
 expect(state.groundConforming).toBe(true);
 expect(state.craterVertices).toBeGreaterThan(state.craterCount*60);
 expect(state.indexed).toBe(true);
 expect(state.textured).toBe(true);
 expect(state.width).toBe(256);
 expect(state.height).toBe(256);
 expect(state.centerAlpha).toBeGreaterThan(0);
 expect(state.cornerAlpha).toBe(0);
 expect(state.raycastIgnored).toBe(true);
 expect(state.cosmetic).toBe(true);
 expect(state.stoneBatches).toBeGreaterThan(0);
 expect(state.stoneVertices).toBeGreaterThan(80);
 expect(state.terrainCount).toBe(16);
 expect(errors).toEqual([]);
});
