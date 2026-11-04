import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('WebGL: real GPU terrain, correctly mapped canyon ramps and original glTF ruins load in browser',async({page})=>{
 test.setTimeout(130000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:100000});
 const state=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game,r=g.world.generated.ridges[0];
  const h=a.heightAt;
  return {webgl2:a.renderer.capabilities.isWebGL2,terrain:a.scene.children.filter(o=>o.userData.terrain).length,
   ruins:a.ruinsLoaded,units:g.units.length,bastions:g.territories.length,
   cliff:h(r.spine[12].x,r.spine[12].y-40)-h(r.spine[12].x,r.spine[12].y+40),
   blocked:g.world.walkable(r.spine[12]),cameraType:a.camera.type,
   seed:g.seed,version:g.world.mapVersion,ready:a.loaded};
 });
 expect(state.webgl2).toBe(true);
 expect(state.terrain).toBe(16);
 expect(state.ruins).toBeGreaterThan(0);
 expect(state.units).toBeGreaterThanOrEqual(2);
 expect(state.bastions).toBe(4);
 expect(state.cliff).toBeGreaterThan(60);
 expect(state.blocked).toBe(false);
 expect(state.cameraType).toBe('OrthographicCamera');
 expect(state.version).toBe(15);
 expect(errors).toEqual([]);
 await mkdir(new URL('artifacts/',import.meta.url).pathname,{recursive:true});
 await page.screenshot({path:new URL('artifacts/webgl-canyon-4-bastions.png',import.meta.url).pathname,fullPage:true});
});

test('WebGL: camera, map selection and simulation retain authoritative RTS state',async({page})=>{
 test.setTimeout(130000);
 await page.setViewportSize({width:1280,height:820});
 await page.goto('/webgl-preview.html?bastions=8&seed=2026&lite=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:100000});
 const old=await page.evaluate(()=>window.__sandforgeWebGL.camera.position.toArray());
 await page.locator('#rotate-right').click();
 const next=await page.evaluate(()=>window.__sandforgeWebGL.camera.position.toArray());
 expect(next).not.toEqual(old);
 await page.locator('#home').click();
 const moved=await page.evaluate(()=>{
  const g=window.__sandforgeWebGL.game,u=g.units.find(v=>v.owner===0);
  const start={x:u.x,y:u.y},target=g.world.nearest({x:u.x+110,y:u.y+85},g.obstacles(),[],u);
  if(!target)return {accepted:0,travel:0};
  const accepted=g.command([u.id],{...target,kind:'move'});
  g.paused=false;for(let n=0;n<80;n++)g.step(.05);g.paused=true;
  return {accepted,travel:Math.hypot(u.x-start.x,u.y-start.y)};
 });
 expect(moved.accepted).toBeGreaterThan(0);
 expect(moved.travel).toBeGreaterThan(0);
 expect(await page.evaluate(()=>window.__sandforgeWebGL.simulationRunning)).toBe(true);
 await page.locator('#simulation').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.simulationRunning)).toBe(false);
 await page.locator('#simulation').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.simulationRunning)).toBe(true);
 await page.locator('[aria-label="Karteneinstellungen anzeigen"]').click();
 await page.locator('#bastions').selectOption('12');
 await page.locator('#seed').fill('2037');
 await page.locator('#load').click();
 await expect(page).toHaveURL(/bastions=12&seed=2037/);
});
