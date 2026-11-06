import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const url='/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1';

test('3D map: seamless exterior ring surrounds all playable edges but is never walkable',async({page})=>{
 test.setTimeout(110000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 const state=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,world=a.game.world;
  const perimeter=a.visualPerimeter,meshes=perimeter.meshes;
  const inside=a.scene.children.filter(x=>x.userData.terrain);
  const outside=a.scene.children.filter(x=>x.userData.visualPerimeter);
  const positions=meshes[0].geometry.attributes.position;
  return {
   inner:inside.length,outer:outside.length,
   same:outside.every(m=>m.material===inside[0].material),
   exteriorOnly:outside.every(m=>m.userData.nonPlayable),
   xBounds:[perimeter.minX,perimeter.maxX],
   zBounds:[perimeter.minZ,perimeter.maxZ],
   mapSize:world.size,mapVersion:world.mapVersion,
   blockedOutside:[world.walkable({x:-30,y:world.size/2}),world.walkable({x:world.size+30,y:world.size/2}),
     world.walkable({x:world.size/2,y:-30}),world.walkable({x:world.size/2,y:world.size+30})],
   meshPositions:positions.count,renderer:a.renderer.capabilities.isWebGL2,
   geometryMatch:a.heightAt(0,world.size*.5)
  };
 });
 expect(state.renderer).toBe(true);
 expect(state.inner).toBe(16);
 expect(state.outer).toBe(48);
 expect(state.same).toBe(true);
 expect(state.exteriorOnly).toBe(true);
 expect(state.xBounds).toEqual([-state.mapSize*.5,state.mapSize*1.5]);
 expect(state.zBounds).toEqual([-state.mapSize*.5,state.mapSize*1.5]);
 expect(state.blockedOutside).toEqual([false,false,false,false]);
 expect(state.mapVersion).toBe(15);
 expect(errors).toEqual([]);
 // Frame the southeast corner where old WebGL showed a flat brown triangle.
 await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,world=a.game.world;
  const x=world.size*1.07-world.size*.5,z=world.size*1.07-world.size*.5;
  const delta=new a.camera.position.constructor(x-a.controls.target.x,0,z-a.controls.target.z);
  a.camera.position.add(delta);a.controls.target.add(delta);a.controls.update();
 });
 const dir=fileURLToPath(new URL('./artifacts/',import.meta.url));
 await mkdir(dir,{recursive:true});
 await page.screenshot({path:dir+'webgl-seamless-exterior.png',fullPage:true});
});

test('3D camera: WASD and arrow keys scroll on screen while paused; F is attack hotkey',async({page})=>{
 test.setTimeout(110000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 const start=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL;
  return {target:a.controls.target.toArray(),time:a.game.time,attack:a.battlefield.attackMode};
 });
 expect(start.attack).toBe(false);
 await page.keyboard.down('d');await page.waitForTimeout(260);await page.keyboard.up('d');
 let current=await page.evaluate(()=>window.__sandforgeWebGL.controls.target.toArray());
 expect(Math.hypot(current[0]-start.target[0],current[2]-start.target[2])).toBeGreaterThan(35);
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.attackMode)).toBe(false);
 const previous=current;
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(260);await page.keyboard.up('ArrowUp');
 current=await page.evaluate(()=>window.__sandforgeWebGL.controls.target.toArray());
 expect(Math.hypot(current[0]-previous[0],current[2]-previous[2])).toBeGreaterThan(35);
 await page.keyboard.press('f');
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.attackMode)).toBe(true);
 await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.attackMode)).toBe(false);
 const paused=await page.evaluate(()=>window.__sandforgeWebGL.game.time);
 expect(paused).toBe(start.time);
 // Input fields must keep keyboard shortcuts from hijacking typing.
 await page.locator('[aria-label="Karteneinstellungen anzeigen"]').click();
 const field=page.locator('#seed');await field.focus();
 const locked=await page.evaluate(()=>window.__sandforgeWebGL.controls.target.toArray());
 await page.keyboard.down('a');await page.waitForTimeout(230);await page.keyboard.up('a');
 const after=await page.evaluate(()=>window.__sandforgeWebGL.controls.target.toArray());
 expect(after[0]).toBeCloseTo(locked[0],2);
 expect(after[2]).toBeCloseTo(locked[2],2);
});
