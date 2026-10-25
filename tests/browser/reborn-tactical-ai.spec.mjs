import {test,expect} from '@playwright/test';

test('tactical AI: a genuinely built blue turret kills two red infantry; the 16-sector AI gathers paid reinforcements, attacks together and saves its lessons',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});await page.goto('/?debug&seed=2026');await page.locator('#loading').waitFor({state:'detached'});
 const result=await page.evaluate(()=>{
  const {game:g,renderer:r}=window.__reborn;g.paused=true;g.aiClock=-1e8;g.time=30;g.explored[0].fill(1);g.credits[0]=5000;
  const h=g.bases[1],start=g.units.find(u=>u.owner===1),target=g.territories[7],route=g.world.path(start,target.point,g.obstacles());let p,from=start;
  for(const to of route){const d=Math.hypot(to.x-from.x,to.y-from.y);for(let i=0;i<=d;i+=25){for(const offset of [0,120,-120]){
   const q={x:from.x+(to.x-from.x)*i/d+offset,y:from.y+(to.y-from.y)*i/d};if(Math.hypot(q.x-h.x,q.y-h.y)>720&&Math.hypot(q.x-start.x,q.y-start.y)>720&&!g.buildError(0,'turret',q)){p=q;break;}
  }if(p)break;}if(p)break;from=to;}
  if(!p)throw Error('No real turret site on the approach');const w=g.spawn(0,g.world.nearest({x:p.x+65,y:p.y},g.obstacles()),'engineer'),b=g.build(0,'turret',p,[w.id]);if(!b)throw Error('Worker failed to place turret');
  g.paused=false;for(let i=0;i<205;i++)g.step();const victims=[];
  for(let n=0;n<2;n++){
   let victim;for(let i=0;i<24;i++){const a=i*Math.PI/12,q={x:b.x+Math.cos(a)*(380+n*50),y:b.y+Math.sin(a)*(380+n*50)};
    if(g.world.walkable(q,g.obstacles())&&g.world.line(b,q,g.obstacles().filter(o=>o.id!==b.id))&&Math.hypot(q.x-h.x,q.y-h.y)>300){victim=g.spawn(1,q);break;}
   }if(!victim)throw Error('No clear firing lane');g.stop([victim.id],true);victim.cooldown=100;for(let i=0;i<140&&victim.hp>0;i++){g.step();r.render(.05);}victims.push({id:victim.id,hp:victim.hp});
  }
  g.updateVision();const learned=g.tactical.state.losses.map(l=>l.id);g.aiClock=3;const decisions=[],launches=[];let group=0;
  for(let i=0;i<3600;i++){
   g.step();if(g.tactical.state.phase==='attack'&&g.tactical.state.groupId!==group){group=g.tactical.state.groupId;launches.push({size:g.tactical.state.launchSize,ids:[...g.tactical.state.group],target:g.tactical.state.target});}
   if(i%60===0)decisions.push({phase:g.tactical.state.phase,size:g.tactical.state.launchSize,target:g.tactical.state.target,count:g.units.filter(u=>u.owner===1).length});
   if(i%10===0)r.render(.5);if(launches.length&&g.tactical.state.knownTurrets.length&&g.tactical.state.target!==target.id)break;
  }
  g.paused=true;r.camera={x:3250,y:700,zoom:.95};r.boundCamera();r.selectedBase=b.id;r.selected.clear();r.render(0);window.__reborn.refresh();
  return {victims,learned,decisions,launches,credits:g.credits[1],map:g.world.mapVersion,sectors:g.territories.length,turret:{hp:b.hp,remaining:b.buildRemaining},blockedSector:target.id,state:structuredClone(g.tactical.state),red:g.units.filter(u=>u.owner===1).map(u=>({id:u.id,kind:u.kind,hp:u.hp}))};
 });
 expect(result.map).toBe(2);expect(result.sectors).toBe(16);expect(result.victims.every(u=>u.hp<=0)).toBe(true);expect(result.learned).toEqual(result.victims.map(u=>u.id));expect(result.turret.remaining).toBe(0);
 // The legacy planner permits three paid fighters after its bounded rally wait.
 expect(result.decisions.some(d=>d.phase==='gather'||d.phase==='regroup')).toBe(true);expect(Math.max(...result.decisions.map(d=>d.count))).toBeGreaterThanOrEqual(3);expect(result.launches.length).toBeGreaterThan(0);for(const launch of result.launches)expect(launch.size).toBeGreaterThanOrEqual(3);expect(result.state.knownTurrets.length).toBeGreaterThan(0);expect(result.state.target).not.toBe(result.blockedSector);expect(result.credits).toBeGreaterThanOrEqual(0);
 await test.info().attach('tactical-decisions',{body:JSON.stringify(result,null,2),contentType:'application/json'});
 await page.screenshot({path:'artifacts/reborn/tactical-ai-after-ambush.png'});
 const saved=await page.evaluate(async()=>{const a=window.__reborn;a.game.updateVision();const expected=structuredClone(a.game.tactical.state);await a.save();await a.load();a.game.paused=true;a.refresh();return {expected,actual:a.game.tactical.state,ownerCount:a.game.territories.length};});
 expect(saved.actual).toEqual(saved.expected);expect(saved.ownerCount).toBe(16);expect(errors).toEqual([]);
});
