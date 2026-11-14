import {test,expect} from '@playwright/test';

test('Kaserne placement preview uses IDENTICAL stylized GLB, scale and material as finished building',async({page})=>{
 test.setTimeout(130000);
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&play=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:100000});
 await page.evaluate(()=>window.__sandforgeWebGL.battlefield.beginPlacement('barracks'));
 await page.waitForFunction(()=>{
  const battlefield=window.__sandforgeWebGL?.battlefield;
  return battlefield?.buildPreview?.userData?.previewDetail;
 },{timeout:60000});
 const result=await page.evaluate(async()=>{
  const bf=window.__sandforgeWebGL.battlefield,preview=bf.buildPreview;
  const model=preview.userData.previewDetail;
  const liveUrl=bf.asset('barracks',0,'building');
  const liveSource=await bf.getModel(liveUrl);
  const mats=[];
  model.traverse(mesh=>{
   if(!mesh.isMesh)return;
   for(const material of (Array.isArray(mesh.material)?mesh.material:[mesh.material])){
    if(!material)continue;
    mats.push({name:material.name,transparent:material.transparent,
     alphaHash:material.alphaHash,depthWrite:material.depthWrite,
     opacity:material.opacity,renderOrder:mesh.renderOrder,
     previewFlag:material.userData?.sandforgePreviewMaterial===true});
   }
  });
  const style=model.userData.sandforgeStylized?model.userData:
   model.children.find(c=>c.userData?.sandforgeStylized)?.userData;
  const yard=preview.userData.previewYard;
  const yardMeshes=[];
  yard?.traverse(m=>{if(m.isMesh)yardMeshes.push(m);});
  return {
   liveUrl,previewSource:preview.userData.previewSource,
   sourceAssetKind:bf.previewKind,
   materialCount:mats.length,
   hasStylizedSource:liveUrl.startsWith('/src/assets/stylized/'),
   metadataMetresToWorld:style?.metresToWorld??null,
   rootScaleFactor:model.scale.x/(liveSource.scene.scale.x||1),
   rootPosition:model.position.toArray(),
   renderOrder:mats.filter(m=>m.renderOrder!==0).slice(0,8),
   forcedGhostMaterials:mats.filter(m=>m.alphaHash||m.previewFlag).slice(0,8),
   ghostPaint:mats.filter(m=>m.previewFlag).length,
   yardOpacityProblems:yardMeshes.filter(m=>{
    const mat=Array.isArray(m.material)?m.material[0]:m.material;
    return mat?.opacity<1||mat?.userData?.sandforgePreviewMaterial;
   }).length,
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
 expect(result.hasStylizedSource).toBe(true);
 expect(result.metadataMetresToWorld).toBeGreaterThan(0);
 expect(result.rootScaleFactor).toBeCloseTo(result.metadataMetresToWorld,5);
 expect(result.rootPosition).toEqual([0,0,0]);
 expect(result.renderOrder).toEqual([]);
 expect(result.forcedGhostMaterials).toEqual([]);
 expect(result.ghostPaint).toBe(0);
 expect(result.yardOpacityProblems).toBe(0);
 expect(result.placeholder).toBe(false);
 expect(result.guides).toBe(false);
 expect(result.hasYard).toBe(true);
});
