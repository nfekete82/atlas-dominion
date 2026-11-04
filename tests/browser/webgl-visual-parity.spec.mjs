import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

test('3D HP bar is bright green at 100%, decreases smoothly and turns yellow/red after damage',async({page})=>{
 test.setTimeout(115000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2026&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 const result=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game,b=a.battlefield;
  const unit=g.units.find(u=>u.owner===0&&u.hp>0);
  const e=b.units.get(unit.id);if(!e)throw Error('Missing owned actor');
  const full=unit.hp;
  const defaultMode=b.presentation.showHealth;
  b.presentation.setHealthMode('all'); // explicit visibility mode for HP snapshots
  b.sync(true,.02,false,1);
  const sample=()=>({
   fraction:e.presentation.bar.fraction,
   width:e.presentation.bar.fill.scale.x,
   color:'#'+e.presentation.bar.fillMaterial.color.getHexString(),
   visible:e.presentation.bar.root.visible,
   height:e.presentation.bar.root.children[2].scale.y
  });
  const fullBar=sample();
  unit.hp=full*.5;b.sync(true,.02,false,1);const halfBar=sample();
  unit.hp=full*.12;b.sync(true,.02,false,1);const lowBar=sample();
  return {fullBar,halfBar,lowBar,mode:b.presentation.showHealth,defaultMode,
   buildingShadows:b.grounding.items.size,structures:b.bases.size};
 });
 expect(result.fullBar.fraction).toBe(1);
 expect(result.fullBar.visible).toBe(true);
 expect(result.fullBar.color).toBe('#24e568');
 expect(result.fullBar.height).toBeLessThan(3);
 expect(result.halfBar.fraction).toBeCloseTo(.5,4);
 expect(result.halfBar.color).toBe('#f6d44b');
 expect(result.halfBar.width).toBeCloseTo(result.fullBar.width*.5,3);
 expect(result.lowBar.fraction).toBeCloseTo(.12,4);
 expect(result.lowBar.color).toBe('#ed5146');
 expect(result.lowBar.width).toBeLessThan(result.halfBar.width);
 expect(result.buildingShadows).toBe(result.structures);
 expect(result.defaultMode).toBe('damaged');
 expect(result.mode).toBe('all');
 expect(errors).toEqual([]);
});

test('4 contiguous rocky outer walls mark map boundary and do not change collision',async({page})=>{
 test.setTimeout(115000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 const state=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,g=a.game,cliffs=a.boundaryCliffs;
  if(!cliffs)throw Error('Missing boundary cliffs');
  const walls=cliffs.cliffs;
  const sample=(mesh,band,last)=>{
   const arr=mesh.geometry.getAttribute('position');
   const tiles=arr.count/6-1;
   const idx=band*(tiles+1)+(last?tiles:0);
   return [arr.getX(idx),arr.getY(idx),arr.getZ(idx)];
  };
  const cornerGaps=[];
  for(let wall=0;wall<4;wall++){
   for(let band=0;band<6;band++){
    const last=sample(walls[wall],band,true);
    const first=sample(walls[(wall+1)%4],band,false);
    cornerGaps.push(Math.hypot(...last.map((v,i)=>v-first[i])));
   }
  }
  const size=g.world.size;
  return {walls:walls.length,scree:cliffs.scree.length,
   nonPlayable:walls.every(w=>w.userData.visualBoundary&&w.userData.nonPlayable),
   maxCornerGap:Math.max(...cornerGaps),
   blocked:[g.world.walkable({x:-10,y:size/2}),g.world.walkable({x:size+10,y:size/2})],
   render:a.renderer.capabilities.isWebGL2};
 });
 expect(state.render).toBe(true);
 expect(state.walls).toBe(4);
 expect(state.scree).toBe(1);
 expect(state.nonPlayable).toBe(true);
 expect(state.maxCornerGap).toBeLessThan(.02);
 expect(state.blocked).toEqual([false,false]);
 const out=fileURLToPath(new URL('./artifacts/',import.meta.url));
 await mkdir(out,{recursive:true});
 await page.screenshot({path:out+'webgl-canyon-boundary-hp.png',fullPage:true});
});

