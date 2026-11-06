import {test,expect} from '@playwright/test';

for(const {width,height} of [
 {width:1440,height:900},
 {width:1272,height:1190},
 {width:390,height:844},
]){
 test('illustrated live menu: seamless sand, freestanding emblem and functioning options at '+width+'x'+height,async({page})=>{
  await page.setViewportSize({width,height});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.locator('#loading').waitFor({state:'detached'});
  const menu=page.locator('#main-dialog');
  await expect(menu).toBeVisible();
  const logo=page.locator('#main-dialog .sandforge-splash-logo');
  await expect(logo).toBeVisible();
  const box=await menu.evaluate(el=>{
   const img=el.querySelector('.sandforge-splash-logo'),r=el.getBoundingClientRect();
   const ir=img.getBoundingClientRect(),buttons=el.querySelector('.menu-buttons').getBoundingClientRect();
   return {bg:getComputedStyle(el).backgroundImage,poster:getComputedStyle(el,'::before').content,
     img:{left:ir.left,right:ir.right,top:ir.top,bottom:ir.bottom,width:ir.width,height:ir.height},
     buttons:{left:buttons.left,right:buttons.right,top:buttons.top,bottom:buttons.bottom},
     menu:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},
     logoSrc:img.getAttribute('src'),newLabel:el.querySelector('#new')?.textContent,
     loadLabel:el.querySelector('#main-load')?.textContent,
     optionsLabel:el.querySelector('#main-options')?.textContent,
     buttonDirection:getComputedStyle(el.querySelector('.menu-buttons')).flexDirection,
   };
  });
  expect(box.bg).toContain('start-screen.png');
  expect(box.bg).not.toContain('menu-desert.png');
  expect(box.bg).not.toContain('start-screen-cinematic.webp');
  expect(box.poster).toBe('none');
  expect(box.logoSrc).toContain('sandforge-logo-transparent.webp');
  expect(box.img.left).toBeGreaterThanOrEqual(-1);
  expect(box.img.right).toBeLessThanOrEqual(width+1);
  expect(box.img.top).toBeGreaterThanOrEqual(-1);
  expect(box.img.bottom).toBeLessThan(box.buttons.top-10);
  expect(box.buttons.left).toBeGreaterThanOrEqual(-1);
  expect(box.buttons.right).toBeLessThanOrEqual(width+1);
  expect(box.buttons.bottom).toBeLessThanOrEqual(height+1);
  expect(box.buttonDirection).toBe('column');
  expect(box.newLabel).toContain('NEUES SPIEL');
  expect(box.loadLabel).toContain('SPIELSTAND LADEN');
  expect(box.optionsLabel).toContain('OPTIONEN');
  await page.locator('#main-options').click();
  await expect(page.locator('#audio-panel')).toBeVisible();
  await page.locator('#audio-close').click();
  await expect(page.locator('#audio-panel')).toBeHidden();
  await expect(menu).toBeVisible();
  if(process.env.SANDFORGE_REQUIRE_NEW_ART==='1'){
   const images=await page.evaluate(async()=>{
    const paths=['/src/assets/reborn/start-screen.png','/src/assets/reborn/sandforge-logo-transparent.webp'];
    const results=[];
    for(const path of paths){
     const img=new Image();img.src=path;await img.decode();
     const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
     const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
     results.push({w:img.naturalWidth,h:img.naturalHeight,alpha:ctx.getImageData(0,0,1,1).data[3]});
    }
    return results;
   });
   expect(images).toEqual([{w:1672,h:941,alpha:255},{w:2172,h:724,alpha:0}]);
  }
  expect(errors).toEqual([]);
 });
}
