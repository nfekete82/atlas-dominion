import {test,expect} from '@playwright/test';

test('campaign sizes: all four larger layouts are selectable, preserve old map saves and fit Minimap',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/');await page.locator('#loading').waitFor({state:'detached'});
 await expect(page.locator('#new-dialog')).toBeVisible();
 await expect(page.locator('#map-size option')).toHaveCount(4);
 for(const [name,count,version,size] of [
  ['small',4,7,3240],['medium',8,8,3564],['large',12,9,3888],['extraLarge',16,10,4064]
 ]){
  if(!await page.locator('#new-dialog').isVisible()){
   await page.locator('#menu').click();
   await page.locator('#new').click();
  }
  await page.locator('#map-size').selectOption(name);
  await page.locator('#new-dialog button[value="new"]').click();
  await expect(page.locator('#territories')).toContainText('/ '+count);
  const data=await page.evaluate(()=>{
   const a=window.__reborn,g=a.game;
   return {version:g.world.mapVersion,size:g.world.size,count:g.territories.length,
    minimap:document.querySelector('#minimap').width,
    home:g.bases.find(b=>b.owner===0&&b.kind==='headquarters'),
    selected:a.renderer.selected.size};
  });
  expect(data.version).toBe(version);expect(data.size).toBe(size);
  expect(data.count).toBe(count);expect(data.minimap).toBeGreaterThan(0);
  expect(data.home.x).toBeGreaterThan(0);expect(data.home.x).toBeLessThan(size);
 }
 expect(errors).toEqual([]);
});
