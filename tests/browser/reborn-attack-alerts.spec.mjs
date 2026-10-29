import {test,expect} from '@playwright/test';

test('enemy hit triggers exactly one Captain warning and a five-second red minimap pulse',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?debug&seed=2026&map=medium');
 await page.locator('#loading').waitFor({state:'detached'});
 const state=await page.evaluate(()=>{
  const a=window.__reborn,g=a.game,r=a.renderer;
  g.aiClock=-1e8;
  const u=g.spawn(0,{x:1750,y:1900},'infantry');
  const enemy=g.spawn(1,{x:1850,y:1950},'infantry');
  g.strike(enemy,u,8);
  return {id:u.id,x:u.x,y:u.y,enemyX:enemy.x,sequence:g.attackAlerts.sequence,
    marker:g.attackAlerts.lastAlert,saveField:Object.hasOwn(g.save(),'attackAlerts')};
 });
 expect(state.sequence).toBe(1);
 expect(state.marker.x).toBe(state.x);
 expect(state.marker.x).not.toBe(state.enemyX);
 expect(state.saveField).toBe(false);
 await expect(page.locator('#notices .notice').last()).toContainText('Captain, wir werden angegriffen!');
 const visible=await page.evaluate(()=>{
   const g=window.__reborn.game,r=window.__reborn.renderer;
   r.render(0);
   const marker=g.attackAlerts.visible(g.time)[0];
   const x=marker.x*r.miniCanvas.width/g.world.size,y=marker.y*r.miniCanvas.width/g.world.size;
   const ctx=r.miniCanvas.getContext('2d'),c=ctx.getImageData(Math.floor(x),Math.floor(y),1,1).data;
   return {markers:g.attackAlerts.visible(g.time).length,red:c[0],green:c[1],blue:c[2]};
 });
 expect(visible.markers).toBe(1);
 expect(visible.red).toBeGreaterThan(visible.green);
 await page.evaluate(()=>{const g=window.__reborn.game;g.time+=6;window.__reborn.renderer.render(0);});
 expect(await page.evaluate(()=>window.__reborn.game.attackAlerts.visible(window.__reborn.game.time).length)).toBe(0);
 expect(errors).toEqual([]);
});
