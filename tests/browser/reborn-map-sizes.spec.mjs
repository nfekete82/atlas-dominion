import {test,expect} from '@playwright/test';

test('campaign sizes: all four new layouts selectable and world bounds/minimap correspond to each size',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/');await page.locator('#loading').waitFor({state:'detached'});
 await expect(page.locator('#new-dialog')).toBeVisible();
 await expect(page.locator('#map-size option')).toHaveCount(4);
 const choices=[
  ['small',4,11,3564],['medium',8,12,3920],['large',12,13,4277],['extraLarge',16,14,4470]
 ];
 for(const [name,count] of choices){
  if(!await page.locator('#new-dialog').isVisible()){
   await page.locator('#menu').click();
   await page.locator('#new').click();
  }
  await page.locator('#map-size').selectOption(name);
  await page.locator('#new-dialog button[value="new"]').click();
  await expect(page.locator('#territories')).toContainText('/ '+count);
 }
 // The debug endpoint exposes test-only read access; normal player pages do not.
 for(const [name,count,version,size] of choices){
  await page.goto('/?debug&seed=2026&map='+name);
  await page.locator('#loading').waitFor({state:'detached'});
  const data=await page.evaluate(()=>{
   const a=window.__reborn,g=a.game;
   return {version:g.world.mapVersion,size:g.world.size,count:g.territories.length,
    minimap:document.querySelector('#minimap').width,
    home:g.bases.find(b=>b.owner===0&&b.kind==='headquarters')};
  });
  expect(data.version).toBe(version);expect(data.size).toBe(size);
  expect(data.count).toBe(count);expect(data.minimap).toBeGreaterThan(0);
  expect(data.home.x).toBeGreaterThan(0);expect(data.home.x).toBeLessThan(size);
 }
 expect(errors).toEqual([]);
});
