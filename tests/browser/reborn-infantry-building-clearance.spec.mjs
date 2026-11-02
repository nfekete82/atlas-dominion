import {test,expect} from '@playwright/test';

test('browser: infantry circles an actual factory instead of crossing its painted walls',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?debug&perfTest&legacy');
 await page.locator('#loading').waitFor({state:'detached'});
 const result=await page.evaluate(async()=>{
  const a=window.__reborn,g=a.game,r=a.renderer;
  const {BUILDINGS,UNITS}=await import('/src/reborn/catalog.js');
  const {infantryStructureColliders}=await import('/src/reborn/infantry-structure-collision.js');
  g.paused=false;g.aiClock=-1e8;g.units=[];
  g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
  const b={...g.bases[0],id:8866,kind:'factory',owner:0,x:1800,y:1950,
    hp:BUILDINGS.factory.hp,radius:BUILDINGS.factory.radius,
    queue:[],queueTypes:[],queueCosts:[],buildRemaining:0,production:0};
  g.bases.push(b);
  const soldier=g.spawn(0,{x:b.x-270,y:b.y-20},'infantry');
  const medic=g.spawn(0,{x:b.x-270,y:b.y+18},'medic');
  const goal={kind:'move',x:b.x+270,y:b.y-20};
  const accepted=g.command([soldier.id,medic.id],goal);
  const colliders=infantryStructureColliders([b]);
  let breaches=0,maxX=soldier.x,minDetour=Infinity;
  for(let i=0;i<285;i++){
   g.step();
   for(const u of [soldier,medic]){
    if(!g.world.walkable(u,colliders,Math.max(0,UNITS[u.kind].radius-10)))breaches++;
   }
   maxX=Math.max(maxX,soldier.x);
   minDetour=Math.min(minDetour,Math.hypot(soldier.x-b.x,soldier.y-b.y));
  }
  g.paused=true;g.revision++;g.updateVision();
  r.camera={x:b.x,y:b.y,zoom:.85};r.boundCamera();r.render(0);
  return {accepted,breaches,maxX,buildingX:b.x,minDetour,soldier:{x:soldier.x,y:soldier.y,orders:soldier.orders,path:soldier.path,moving:soldier.moving,repath:soldier.repath,stuck:soldier.vehicleEscape},medic:{x:medic.x,y:medic.y,orders:medic.orders,path:medic.path,moving:medic.moving},time:g.time,status:g.status};
 });
 expect(result.accepted).toBe(2);
 expect(result.breaches).toBe(0);
 expect(result.maxX,JSON.stringify(result)).toBeGreaterThan(result.buildingX+100);
 expect(result.minDetour).toBeGreaterThan(70);
 await page.screenshot({path:'artifacts/reborn/infantry-around-factory.png'});
 expect(errors).toEqual([]);
});
