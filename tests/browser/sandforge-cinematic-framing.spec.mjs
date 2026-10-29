import {test,expect} from '@playwright/test';

for(const {width,height,label} of [
  {width:1272,height:1190,label:'tall desktop screenshot'},
  {width:1440,height:900,label:'standard desktop'},
  {width:390,height:844,label:'narrow mobile'},
]){
 test('cinematic poster remains complete and buttons usable on '+label,async({page})=>{
  await page.setViewportSize({width,height});
  await page.goto('/');
  await page.locator('#loading').waitFor({state:'detached'});
  await expect(page.locator('html')).toHaveClass(/sandforge-cinematic-title/);
  const m=page.locator('#main-dialog');
  await expect(m).toBeVisible();
  const info=await m.evaluate(el=>{
   const rect=el.getBoundingClientRect(),art=getComputedStyle(el,'::before');
   const bg=getComputedStyle(el);
   const buttons=el.querySelector('.menu-buttons').getBoundingClientRect();
   const logo=el.querySelector('.sandforge-splash-logo').getBoundingClientRect();
   const w=parseFloat(art.width),h=parseFloat(art.height);
   return {rect:{x:rect.x,y:rect.y,w:rect.width,h:rect.height},
    art:{width:w,height:h,ratio:w/h,image:art.backgroundImage,mask:art.maskImage,
      pointerEvents:art.pointerEvents,position:art.position},
    backdrop:bg.backgroundImage,logo:{w:logo.width,h:logo.height},
    buttons:{x:buttons.x,y:buttons.y,w:buttons.width,h:buttons.height},
    scrollHeight:el.scrollHeight,clientHeight:el.clientHeight};
  });
  expect(info.art.image).toContain('start-screen-cinematic.webp');
  expect(info.backdrop).toContain('menu-desert.png');
  expect(info.backdrop).not.toContain('start-screen-cinematic.webp');
  expect(info.art.mask).not.toBe('none');
  expect(info.art.pointerEvents).toBe('none');
  expect(info.art.position).toBe('absolute');
  // Unlike background-size:cover, the whole gold wordmark and fortress are
  // guaranteed to fit inside the dialog on both portrait and landscape.
  expect(info.art.width).toBeLessThanOrEqual(width*.961);
  expect(info.art.height).toBeLessThanOrEqual(height*.981);
  expect(info.art.ratio).toBeCloseTo(1606/979,2);
  expect(info.art.width).toBeGreaterThan(width*.4);
  expect(info.buttons.x).toBeGreaterThanOrEqual(0);
  expect(info.buttons.x+info.buttons.w).toBeLessThanOrEqual(width+1);
  expect(info.buttons.y).toBeGreaterThan(height*.65);
  expect(info.buttons.y+info.buttons.h).toBeLessThanOrEqual(height+1);
  expect(info.logo.w).toBeLessThanOrEqual(2);
  await expect(page.locator('#new')).toBeVisible();
  await expect(page.locator('#main-load')).toBeVisible();
 });
}
