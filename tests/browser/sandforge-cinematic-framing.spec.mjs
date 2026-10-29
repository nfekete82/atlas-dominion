import {test,expect} from '@playwright/test';

for(const {width,height,label} of [
  {width:1272,height:1190,label:'tall desktop screenshot'},
  {width:1440,height:900,label:'standard desktop'},
  {width:390,height:844,label:'narrow mobile'},
]){
 test('clean Sandforge title is seamless and logo uncropped on '+label,async({page})=>{
  await page.setViewportSize({width,height});
  await page.goto('/');
  await page.locator('#loading').waitFor({state:'detached'});
  await expect(page.locator('html')).toHaveClass(/sandforge-clean-title/);
  const menu=page.locator('#main-dialog');
  await expect(menu).toBeVisible();
  const info=await menu.evaluate(el=>{
    const menuBox=el.getBoundingClientRect(),style=getComputedStyle(el);
    const logo=el.querySelector('.sandforge-splash-logo').getBoundingClientRect();
    const buttons=el.querySelector('.menu-buttons').getBoundingClientRect();
    const poster=getComputedStyle(el,'::before');
    return {
      bg:style.backgroundImage,
      bgSize:style.backgroundSize,
      posterContent:poster.content,
      logo:{x:logo.x,y:logo.y,w:logo.width,h:logo.height,bottom:logo.bottom,right:logo.right},
      buttons:{x:buttons.x,y:buttons.y,w:buttons.width,h:buttons.height},
      menu:{w:menuBox.width,h:menuBox.height},
      subtitle:el.innerText.includes('OPERATION SANDKRONE'),
    };
  });
  expect(info.bg).toContain('start-screen.png');
  expect(info.bg).not.toContain('menu-desert.png');
  expect(info.bg).not.toContain('start-screen-cinematic.webp');
  expect(info.bgSize).toBe('cover, cover');
  expect(info.posterContent).toBe('none');
  expect(info.subtitle).toBe(false);
  expect(info.logo.x).toBeGreaterThanOrEqual(0);
  expect(info.logo.right).toBeLessThanOrEqual(width+1);
  expect(info.logo.y).toBeGreaterThanOrEqual(0);
  expect(info.logo.bottom).toBeLessThan(info.buttons.y-12);
  expect(info.logo.w).toBeGreaterThan(width*.40);
  expect(info.logo.w).toBeLessThanOrEqual(width*.95);
  expect(info.buttons.x).toBeGreaterThanOrEqual(0);
  expect(info.buttons.x+info.buttons.w).toBeLessThanOrEqual(width+1);
  expect(info.buttons.y).toBeGreaterThan(height*.66);
  expect(info.buttons.y+info.buttons.h).toBeLessThanOrEqual(height+1);
  await expect(page.locator('#new')).toBeVisible();
  await expect(page.locator('#main-load')).toBeVisible();
 });
}
