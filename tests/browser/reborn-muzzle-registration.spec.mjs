import {test,expect} from '@playwright/test';

test('weapon sockets follow actual drawn barrel transforms in every direction during suspension and recoil',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?debug&perfTest&legacy&seed=2026');await page.locator('#loading').waitFor({state:'detached'});
 const result=await page.evaluate(async()=>{
  const {unitArtScale}=await import('/src/reborn/visual-scale.js');
  const {rocketTubeOffset}=await import('/src/reborn/rocket-presentation.js');
  const a=window.__reborn,g=a.game,presentation=a.renderer.units;
  g.paused=true;g.units=[];
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d'),out=[];
  for(const kind of ['tank','artillery','rover','infantry','scout']){
   const u=g.spawn(0,{x:256,y:300},kind);
   for(let direction=0;direction<16;direction++){
    u.angle=direction*Math.PI/8;u.hullAngle=u.angle+Math.PI/2;u.fire=.13;u.moving=true;u.walkDistance=43+direction*13;
    presentation.update([u],.05,()=>true);
    const view=presentation.inspect(u.id),suspension=view.rocket??view.chassis;
    if(suspension)Object.assign(suspension,{speed:.8,turn:.7,acceleration:-.5,shotAge:.08,idleAge:.1});
    const original=presentation.drawFrame;let expected,expectedShot;
    presentation.drawFrame=function(c,v,frame,p,offset={x:0,y:0},image){
     const scale=v.asset.data.nativeScale*unitArtScale(kind),m=frame.muzzle;
     if(m){
      const x=p.x+(m[0]-frame.pivot[0])*scale+offset.x,y=p.y+(m[1]-frame.pivot[1])*scale+offset.y;
      expected=c.getTransform().transformPoint({x,y});
      const socket=frame.muzzles?.[kind==='artillery'?4%frame.muzzles.length:0]??m;
      const delta=kind==='artillery'&&!frame.muzzles?.length?rocketTubeOffset(4,u.angle,unitArtScale(kind)):{x:0,y:0};
      delta.x+=(socket[0]-m[0])*scale;delta.y+=(socket[1]-m[1])*scale;
      expectedShot=c.getTransform().transformPoint({x:x+delta.x,y:y+delta.y});
     }
     return original.call(this,c,v,frame,p,offset,image);
    };
    try{presentation.draw(ctx,u,u);}finally{presentation.drawFrame=original;}
    const actual=presentation.muzzleFor(u);
    const shot=presentation.muzzleForShot({from:u,to:{x:600,y:300},owner:0,life:1,hit:false,kind,source:u.id,angle:kind==='scout'?view.bodyAngle:u.angle,groundFrom:u,barrel:kind==='artillery'?4:0});
    out.push({kind,direction,error:Math.hypot(actual.x-expected.x,actual.y-expected.y),shotError:Math.hypot(shot.x-expectedShot.x,shot.y-expectedShot.y)});
   }
  }
  return out;
 });
 expect(result).toHaveLength(80);
 expect(result.filter(r=>r.error>1e-6||r.shotError>1e-6)).toEqual([]);
 expect(errors).toEqual([]);
});
