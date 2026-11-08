import {test,expect} from '@playwright/test';

test('real WebGL does not prematurely win and displays large centered endgame banner',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(
  '/webgl-preview.html?bastions=4&seed=2074&terrain=dunes&play=1&lite=1&pause=1',
  {waitUntil:'domcontentloaded'}
 );
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:100000});
 const overlay=page.locator('#sf3d-match-result');
 const outcome=await page.evaluate(()=>{
  const g=window.__sandforgeWebGL.game;
  const red=g.units.find(u=>u.owner===1&&u.kind==='infantry');
  if(!red)throw Error('No enemy infantry for regression');
  g.units=g.units.filter(u=>u.owner===0||u.id===red.id);
  // Bootstrap has no HQ; losing all engineers used to end the battle.
  g.step(.05);
  return {status:g.status,red:g.units.filter(u=>u.owner===1).length,
   enemyBuildings:g.bases.filter(b=>b.owner===1&&b.hp>0).length};
 });
 expect(outcome.status).toBe('playing');
 expect(outcome.red).toBe(1);
 expect(outcome.enemyBuildings).toBe(0);
 await expect(overlay).toBeHidden();

 await page.evaluate(()=>{
  const g=window.__sandforgeWebGL.game;
  g.units=g.units.filter(u=>u.owner===0);
  g.step(.05);
 });
 await expect(overlay).toBeVisible({timeout:3500});
 await expect(overlay.locator('.sf3d-match-result-heading')).toHaveText('SIEG');
 await expect(overlay.locator('.sf3d-match-result-subheading')).toHaveText('Gefecht beendet');
 await expect(overlay).toHaveAttribute('data-result','victory');
 await expect(page.locator('#sf3d-simulation-state')).toBeHidden();
 const measured=await page.evaluate(()=>{
  const root=document.querySelector('#sf3d-match-result');
  const panel=root.querySelector('.sf3d-match-result-panel');
  const title=root.querySelector('.sf3d-match-result-heading');
  const rect=panel.getBoundingClientRect(),style=getComputedStyle(title);
  return {
   x:rect.left+rect.width/2,y:rect.top+rect.height/2,
   viewportWidth:innerWidth,viewportHeight:innerHeight,
   fontSize:parseFloat(style.fontSize),
   zIndex:getComputedStyle(root).zIndex,
   pointerEvents:getComputedStyle(root).pointerEvents
  };
 });
 expect(Math.abs(measured.x-measured.viewportWidth/2)).toBeLessThan(5);
 expect(Math.abs(measured.y-measured.viewportHeight/2)).toBeLessThan(5);
 expect(measured.fontSize).toBeGreaterThanOrEqual(68);
 expect(Number(measured.zIndex)).toBeGreaterThan(9);
 expect(measured.pointerEvents).toBe('none');

 // The same overlay must switch cleanly to red defeat without reloading
 // page or adding duplicate DOM/animation loops.
 await page.evaluate(()=>{
  const g=window.__sandforgeWebGL.game;
  g.status='playing';
  g.units=g.units.filter(u=>u.owner===1);
  g.spawn(1,{x:g.world.size/2,y:g.world.size/2},'infantry');
  g.bases=[];
  g.step(.05);
 });
 await expect(overlay).toHaveAttribute('data-result','defeat',{timeout:3500});
 await expect(overlay.locator('.sf3d-match-result-heading')).toHaveText('NIEDERLAGE');
 await expect(overlay.locator('.sf3d-match-result-subheading')).toHaveText('Gefecht beendet');
 expect(await page.locator('#sf3d-match-result').count()).toBe(1);
 expect(errors).toEqual([]);
});
