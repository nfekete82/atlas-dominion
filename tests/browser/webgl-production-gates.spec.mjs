import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('real factory GLBs: production, four rotations, two factions, pause, orders and destruction',async({page})=>{
 test.setTimeout(240000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/shader|animation|gltf/i.test(m.text()))errors.push(m.text());});
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/?bastions=4&seed=2074&pause=1');
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded,null,{timeout:120000});
 await page.evaluate(async()=>{
  const w=window.__sandforgeWebGL,g=w.game,bf=w.battlefield;
  g.paused=true;g.aiClock=-1e8;g.canSee=()=>true;
  // Choose a genuinely level, walkable site for contact/threshold captures.
  const origin=g.units[0];let best=null;
  for(let dx=-600;dx<=600;dx+=60)for(let dy=-600;dy<=600;dy+=60){
   const x=origin.x+dx,y=origin.y+dy;
   if(!g.world.walkable({x,y},[],90))continue;
   const heights=[];for(const ox of [-140,0,140])for(const oy of [-140,0,140])heights.push(w.heightAt(x+ox,y+oy));
   const spread=Math.max(...heights)-Math.min(...heights);
   const score=spread+Math.hypot(dx,dy)*.0001;
   if(!best||score<best.score)best={x,y,score,spread};
  }
  if(!best)throw Error('No flat factory fixture site');
  g.units=[];g.bases=[];bf.sync(true);
  const base={id:900,kind:'factory',radius:70,production:0,cooldown:0,owner:0,x:best.x,y:best.y,facing:0,buildRemaining:0,hp:1100,queue:[],queueTypes:[],queueCosts:[]};
  const hq={...base,id:901,kind:'headquarters',x:base.x-500,y:base.y-500};g.bases.push(base,hq);
  bf.sync(true);window.gateFixture={base,site:best};
  await Promise.all([bf.getModel(bf.asset('factory',0,'building')),bf.getModel(bf.asset('factory',1,'building')),bf.getModel(bf.asset('tank',0,'unit')),bf.getModel(bf.asset('tank',1,'unit'))]);
 });
 await page.waitForFunction(()=>window.__sandforgeWebGL.battlefield.bases.get(900)?.detail,null,{timeout:45000});
 await mkdir('artifacts/production-gates',{recursive:true});
 for(const owner of [0,1])for(const facing of [0,2,1,3]){
  await page.evaluate(async({owner,facing})=>{
   const w=window.__sandforgeWebGL,g=w.game,bf=w.battlefield,{base}=gateFixture;
   g.units=[];bf.sync(true);base.facing=facing;
   if(base.owner!==owner){
    const old=bf.bases.get(base.id);bf.presentation.remove(old);bf.productionGates.detach(old);old.node.removeFromParent();bf.bases.delete(base.id);base.owner=owner;
   }
   bf.sync(true);await new Promise(r=>setTimeout(r,200));
  },{owner,facing});
  await page.waitForFunction(()=>window.__sandforgeWebGL.battlefield.bases.get(900)?.detail,null,{timeout:30000});
  const release=await page.evaluate(()=>{
   const w=window.__sandforgeWebGL,g=w.game,bf=w.battlefield,{base}=gateFixture;
   base.queue=[.05];base.queueTypes=['tank'];base.queueCosts=[550];
   base.rally={x:base.x+300,y:base.y+300};g.status='playing';g.paused=false;g.step(.05);g.paused=true;bf.sync(true);
   const event=g.productionReleases.at(-1);if(!event||event.baseId!==base.id)throw Error('Real production did not release');
   const unit=g.units.find(u=>u.id===event.unitId);gateFixture.event=event;gateFixture.unit=unit;
   const target=bf.entityPosition(base);w.controls.target.copy(target);
   const angle=[0,Math.PI,Math.PI/2,Math.PI*1.5][base.facing];
   w.camera.position.set(target.x+Math.cos(angle)*220+Math.sin(angle)*380,target.y+245,target.z-Math.sin(angle)*220+Math.cos(angle)*380);
   w.camera.zoom=2.4;w.camera.updateProjectionMatrix();w.controls.update();
   return {count:g.units.length,active:bf.productionGates.active.size,orders:unit.orders,duration:bf.productionGates.active.get(base.id).duration,site:gateFixture.site};
  });
  expect(release.count).toBe(1);expect(release.active).toBe(1);expect(release.orders[0]?.kind).toBe('attackMove');
  await page.waitForFunction(()=>{const f=gateFixture;return window.__sandforgeWebGL.battlefield.units.get(f.unit.id)?.detail;},null,{timeout:30000});
  for(const [stage,age,open]of [['closed',0,0],['half',.75,.5],['open',1.25,1],['drive',2.7,1],['clear',1.25+release.duration,1],['closed-again',2.25+release.duration,0]]){
   const pose=await page.evaluate(age=>{
    const w=window.__sandforgeWebGL,g=w.game,bf=w.battlefield,{event,unit,base}=gateFixture;
    g.time=event.at+age;bf.sync(true,0,false);const actor=bf.units.get(unit.id),gate=bf.bases.get(base.id).gate;
    w.renderer.render(w.scene,w.camera);
    return {open:(1-gate.door.scale.y)/.96,position:actor.node.position.toArray(),actual:bf.entityPosition(unit).toArray(),visible:actor.node.visible,count:g.units.length,active:bf.productionGates.active.size,
     hall:gate.hall.visible,orders:unit.orders};
   },age);
   expect(pose.open).toBeCloseTo(open,5);expect(pose.count).toBe(1);
   if(stage==='closed')expect(pose.visible).toBe(false);
   if(stage==='clear')expect(Math.hypot(...pose.position.map((n,i)=>n-pose.actual[i]))).toBeLessThan(.001);
   if(stage==='closed-again')expect(pose.active).toBe(0);
   if(owner===0&&facing===0)await page.screenshot({path:`artifacts/production-gates/${stage}.png`});
   if(stage==='drive')await page.screenshot({path:`artifacts/production-gates/drive-faction-${owner}-facing-${facing}.png`});
  }
 }
 for(const kind of ['rover','artillery']){
  await page.evaluate(async kind=>{
   const w=__sandforgeWebGL,g=w.game,bf=w.battlefield,{base}=gateFixture;
   g.units=[];bf.sync(true);await bf.getModel(bf.asset(kind,base.owner,'unit'));
   base.queue=[.05];base.queueTypes=[kind];base.queueCosts=[550];base.rally=null;
   g.paused=false;g.status='playing';g.step(.05);g.paused=true;bf.sync(true);
   gateFixture.event=g.productionReleases.at(-1);gateFixture.unit=g.units.find(u=>u.id===gateFixture.event.unitId);
  },kind);
  await page.waitForFunction(()=>__sandforgeWebGL.battlefield.units.get(gateFixture.unit.id)?.detail);
  const bounds=await page.evaluate(async()=>{
   const T=await import('three'),w=__sandforgeWebGL,{event,unit,base}=gateFixture;
   w.game.time=event.at+2.7;w.battlefield.sync(true,.05,true);
   const actor=w.battlefield.units.get(unit.id),entry=w.battlefield.bases.get(base.id);
   const roof=entry.gate.door.parent.localToWorld(new T.Vector3(.18,1.48*.96+.25*.04,1.5));
   const box=new T.Box3().setFromObject(actor.detail);
   return {top:box.max.y,lintel:roof.y,active:w.battlefield.productionGates.active.size};
  });
  expect(bounds.active).toBe(1);
  expect(bounds.top).toBeLessThanOrEqual(bounds.lintel+1);
  await page.screenshot({path:`artifacts/production-gates/${kind}-drive.png`});
  await page.evaluate(()=>{const w=__sandforgeWebGL;w.game.time=gateFixture.event.at+12;w.battlefield.sync(true);});
 }
 // A subsequent real production can start on the same gate. Pausing, command
 // replacement and destruction must immediately recover authoritative actors.
 const recovery=await page.evaluate(()=>{
  const w=window.__sandforgeWebGL,g=w.game,bf=w.battlefield,{base}=gateFixture;
  g.units=[];bf.sync(true);base.queue=[.05];base.queueTypes=['tank'];base.queueCosts=[550];base.rally=null;
  g.paused=false;g.status='playing';g.step(.05);g.paused=true;bf.sync(true);
  const event=g.productionReleases.at(-1),u=g.units.find(u=>u.id===event.unitId);g.time=event.at+.75;bf.sync(true);
  const gate=bf.bases.get(base.id).gate,paused=gate.door.position.y;bf.sync(true,.1,false);
  const pauseStable=gate.door.position.y===paused;
  g.command([u.id],{kind:'move',x:u.x+100,y:u.y+100});bf.sync(true);
  const commandRecovered=bf.productionGates.active.size===0&&bf.units.get(u.id).node.position.distanceTo(bf.entityPosition(u))<.001;
  const save=g.save();const formatUnchanged=!('productionReleases'in save);
  base.hp=0;bf.sync(true);
  return {pauseStable,commandRecovered,formatUnchanged,removed:!bf.bases.has(base.id),count:g.units.length};
 });
 expect(recovery).toEqual({pauseStable:true,commandRecovered:true,formatUnchanged:true,removed:true,count:1});
 expect(errors).toEqual([]);
});
