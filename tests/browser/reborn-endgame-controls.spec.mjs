import {test,expect} from '@playwright/test';

async function start(page){
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?debug&perfTest&seed=2026');
 await page.locator('#loading').waitFor({state:'detached'});
 return errors;
}

test('victory: result buttons are clickable; inspecting battlefield and reopening menu cannot lock UI',async({page})=>{
 const errors=await start(page);
 await page.evaluate(()=>{
  const a=window.__reborn;
  a.game.paused=false;
  a.game.status='victory';
  a.refresh();
 });
 await expect(page.locator('#result-dialog')).toBeVisible();
 await expect(page.locator('#app')).not.toHaveAttribute('inert');
 await expect(page.locator('#result-new')).toBeEnabled();
 await expect(page.locator('#result-close')).toBeEnabled();
 await page.locator('#result-close').click();
 await expect(page.locator('#result-dialog')).not.toBeVisible();
 await expect(page.locator('#app')).not.toHaveAttribute('inert');
 await page.locator('#menu').click();
 await expect(page.locator('#pause-dialog')).toBeVisible();
 await expect(page.locator('#app')).not.toHaveAttribute('inert');
 await page.locator('#pause-dialog button[value="resume"]').click();
 await expect(page.locator('#pause-dialog')).not.toBeVisible();
 await expect(page.locator('#app')).not.toHaveAttribute('inert');
 expect(errors).toEqual([]);
});

test('defeat: new campaign button opens map selection and restarts playable campaign',async({page})=>{
 const errors=await start(page);
 await page.evaluate(()=>{
  const a=window.__reborn;
  a.game.paused=false;
  a.game.status='defeat';
  a.refresh();
 });
 await expect(page.locator('#result-dialog')).toBeVisible();
 await expect(page.locator('#app')).not.toHaveAttribute('inert');
 await page.locator('#result-new').click();
 await expect(page.locator('#new-dialog')).toBeVisible();
 await expect(page.locator('#app')).not.toHaveAttribute('inert');
 await page.locator('#map-size').selectOption('small');
 await page.locator('#new-dialog button[value="new"]').click();
 await expect(page.locator('#new-dialog')).not.toBeVisible();
 const current=await page.evaluate(()=>({
  status:window.__reborn.game.status,
  paused:window.__reborn.game.paused,
  version:window.__reborn.game.world.mapVersion,
  inert:document.querySelector('#app').inert
 }));
 expect(current).toEqual({status:'playing',paused:false,version:11,inert:false});
 expect(errors).toEqual([]);
});
