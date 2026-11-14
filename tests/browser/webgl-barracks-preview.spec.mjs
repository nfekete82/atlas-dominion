import {test,expect} from '@playwright/test';

test('Kaserne placement preview matches finished GLB and does not show X-ray interiors',async({page})=>{
 test.setTimeout(130000);
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&play=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:100000});
 await page.evaluate(()=>window.__sandforgeWebGL.battlefield.beginPlacement('barracks'));
 await page.waitForFunction(()=>{
  const battlefield=window.__sandforgeWebGL?.battlefield;
  return battlefield?.buildPreview?.userData?.previewDetail;
 },{timeout:60000});
 const result=await page.evaluate(()=>{
  const bf=window.__sandforgeWebGL.battlefield,preview=bf.buildPreview;
  const model=preview.userData.previewDetail;
  const liveUrl=bf.asset('barracks',0,'building');
  const mats=[];
  model.traverse(mesh=>{
   if(!mesh.isMesh)return;
   for(const material of (Array.isArray(mesh.material)?mesh.material:[mesh.material])){
    if(!material)continue;
    mats.push({name:material.name,transparent:material.transparent,
     alphaHash:material.alphaHash,depthWrite:material.depthWrite,
     opacity:material.opacity,renderOrder:mesh.renderOrder});
   }
  });
  return {
   liveUrl,previewSource:preview.userData.previewSource,
   sourceAssetKind:bf.previewKind,
   materialCount:mats.length,
   xray:mats.filter(m=>m.transparent||!m.depthWrite||!m.alphaHash).slice(0,8),
   renderOrder:mats.filter(m=>m.renderOrder!==0).slice(0,8),
   placeholder:preview.userData.previewPlaceholder?.visible??false,
   guides:preview.userData.previewGuides?.visible??false,
   hasYard:!!preview.userData.previewYard,
   realMeshes:model.children.length
  };
 });
 expect(result.previewSource).toBe(result.liveUrl);
 expect(result.sourceAssetKind).toBe('barracks');
 expect(result.materialCount).toBeGreaterThan(5);
 expect(result.realMeshes).toBeGreaterThan(0);
 expect(result.xray).toEqual([]);
 expect(result.renderOrder).toEqual([]);
 expect(result.placeholder).toBe(false);
 expect(result.guides).toBe(false);
 expect(result.hasYard).toBe(true);
});
