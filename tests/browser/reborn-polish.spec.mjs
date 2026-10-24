import {test,expect} from '@playwright/test';
async function start(page){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});
 await page.goto('/?debug&legacy');await page.locator('#loading').waitFor({state:'detached'});
 await page.evaluate(()=>{const a=window.__reborn;a.game.paused=true;a.game.aiClock=-1e8;a.game.credits=[10000,10000];a.refresh();});return errors;
}

test('polish: live rifle bursts use warm muzzle sockets and short travelling tracers, actual shot audio, pause and settings',async({page})=>{
 const errors=await start(page);await page.locator('#sound').click();await page.locator('#audio-test').click();await page.locator('#audio-close').click();
 const state=await page.evaluate(async()=>{
  const {game:g,renderer:r,audio:a}=window.__reborn;await a.unlock();g.units=[];
  const u=g.spawn(0,{x:1900,y:2100}),e=g.spawn(1,{x:2050,y:2100},'tank');e.cooldown=100;g.stop([u.id,e.id],true);g.updateVision();r.camera={x:1970,y:2100,zoom:2};r.boundCamera();r.selected.clear();r.render(0);
  a.update(g,r);const before=a.played.rifle,events=[];let muzzleError=Infinity;g.paused=false;
  for(let i=0;i<5;i++){g.step();a.update(g,r);r.render(.05);if(i===0){const muzzle=r.units.muzzleFor(u),flash=r.units.particles.items.find(p=>p.color==='#fff0bb');muzzleError=flash?Math.hypot(flash.x-muzzle.x,flash.y-muzzle.y):Infinity;}events.push(g.shots.filter(s=>s.source===u.id).length);}
  const played=a.played.rifle-before,traces=r.units.particles.items.filter(p=>p.trace).map(p=>({x:p.x,y:p.y,vx:p.vx,vy:p.vy,age:p.age}));
  const segments=[];const c=r.context,original=c.lineTo;c.lineTo=function(x,y){if(this.strokeStyle==='#ffe5a0')segments.push([x,y]);return original.call(this,x,y);};r.render(0);c.lineTo=original;
  const count=r.units.particles.count,master=a.master.gain.value,shotCount=g.shots.length,context=a.context;
  g.paused=true;a.update(g,r);r.render(.1);window.__reborn.refresh();
  return {events,played,muzzleError,traces,segments:segments.length,count,afterPause:r.units.particles.count,shotCount,master,voices:a.activeGameplayVoices,contextState:context.state};
 });
 expect(state.muzzleError).toBeLessThan(.01);expect(state.events).toEqual([1,1,2,3,3]);expect(state.played).toBe(3);expect(state.traces.length).toBeGreaterThan(0);expect(state.segments).toBeGreaterThan(0);expect(state.count).toBe(state.afterPause);expect(state.voices).toBe(0);expect(state.contextState).toBe('running');
 await page.screenshot({path:'artifacts/reborn/polish-rifle.png'});
 const disabled=await page.evaluate(()=>{const {game:g,renderer:r,audio:a}=window.__reborn;a.setEnabled(false);const before=a.played.shots;g.paused=false;g.units[0].cooldown=0;g.step();a.update(g,r);r.units.particles.enabled=false;r.render(.05);g.paused=true;return {before,after:a.played.shots,particles:r.units.particles.count,enabled:a.enabled};});
 expect(disabled.after).toBe(disabled.before);expect(disabled.particles).toBe(0);expect(disabled.enabled).toBe(false);
 const suppressed=await page.evaluate(()=>{
  const {game:g,renderer:r,audio:a}=window.__reborn;a.setEnabled(true);a.setVolume(0);g.paused=false;const before=a.played.shots;
  const shot=()=>({...g.shots[0],at:g.time});g.shots.push(shot());a.update(g,r);const zero=a.played.shots;
  a.setVolume(.5);a.update(g,r);const replay=a.played.shots;
  g.visible[0].fill(1);g.shots.push({...shot(),groundFrom:{x:300,y:300},groundTo:{x:350,y:300}});a.update(g,r);const offscreen=a.played.shots;
  g.visible[0].fill(0);g.shots.push(shot());a.update(g,r);const unseen=a.played.shots;g.paused=true;
  return {before,zero,replay,offscreen,unseen};
 });
 expect(new Set(Object.values(suppressed)).size).toBe(1);
 await page.locator('#sound').click();await page.locator('#audio-volume').fill('25');await expect(page.locator('#audio-level')).toHaveText('25 %');await page.locator('#particles-enabled').uncheck();
 expect(await page.evaluate(()=>({volume:window.__reborn.audio.volume,particles:window.__reborn.renderer.units.particles.enabled}))).toEqual({volume:.25,particles:false});expect(errors).toEqual([]);
});

