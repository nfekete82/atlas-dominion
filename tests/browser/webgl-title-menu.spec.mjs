import {test,expect} from '@playwright/test';

test('3D starts with the original Sandforge title and enters a real playable campaign',async({page})=>{
 test.setTimeout(130000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#main-dialog')).toBeVisible();
 await expect(page.locator('html')).toHaveClass(/sandforge-clean-title/);
 const cinematic=await page.request.get(new URL('/src/assets/reborn/sandforge-title-centered.webp',page.url()).href);
 if(cinematic.ok()){
  await page.waitForFunction(()=>document.documentElement.classList.contains('sf-centered-art-ready'));
  await expect(page.locator('#main-dialog .sandforge-splash-logo')).toBeHidden();
 }else{
  await expect(page.locator('#main-dialog .sandforge-splash-logo')).toBeVisible();
 }
 await expect(page.locator('#sf3d-new')).toBeVisible();
 await expect(page.locator('#sf3d-main-options')).toBeVisible();
 expect(await page.evaluate(()=>!!window.__sandforgeWebGL)).toBe(false);
 await page.locator('#sf3d-main-options').click();
 await expect(page.locator('#sf3d-options-dialog')).toBeVisible();
 await page.locator('#sf3d-quality').selectOption('lite');
 await page.locator('#sf3d-options-save').click();
 await page.locator('#sf3d-new').click();
 await expect(page.locator('#sf3d-new-dialog')).toBeVisible();
 await page.locator('#sf3d-map-size').selectOption('4');
 await page.locator('#sf3d-seed').fill('2074');
 await page.locator('#sf3d-new-confirm').click();
 await expect(page).toHaveURL(/bastions=4&seed=2074&play=1&lite=1/);
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:100000});
 const state=await page.evaluate(()=>({
  actors:window.__sandforgeWebGL.battlefield.units.size,
  structures:window.__sandforgeWebGL.battlefield.bases.size,
  meshes:window.__sandforgeWebGL.scene.children.filter(x=>x.userData.terrain).length,
  hasWebGL:window.__sandforgeWebGL.renderer.capabilities.isWebGL2,
  canvas:document.querySelector('#stage canvas')?.width,
  hasHud:Boolean(document.querySelector('#sf-classic-root'))
 }));
 expect(state.actors).toBeGreaterThanOrEqual(2);
 expect(state.structures).toBe(0);
 expect(await page.evaluate(()=>window.__sandforgeWebGL.game.needsHeadquarters(0))).toBe(true);
 expect(state.meshes).toBe(16);
 expect(state.hasWebGL).toBe(true);
 expect(state.canvas).toBeGreaterThan(400);
 expect(state.hasHud).toBe(true);
 await page.locator('[data-action="menu"]').click();
 await expect(page.locator('#sf3d-pause-dialog')).toBeVisible();
 await page.locator('#sf3d-pause-save').click();
 expect(await page.evaluate(()=>Boolean(localStorage.getItem('sandforge:webgl:v1')))).toBe(true);
 await page.locator('#sf3d-pause-main').click();
 await expect(page.locator('#main-dialog')).toBeVisible();
 await expect(page.locator('#main-dialog .sf3d-hero-button')).toHaveCount(5);
 await page.locator('#sf3d-new').click();
 await expect(page.locator('#sf3d-continue')).toBeVisible();
 await page.locator('#sf3d-continue').click();
 await expect(page).toHaveURL(/resume=1/);
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:100000});
 expect(errors).toEqual([]);
});

test('3D direct-link bootstrap ships ALL required JS modules and reports missing imports visibly',async({page})=>{
 test.setTimeout(120000);
 const responses=[];
 page.on('response',r=>{if(/webgl-(actor-presentation|battlefield|preview|title-menu)\.js/.test(r.url()))responses.push({name:r.url().split('/').pop(),code:r.status()});});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:100000});
 for(const name of ['webgl-title-menu.js','webgl-preview.js','webgl-battlefield.js','webgl-actor-presentation.js'])
  expect(responses.find(x=>x.name===name)?.code,name+' not shipped').toBe(200);
 await expect(page.locator('#sf3d-fatal')).toBeHidden();
});
