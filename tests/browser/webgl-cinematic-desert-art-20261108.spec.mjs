import {test,expect} from '@playwright/test';

test('desert has scenic layers, no exterior props and camera can enter black void',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&terrain=dunes&play=1&lite=1&pause=1&fog=off',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:100000});
 const start=await page.evaluate(()=>{
  const v=window.__sandforgeWebGL,size=v.game.world.size,half=size/2;
  const wash=v.scene.children.filter(o=>o.userData?.dryWash);
  const rock=v.scene.getObjectByName('physical-battlefield-rocks');
  const terrain=v.scene.children.filter(o=>o.userData?.terrain);
  return {size,half,background:v.scene.background.getHexString(),
   washCount:wash.length,pebbles:wash[0]?.count??0,
   rockCount:rock?.geometry.getAttribute('position').count??0,
   terrainCount:terrain.length,edge:v.visualPerimeter?.hardVoid,
   borderGeometry:v.visualPerimeter?.meshes?.length};
 });
 expect(start.size).toBeGreaterThan(3500);
 expect(start.background).toBe('000000');
 expect(start.edge).toBe(true);
 expect(start.borderGeometry).toBe(0);
 expect(start.terrainCount).toBe(16);
 expect(start.washCount).toBe(1);
 expect(start.pebbles).toBeGreaterThan(80);
 expect(start.rockCount).toBeGreaterThan(0);
 // Push camera target just beyond the playable edge and allow RAF
 // stepCamera to clamp it with the NEW black-void overscan, not the old
 // decorative-apron frustum correction.
 await page.evaluate(()=>{
  const v=window.__sandforgeWebGL;
  const desired=v.game.world.size/2+420;
  const shift=desired-v.controls.target.x;
  v.controls.target.x+=shift;
  v.camera.position.x+=shift;
  v.controls.update();
 });
 await page.waitForTimeout(400);
 const actual=await page.evaluate(()=>{
  const v=window.__sandforgeWebGL;
  return {x:v.controls.target.x,half:v.game.world.size/2,
   z:v.controls.target.z,zoom:v.camera.zoom};
 });
 expect(actual.x).toBeGreaterThan(actual.half+300);
 expect(actual.x).toBeLessThan(actual.half+760);
 // The camera alone crosses the border: the original terrain square stays
 // the only walkable and raycastable area.
 expect(errors).toEqual([]);
});
