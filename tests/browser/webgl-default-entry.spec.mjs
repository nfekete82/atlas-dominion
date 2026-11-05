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
