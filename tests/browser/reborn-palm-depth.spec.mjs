import {test,expect} from '@playwright/test';

test('palm scenery uses foot Y-depth: soldiers behind go under crown, soldiers in front stay visible',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?debug&perfTest&seed=2026&map=medium');
 await page.locator('#loading').waitFor({state:'detached'});
 const order=await page.evaluate(()=>{
  const {renderer:r,game:g}=window.__reborn;
  const palms=r.palms.visibleTrees();
  const chosen=palms.find(d=>d.x>400&&d.y>400&&d.x<g.world.size-400&&d.y<g.world.size-400);
  if(!chosen)throw Error('No test palm');
  const soldier=g.units.find(u=>u.owner===0&&u.kind==='infantry');
  if(!soldier)throw Error('No test soldier');
  g.paused=true;
  r.camera.x=chosen.x;r.camera.y=chosen.y;r.camera.zoom=1;r.boundCamera();
  const calls=[];
  const drawTree=r.palms.drawOne,drawSoldier=r.drawUnit;
  try{
   r.palms.drawOne=function(c,d){if(d===chosen)calls.push('palm');return drawTree.call(this,c,d);};
   r.drawUnit=function(u){if(u.id===soldier.id)calls.push('soldier');return drawSoldier.call(this,u);};
   const renderAt=offset=>{
    soldier.x=chosen.x;soldier.y=chosen.y+offset;
    soldier.previousX=soldier.x;soldier.previousY=soldier.y;
    g.updateVision();
    calls.length=0;
    r.render(0);
    return calls.filter(c=>c==='soldier'||c==='palm');
   };
   return {behind:renderAt(-55),front:renderAt(55)};
  }finally{
   r.palms.drawOne=drawTree;r.drawUnit=drawSoldier;
  }
 });
 expect(order.behind).toEqual(['soldier','palm']);
 expect(order.front).toEqual(['palm','soldier']);
 expect(errors).toEqual([]);
});
