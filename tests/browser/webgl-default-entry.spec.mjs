import {test,expect} from '@playwright/test';

// The 3D root is opt-in during G0. CI builds with SANDFORGE_RENDERER=webgl
// and exercises a real WebGL scene, not just HTML string replacement.
test('release candidate starts the actual WebGL game at / and keeps classic accessible',async({page,request})=>{
 test.skip(process.env.SANDFORGE_RENDERER!=='webgl',
  'Run with SANDFORGE_RENDERER=webgl after the 3D release candidate build');
 test.setTimeout(125000);
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?bastions=4&seed=2074&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 const root=await page.evaluate(()=>{
  const w=window.__sandforgeWebGL;
  return {canvas:document.querySelector('#stage canvas')?.tagName??null,
   oldWorld:!!document.getElementById('world'),
   stage:!!w?.scene,simulation:!!w?.game,battlefield:!!w?.battlefield,
   rendered:!!w?.renderer,assetCount:w?.scene?.children?.length??0};
 });
 expect(root).toMatchObject({canvas:'CANVAS',oldWorld:false,
  stage:true,simulation:true,battlefield:true});
 expect(root.assetCount).toBeGreaterThan(0);
 // Old Canvas entry remains for explicit legacy QA, never the default game.
 const classic=await request.get('/classic.html');
 expect(classic.ok()).toBe(true);
 expect(await classic.text()).toContain('<canvas id="world"');
 expect(errors).toEqual([]);
});


test('3D root menu keeps all new games and saves on / instead of returning to preview',async({page})=>{
 test.skip(process.env.SANDFORGE_RENDERER!=='webgl',
  'Requires SANDFORGE_RENDERER=webgl release-candidate build');
 test.setTimeout(210000);
 const errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#main-dialog')).toBeVisible();
 await expect(page.locator('#main-dialog a[href="/classic.html"]')).toBeVisible();
 expect(new URL(page.url()).pathname).toBe('/');
 await page.locator('#sf3d-main-options').click();
 await page.locator('#sf3d-quality').selectOption('lite');
 await page.locator('#sf3d-options-save').click();
 await page.locator('#sf3d-new').click();
 await page.locator('#sf3d-map-size').selectOption('4');
 await page.locator('#sf3d-seed').fill('2074');
 await page.locator('#sf3d-new-confirm').click();
 await expect(page).toHaveURL(/bastions=4&seed=2074&play=1&lite=1/);
 expect(new URL(page.url()).pathname).toBe('/');
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 expect(await page.evaluate(()=>window.__sandforgeWebGL?.game?.seed)).toBe(2074);
 await page.locator('[data-action="menu"]').click();
 await expect(page.locator('#sf3d-pause-dialog')).toBeVisible();
 await page.locator('#sf3d-pause-save').click();
 await expect(page.locator('#sf3d-pause-status')).toHaveText('Kampagne lokal gespeichert.');
 expect(await page.evaluate(()=>Boolean(localStorage.getItem('sandforge:webgl:v1')))).toBe(true);
 await page.locator('#sf3d-pause-main').click();
 await expect(page.locator('#main-dialog')).toBeVisible();
 expect(new URL(page.url()).pathname).toBe('/');
 await expect(page.locator('#sf3d-continue')).toBeVisible();
 await page.locator('#sf3d-continue').click();
 await expect(page).toHaveURL(/resume=1/);
 expect(new URL(page.url()).pathname).toBe('/');
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 const resumed=await page.evaluate(()=>({
  seed:window.__sandforgeWebGL.game.seed,
  model:window.__sandforgeWebGL.battlefield!==undefined,
  route:window.Sandforge3DMenu?.gameRoute()
 }));
 expect(resumed).toEqual({seed:2074,model:true,route:'/'});
 expect(errors).toEqual([]);
});
