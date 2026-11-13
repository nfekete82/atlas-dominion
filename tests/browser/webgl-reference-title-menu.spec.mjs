import {test,expect} from '@playwright/test';

for(const {width,height} of [{width:1648,height:928},{width:390,height:844}]){
 test('WebGL title uses illustrated five-button layout at '+width+'x'+height,async({page})=>{
  await page.setViewportSize({width,height});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/webgl-preview.html',{waitUntil:'domcontentloaded'});
  const menu=page.locator('#main-dialog');
  await expect(menu).toBeVisible();
  const items=menu.locator('.sf3d-hero-button');
  await expect(items).toHaveCount(5);
  await expect(items).toHaveText(['SPIELEN','OPTIONEN','STATISTIKEN','CREDITS','BEENDEN']);
  const layout=await page.evaluate(()=>{
   const menu=document.getElementById('main-dialog');
   const buttons=menu.querySelector('.menu-buttons');
   const logo=menu.querySelector('.sandforge-splash-logo');
   const a=buttons.getBoundingClientRect(),b=logo.getBoundingClientRect();
   const css=getComputedStyle(menu);
   return {background:css.backgroundImage,
    buttonDirection:getComputedStyle(buttons).flexDirection,
    menuTop:a.top,menuLeft:a.left,menuRight:a.right,menuBottom:a.bottom,
    logoLeft:b.left,logoRight:b.right,logoTop:b.top,logoBottom:b.bottom,
    logoMiddle:b.left+b.width/2};
  });
  expect(layout.background).toContain('title-hero.svg');
  expect(layout.buttonDirection).toBe('column');
  expect(layout.menuLeft).toBeGreaterThanOrEqual(-1);
  expect(layout.menuRight).toBeLessThanOrEqual(width+1);
  expect(layout.menuBottom).toBeLessThanOrEqual(height+1);
  expect(layout.logoLeft).toBeGreaterThanOrEqual(-1);
  expect(layout.logoRight).toBeLessThanOrEqual(width+1);
  expect(Math.abs(layout.logoMiddle-width/2)).toBeLessThan(12);
  expect(layout.logoBottom).toBeLessThan(layout.menuTop);
  if(width>720)expect(layout.menuLeft).toBeLessThan(width/4);
  await expect(page.locator('#main-dialog .sandforge-splash-logo')).toBeVisible();
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
