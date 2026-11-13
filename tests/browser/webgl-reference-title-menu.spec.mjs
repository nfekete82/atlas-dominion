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
  const assetUrl=new URL('/src/assets/reborn/sandforge-title-centered.webp',page.url());
  const available=(await page.request.get(assetUrl.href)).ok();
  if(available)await page.waitForFunction(()=>document.documentElement.classList.contains('sf-centered-art-ready'));
  const centered=await page.evaluate(()=>document.documentElement.classList.contains('sf-centered-art-ready'));
  expect(centered).toBe(available);
  const finalLayout=await page.evaluate(()=>{
   const menu=document.getElementById('main-dialog');
   const buttons=menu.querySelector('.menu-buttons');
   const logo=menu.querySelector('.sandforge-splash-logo');
   const a=buttons.getBoundingClientRect(),b=logo.getBoundingClientRect();
   return {background:getComputedStyle(menu).backgroundImage,
    left:a.left,top:a.top,right:a.right,bottom:a.bottom,
    logoLeft:b.left,logoRight:b.right,logoTop:b.top,logoBottom:b.bottom,
    logoMiddle:b.left+b.width/2};
  });
  expect(finalLayout.background).toContain(centered?'sandforge-title-centered.webp':'title-hero.svg');
  expect(layout.buttonDirection).toBe('column');
  expect(finalLayout.left).toBeGreaterThanOrEqual(-1);
  expect(finalLayout.right).toBeLessThanOrEqual(width+1);
  expect(finalLayout.bottom).toBeLessThanOrEqual(height+1);
  if(centered){
   await expect(page.locator('#main-dialog .sandforge-splash-logo')).toBeHidden();
   if(width>720){
    const scale=Math.max(width/1672,height/941);
    const first=await page.locator('#sf3d-new').boundingBox();
    expect(first).not.toBeNull();
    expect(Math.abs(first.x-(width/2-191*scale))).toBeLessThan(4);
    expect(Math.abs(first.y-(height/2-143*scale))).toBeLessThan(4);
    expect(first.height).toBeGreaterThan(50);
    const last=await page.locator('#sf3d-main-exit').boundingBox();
    expect(last.y).toBeGreaterThan(first.y+260*scale);
   }
  }else{
   await expect(page.locator('#main-dialog .sandforge-splash-logo')).toBeVisible();
   expect(finalLayout.logoLeft).toBeGreaterThanOrEqual(-1);
   expect(finalLayout.logoRight).toBeLessThanOrEqual(width+1);
   expect(Math.abs(finalLayout.logoMiddle-width/2)).toBeLessThan(12);
   expect(finalLayout.logoBottom).toBeLessThan(finalLayout.top);
  }
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
