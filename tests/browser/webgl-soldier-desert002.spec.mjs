import {test,expect} from '@playwright/test';

test('real Atlas engineer GLB has desert 002 on ceramic helmet/chest and cloth, not weapon',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&play=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:95000});
 await page.waitForFunction(()=>[...window.__sandforgeWebGL.battlefield.units.values()]
  .some(entry=>entry.kind==='engineer'&&
   entry.detail?.getObjectByName('Atlas_HelmetShell')), {timeout:60000});
 const materials=await page.evaluate(()=>{
  const unit=[...window.__sandforgeWebGL.battlefield.units.values()]
   .find(entry=>entry.kind==='engineer'&&entry.detail?.getObjectByName('Atlas_HelmetShell'));
  const get=name=>{
   const mesh=unit.detail.getObjectByName(name),mat=mesh?.material;
   return {
    mesh:mesh?.name,map:mat?.map?.name??null,color:mat?.color?.getHexString(),
    uvRevision:mesh?.geometry?.userData?.sandforgeSoldierCamoUV??null,
    uniforms:mat?.userData?.sandforgeMasterCamo??null
   };
  };
  return {helmet:get('Atlas_HelmetShell'),sleeve:get('Atlas_ForearmLSuit'),
   weapon:get('Atlas_PistolHandle'),insignia:get('Atlas_HelmetStripe')};
 });
 for(const name of ['helmet','sleeve']){
  expect(materials[name].map).toBe('Sandforge_Desert002_UniformCamouflage');
  expect(materials[name].color).toBe('dcc5a8');
  expect(materials[name].uniforms).toBe('desert-002');
  expect(materials[name].uvRevision).toBe('desert-002-projected-uniform-v2');
 }
 expect(materials.weapon.map).not.toBe('Sandforge_Desert002_UniformCamouflage');
 expect(materials.insignia.map).not.toBe('Sandforge_Desert002_UniformCamouflage');
});
