import {test,expect} from '@playwright/test';

async function load(page){
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
}

test('Zero Hour-inspired HUD has left minimap, horizontal middle catalog and right commands',async({page})=>{
 test.setTimeout(115000);
 await load(page);
 const before=await page.evaluate(()=>{
  const rect=id=>{
   const r=document.querySelector(id).getBoundingClientRect();
   return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
  };
  return {
   viewport:{width:innerWidth,height:innerHeight},
   dock:rect('#sidebar'),
   radar:rect('#sidebar .radar'),
   catalog:rect('#sidebar .catalog'),
   commands:rect('#sf-selection-panel'),
   map:rect('#sf-map'),
   zoom:window.__sandforgeWebGL.camera.zoom,
   minZoom:window.__sandforgeWebGL.controls.minZoom
  };
 });
 expect(before.dock.top).toBeGreaterThan(600);
 expect(before.dock.bottom).toBeGreaterThan(875);
 expect(before.radar.left).toBeLessThan(before.catalog.left);
 expect(before.catalog.left).toBeLessThan(before.commands.left);
 expect(before.catalog.right).toBeLessThan(before.commands.left);
 expect(before.commands.bottom).toBeGreaterThan(875);
 expect(before.map.width).toBeGreaterThan(100);
 expect(before.zoom).toBeCloseTo(.59,2);
 expect(before.minZoom).toBeLessThan(.5);
 await page.locator('[data-tab="buildings"]').click();
 const after=await page.evaluate(()=>{
  const elements=[...document.querySelectorAll(
   '#sf-actions .sf-group[data-sf-group="buildings"] .catalog-card')];
  const visible=elements.filter(e=>e.getBoundingClientRect().width>0);
  const boxes=visible.slice(0,2).map(e=>e.getBoundingClientRect());
  return {tab:document.querySelector('#sf-classic-root').dataset.tab,
   cards:visible.length,first:boxes[0]?.left??0,second:boxes[1]?.left??0};
 });
 expect(after.tab).toBe('buildings');
 expect(after.cards).toBeGreaterThan(1);
 expect(after.second).toBeGreaterThan(after.first);
});

test('lite mode still requests original detailed PBR building model, and ruins receive props',async({page})=>{
 test.setTimeout(125000);
 await load(page);
 const state=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game,b=a.battlefield;
  const site=g.headquartersCandidates(0).find(p=>g.buildError(0,'headquarters',p)===null);
  if(!site)throw new Error('No valid HQ fixture placement');
  const building=g.build(0,'headquarters',site);
  if(!building)throw new Error('HQ fixture could not be created');
  b.sync(true);
  const entry=b.bases.get(building.id);
  return {requested:entry?.requested===true,
   filename:b.asset('headquarters',0,'building'),
   lite:b.lite===true};
 });
 expect(state.lite).toBe(true);
 expect(state.requested).toBe(true);
 expect(state.filename).toContain('buildings-3d/headquarters-0.glb');
 await page.waitForFunction(()=>{
  const b=window.__sandforgeWebGL?.battlefield;
  return [...(b?.bases.values()??[])].some(e=>e.kind==='headquarters'&&e.detail);
 },null,{timeout:65000});
 const hasPBR=await page.evaluate(()=>{
  const entries=[...window.__sandforgeWebGL.battlefield.bases.values()];
  const model=entries.find(e=>e.kind==='headquarters')?.detail;
  let maps=0;
  model?.traverse(n=>{
   if(!n.isMesh)return;
   const materials=Array.isArray(n.material)?n.material:[n.material];
   maps+=materials.filter(m=>m?.map&&m?.normalMap).length;
  });
  return maps>0;
 });
 expect(hasPBR).toBe(true);
 await page.waitForFunction(()=>window.__sandforgeWebGL.scene.children.some(
  node=>node.userData?.ruinDecor===true),null,{timeout:65000});
 const props=await page.evaluate(()=>window.__sandforgeWebGL.scene.children.filter(
  node=>node.userData?.ruinDecor===true).length);
 expect(props).toBeGreaterThan(0);
});
