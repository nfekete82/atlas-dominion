import {test,expect} from '@playwright/test';

test('Position halten UI: no shots at an enemy building or passing enemy, return fire only after a hit',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?debug&seed=2026');
 await page.locator('#loading').waitFor({state:'detached'});
 await page.evaluate(()=>{
  const app=window.__reborn,g=app.game,r=app.renderer;
  g.paused=true;g.aiClock=-1e8;g.units=[];
  g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
  const blue=g.spawn(0,{x:1900,y:2100},'infantry');
  const red=g.spawn(1,{x:1990,y:2100},'heavy');
  const building=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
  Object.assign(building,{x:1940,y:2230});
  g.stop([red.id],true);red.cooldown=100;
  r.selectedBase=null;r.selected=new Set([blue.id]);
  g.updateVision();app.refresh();
  window.__holdFixture={blue:blue.id,red:red.id,building:building.id};
 });
 await expect(page.locator('#hold')).toBeVisible();
 await page.locator('#hold').click();
 const before=await page.evaluate(()=>{
  const g=window.__reborn.game,ids=window.__holdFixture;
  return {hold:g.units.find(u=>u.id===ids.blue).hold,
   redHp:g.units.find(u=>u.id===ids.red).hp,
   buildingHp:g.bases.find(b=>b.id===ids.building).hp};
 });
 expect(before.hold).toBe(true);
 const result=await page.evaluate(()=>{
  const g=window.__reborn.game,ids=window.__holdFixture;
  const blue=g.units.find(u=>u.id===ids.blue),red=g.units.find(u=>u.id===ids.red),
    building=g.bases.find(b=>b.id===ids.building);
  g.paused=false;
  for(let i=0;i<30;i++)g.step(.05);
  const idle={redHp:red.hp,buildingHp:building.hp,blueShots:g.shots.filter(s=>s.owner===0).length};
  g.strike(red,blue,8);
  for(let i=0;i<3;i++)g.step(.05);
  g.paused=true;
  return {idle,after:{redHp:red.hp,buildingHp:building.hp,hold:blue.hold,
     position:{x:blue.x,y:blue.y},lastAttacker:blue.lastAttacker}};
 });
 expect(result.idle.redHp).toBe(before.redHp);
 expect(result.idle.buildingHp).toBe(before.buildingHp);
 expect(result.idle.blueShots).toBe(0);
 expect(result.after.redHp).toBeLessThan(result.idle.redHp);
 expect(result.after.buildingHp).toBe(result.idle.buildingHp);
 expect(result.after.hold).toBe(true);
 expect(result.after.position).toEqual({x:1900,y:2100});
 expect(errors).toEqual([]);
});
