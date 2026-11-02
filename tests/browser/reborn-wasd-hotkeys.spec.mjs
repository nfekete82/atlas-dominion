import {test,expect} from '@playwright/test';

test('holding WASD pans the camera without canceling selected units march orders',async({page})=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?debug&perfTest&seed=2026');
 await page.locator('#loading').waitFor({state:'detached'});
 const before=await page.evaluate(()=>{
  const {game:g,renderer:r}=window.__reborn;
  g.paused=true;g.units=[];
  const x=g.world.size/2,y=g.world.size/2;
  const u=g.spawn(0,{x,y},'infantry');
  r.selected=new Set([u.id]);r.selectedBase=null;r.attackMode=false;
  r.camera.x=x;r.camera.y=y;r.boundCamera();
  const accepted=g.command([u.id],{kind:'move',x:x+300,y:y+150});
  if(accepted!==1)throw Error('Unable to issue initial march order');
  return {id:u.id,x:r.camera.x,y:r.camera.y,order:structuredClone(u.orders[0]),unitX:u.x,unitY:u.y};
 });
 for(const [key,axis,sign] of [['s','y',1],['w','y',-1],['a','x',-1],['d','x',1]]){
  const previous=await page.evaluate(()=>({x:window.__reborn.renderer.camera.x,y:window.__reborn.renderer.camera.y}));
  await page.keyboard.down(key);
  await page.waitForTimeout(250);
  await page.keyboard.up(key);
  const next=await page.evaluate(({id})=>{
   const {game:g,renderer:r}=window.__reborn,u=g.units.find(u=>u.id===id);
   return {x:r.camera.x,y:r.camera.y,orders:u.orders,unitX:u.x,unitY:u.y,attackMode:r.attackMode};
  },{id:before.id});
  expect((next[axis]-previous[axis])*sign, key+' should pan camera').toBeGreaterThan(40);
  expect(next.orders).toEqual([before.order]);
  expect(next.unitX).toBe(before.unitX);
  expect(next.unitY).toBe(before.unitY);
  expect(next.attackMode).toBe(false);
 }
 await page.keyboard.press('q');
 expect(await page.evaluate(()=>window.__reborn.renderer.attackMode)).toBe(true);
 await page.keyboard.press('x');
 const stopped=await page.evaluate(({id})=>window.__reborn.game.units.find(u=>u.id===id).orders.length,{id:before.id});
 expect(stopped).toBe(0);
 expect(errors).toEqual([]);
});
