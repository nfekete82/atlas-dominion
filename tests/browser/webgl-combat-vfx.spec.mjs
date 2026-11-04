import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

test('WebGL 3D combat smoke, fire, scorch, tank tracks and wrecks draw from gameplay events',async({page})=>{
 test.setTimeout(115000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:95000});
 const state=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,fx=a.effects,g=a.game;
  const unit=g.units.find(u=>u.owner===0&&u.hp>0);
  const p={x:unit.x,y:unit.y};
  if(!g.canSee(0,p))throw new Error('Friendly starting unit must be visible');
  const b=p;
  const before={blasts:fx.stats.blasts,scorch:fx.stats.scorch,tracks:fx.stats.tracks,wrecks:fx.stats.wrecks};
  g.blasts.push({...p,id:90001234,at:g.time});
  fx.update(.15,true);
  const trail={kind:'tank',owner:0,id:123456,x:b.x+42,y:b.y+36,moving:true,angle:.2};
  fx.tracksFor(trail,{x:b.x+14,y:b.y+4});
  fx.addWreck({...trail,x:b.x+100,y:b.y+66});
  fx.update(.12,true);
  return {before,after:{...fx.stats},smoke:fx.smoke.mesh.count,
   fire:fx.flames.mesh.count,scorch:fx.scorch.count,tracks:fx.track.count,
   wrecks:fx.wreckHull.count,renderer:a.renderer.capabilities.isWebGL2};
 });
 expect(state.renderer).toBe(true);
 expect(state.after.blasts).toBeGreaterThan(state.before.blasts);
 expect(state.after.scorch).toBeGreaterThan(state.before.scorch);
 expect(state.after.wrecks).toBeGreaterThan(state.before.wrecks);
 expect(state.smoke).toBeGreaterThan(0);
 expect(state.fire).toBeGreaterThan(0);
 expect(state.scorch).toBeGreaterThan(0);
 expect(state.tracks).toBeGreaterThan(0);
 expect(state.wrecks).toBeGreaterThan(0);
 expect(errors).toEqual([]);
 const out=fileURLToPath(new URL('./artifacts/',import.meta.url));
 await mkdir(out,{recursive:true});
 await page.screenshot({path:out+'webgl-3d-combat-vfx.png',fullPage:true});
 await page.locator('#sound').click();
 await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','true');
 const audio=await page.evaluate(()=>({
  enabled:window.__sandforgeWebGL.sound.enabled,
  context:window.__sandforgeWebGL.sound.context?.state||'missing'
 }));
 expect(audio.enabled).toBe(true);
 expect(['running','suspended']).toContain(audio.context);
 expect(await page.evaluate(()=>window.__sandforgeWebGL.simulationRunning)).toBe(true);
 await page.waitForTimeout(300);
 expect(await page.evaluate(()=>window.__sandforgeWebGL.game.time)).toBeGreaterThan(0);
 await page.locator('#simulation').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.simulationRunning)).toBe(false);
 await page.locator('#simulation').click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.simulationRunning)).toBe(true);
 await page.locator('#sound').click();
 await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','false');

});
