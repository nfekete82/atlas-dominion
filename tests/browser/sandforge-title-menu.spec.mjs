import {test,expect} from '@playwright/test';

test('Sandforge shows the full-screen desert title and starts via map selection',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 await page.locator('#loading').waitFor({state:'detached'});
 const menu=page.locator('#main-dialog');
 await expect(menu).toBeVisible();
 await expect(page.locator('#new-dialog')).not.toBeVisible();
 await expect(page.locator('#main-continue')).toBeHidden();
 const layout=await menu.evaluate(async el=>{
   const image=el.querySelector('.sandforge-splash-logo');
   if(image && !image.complete)await new Promise(resolve=>image.addEventListener('load',resolve,{once:true}));
   const r=el.getBoundingClientRect();
   return {width:r.width,height:r.height,background:getComputedStyle(el).backgroundImage,logoLoaded:!!image&&image.naturalWidth>0};
 });
 expect(layout.width).toBeGreaterThan(1300);
 expect(layout.height).toBeGreaterThan(800);
 expect(layout.background).toContain('start-screen.png');
 expect(layout.logoLoaded).toBe(true);
 await page.keyboard.press('Escape');
 await expect(menu).toBeVisible();
 await page.locator('#new').click();
 await expect(page.locator('#new-dialog')).toBeVisible();
 await page.locator('#map-size').selectOption('small');
 await page.locator('#new-dialog [value="new"]').click();
 await expect(menu).not.toBeVisible();
 await expect(page.locator('#new-dialog')).not.toBeVisible();
 await page.locator('#menu').click();
 await page.locator('#to-main').click();
 await expect(menu).toBeVisible();
 await expect(page.locator('#main-continue')).toBeVisible();
});
