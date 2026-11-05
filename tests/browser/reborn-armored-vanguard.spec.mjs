import {test,expect} from '@playwright/test';

test('combined-arms column: vehicles visibly lead and soldiers follow behind',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?debug&perfTest&legacy');
 await page.locator('#loading').waitFor({state:'detached'});
 const result=await page.evaluate(async()=>{
  const a=window.__reborn,g=a.game,r=a.renderer;
  g.aiClock=-1e8;g.paused=false;g.units=[];
  g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
  g.territories=[];
  const kinds=['tank','rover','infantry','heavy','artillery','medic','engineer'];
  const units=kinds.map((kind,i)=>g.spawn(0,{x:1350-i*16,y:1700+i*8},kind));
  const assigned=g.command(units.map(u=>u.id),{kind:'move',x:2100,y:1700});
  const formation=Object.fromEntries(units.map(u=>[u.kind,u.orders[0]?.formation?.rear??0]));
  for(let i=0;i<100;i++)g.step();
  const positions=Object.fromEntries(units.map(u=>[u.kind,{x:u.x,y:u.y}]));
  g.paused=true;g.updateVision();g.revision++;
  r.camera={x:1640,y:1700,zoom:.85};r.boundCamera();r.render(0);
  return {assigned,formation,positions};
 });
 expect(result.assigned).toBe(7);
 const p=result.positions;
 const lead=Math.min(p.tank.x,p.rover.x);
 expect(lead).toBeGreaterThan(p.infantry.x+20);
 expect(lead).toBeGreaterThan(p.heavy.x+20);
 expect(p.infantry.x).toBeGreaterThan(p.artillery.x);
 expect(p.artillery.x).toBeGreaterThan(p.medic.x);
 expect(result.formation.infantry).toBeLessThan(result.formation.artillery);
 await page.screenshot({path:'artifacts/reborn/armored-vanguard.png'});
 expect(errors).toEqual([]);
});
