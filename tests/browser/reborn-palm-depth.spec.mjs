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

test('palm overlap uses interpolated soldier feet, so foliage does not pop across a moving unit',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?debug&perfTest&seed=2026&map=medium');
 await page.locator('#loading').waitFor({state:'detached'});
 const order=await page.evaluate(()=>{
  const {renderer:r,game:g}=window.__reborn,tree=r.palms.visibleTrees().find(d=>d.x>400&&d.y>400&&d.x<g.world.size-400&&d.y<g.world.size-400);
  if(!tree)throw Error('No palm in seeded scene');
  const infantry=g.units.find(u=>u.owner===0&&u.kind==='infantry');
  if(!infantry)throw Error('No infantry');
  g.paused=false;r.camera.x=tree.x;r.camera.y=tree.y;r.camera.zoom=1;r.boundCamera();
  infantry.x=infantry.previousX=tree.x;
  infantry.previousY=tree.y-55;infantry.y=tree.y+40;
  g.updateVision();
  const observed=[],origTree=r.palms.drawOne,origSoldier=r.drawUnit;
  try{
   r.palms.drawOne=function(c,d){if(d===tree)observed.push('palm');return origTree.call(this,c,d);};
   r.drawUnit=function(u){if(u.id===infantry.id)observed.push('soldier');return origSoldier.call(this,u);};
   const check=interpolation=>{
    observed.length=0;r.render(0,interpolation);
    return observed.filter(x=>x==='palm'||x==='soldier');
   };
   return {nearBack:check(.2),nearFront:check(.9)};
  }finally{
   r.palms.drawOne=origTree;r.drawUnit=origSoldier;
  }
 });
 expect(order.nearBack).toEqual(['soldier','palm']);
 expect(order.nearFront).toEqual(['palm','soldier']);
 expect(errors).toEqual([]);
});
