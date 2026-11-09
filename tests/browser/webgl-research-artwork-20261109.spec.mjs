import {test,expect} from '@playwright/test';

test('research HUD displays nine full 3D miniatures left of the upgrade data',async({page})=>{
 test.setTimeout(150000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&terrain=dunes&play=1&lite=1&pause=1&fog=off',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:100000});
 await page.evaluate(()=>{
  const {game:g,battlefield:b}=window.__sandforgeWebGL;
  const p=g.startRegions[0].center;
  g.credits[0]=50000;
  g.bases.push({
   id:9930,owner:0,kind:'research',x:p.x+230,y:p.y,hp:950,territory:0,radius:59,
   queue:[],queueTypes:[],production:0,buildRemaining:0,cooldown:0,rally:null
  });
  g.updateVision();
  b.selected.clear();b.selectedBase=9930;b.sync(true);b.drawInterface();
 });
 const tab=page.locator('#sf-tabs [data-tab="research"]');
 await expect(tab).toBeVisible();
 await tab.click();
 const cards=page.locator('.sf-research-card');
 await expect(cards).toHaveCount(9);
 await page.waitForFunction(()=>
  document.querySelectorAll('.sf-research-card img[data-sf-art-status="ready"]').length===9,
  null,{timeout:25000});
 const result=await cards.evaluateAll(items=>items.map(card=>{
  const art=card.querySelector('.sf-tech-art');
  const image=art.querySelector('img');
  const info=card.querySelector('.sf-tech-body');
  const title=info.querySelector('strong');
  const effect=info.querySelector('.sf-tech-effect');
  const meta=info.querySelector('.sf-tech-meta');
  const progress=info.querySelector('.sf-tech-progress');
  const a=art.getBoundingClientRect(),b=info.getBoundingClientRect();
  return {
   kind:card.dataset.upgrade,
   src:image.currentSrc||image.src,
   ready:image.complete&&image.naturalWidth===256&&image.naturalHeight===256,
   artWidth:a.width,artRight:a.right,textLeft:b.left,
   text:Boolean(title?.textContent?.trim()&&effect?.textContent?.trim()&&meta?.textContent?.trim()&&progress?.textContent?.trim())
  };
 })));
 expect(result.map(x=>x.kind)).toEqual([
  'armor1','armor2','precision','engines','infantryTraining',
  'rocketDevelopment','radar','tankArmor','tankMobility'
 ]);
 for(const entry of result){
  expect(entry.src).toMatch(/^data:image\/png;base64,/);
  expect(entry.ready).toBe(true);
  expect(entry.artWidth).toBeGreaterThanOrEqual(100);
  expect(entry.artRight).toBeLessThanOrEqual(entry.textLeft);
  expect(entry.text).toBe(true);
 }
 expect(errors).toEqual([]);
});

test('research and silo are detailed, batched PBR structures in the real world',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&terrain=dunes&play=1&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:100000});
 const result=await page.evaluate(()=>{
  const {game:g,battlefield:b,scene}=window.__sandforgeWebGL;
  const p=g.startRegions[0].center;
  const fake=(kind,id,x)=>({
   id,owner:0,kind,x,y:p.y,hp:kind==='silo'?1900:950,territory:0,
   radius:kind==='silo'?91:59,queue:[],queueTypes:[],production:0,
   buildRemaining:0,cooldown:0,rally:null,
   ...(kind==='silo'?{siloCharge:600}:{})
  });
  g.bases.push(fake('research',9931,p.x+230),fake('silo',9932,p.x+590));
  g.updateVision();b.sync(true);
  return ['research','silo'].map(kind=>{
   const model=scene.getObjectByName('Strategic_'+kind);
   const children=[];
   model?.traverse(obj=>{if(obj.isMesh)children.push(obj);});
   return {kind,exists:!!model,meshCount:children.length,
    textured:children.some(m=>!!m.material?.map),
    batched:children.some(m=>m.name.startsWith('SF_StaticBatch_')),
    glow:children.some(m=>m.material?.emissiveIntensity>.1)};
  });
 });
 for(const item of result){
  expect(item.exists).toBe(true);
  expect(item.meshCount).toBeLessThan(20);
  expect(item.textured).toBe(true);
  expect(item.batched).toBe(true);
  expect(item.glow).toBe(true);
 }
 expect(errors).toEqual([]);
});
