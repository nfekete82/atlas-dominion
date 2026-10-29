import {test,expect} from '@playwright/test';

test('Sandforge shows the full-screen desert title and starts via map selection',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 await page.locator('#loading').waitFor({state:'detached'});
 const cinematicAsset=await page.request.get('/src/assets/reborn/start-screen-cinematic.webp');
 const cinematic=cinematicAsset.ok()&&cinematicAsset.headers()['content-type']?.startsWith('image/');
 if(process.env.SANDFORGE_REQUIRE_CINEMATIC==='1')expect(cinematic).toBe(true);

 if(cinematic)await expect(page.locator('html')).toHaveClass(/sandforge-cinematic-title/);
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
 expect(layout.background).toContain(cinematic?'start-screen-cinematic.webp':'start-screen.png');
 expect(layout.logoLoaded).toBe(true);
 // Center the floating logo and all game-entry controls (not the old left column).
 const position=await page.evaluate(()=>{
  const title=document.querySelector('#main-dialog');
  const logo=title.querySelector('.sandforge-splash-logo');
  const buttons=title.querySelector('.menu-buttons');
  const r=title.getBoundingClientRect(),l=logo.getBoundingClientRect(),b=buttons.getBoundingClientRect();
  const image=document.createElement('canvas');image.width=logo.naturalWidth;image.height=logo.naturalHeight;
  const ctx=image.getContext('2d',{willReadFrequently:true});ctx.drawImage(logo,0,0);
  const corners=[[1,1],[image.width-2,1],[1,image.height-2],[image.width-2,image.height-2]];
  const transparentCorners=corners.every(([x,y])=>ctx.getImageData(x,y,1,1).data[3]===0);
  return {centerTitle:r.x+r.width/2,centerLogo:l.x+l.width/2,centerButtons:b.x+b.width/2,
   logoBottom:l.bottom,buttonsTop:b.top,logoWidth:l.width,transparentCorners};
 });
 if(!cinematic)expect(Math.abs(position.centerLogo-position.centerTitle)).toBeLessThan(16);
 expect(Math.abs(position.centerButtons-position.centerTitle)).toBeLessThan(16);
 if(!cinematic)expect(position.buttonsTop).toBeGreaterThan(position.logoBottom);
 else {
   const art=await cinematicAsset.body();
   expect(art.byteLength).toBeGreaterThan(100000);
   const buttonStyle=await page.locator('#main-dialog .menu-buttons').evaluate(el=>getComputedStyle(el).flexDirection);
   expect(buttonStyle).toBe('row');
   expect(position.buttonsTop).toBeGreaterThan(400);
 }
 if(!cinematic)expect(position.logoWidth).toBeGreaterThan(450);
 expect(position.transparentCorners).toBe(true);
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
