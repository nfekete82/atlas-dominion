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
  return {fullBar,halfBar,lowBar,mode:b.presentation.showHealth,
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
