import {test,expect} from '@playwright/test';

test('six-wheel launcher: motion and recoil are visually rendered, game state and hitbox stay unchanged',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?debug&perfTest&seed=2026');
 await page.locator('#loading').waitFor({state:'detached'});
 const result=await page.evaluate(async()=>{
  const a=window.__reborn,g=a.game,r=a.renderer;
  g.paused=true;
  const u=g.spawn(0,{x:1900,y:2100},'artillery');
  const c=document.createElement('canvas');c.width=c.height=512;
  const ctx=c.getContext('2d'),at={x:256,y:300};
  const render=()=>{ctx.clearRect(0,0,512,512);r.units.draw(ctx,u,at);
   return ctx.getImageData(115,120,285,250).data.slice();};
  const checkpoint=JSON.stringify(g.save());
  r.units.update([u],0,()=>true);
  const idle=render();
  u.moving=true;u.driveSpeed=65;u.walkDistance=26;u.x+=22;
  u.hullAngle=Math.PI*.12;
  r.units.update([u],.05,()=>true);
  const first=render(),motion=r.units.inspect(u.id).rocket;
  u.walkDistance+=22;u.x+=20;u.hullAngle=Math.PI*.22;
  r.units.update([u],.05,()=>true);
  const second=render(),lean=r.units.inspect(u.id).rocket;
  const diff=(one,two)=>{let n=0;for(let i=3;i<one.length;i+=4)if(one[i]!==two[i])n++;return n;};
  const movingDiff=diff(first,second),idleDiff=diff(idle,first);
  const afterDraw=JSON.stringify(g.save());
  u.moving=false;u.driveSpeed=0;u.fire=.18;
  r.units.update([u],.05,()=>true);
  u.fire=.13;r.units.update([u],.05,()=>true);
  const firing=render(),firingDiff=diff(second,firing);
  return {idleDiff,movingDiff,firingDiff,speed:motion.speed,lean:lean.turn,
    unchangedByRender:afterDraw!==checkpoint,hitbox:u.kind==='artillery'&&g.units.find(q=>q.id===u.id).kind==='artillery'};
 });
 expect(result.idleDiff).toBeGreaterThan(100,'truck wheels and chassis actually move');
 expect(result.movingDiff).toBeGreaterThan(50,'continuous motion changes visible sprite pixels');
 expect(result.firingDiff).toBeGreaterThan(50,'launch recoils against the chassis');
 expect(result.speed).toBeGreaterThan(0);
 expect(result.hitbox).toBe(true);
 expect(errors).toEqual([]);
});