test('polish: real dual turret barrels, distinct synthesized weapon signals and capped audio voices',async({page})=>{
 const errors=await start(page);await page.locator('#sound').click();await page.locator('#audio-test').click();await page.locator('#audio-close').click();
 const result=await page.evaluate(async()=>{
  const {game:g,renderer:r,audio:a}=window.__reborn;await a.unlock();g.units=[];
  const b={...g.bases[0],id:1300,x:1900,y:2100,kind:'turret',hp:650,radius:30,queue:[],queueTypes:[],cooldown:0,turretAngle:Math.PI};g.bases.push(b);
  const e=g.spawn(1,{x:2280,y:2100},'tank');e.cooldown=100;g.stop([e.id],true);g.updateVision();r.camera={x:2030,y:2100,zoom:1.7};r.boundCamera();r.selectedBase=b.id;r.render(0);a.update(g,r);const before=a.played.turret;
  g.paused=false;g.step();const early=g.shots.length;
  for(let i=0;i<35&&g.shots.filter(s=>s.source===b.id).length<4;i++){g.step();a.update(g,r);r.render(.05);}
  const shots=g.shots.filter(s=>s.source===b.id),played=a.played.turret-before;g.paused=true;a.update(g,r);r.render(0);
  const {Soundscape,WEAPON_SOUNDS}=await import('/src/reborn/audio.js'),signals={};
  for(const kind of ['rifle','heavy','pistol','turret']){
   const offline=new OfflineAudioContext(1,24000,48000),sound=new Soundscape();sound.context=offline;sound.noise=a.noise;sound.master=offline.createGain();sound.master.connect(offline.destination);sound.weapon(kind,{x:2030,y:2100},r);
   const rendered=await offline.startRendering(),data=rendered.getChannelData(0);let energy=0,tail=0,peak=0;for(let i=0;i<data.length;i++){energy+=data[i]*data[i];peak=Math.max(peak,Math.abs(data[i]));if(i>12000)tail+=Math.abs(data[i]);}signals[kind]={energy,peak,tail,profile:WEAPON_SOUNDS[kind]};
  }
  a.setEnabled(true);a.setVolume(1);g.shots=[];g.paused=false;
  for(let i=0;i<100;i++)g.shots.push({from:{x:1900,y:2082},to:{x:2050,y:2077},groundFrom:{x:1900,y:2100},groundTo:{x:2050,y:2100},owner:0,life:.5,hit:true,weapon:'turret',at:g.time});
  a.update(g,r);const cap={voices:a.activeVoices,peak:a.peakVoices,limit:a.voiceLimit,dropped:a.droppedVoices};g.paused=true;a.update(g,r);
  return {early,barrels:shots.map(s=>s.barrel),muzzles:shots.map(s=>s.from),damage:620-e.hp,played,signals,cap};
 });
 expect(result.early).toBe(0);expect(result.barrels).toEqual([0,1,0,1]);expect(result.muzzles[0]).not.toEqual(result.muzzles[1]);expect(result.muzzles[0]).toEqual(result.muzzles[2]);expect(result.damage).toBe(24);expect(result.played).toBe(4);
 for(const signal of Object.values(result.signals)){expect(signal.energy).toBeGreaterThan(.01);expect(signal.peak).toBeLessThan(1);expect(signal.tail).toBe(0);}
 expect(result.signals.pistol.energy).not.toBe(result.signals.rifle.energy);expect(result.signals.turret.profile.bass).toBeLessThan(result.signals.rifle.profile.bass);expect(result.cap.voices).toBeLessThanOrEqual(result.cap.limit);expect(result.cap.peak).toBeLessThanOrEqual(result.cap.limit);expect(result.cap.dropped).toBeGreaterThan(0);
 await page.screenshot({path:'artifacts/reborn/polish-turret.png'});expect(errors).toEqual([]);
});

