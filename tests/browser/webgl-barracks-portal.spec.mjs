import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('real WebGL barracks airlock opens for produced infantry and closes after walkout',async({page})=>{
 test.setTimeout(180000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/shader|clipp|gltf/i.test(m.text()))errors.push(m.text());});
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?bastions=4&seed=2074&pause=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded,null,{timeout:120000});
 await page.evaluate(async()=>{
  const w=window.__sandforgeWebGL,g=w.game,bf=w.battlefield;
  g.paused=true;g.aiClock=-1e8;g.canSee=()=>true;
  const origin=g.units[0];
  let best=null;
  for(let dx=-500;dx<=500;dx+=80)for(let dy=-500;dy<=500;dy+=80){
   const x=origin.x+dx,y=origin.y+dy;
   if(!g.world.walkable({x,y},[],95))continue;
   const h=[];for(const ox of [-110,0,110])for(const oy of [-110,0,110])
    h.push(w.heightAt(x+ox,y+oy));
   const spread=Math.max(...h)-Math.min(...h),score=spread+Math.hypot(dx,dy)*.0001;
   if(!best||score<best.score)best={x,y,score};
  }
  if(!best)throw Error('No level barracks site');
  g.units=[];g.bases=[];bf.sync(true);
  const base={id:903,kind:'barracks',radius:53,production:0,cooldown:0,owner:0,
   x:best.x,y:best.y,facing:0,buildRemaining:0,hp:800,queue:[],queueTypes:[],queueCosts:[]};
  const hq={...base,id:904,kind:'headquarters',x:base.x-450,y:base.y-450};
  g.bases.push(base,hq);bf.sync(true);
  window.barracksFixture={base};
  await Promise.all([bf.getModel(bf.asset('barracks',0,'building')),bf.getModel(bf.asset('infantry',0,'unit'))]);
 });
 await page.waitForFunction(()=>window.__sandforgeWebGL.battlefield.bases.get(903)?.gate?.portal,null,{timeout:45000});
 const start=await page.evaluate(()=>{
  const w=__sandforgeWebGL,g=w.game,bf=w.battlefield,{base}=barracksFixture;
  base.queue=[.05];base.queueTypes=['infantry'];base.queueCosts=[100];
  base.rally={x:base.x+340,y:base.y+280};
  g.status='playing';g.paused=false;g.step(.05);g.paused=true;bf.sync(true);
  const event=g.productionReleases.at(-1);if(!event||event.baseId!==base.id)throw Error('No infantry release');
  const unit=g.units.find(u=>u.id===event.unitId);
  barracksFixture.event=event;barracksFixture.unit=unit;
  const target=bf.entityPosition(base);
  w.controls.target.copy(target);
  w.camera.position.set(target.x+320,target.y+235,target.z+315);
  w.camera.zoom=2.4;w.camera.updateProjectionMatrix();w.controls.update();
  const gate=bf.bases.get(base.id).gate;
  return {hold:g.isProductionDepartureHeld(unit.id),count:g.units.length,
   duration:bf.productionGates.active.get(base.id)?.duration??0,
   panels:gate.portal.doorPanels.length,clipped:gate.portal.planes.length,
   actual:[unit.x,unit.y],orders:unit.orders.map(o=>o.kind)};
 });
 expect(start.count).toBe(1);
 expect(start.hold).toBe(true);
 expect(start.panels).toBeGreaterThan(0);
 expect(start.clipped).toBe(6);
 expect(start.orders).toContain('attackMove');
 expect(start.duration).toBeGreaterThanOrEqual(2.8);
 await mkdir('artifacts/barracks-portal',{recursive:true});
 const results=[];
 for(const [name,age] of [['closed',0],['half',.75],['walk',2.25],
  ['clear',1.25+start.duration],['closed-again',2.25+start.duration]]){
  const v=await page.evaluate(age=>{
   const w=__sandforgeWebGL,g=w.game,bf=w.battlefield,{event,unit,base}=barracksFixture;
   g.time=event.at+age;bf.sync(true,0,false);
   const gate=bf.bases.get(base.id).gate,actor=bf.units.get(unit.id);
   w.renderer.render(w.scene,w.camera);
   return {panelY:gate.portal.doorPanels[0].mesh.position.y,
    panelScale:gate.portal.doorPanels[0].mesh.scale.y,
    hall:gate.hall.visible,active:bf.productionGates.active.has(base.id),
    actual:[unit.x,unit.y],visible:actor.node.visible,drawCalls:w.renderer.info.render.calls};
  },age);
  results.push({name,...v});
  if(['closed','half','walk','closed-again'].includes(name))
   await page.screenshot({path:`artifacts/barracks-portal/${name}.png`});
 }
 expect(results[0].panelScale).toBeCloseTo(1,5);
 expect(results[1].panelScale).toBeLessThan(.8);
 expect(results[1].hall).toBe(true);
 expect(results[2].active).toBe(true);
 expect(results[3].active).toBe(true);
 expect(results[4].panelScale).toBeCloseTo(1,5);
 expect(results[4].active).toBe(false);
 for(const r of results)expect(r.actual).toEqual(start.actual);
 expect(errors).toEqual([]);
});
