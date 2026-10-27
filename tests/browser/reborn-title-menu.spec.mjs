import {test,expect} from '@playwright/test';

test('normal entry and refresh show the full-screen title rather than the map picker',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 await page.locator('#loading').waitFor({state:'detached'});
 await expect(page.locator('#main-dialog')).toBeVisible();
 await expect(page.locator('#new-dialog')).not.toBeVisible();
 await expect(page.locator('#main-continue')).toBeHidden();
 const appearance=await page.locator('#main-dialog').evaluate(node=>{
  const style=getComputedStyle(node);
  return {width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height,
    background:style.backgroundImage};
 });
 expect(appearance.width).toBeGreaterThan(1300);
 expect(appearance.height).toBeGreaterThan(800);
 expect(appearance.background).toContain('start-screen.png');
 await page.keyboard.press('Escape');
 await expect(page.locator('#main-dialog')).toBeVisible();
 await page.locator('#new').click();
 await expect(page.locator('#new-dialog')).toBeVisible();
 await page.locator('#map-size').selectOption('large');
 await page.locator('#new-dialog [value="new"]').click();
 await expect(page.locator('#new-dialog')).not.toBeVisible();
 await expect(page.locator('#main-dialog')).not.toBeVisible();
 await page.locator('#menu').click();
 await page.locator('#to-main').click();
 await expect(page.locator('#main-dialog')).toBeVisible();
 await expect(page.locator('#main-continue')).toBeVisible();
 await page.locator('#main-continue').click();
 await expect(page.locator('#main-dialog')).not.toBeVisible();
 await page.reload();
 await page.locator('#loading').waitFor({state:'detached'});
 await expect(page.locator('#main-dialog')).toBeVisible();
 await expect(page.locator('#new-dialog')).not.toBeVisible();
});
