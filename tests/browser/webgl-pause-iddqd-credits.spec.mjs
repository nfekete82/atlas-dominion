import {test,expect} from '@playwright/test';

test('IDDQD typed in actual 3D tactical pause dialog gives 1000 credits, repeats, and never affects play or options',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/webgl-preview.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>Boolean(window.Sandforge3DMenu));
 await expect(page.locator('#main-dialog')).toBeVisible();
 // The real menu script runs without the heavyweight WebGL renderer here.
 // Supply the runtime's documented game/UI contract for deterministic input.
 await page.evaluate(()=>{
  document.getElementById('main-dialog').close();
  const game={credits:[400,300],status:'playing'};
  window.__sandforgeWebGL={loaded:true,simulationRunning:true,game,
   battlefield:{drawInterface(){window.__cheatUIUpdates=(window.__cheatUIUpdates??0)+1;}}};
  // The HTML already includes the simulation toggle. Bind that existing
  // button, or the pause menu would click it instead of a duplicate ID.
  const simulation=document.getElementById('simulation');
  if(!simulation)throw Error('Missing existing simulation pause toggle');
  simulation.addEventListener('click',()=>{
   const view=window.__sandforgeWebGL;
   view.simulationRunning=!view.simulationRunning;
  });
 });
 await page.keyboard.type('iddqd');
 expect(await page.evaluate(()=>window.__sandforgeWebGL.game.credits)).toEqual([400,300]);
 await page.evaluate(()=>window.Sandforge3DMenu.openPause());
 await expect(page.locator('#sf3d-pause-dialog')).toBeVisible();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.simulationRunning)).toBe(false);
 await page.keyboard.type('IdDqD');
 await expect(page.locator('#sf3d-pause-status')).toContainText('+1.000 CREDITS');
 expect(await page.evaluate(()=>window.__sandforgeWebGL.game.credits)).toEqual([1400,300]);
 await page.keyboard.type('iddqd');
 expect(await page.evaluate(()=>window.__sandforgeWebGL.game.credits)).toEqual([2400,300]);
 expect(await page.evaluate(()=>window.__cheatUIUpdates)).toBe(2);
 await page.locator('#sf3d-pause-options').click();
 await expect(page.locator('#sf3d-options-dialog')).toBeVisible();
 await page.keyboard.type('iddqd');
 expect(await page.evaluate(()=>window.__sandforgeWebGL.game.credits)).toEqual([2400,300]);
 await page.evaluate(()=>document.getElementById('sf3d-options-dialog').close());
 await page.locator('#sf3d-pause-resume').click();
 await expect(page.locator('#sf3d-pause-dialog')).toBeHidden();
 expect(await page.evaluate(()=>window.__sandforgeWebGL.simulationRunning)).toBe(true);
 await page.keyboard.type('iddqd');
 expect(await page.evaluate(()=>window.__sandforgeWebGL.game.credits)).toEqual([2400,300]);
 expect(errors).toEqual([]);
});
