import {test,expect} from '@playwright/test';

test('live WebGL strategic building selection, research, silo and interceptor controls',async({page})=>{
 test.setTimeout(120000);
 const exceptions=[];page.on('pageerror',e=>exceptions.push(e.message));
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&terrain=dunes&play=1&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:100000});
 const ids=await page.evaluate(()=>{
  const {game:g,battlefield:field}=window.__sandforgeWebGL;
  g.credits[0]=10000;
  const p=g.startRegions[0].center;
  const mock=(kind,id,dx)=>({
   id,owner:0,kind,x:p.x+dx,y:p.y,hp:1000,territory:0,radius:65,
   queue:[],queueTypes:[],production:0,buildRemaining:0,cooldown:0,rally:null,
   ...(kind==='silo'?{siloCharge:0}:{}),
   ...(kind==='interceptor'?{interceptorAmmo:2}:{})
  });
  g.bases.push(mock('research',9910,260),mock('silo',9911,500),
   mock('interceptor',9912,750));
  field.selected.clear();field.selectedBase=9910;field.drawInterface();
  return {research:9910,silo:9911,interceptor:9912};
 });
 const researchTab=page.locator('[data-tab="research"]');
 await expect(researchTab).toBeVisible();
 const armor=page.locator('button[data-upgrade="armor1"]');
 await expect(armor).toBeVisible();
 await expect(armor).toBeEnabled();
 await armor.click();
 const started=await page.evaluate(()=>window.__sandforgeWebGL.game.research[0]);
 expect(started.active).toBe('armor1');
 expect(started.remaining).toBe(40);
 await expect(armor).toBeDisabled();
 await page.evaluate(id=>{
  const {battlefield:field}=window.__sandforgeWebGL;
  field.selectedBase=id;field.drawInterface();
 },ids.silo);
 const fire=page.locator('#sf-strategic-fire');
 await expect(fire).toBeVisible();
 await expect(fire).toBeEnabled();
 await fire.click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.battlefield.strategicTargetMode)).toBe(true);
 await page.evaluate(()=>{
  const {game:g,battlefield:field}=window.__sandforgeWebGL;
  g.explored[0].fill(1);
  const enemy=g.startRegions[1].center;
  if(!g.launchStrategicMissile(0,enemy))throw Error('real silo launch rejected');
  field.strategicTargetMode=false;
  field.drawInterface();
 });
 expect(await page.evaluate(()=>window.__sandforgeWebGL.game.strategicMissiles.length)).toBe(1);
 await expect(fire).toBeDisabled();
 await page.evaluate(id=>{
  const {battlefield:field}=window.__sandforgeWebGL;
  field.selectedBase=id;field.drawInterface();
 },ids.interceptor);
 const rearm=page.locator('#sf-interceptor-rearm');
 await expect(rearm).toBeVisible();
 await expect(rearm).toBeEnabled();
 await rearm.click();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.game.bases
  .find(b=>b.id===9912).interceptorAmmo)).toBe(3);
 await expect(rearm).toBeDisabled();
 expect(exceptions).toEqual([]);
});
