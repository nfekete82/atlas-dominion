import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const uri='/?bastions=4&seed=2074&pause=1&lite=1&fog=off';
const rect=element=>{const r=element.getBoundingClientRect();
 return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};

test('low-poly HUD has right-side resources and a full-width bottom deck',async({page})=>{
 test.setTimeout(150000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1600,height:900});
 await page.goto(uri,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:120000});
 await expect(page.locator('#sf-hud-menu-toggle')).toBeVisible();
 await expect(page.locator('#sf-tabs button[data-tab="buildings"]')).toBeVisible();
 const result=await page.evaluate(()=>{
  const get=id=>{const r=document.querySelector(id).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  return {dock:get('#sidebar'),map:get('#sidebar .radar'),buttons:get('.sf-modern-side-actions'),
   deck:get('#sidebar .catalog'),tabs:get('#sf-tabs'),cards:get('#sf-actions'),
   bar:get('.top.hud'),brand:get('.sf-modern-brand'),cardsCount:document.querySelectorAll('[data-build]').length,
   visibleCards:[...document.querySelectorAll('[data-build]')].filter(e=>e.getBoundingClientRect().width>50).length,
   lostControls:[...'sf-credits sf-income sf-capacity sf-map sf-production sf-selection-panel sf-actions'.split(' ')]
    .filter(id=>!document.getElementById(id)),
   bodyScroll:document.documentElement.scrollWidth>innerWidth+5};
 });
 expect(result.dock.y).toBeGreaterThan(610);
 expect(result.dock.bottom).toBeLessThanOrEqual(902);
 expect(result.map.x).toBeLessThan(result.buttons.x);
 expect(result.buttons.right).toBeLessThanOrEqual(result.deck.x+5);
 expect(result.map.width).toBeGreaterThan(170);
 expect(result.deck.width).toBeGreaterThan(1020);
 expect(result.tabs.height).toBeGreaterThanOrEqual(40);
 expect(result.cardsCount).toBeGreaterThanOrEqual(8);
 expect(result.visibleCards).toBeGreaterThanOrEqual(8);
 expect(result.bar.x).toBeGreaterThan(900);
 expect(result.brand.right).toBeLessThan(result.bar.x);
 expect(result.lostControls).toEqual([]);
 expect(result.bodyScroll).toBe(false);
 await expect(page.locator('#sf-tools')).toBeHidden();
 await page.locator('#sf-hud-menu-toggle').click();
 await expect(page.locator('#sf-tools')).toBeVisible();
 await page.locator('#sf-hud-tools-toggle').click();
 await expect(page.locator('#sf-tools')).toBeHidden();
 await page.locator('#sf-modern-queue').click();
 await expect(page.locator('#sf-production')).toBeVisible();
 await page.locator('#sf-modern-selection').click();
 await expect(page.locator('#sf-selection-panel')).toBeVisible();
 await expect(page.locator('#sf-production')).toBeHidden();
 await page.locator('#sf-modern-selection').click();
 await expect(page.locator('#sf-selection-panel')).toBeHidden();
 await mkdir('tests/browser/artifacts',{recursive:true});
 await page.screenshot({path:'tests/browser/artifacts/webgl-hud-1600.png'});
 expect(errors).toEqual([]);
});

test('Units subcategories and research remain live after producer unlocks',async({page})=>{
 test.setTimeout(150000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto(uri,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:120000});
 await page.evaluate(()=>{
  const {game:g,battlefield:b}=window.__sandforgeWebGL;
  for(const [i,kind] of ['headquarters','factory','airfield','research'].entries())
   g.bases.push({id:7600+i,owner:0,kind,hp:950,
    x:g.world.size*(.2+i*.15),y:g.world.size*.25,territory:0,radius:70,
    queue:[],queueTypes:[],production:0,buildRemaining:0,cooldown:0,rally:null});
  g.credits[0]=25000;
  b.drawInterface();
 });
 await expect(page.locator('#sf-tabs button[data-tab="units"]')).toBeEnabled();
 await page.locator('#sf-tabs button[data-tab="units"]').click();
 await expect(page.locator('#sf-unit-categories')).toBeVisible();
 await expect(page.locator('[data-sf-group="infantry"]')).toBeVisible();
 await page.locator('[data-sf-unit-category="vehicles"]').click();
 await expect(page.locator('[data-sf-group="vehicles"]')).toBeVisible();
 await expect(page.locator('[data-sf-group="infantry"]')).toBeHidden();
 await page.locator('[data-sf-unit-category="aircraft"]').click();
 await expect(page.locator('[data-sf-group="aircraft"]')).toBeVisible();
 await page.locator('#sf-tabs button[data-tab="research"]').click();
 await expect(page.locator('[data-sf-group="research"]')).toBeVisible();
 await expect(page.locator('#sf-unit-categories')).toBeHidden();
 await page.locator('#sf-tabs button[data-tab="buildings"]').click();
 await expect(page.locator('[data-build="headquarters"]')).toBeVisible();
 await expect(page.locator('#sf-actions .catalog-card').first()).toBeVisible();
});

test('compact HUD remains accessible on small screens',async({page})=>{
 test.setTimeout(150000);
 await page.setViewportSize({width:820,height:720});
 await page.goto(uri,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:120000});
 const boxes=await page.evaluate(()=>{
  const pick=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,height:r.height};};
  return {dock:pick('#sidebar'),radar:pick('#sidebar .radar'),buttons:pick('.sf-modern-side-actions'),deck:pick('#sidebar .catalog')};
 });
 expect(boxes.dock.right).toBeLessThanOrEqual(821);
 expect(boxes.radar.width).toBeGreaterThan(80);
 expect(boxes.buttons.right).toBeLessThanOrEqual(boxes.deck.x+5);
 expect(boxes.deck.width).toBeGreaterThan(260);
 await page.locator('#sf-modern-selection').click();
 await expect(page.locator('#sf-selection-panel')).toBeVisible();
 await mkdir('tests/browser/artifacts',{recursive:true});
 await page.screenshot({path:'tests/browser/artifacts/webgl-hud-820.png'});
});
