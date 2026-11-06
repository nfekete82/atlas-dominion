import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('real two-faction barracks blast doors open before infantry walks to rally',async({page})=>{
 test.setTimeout(240000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('console',msg=>{if(msg.type()==='error'&&/shader|GLTF|animation|WebGL/i.test(msg.text()))errors.push(msg.text());});
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?bastions=4&seed=2074&pause=1&fog=off');
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded,null,{timeout:120000});
 await page.evaluate(async()=>{
  const w=__sandforgeWebGL,g=w.game,bf=w.battlefield;
  g.paused=true;g.aiClock=-1e8;g.canSee=()=>true;
  let site=null;
  for(let x=g.world.size*.25;x<g.world.size*.75;x+=75){
   for(let y=g.world.size*.25;y<g.world.size*.75;y+=75){
    if(g.world.walkable({x,y},[],100)){site={x,y};break;}
   }
   if(site)break;
  }
  if(!site)throw Error('No walkable barracks fixture site');
  g.units=[];g.bases=[];bf.sync(true);
  const barracks={id:900,kind:'barracks',radius:53,production:0,cooldown:0,owner:0,
   x:site.x,y:site.y,facing:0,buildRemaining:0,hp:800,queue:[],queueTypes:[],queueCosts:[],
   rally:{x:site.x+300,y:site.y+300}};
  const hq={...barracks,id:901,kind:'headquarters',x:site.x-450,y:site.y-450,hp:1500,rally:null};
  g.bases.push(barracks,hq);bf.sync(true);
  window.barracksFixture={barracks};
  await Promise.all([
   bf.getModel(bf.asset('barracks',0,'building')),
   bf.getModel(bf.asset('barracks',1,'building')),
   bf.getModel(bf.asset('infantry',0,'unit')),
   bf.getModel(bf.asset('infantry',1,'unit'))
  ]);
 });
 await mkdir('artifacts/barracks-release',{recursive:true});
 for(const owner of [0,1])for(const facing of [0,2]){
  await page.evaluate(({owner,facing})=>{
   const w=__sandforgeWebGL,g=w.game,bf=w.battlefield,{barracks}=barracksFixture;
   g.units=[];bf.sync(true);barracks.facing=facing;
   if(barracks.owner!==owner){
    const old=bf.bases.get(barracks.id);
    if(old){bf.presentation.remove(old);bf.productionGates.detach(old);old.node.removeFromParent();bf.bases.delete(barracks.id);}
    barracks.owner=owner;
   }
   bf.sync(true);
  },{owner,facing});
  await page.waitForFunction(()=>{
   const entry=__sandforgeWebGL.battlefield.bases.get(900);
   return entry?.detail&&entry?.gate?.kind==='barracks';
  },null,{timeout:60000});
  const started=await page.evaluate(()=>{
   const w=__sandforgeWebGL,g=w.game,bf=w.battlefield,{barracks}=barracksFixture;
   barracks.queue=[.05];barracks.queueTypes=['infantry'];barracks.queueCosts=[125];
   g.paused=false;g.status='playing';g.step(.05);g.paused=true;bf.sync(true);
   const event=g.productionReleases.at(-1);
   if(!event||event.baseId!==barracks.id)throw Error('Barracks did not train a real soldier');
   const unit=g.units.find(u=>u.id===event.unitId);
   barracksFixture.event=event;barracksFixture.unit=unit;
   const target=bf.entityPosition(barracks);w.controls.target.copy(target);
   w.camera.position.set(target.x+245,target.y+280,target.z+320);
   w.camera.zoom=2.5;w.camera.updateProjectionMatrix();w.controls.update();
   const entry=bf.bases.get(barracks.id);
   return {unitId:unit.id,realCount:g.units.length,until:unit.productionExitUntil,
    duration:bf.productionGates.active.get(barracks.id)?.duration,clipped:entry.gate.changed.length};
  });
  expect(started.realCount).toBe(1);
  expect(started.clipped).toBeGreaterThan(0);
  expect(started.until).toBeGreaterThan(0);
  expect(started.duration).toBeGreaterThan(.5);
  await page.waitForFunction(()=>__sandforgeWebGL.battlefield.units.get(barracksFixture.unit.id)?.detail,null,{timeout:40000});
  for(const [stage,age] of [['closed',0],['half',.75],['walk',1.7],['outside',1.25+started.duration],['closed-again',2.25+started.duration]]){
   const state=await page.evaluate(age=>{
    const w=__sandforgeWebGL,g=w.game,bf=w.battlefield,{barracks,event,unit}=barracksFixture;
    g.time=event.at+age;bf.sync(true,0,false);w.renderer.render(w.scene,w.camera);
    const entry=bf.bases.get(barracks.id),actor=bf.units.get(unit.id);
    return {open:(1-entry.gate.door.scale.y)/.96,actor:actor.node.position.toArray(),
     real:bf.entityPosition(unit).toArray(),active:bf.productionGates.active.size,
     stillOnlyOne:g.units.length===1,position:unit.x,orders:unit.orders.length};
   },age);
   expect(state.stillOnlyOne).toBe(true);
   expect(state.orders).toBeGreaterThan(0);
   if(stage==='half')expect(state.open).toBeGreaterThan(.35);
   if(stage==='walk')expect(state.open).toBeGreaterThan(.95);
   if(stage==='outside')
    expect(Math.hypot(...state.actor.map((value,i)=>value-state.real[i]))).toBeLessThan(.01);
   if(stage==='closed-again')expect(state.active).toBe(0);
   if(owner===0&&facing===0)await page.screenshot({path:`artifacts/barracks-release/${stage}.png`});
  }
 }
 expect(errors).toEqual([]);
});

test('rover wheel animation is halted while physically stationary',async({page})=>{
 test.setTimeout(140000);
 await page.goto('/?bastions=4&seed=2074&pause=1&fog=off');
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded,null,{timeout:120000});
 await page.evaluate(async()=>{
  const w=__sandforgeWebGL,g=w.game,bf=w.battlefield;
  const start=g.units.find(u=>u.owner===0);
  const rover=g.spawn(0,{x:start.x+60,y:start.y+50},'rover');
  g.canSee=()=>true;g.paused=true;
  bf.sync(true);
  window.wheelFixture=rover;
  await bf.getModel(bf.asset('rover',0,'unit'));
 });
 await page.waitForFunction(()=>__sandforgeWebGL.battlefield.units.get(wheelFixture.id)?.animation,null,{timeout:50000});
 const state=await page.evaluate(()=>{
  const w=__sandforgeWebGL,u=wheelFixture,bf=w.battlefield;
  u.moving=false;u.previousX=u.x;u.previousY=u.y;
  bf.sync(true,.05,true);
  const entry=bf.units.get(u.id);
  const idle=entry.animation.mixer.existingAction(entry.animation.idle);
  const stopped=idle?.getEffectiveTimeScale()??NaN;
  u.previousX=u.x-5;u.moving=true;u.x+=5;
  bf.sync(true,.05,true);
  const walk=entry.animation.mixer.existingAction(entry.animation.walk);
  const driving=walk?.getEffectiveTimeScale()??NaN;
  return {stopped,driving};
 });
 expect(state.stopped).toBe(0);
 expect(state.driving).toBeGreaterThan(0);
});
