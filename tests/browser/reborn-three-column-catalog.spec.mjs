import {test,expect} from '@playwright/test';

test('production catalog shows three units per row on desktop and two on narrower layouts',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?debug&perfTest&seed=2026');
 await page.locator('#loading').waitFor({state:'detached'});
 await expect(page.locator('[data-production-building="barracks"] .catalog-card')).toHaveCount(3);
 const positions=async()=>page.locator('[data-production-building="barracks"] .catalog-card').evaluateAll(cards=>{
  return cards.map(c=>{const r=c.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,right:r.right}});
 });
 const desktop=await positions();
 expect(desktop[0].width).toBeGreaterThan(85);
 expect(desktop[0].width).toBeLessThan(132);
 expect(Math.abs(desktop[0].y-desktop[1].y)).toBeLessThan(2);
 expect(Math.abs(desktop[1].y-desktop[2].y)).toBeLessThan(2);
 expect(desktop[0].right).toBeLessThan(desktop[1].x);
 expect(desktop[1].right).toBeLessThan(desktop[2].x);
 const name=page.locator('[data-unit="heavy"] .card-name');
 await expect(name).toHaveCSS('text-overflow','ellipsis');
 await page.setViewportSize({width:900,height:850});
 const compact=await positions();
 expect(compact[0].y).toBe(compact[1].y);
 expect(compact[2].y).toBeGreaterThan(compact[1].y);
 expect(errors).toEqual([]);
});