test('dark natural map rim has grounded non-playable palm groves and no bright outer sand',async({page})=>{
 test.setTimeout(115000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:90000});
 // Detailed palms stream in asynchronously after the tactical scene is ready.
 await page.waitForFunction(()=>window.__sandforgeWebGL.scene.children.some(
  node=>node.name==='visual-boundary-palm'),{timeout:20000});
 const state=await page.evaluate(()=>{
  const v=window.__sandforgeWebGL,size=v.game.world.size,half=size*.5;
  const edgeColor=[],voidColor=[];
  for(const tile of v.visualPerimeter.meshes){
   const p=tile.geometry.getAttribute('position');
   const c=tile.geometry.getAttribute('color');
   for(let i=0;i<p.count;i++){
    const x=p.getX(i)+half,z=p.getZ(i)+half;
    const beyond=Math.max(0,-x,x-size,-z,z-size);
    const brightness=(c.getX(i)+c.getY(i)+c.getZ(i))/3;
    if(beyond<.01)edgeColor.push(brightness);
    if(beyond>1000)voidColor.push(brightness);
   }
  }
  const palms=v.scene.children.filter(node=>node.name==='visual-boundary-palm');
  return {
   edge:edgeColor.reduce((a,b)=>a+b,0)/edgeColor.length,
   beyond:voidColor.reduce((a,b)=>a+b,0)/voidColor.length,
   samples:[edgeColor.length,voidColor.length],
   background:'#'+v.scene.background.getHexString(),
   palmCount:palms.length,
   allOutside:palms.every(node=>{
    const x=node.position.x+half,z=node.position.z+half;
    return x<0||x>size||z<0||z>size;
   }),
   cosmetic:palms.every(node=>node.userData.visualBoundary&&node.userData.nonPlayable)
  };
 });
 expect(state.samples[0]).toBeGreaterThan(0);
 expect(state.samples[1]).toBeGreaterThan(0);
 expect(state.beyond).toBeLessThan(state.edge*.15);
 expect(state.background).toBe('#000000');
 expect(state.palmCount).toBeGreaterThanOrEqual(12);
 expect(state.allOutside).toBe(true);
 expect(state.cosmetic).toBe(true);
 // Render-only border never receives fog-of-war overlays: dense unknown
 // terrain is still hidden inside the 16 authoritative map chunks only.
 const fogState=await page.evaluate(()=>{
   const v=window.__sandforgeWebGL;
   return {count:v.battlefield.fogNodes.length,
     decorative:v.battlefield.fogNodes.filter(
       m=>v.visualPerimeter.meshes.some(p=>p.geometry===m.geometry)).length,
     unknown:v.battlefield.fogTexture.image.data.some((n,i)=>i%4===3&&n===255)};
 });
 expect(fogState.count).toBe(16);
 expect(fogState.decorative).toBe(0);
 expect(fogState.unknown).toBe(true);
});


test('3D buildings receive texture-based fill without brightening sand or soldier materials',async({page})=>{
 test.setTimeout(125000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 const fixture=await page.evaluate(()=>{
  const v=window.__sandforgeWebGL,g=v.game,b=v.battlefield;
  const terrain=v.terrain;
  const fallback=b.createFallback('headquarters',0,'building');
  const soldier=b.createFallback('infantry',0,'unit');
  const materials=root=>{
   const list=[];root.traverse(o=>{
    if(o.isMesh){const m=Array.isArray(o.material)?o.material:[o.material];
     list.push(...m.filter(Boolean));}
   });return list;
  };
  const fallbackMaterials=materials(fallback),unitMaterials=materials(soldier);
  const readySite=g.headquartersCandidates(0)
   .find(p=>g.buildError(0,'headquarters',p)===null);
  if(!readySite)throw Error('No HQ fixture construction site');
  const base=g.build(0,'headquarters',readySite);
  if(!base)throw Error('Could not build HQ fixture');
  base.buildRemaining=0;base.hp=1200;
  b.sync(true,.06,false,1);
  return {id:base.id,exposure:v.renderer.toneMappingExposure,
   fallbackLit:fallbackMaterials.every(m=>m.emissiveIntensity===.22),
   soldierUnchanged:unitMaterials.every(m=>m.emissiveIntensity===1&&m.emissive.getHex()===0),
   terrainUnchanged:terrain.every?.(mesh=>!mesh.material?.userData?.sandforgeBuildingFill)??true};
 });
 expect(fixture.fallbackLit).toBe(true);
 expect(fixture.soldierUnchanged).toBe(true);
 expect(fixture.terrainUnchanged).toBe(true);
 expect(fixture.exposure).toBeCloseTo(.96,3);
 await page.waitForFunction(id=>{
  const b=window.__sandforgeWebGL.battlefield;
  return Boolean(b.bases.get(id)?.detail);
 },fixture.id,{timeout:65000});
 const state=await page.evaluate(async id=>{
  const b=window.__sandforgeWebGL.battlefield;
  const model=b.bases.get(id).detail;
  const materials=[];
  model.traverse(obj=>{
   if(obj.isMesh){
    const values=Array.isArray(obj.material)?obj.material:[obj.material];
    materials.push(...values.filter(m=>m?.isMeshStandardMaterial));
   }
  });
  const original=(await b.getModel(b.asset('headquarters',0,'building'))).scene;
  const originals=[];
  original.traverse(obj=>{
   if(obj.isMesh){
    const values=Array.isArray(obj.material)?obj.material:[obj.material];
    originals.push(...values.filter(m=>m?.isMeshStandardMaterial));
   }
  });
  return {modelMaterials:materials.length,
   colored:materials.every(m=>m.userData.sandforgeBuildingFill===true&&m.emissiveIntensity===.22),
   textured:materials.filter(m=>m.map).length,
   mapUsedAsFill:materials.filter(m=>m.map).every(m=>m.emissiveMap===m.map),
   originalUnchanged:originals.every(m=>!m.userData?.sandforgeBuildingFill)};
 },fixture.id);
 expect(state.modelMaterials).toBeGreaterThan(0);
 expect(state.colored).toBe(true);
 expect(state.textured).toBeGreaterThan(0);
 expect(state.mapUsedAsFill).toBe(true);
 expect(state.originalUnchanged).toBe(true);
});
