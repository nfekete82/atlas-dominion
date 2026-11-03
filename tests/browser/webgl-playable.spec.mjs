import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const pageUrl='/webgl-preview.html?bastions=4&seed=2074&lite=1';
test('Playable 3D: assets, terrain, fog, units, buildings, minimap and production UI',async({page})=>{
 test.setTimeout(110000);
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto(pageUrl,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 await expect(page.locator('#sf-stats')).toContainText('Credits');
 await expect(page.locator('#sf-actions')).toContainText('Kaserne');
 const before=await page.evaluate(()=>{
  const {battlefield,game}=window.__sandforgeWebGL;
  return {
   unitCount:battlefield.units.size,baseCount:battlefield.bases.size,
   sectors:battlefield.bastions.size,worldSectors:game.territories.length,
   fogMeshes:battlefield.fogNodes.length,textureWidth:battlefield.fogTexture.image.width,
   fps:window.__sandforgeWebGL.renderer.info.render.frame
  };
 });
 expect(before.unitCount).toBeGreaterThanOrEqual(4);
 expect(before.baseCount).toBe(2);
 expect(before.sectors).toBe(4);
 expect(before.worldSectors).toBe(4);
 expect(before.fogMeshes).toBe(16);
 expect(before.textureWidth).toBe(240);
 const initial=await page.evaluate(()=>window.__sandforgeWebGL.battlefield.fogEnabled);
 await page.locator('[data-action="fog"]').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.fogEnabled)).toBe(!initial);
 await page.evaluate(()=>{window.__stableCommandButton=document.querySelector('[data-action="select-all"]');});
 await page.waitForTimeout(900);
 expect(await page.evaluate(()=>document.querySelector('[data-action="select-all"]')===window.__stableCommandButton)).toBe(true);
 await page.locator('[data-action="select-all"]').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.selected.size)).toBeGreaterThan(0);
 await page.locator('[data-build="barracks"]').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.buildKind)).toBe('barracks');
 await page.locator('[data-action="cancel"]').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.buildKind)).toBe(null);
 expect(errors).toEqual([]);
 await mkdir(fileURLToPath(new URL('./artifacts/',import.meta.url)),{recursive:true});
 await page.screenshot({path:fileURLToPath(new URL('./artifacts/webgl-playable.png',import.meta.url)),fullPage:true});
});

test('Playable 3D: save and resume hold authoritative combat and economy state',async({page})=>{
 test.setTimeout(110000);
 await page.goto(pageUrl,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 const initial=await page.evaluate(()=>{
  const g=window.__sandforgeWebGL.game;
  g.paused=false;for(let i=0;i<24;i++)g.step(.05);g.paused=true;
  return {time:g.time,credits:g.credits[0],units:g.units.length,mapVersion:g.world.mapVersion};
 });
 await page.locator('[data-action="save"]').click();
 await expect(page.locator('#sf-message')).toContainText('gespeichert');
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&resume=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 const after=await page.evaluate(()=>{
  const g=window.__sandforgeWebGL.game;
  return {time:g.time,credits:g.credits[0],units:g.units.length,mapVersion:g.world.mapVersion};
 });
 expect(after).toEqual(initial);
});
