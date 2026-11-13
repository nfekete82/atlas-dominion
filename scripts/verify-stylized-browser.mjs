import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from '../tests/browser/node_modules/playwright/index.mjs';

const base=process.env.SANDFORGE_BASE_URL??'http://127.0.0.1:8198';
const dir='docs/stylized-reference/qa';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&/shader|gltf|webgl/i.test(m.text()))errors.push(m.text());});
const results={gallery:{},live:{},errors};
try{
 await page.goto(base+'/art-gallery.html');await page.waitForFunction(()=>window.__sandforgeArt?.ready);
 await page.evaluate(()=>{__sandforgeArt.pause();__sandforgeArt.setDoor(0);__sandforgeArt.render();});
 for(const owner of [0,1]){
  await page.evaluate(async owner=>{await __sandforgeArt.load(owner);__sandforgeArt.render();},owner);
  await page.screenshot({path:`${dir}/reference-${owner===0?'blue':'red'}.png`});
 }
 await page.evaluate(()=>{__sandforgeArt.setRTS(true);__sandforgeArt.render();});
 await page.screenshot({path:dir+'/rts-distance.png'});
 await page.evaluate(async()=>{await __sandforgeArt.load(0);__sandforgeArt.setRTS(false);__sandforgeArt.setDoor(1);__sandforgeArt.render();});
 await page.screenshot({path:dir+'/barracks-open.png'});
 results.gallery=await page.evaluate(()=>{
  const a=__sandforgeArt;
  return {models:a.entries.map(e=>({kind:e.kind,scale:e.node.scale.toArray(),clips:e.clips.map(c=>c.name)})),drawCalls:a.renderer.info.render.calls,triangles:a.renderer.info.render.triangles};
 });
 for(const kind of ['rover','infantry']){
  await page.evaluate(async kind=>{
   const a=__sandforgeArt,T=await import('three'),entry=a.entries.find(e=>e.kind===kind);
   for(const e of a.entries)e.node.visible=e===entry;
   const bounds=new T.Box3().setFromObject(entry.node),target=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),extent=Math.max(size.x,size.y,size.z);
   a.camera.zoom=1;a.camera.left=-extent*.93;a.camera.right=extent*.93;a.camera.top=extent*.93*925/1600;a.camera.bottom=-a.camera.top;
   a.controls.target.copy(target);a.camera.position.copy(target).add(new T.Vector3(extent*.85,extent*.43,-extent*1.3));a.controls.update();a.camera.updateProjectionMatrix();
   a.setClip('Idle');a.render();
  },kind);
  await page.screenshot({path:dir+'/'+kind+'-detail.png'});
  if(kind==='infantry')for(const clip of ['Walk','Run','Shoot','Death']){
   await page.evaluate(clip=>{const a=__sandforgeArt;a.setClip(clip);for(const e of a.entries)e.mixer.update(clip==='Death'?.85:.18);a.render();},clip);
   await page.screenshot({path:dir+'/infantry-'+clip.toLowerCase()+'.png'});
  }
 }
 // Exercise the actual game adapter, authoritative actor, construction and
 // production release. Only this isolated QA scene arranges a controlled base.
 await page.goto(base+'/?bastions=4&seed=2074&pause=1&lite=1&fog=off');
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded,null,{timeout:120000});
 await page.evaluate(()=>__sandforgeWebGL.renderer.setAnimationLoop(null));
 await page.evaluate(()=>{
  const w=__sandforgeWebGL,g=w.game,bf=w.battlefield,start=g.units[0];
  const origin=g.world.nearest({x:start.x+500,y:start.y+450},[],[],undefined,350);
  if(!origin)throw Error('No clear QA staging area found');
  window.artOrigin={x:origin.x,y:origin.y};g.canSee=()=>true;g.aiClock=-1e8;g.units=[];g.bases=[];bf.sync(true,0,false);
  const x=origin.x,y=origin.y;
  g.bases.push({id:8901,kind:'barracks',owner:0,x,y,facing:0,buildRemaining:6,hp:800,radius:53,production:0,cooldown:0,queue:[],queueTypes:[],queueCosts:[]});
  g.spawn(0,{x:x-180,y:y+60},'rover');g.spawn(0,{x:x-100,y:y-110},'infantry');bf.sync(true,0,false);
 });
 await page.waitForFunction(()=>{const b=__sandforgeWebGL.battlefield;return b.bases.get(8901)?.detail&&[...b.units.values()].every(e=>e.detail);},null,{timeout:60000});
 results.live.models=await page.evaluate(()=>{
  const w=__sandforgeWebGL,g=w.game,b=w.battlefield,base=g.bases[0],entry=b.bases.get(base.id),stages=[];
  for(const remaining of [12,9,6,3,0]){base.buildRemaining=remaining;b.sync(true,0,false);stages.push({remaining,visibleIndices:entry.construction?.authoredAssembly?.meshes.reduce((s,m)=>s+m.geometry.drawRange.count,0)??null});}
  w.controls.target.copy(entry.node.position);w.controls.target.y+=30;w.camera.position.copy(w.controls.target).add({x:350,y:380,z:-550});w.camera.zoom=2.2;w.camera.updateProjectionMatrix();w.controls.update();
  w.renderer.render(w.scene,w.camera);
  return {stages,assets:[entry,...b.units.values()].map(e=>({kind:e.kind,stylized:e.detail?.userData?.sandforgeStylized,worldHeight:e.modelHeight,scale:e.detail?.scale.toArray(),clips:e.animation?Object.fromEntries(['idle','walk','run','attack','death'].map(k=>[k,e.animation[k]?.name])):null}))};
 });
 assert.ok(results.live.models.assets.every(e=>e.stylized&&e.scale.every(s=>s===18)));
 assert.equal(results.live.models.stages[0].visibleIndices,0);
 assert.ok(results.live.models.stages[2].visibleIndices>0);
 await page.screenshot({path:dir+'/live-game.png'});
 results.live.wheels=await page.evaluate(()=>{
  const w=__sandforgeWebGL,g=w.game,bf=w.battlefield,u=g.units.find(u=>u.kind==='rover'),e=bf.units.get(u.id),wheel=e.detail.getObjectByName('Wheel_LF');
  const initial=wheel.quaternion.clone();
  for(let i=0;i<5;i++){u.previousX=u.x;u.previousY=u.y;u.x+=5;u.moving=true;bf.sync(true,.05,true);}
  const movingClip=e.animation.playing.name,turn=initial.angleTo(wheel.quaternion);
  u.previousX=u.x;u.previousY=u.y;u.moving=true;
  for(let i=0;i<5;i++)bf.sync(true,.05,true);
  const stopped=wheel.quaternion.clone();for(let i=0;i<5;i++)bf.sync(true,.05,true);
  return {movingClip,turn,stationaryClip:e.animation.playing.name,stationaryTurn:stopped.angleTo(wheel.quaternion)};
 });
 assert.equal(results.live.wheels.movingClip,'Drive');assert.ok(results.live.wheels.turn>.1);
 assert.equal(results.live.wheels.stationaryClip,'Idle');assert.ok(results.live.wheels.stationaryTurn<.001);
 results.live.departures=[];
 for(const facing of [0,2,1,3]){
  const id=await page.evaluate(facing=>{
   const w=__sandforgeWebGL,g=w.game,bf=w.battlefield,b=g.bases[0];
   bf.productionGates.active.clear();b.facing=facing;g.units=[];bf.sync(true,0,false);
   b.queue=[.01];b.queueTypes=['infantry'];b.queueCosts=[100];b.production=0;b.rally={x:b.x+380,y:b.y+270};
   g.status='playing';g.paused=false;g.step(.05);g.paused=true;bf.sync(true,0,false);
   window.artRelease=g.productionReleases.at(-1);return artRelease?.unitId;
  },facing);
  assert.ok(id,'production creates one authoritative soldier');
  await page.waitForFunction(id=>__sandforgeWebGL.battlefield.units.get(id)?.detail,id);
  const result=await page.evaluate(()=>{
   const w=__sandforgeWebGL,g=w.game,bf=w.battlefield,event=artRelease,u=g.units.find(u=>u.id===event.unitId),base=g.bases[0],entry=bf.bases.get(base.id);
   const authoritative=JSON.stringify(u);g.time=event.at;bf.sync(true,0,false);
   const at=bf.productionGates.active.get(base.id)?.visualAt??event.at,samples=[];
   for(const age of [0,.75,1.3,1.7,2.2,2.7,3.1,3.5,9]){
    g.time=at+age;bf.sync(true,.05,false);const actor=bf.units.get(u.id);entry.node.updateWorldMatrix(true,true);
    const local=entry.detail.worldToLocal(actor.node.position.clone());
    samples.push({age,visible:actor.node.visible,local:local.toArray(),left:entry.gate.portal.left.position.x,right:entry.gate.portal.right.position.x});
   }
   return {facing:base.facing,samples,simulationUnchanged:JSON.stringify(u)===authoritative,stylized:entry.gate.portal.stylized};
  });
  results.live.departures.push(result);
  assert.ok(result.stylized);assert.ok(result.simulationUnchanged);assert.equal(result.samples[0].visible,false);assert.equal(result.samples[2].visible,true);
  assert.ok(result.samples[1].left<result.samples[0].left);assert.equal(result.samples.at(-1).left,result.samples[0].left);
  // Until the actor clears the front wall it stays on the opening's centreline.
  assert.ok(result.samples.filter(s=>s.visible&&s.age<=2.7).every(s=>Math.abs(s.local[0])<.01));
 }
 // Capture must repaint authored blue panels without altering cached geometry.
 results.live.capture=await page.evaluate(()=>{
  const w=__sandforgeWebGL,b=w.game.bases[0],e=w.battlefield.bases.get(b.id);b.owner=1;w.battlefield.sync(true,0,false);w.renderer.render(w.scene,w.camera);
  return {owner:e.factionOwner,paint:e.detail.userData.stylizedPaintOwner};
 });
 assert.deepEqual(results.live.capture,{owner:1,paint:1});
 results.live.death=await page.evaluate(()=>{
  const w=__sandforgeWebGL,g=w.game,bf=w.battlefield,u=g.units[0];u.hp=0;bf.sync(true,0,false);
  const remnant=bf.presentation.remnants.at(-1);
  for(let i=0;i<14;i++)bf.presentation.stepRemnants(.08,true);
  const hips=remnant.model.getObjectByName('Hips');
  return {animated:!!remnant.deathMixer,hipsY:hips.position.y,hipsAngle:hips.rotation.x};
 });
 assert.ok(results.live.death.animated);assert.ok(results.live.death.hipsY<.25);assert.ok(Math.abs(results.live.death.hipsAngle)>1.3);
 const fallbackId=await page.evaluate(()=>{
  const w=__sandforgeWebGL,bf=w.battlefield,original=bf.getModel;
  window.restoreArtModelGet=()=>{bf.getModel=original;};
  bf.getModel=function(url){return url==='/src/assets/stylized/infantry-1.glb'?Promise.reject(new Error('QA: intentionally unavailable')):original.call(this,url);};
  const b=w.game.bases[0],u=w.game.spawn(1,{x:b.x+210,y:b.y-150},'infantry');bf.sync(true,0,false);return u.id;
 });
 await page.waitForFunction(id=>__sandforgeWebGL.battlefield.units.get(id)?.detail,fallbackId,{timeout:60000});
 results.live.fallback=await page.evaluate(id=>{
  const e=__sandforgeWebGL.battlefield.units.get(id);restoreArtModelGet();
  return {loaded:!!e.detail,stylized:!!e.detail.userData.sandforgeStylized,animated:!!e.animation?.walk};
 },fallbackId);
 assert.deepEqual(results.live.fallback,{loaded:true,stylized:false,animated:true});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify(results,null,2));
}finally{await writeFile(dir+'/browser-results.json',JSON.stringify(results,null,2)+'\n');await browser.close();}
