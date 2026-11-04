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
   minZoom:window.__sandforgeWebGL.controls.minZoom,
   worldSize:window.__sandforgeWebGL.game.world.size,
   worldVersion:window.__sandforgeWebGL.game.world.mapVersion,
   rimHidden:window.__sandforgeWebGL.boundaryCliffs.cliffs.every(x=>!x.visible)
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
 expect(before.worldVersion).toBe(19);
 expect(before.worldSize).toBe(6240);
 expect(before.rimHidden).toBe(true);
 await page.locator('[data-tab="buildings"]').click();
 const after=await page.evaluate(()=>{
  const elements=[...document.querySelectorAll(
   '#sf-actions .sf-group[data-sf-group="buildings"] .catalog-card')];
  const visible=elements.filter(e=>e.getBoundingClientRect().width>0);
  const boxes=visible.slice(0,2).map(e=>e.getBoundingClientRect());
  const first=visible[0],last=visible.at(-1);
  const names=visible.map(card=>card.querySelector('.card-name'));
  const toNum=(e,key)=>Number.parseFloat(getComputedStyle(e)[key])||0;
  const tab=document.querySelector('#sidebar .catalog-tabs button[data-tab="buildings"]');
  return {
   tab:document.querySelector('#sf-classic-root').dataset.tab,
   cards:visible.length,first:boxes[0]?.left??0,second:boxes[1]?.left??0,
   dockHeight:document.querySelector('#sidebar').getBoundingClientRect().height,
   tabHeight:tab.getBoundingClientRect().height,tabFont:toNum(tab,'fontSize'),
   cardHeight:first.getBoundingClientRect().height,
   labelMin:Math.min(...names.map(el=>toNum(el,'fontSize'))),
   firstRow:last.getBoundingClientRect().top-first.getBoundingClientRect().top<5,
   commandFont:toNum(document.querySelector('#sf-selection-panel .commands button'),'fontSize')
  };
 });
 expect(after.tab).toBe('buildings');
 expect(after.cards).toBeGreaterThan(1);
 expect(after.second).toBeGreaterThan(after.first);
 expect(after.dockHeight).toBeGreaterThanOrEqual(265);
 expect(after.tabHeight).toBeGreaterThanOrEqual(40);
 expect(after.tabFont).toBeGreaterThanOrEqual(12);
 expect(after.cardHeight).toBeGreaterThanOrEqual(120);
 expect(after.labelMin).toBeGreaterThanOrEqual(12);
 expect(after.commandFont).toBeGreaterThanOrEqual(12);
 expect(after.firstRow).toBe(true);
});

test('lite infantry visual scale is reduced without changing unit collision radius',async({page})=>{
 test.setTimeout(115000);
 await load(page);
 const result=await page.evaluate(()=>{
  const view=window.__sandforgeWebGL,game=view.game;
  const soldier=game.units.find(u=>u.owner===0&&u.kind==='infantry');
  const entry=view.battlefield.units.get(soldier.id);
  return {scale:entry?.placeholder?.scale.x,kind:soldier.kind,
   radius:game.world.walkable(soldier),sameUnit:entry?.node?.userData?.id===soldier.id};
 });
 expect(result.kind).toBe('infantry');
 expect(result.scale).toBeCloseTo(.88,3);
 expect(result.sameUnit).toBe(true);
 expect(result.radius).toBe(true);
});

test('spacious desert details are subtle decals, not oversized scattered blobs',async({page})=>{
 test.setTimeout(120000);
 await load(page);
 const visuals=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,scene=a.scene;
  const craters=scene.getObjectByName('visual-desert-craters');
  const stones=scene.getObjectByName('visual-desert-debris');
  // Instanced matrices are available without exposing THREE globally.
  const sizes=[];
  if(craters)for(let i=0;i<Math.min(craters.count,8);i++){
   const m=craters.instanceMatrix.array,offset=i*16;
   const x=Math.hypot(m[offset],m[offset+1],m[offset+2]);
   const y=Math.hypot(m[offset+4],m[offset+5],m[offset+6]);
   sizes.push(Math.max(x,y));
  }
  return {version:a.world?.mapVersion??a.game.world.mapVersion,
   craters:craters?.count??0,opacity:craters?.material?.opacity,
   debris:stones?.count??0,craterSizes:sizes};
 });
 expect(visuals.version).toBe(19);
 expect(visuals.craters).toBeLessThanOrEqual(30);
 expect(visuals.craters).toBeGreaterThan(0);
 expect(visuals.opacity).toBeCloseTo(.74,2);
 expect(visuals.debris).toBeLessThanOrEqual(160);
 expect(visuals.craterSizes.every(v=>v>0&&v<150)).toBe(true);
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
   sandApron:entry?.node.getObjectByName('sand-apron-headquarters-'+building.id)?.isMesh===true,
   grounding:b.grounding.items.has(building.id),
   lite:b.lite===true};
 });
 expect(state.lite).toBe(true);
 expect(state.requested).toBe(true);
 expect(state.sandApron).toBe(true);
 expect(state.grounding).toBe(true);
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
