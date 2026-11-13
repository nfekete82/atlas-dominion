import {test,expect} from '@playwright/test';

for(const {width,height} of [{width:1648,height:928},{width:390,height:844}]){
 test('Bastion title centers five interactive gold-metal menu buttons at '+width+'x'+height,async({page})=>{
  await page.setViewportSize({width,height});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/webgl-preview.html',{waitUntil:'domcontentloaded'});
  const menu=page.locator('#main-dialog');
  await expect(menu).toBeVisible();
  const items=menu.locator('.sf3d-hero-button');
  await expect(items).toHaveCount(5);
  await expect(items).toHaveText(['SPIELEN','OPTIONEN','STATISTIKEN','CREDITS','BEENDEN']);
  await expect(page.locator('#main-dialog .sandforge-splash-logo')).toBeVisible();
  const layout=await page.evaluate(()=>{
   const root=document.getElementById('main-dialog');
   const buttons=root.querySelector('.menu-buttons'),logo=root.querySelector('.sandforge-splash-logo');
   const bounds=buttons.getBoundingClientRect(),badge=logo.getBoundingClientRect();
   const item=root.querySelector('.sf3d-hero-button');
   const css=getComputedStyle(item);
   return {background:getComputedStyle(root).backgroundImage,
    direction:getComputedStyle(buttons).flexDirection,
    menuLeft:bounds.left,menuRight:bounds.right,menuTop:bounds.top,menuBottom:bounds.bottom,
    midX:bounds.left+bounds.width/2,midY:bounds.top+bounds.height/2,
    logoLeft:badge.left,logoRight:badge.right,logoBottom:badge.bottom,
    buttonBorder:css.borderTopWidth,buttonText:css.color,
    buttonVisible:css.visibility==='visible'&&css.display!=='none'};
  });
  expect(layout.background).toMatch(/title-hero\.svg|sandforge-start-background\.png/);
  expect(layout.direction).toBe('column');
  expect(Math.abs(layout.midX-width/2)).toBeLessThan(12);
  expect(Math.abs(layout.midY-height*.62)).toBeLessThan(width>720?24:34);
  expect(layout.menuLeft).toBeGreaterThanOrEqual(-1);
  expect(layout.menuRight).toBeLessThanOrEqual(width+1);
  expect(layout.menuBottom).toBeLessThanOrEqual(height+1);
  expect(layout.logoLeft).toBeGreaterThanOrEqual(-1);
  expect(layout.logoRight).toBeLessThanOrEqual(width+1);
  expect(layout.logoBottom).toBeLessThan(layout.menuTop);
  expect(layout.buttonBorder).not.toBe('0px');
  expect(layout.buttonVisible).toBe(true);
  expect(errors).toEqual([]);
 });
}

test('WebGL title navigates to game, settings, statistics, credits and exit confirmation',async({page})=>{
 await page.goto('/webgl-preview.html',{waitUntil:'domcontentloaded'});
 await page.locator('#sf3d-main-stats').click();
 await expect(page.locator('#sf3d-stats-dialog')).toBeVisible();
 await expect(page.locator('#sf3d-stats-content')).toContainText('Noch keine gespeicherte Kampagne');
 await page.locator('#sf3d-stats-dialog [data-sf3d-close]').click();
 await expect(page.locator('#sf3d-stats-dialog')).toBeHidden();
 await page.locator('#sf3d-main-credits').click();
 await expect(page.locator('#sf3d-credits-dialog')).toBeVisible();
 await page.locator('#sf3d-credits-dialog [data-sf3d-close]').click();
 await page.locator('#sf3d-main-exit').click();
 await expect(page.locator('#sf3d-exit-dialog')).toBeVisible();
 await page.locator('#sf3d-exit-dialog [data-sf3d-close]').click();
 await expect(page.locator('#main-dialog')).toBeVisible();
 await page.locator('#sf3d-main-options').click();
 await expect(page.locator('#sf3d-options-dialog')).toBeVisible();
 await page.locator('#sf3d-options-dialog [data-sf3d-close]').click();
 await page.locator('#sf3d-new').click();
 await expect(page.locator('#sf3d-new-dialog')).toBeVisible();
 await expect(page.locator('#sf3d-main-load')).toBeDisabled();
 await expect(page.locator('#sf3d-campaign')).toBeVisible();
 await page.locator('#sf3d-campaign').click();
 await expect(page.locator('#sf3d-map-size')).toBeFocused();
});
