import {test,expect} from '@playwright/test';

async function start(page){
 await page.goto('/?debug&perfTest&legacy&seed=2026');
 await page.locator('#loading').waitFor({state:'detached'});
 return page.evaluate(()=>{
  const a=window.__reborn,g=a.game,r=a.renderer;
  g.paused=true;r.selectedBase=null;r.selected=new Set([g.units[0].id]);a.refresh();
  return g.units[0].id;
 });
}
async function mode(page){return page.evaluate(()=>{
 const r=window.__reborn.renderer;
 return {attack:r.attackMode,command:r.commandMode,placement:r.placement,cursor:r.canvas.classList.contains('attack')||r.canvas.classList.contains('building'),selected:r.selected.size};
});}

test('command cancellation: Escape leaves units selected, clears attack cursor, second Escape deselects',async({page})=>{
 await start(page);await page.keyboard.press('q');
 expect((await mode(page)).attack).toBe(true);
 await page.keyboard.press('Escape');
 expect(await mode(page)).toEqual({attack:false,command:null,placement:null,cursor:false,selected:1});
 await page.keyboard.press('Escape');expect((await mode(page)).selected).toBe(0);
});

for(const key of ['x','hold'])test(`command cancellation: ${key} stops pending attack and move targeting`,async({page})=>{
 const id=await start(page);
 for(const targeting of ['q','m']){
  await page.keyboard.press(targeting);
  if(key==='hold')await page.locator('#hold').click();else await page.keyboard.press(key);
  expect(await mode(page)).toEqual({attack:false,command:null,placement:null,cursor:false,selected:1});
  const u=await page.evaluate(id=>{const u=window.__reborn.game.units.find(u=>u.id===id);return {orders:u.orders.length,hold:!!u.hold};},id);
  expect(u).toEqual({orders:0,hold:key==='hold'});
 }
});

test('command cancellation: right-click cancels move mode without issuing orders',async({page})=>{
 const id=await start(page);await page.keyboard.press('q');await page.keyboard.press('m');
 await page.locator('#world').click({button:'right',position:{x:400,y:300}});
 expect(await mode(page)).toEqual({attack:false,command:null,placement:null,cursor:false,selected:1});
 expect(await page.evaluate(id=>window.__reborn.game.units.find(u=>u.id===id).orders.length,id)).toBe(0);
});

test('command cancellation: focus loss discards an unfinished selection rectangle and edge pointer',async({page})=>{
 await start(page);
 await page.mouse.move(300,250);await page.mouse.down();await page.mouse.move(430,360,{steps:4});
 expect(await page.evaluate(()=>!!window.__reborn.renderer.box)).toBe(true);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await page.mouse.up();
 expect(await page.evaluate(()=>({box:window.__reborn.renderer.box,pointer:window.__reborn.renderer.pointer,selected:window.__reborn.renderer.selected.size}))).toEqual({box:null,pointer:null,selected:1});
});
