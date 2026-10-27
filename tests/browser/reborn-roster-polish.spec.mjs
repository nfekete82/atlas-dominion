import {test,expect} from '@playwright/test';

test('production cards center and fill their image area without overlapping names or prices',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/?debug&legacy');
  await page.locator('#loading').waitFor({state:'detached'});
  const portrait=page.locator('#catalog-units [data-unit="engineer"] > img');
  await expect(portrait).toBeVisible();
  await expect(portrait).toHaveJSProperty('naturalWidth',192);
  await expect(portrait).toHaveJSProperty('naturalHeight',120);
  const details=await page.locator('#catalog-units [data-unit="engineer"]').evaluate(card=>{
    const img=card.querySelector('img'),meta=card.querySelector('.card-meta');
    const art=img.getBoundingClientRect(),frame=card.getBoundingClientRect(),bar=meta.getBoundingClientRect();
    return {art:{x:art.x,y:art.y,w:art.width,h:art.height,bottom:art.bottom},frame:{x:frame.x,w:frame.width},bar:{top:bar.top,h:bar.height},
      fit:getComputedStyle(img).objectFit,position:getComputedStyle(img).objectPosition};
  });
  expect(details.fit).toBe('cover');
  expect(details.art.w).toBeGreaterThan(details.frame.w-5);
  expect(details.art.x).toBeGreaterThanOrEqual(details.frame.x-.1);
  expect(details.art.bottom).toBeLessThanOrEqual(details.bar.top+1);
  expect(details.bar.h).toBeGreaterThanOrEqual(24);
  expect(details.position).toBe('50% 50%');
  await page.setViewportSize({width:560,height:800});
  await expect(portrait).toBeVisible();
  expect(await portrait.evaluate(img=>getComputedStyle(img).objectFit)).toBe('contain');
});
