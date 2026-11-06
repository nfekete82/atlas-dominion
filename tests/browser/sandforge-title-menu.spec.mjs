import {test,expect} from '@playwright/test';

test('Sandforge main menu uses one continuous desert and its real transparent logo',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 await page.locator('#loading').waitFor({state:'detached'});
 const menu=page.locator('#main-dialog');
 await expect(menu).toBeVisible();
 await expect(page.locator('html')).toHaveClass(/sandforge-clean-title/);
 await expect(page.locator('html')).not.toHaveClass(/sandforge-cinematic-title/);
 await expect(page.locator('#new-dialog')).not.toBeVisible();
 await expect(page.locator('#main-continue')).toBeHidden();
 await expect(page.locator('#main-dialog .sandforge-splash-logo')).toBeVisible();

 const layout=await menu.evaluate(async el=>{
   const logo=el.querySelector('.sandforge-splash-logo');
   if(!logo.complete)await new Promise((resolve,reject)=>{
     logo.addEventListener('load',resolve,{once:true});
     logo.addEventListener('error',reject,{once:true});
   });
   const r=el.getBoundingClientRect(),l=logo.getBoundingClientRect();
   const buttons=el.querySelector('.menu-buttons').getBoundingClientRect();
   const bg=getComputedStyle(el),poster=getComputedStyle(el,'::before');
   const canvas=document.createElement('canvas');
   canvas.width=logo.naturalWidth;canvas.height=logo.naturalHeight;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   ctx.drawImage(logo,0,0);
   const corners=[[1,1],[canvas.width-2,1],[1,canvas.height-2],[canvas.width-2,canvas.height-2]];
   return {width:r.width,height:r.height,
     background:bg.backgroundImage,posterContent:poster.content,
     logoLoaded:logo.naturalWidth>0,
     logoUrl:logo.getAttribute('src'),
     transparentCorners:corners.every(([x,y])=>ctx.getImageData(x,y,1,1).data[3]===0),
     centered:Math.abs(l.x+l.width/2-(r.x+r.width/2))<16,
     logoFits:l.left>=0&&l.right<=r.right&&l.top>=0&&l.bottom<buttons.top,
     buttonsCentered:Math.abs(buttons.x+buttons.width/2-(r.x+r.width/2))<16,
     operationLabel:!!el.querySelector(':scope > small')};
 });
 expect(layout.width).toBeGreaterThan(1300);
 expect(layout.height).toBeGreaterThan(800);
 expect(layout.background).toContain('start-screen.png');
 expect(layout.background).not.toContain('menu-desert.png');
 expect(layout.background).not.toContain('start-screen-cinematic.webp');
 expect(layout.posterContent).toBe('none');
 expect(layout.logoLoaded).toBe(true);
 expect(layout.logoUrl).toContain('sandforge-logo-transparent.webp');
 expect(layout.transparentCorners).toBe(true);
 expect(layout.centered).toBe(true);
 expect(layout.logoFits).toBe(true);
 expect(layout.buttonsCentered).toBe(true);
 expect(layout.operationLabel).toBe(false);

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
