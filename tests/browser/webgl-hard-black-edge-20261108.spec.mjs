import {test,expect} from '@playwright/test';

test('modern 3D map stops at full black with zero cliffs, exterior rock or sand meshes',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&play=1&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:100000});
 const data=await page.evaluate(()=>{
  const view=window.__sandforgeWebGL;
  const scene=view.scene,world=view.game.world;
  const outside=scene.children.filter(o=>o.userData?.visualPerimeter||
    o.userData?.perimeterVoid||o.userData?.visualBoundary);
  return {version:world.mapVersion,black:scene.background.getHexString(),
    hardVoid:view.visualPerimeter.hardVoid,
    perimeter:view.visualPerimeter.meshes.length,
    cover:view.visualPerimeter.voidCover.length,
    cliffs:view.boundaryCliffs.cliffs.length,
    rubble:view.boundaryCliffs.scree.length,
    monoliths:view.boundaryCliffs.monoliths,
    outside:outside.map(o=>o.name||o.type),
    count:scene.children.filter(o=>o.userData?.terrain).length,
    originalWorldSize:world.size};
 });
 expect(data.version).toBeGreaterThanOrEqual(19);
 expect(data.black).toBe('000000');
 expect(data.hardVoid).toBe(true);
 expect(data.perimeter).toBe(0);
 expect(data.cover).toBe(0);
 expect(data.cliffs).toBe(0);
 expect(data.rubble).toBe(0);
 expect(data.monoliths).toBeNull();
 expect(data.outside).toEqual([]);
 expect(data.count).toBe(16);
 expect(data.originalWorldSize).toBeGreaterThan(1000);
 expect(errors).toEqual([]);
});
