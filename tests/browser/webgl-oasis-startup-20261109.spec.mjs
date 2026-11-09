import {test,expect} from '@playwright/test';

// A runtime ReferenceError in oasis stone construction previously prevented
// the WHOLE WebGL battlefield from starting. TypeScript does not type-check
// this plain JS module. Test the real browser path, in both quality modes.
for(const lite of [1,0]){
 test('3D starts with oasis PBR stones, lite='+lite,async({page})=>{
  test.setTimeout(120000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?bastions=4&seed=2074&pause=1&lite='+lite+'&oasis=water',
   {waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,
   null,{timeout:100000});
  const result=await page.evaluate(()=>{
   const v=window.__sandforgeWebGL;
   const o=v.oases;
   const rock=o.root.getObjectByName('oasis-weathered-stones');
   return {
    oases:o.layout.length,rocks:rock?.count??0,
    normals:Boolean(rock?.material?.normalMap),
    materialName:rock?.material?.type,
    geometry:rock?.geometry?.type,
    terrain:v.scene.children.filter(x=>x.userData?.terrain).length
   };
  });
  expect(result.oases).toBeGreaterThan(0);
  expect(result.rocks).toBeGreaterThan(0);
  expect(result.normals).toBe(true);
  expect(result.materialName).toBe('MeshStandardMaterial');
  expect(result.terrain).toBe(16);
  expect(errors).toEqual([]);
 });
}
