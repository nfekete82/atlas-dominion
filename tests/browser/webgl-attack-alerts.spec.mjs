import {test,expect} from '@playwright/test';

test('WebGL enemy hit displays Captain warning and red minimap beacon without disclosing attacker',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 const injected=await page.evaluate(()=>{
  const view=window.__sandforgeWebGL,g=view.game;
  const own=g.units.find(u=>u.owner===0&&u.hp>0);
  if(!own)throw Error('No surviving player unit to target');
  const enemy=g.spawn(1,{x:own.x+120,y:own.y+120},'infantry');
  g.strike(enemy,own,8);
  return {sequence:g.attackAlerts.sequence,marker:g.attackAlerts.lastAlert,
   victim:{x:own.x,y:own.y},attacker:{x:enemy.x,y:enemy.y},
   saved:Object.hasOwn(g.save(),'attackAlerts')};
 });
 expect(injected.sequence).toBe(1);
 expect(injected.marker.x).toBe(injected.victim.x);
 expect(injected.marker.y).toBe(injected.victim.y);
 expect(injected.marker.x).not.toBe(injected.attacker.x);
 expect(injected.saved).toBe(false);
 await page.evaluate(()=>{
  const view=window.__sandforgeWebGL;
  view.sound.announceAttack=()=>{window.__testAttackAudioCalls=(window.__testAttackAudioCalls??0)+1;};
  document.getElementById('simulation').click();
 });
 await page.waitForFunction(()=>document.querySelector('#sf-message')?.dataset.attackAlert==='true',null,{timeout:15000});
 expect(await page.locator('#sf-message').textContent()).toContain('Captain, wir werden angegriffen!');
 const check=await page.evaluate(()=>{
  const view=window.__sandforgeWebGL,g=view.game;
  view.battlefield.drawMinimap();
  const marker=g.attackAlerts.visible(g.time)[0];
  const canvas=view.battlefield.mini,scale=canvas.width/g.world.size;
  const color=canvas.getContext('2d').getImageData(
   Math.round(marker.x*scale),Math.round(marker.y*scale),1,1).data;
  return {color:[...color],count:g.attackAlerts.visible(g.time).length,
   audio:window.__testAttackAudioCalls??0};
 });
 expect(check.count).toBe(1);
 expect(check.audio).toBe(1);
 expect(check.color[0]).toBeGreaterThan(check.color[1]);
 await page.evaluate(()=>{
  const view=window.__sandforgeWebGL;
  view.game.time+=6;
  view.battlefield.drawMinimap();
 });
 await page.waitForFunction(()=>document.querySelector('#sf-message')?.dataset.attackAlert!=='true');
 expect(await page.evaluate(()=>window.__sandforgeWebGL.game.attackAlerts.visible(window.__sandforgeWebGL.game.time).length)).toBe(0);
 expect(errors).toEqual([]);
});