test('polish: real healing crosses, self care, one repair wrench and construction activity stop on interruption and load',async({page})=>{
 const errors=await start(page);
 const state=await page.evaluate(()=>{
  const {game:g,renderer:r}=window.__reborn;g.units=[];
  const m=g.spawn(0,{x:1900,y:2100},'medic'),u=g.spawn(0,{x:1940,y:2110}),h=g.spawn(0,{x:1870,y:2130},'heavy');u.hp=20;h.hp=40;m.hp=50;
  const b={...g.bases[0],id:1350,x:2090,y:2120,kind:'barracks',hp:400,radius:53,queue:[],queueTypes:[],buildRemaining:0};g.bases.push(b);
  const w=g.spawn(0,{x:2180,y:2120},'engineer'),w2=g.spawn(0,{x:2090,y:2210},'engineer');
  g.explored[0].fill(1);let p;for(let y=2280;y<2500&&!p;y+=20)for(let x=1780;x<1980;x+=20)if(!g.buildError(0,'turret',{x,y})){p={x,y};break;}
  if(!p)throw Error('No construction site');const builder=g.spawn(0,{x:p.x+65,y:p.y},'engineer'),site=g.build(0,'turret',p,[builder.id]);if(!site)throw Error('Build failed');
  g.updateVision();r.camera={x:2040,y:2210,zoom:1.7};r.boundCamera();r.selected=new Set([m.id]);r.render(0);g.paused=false;g.step();r.render(.05);g.paused=true;window.__reborn.refresh();
  window.polishFixture={m:m.id,u:u.id,h:h.id,workers:[w.id,w2.id,builder.id],b:b.id,site:site.id};
  return {heals:g.workEffects.filter(e=>e.kind==='heal').map(e=>e.target),repairs:g.workEffects.filter(e=>e.kind==='repair').length,builds:g.workEffects.filter(e=>e.kind==='build').length,particles:r.units.particles.count,hp:[u.hp,h.hp,m.hp],remaining:site.buildRemaining};
 });
 expect(state.heals).toHaveLength(2);expect(state.repairs).toBe(1);expect(state.builds).toBe(1);expect(state.hp[0]).toBeGreaterThan(20);expect(state.hp[1]).toBeGreaterThan(40);expect(state.hp[2]).toBe(50);expect(state.particles).toBeGreaterThan(0);expect(state.remaining).toBeLessThan(10);
 await page.screenshot({path:'artifacts/reborn/polish-support.png'});
 const stopped=await page.evaluate(()=>{const {game:g,renderer:r}=window.__reborn,f=window.polishFixture;g.units.find(u=>u.id===f.u).hp=100;g.units.find(u=>u.id===f.h).hp=420;for(const id of f.workers)g.units.find(u=>u.id===id).defendUntil=g.time+5;g.paused=false;for(let i=0;i<12;i++){g.step();r.render(.05);}g.paused=true;return {effects:g.workEffects.map(e=>({kind:e.kind,target:e.target})),self:g.units.find(u=>u.id===f.m).hp,remaining:g.bases.find(b=>b.id===f.site).buildRemaining};});
 expect(stopped.effects).toEqual([{kind:'heal',target:await page.evaluate(()=>window.polishFixture.m)}]);expect(stopped.self).toBeGreaterThan(50);expect(stopped.remaining).toBe(state.remaining);
 await page.evaluate(async()=>{const a=window.__reborn;await a.save();await a.load();a.game.paused=true;a.renderer.render(0);});expect(await page.evaluate(()=>({events:window.__reborn.game.workEffects.length,shots:window.__reborn.game.shots.length,particles:window.__reborn.renderer.units.particles.count}))).toEqual({events:0,shots:0,particles:0});expect(errors).toEqual([]);
});
