import {addProducer} from './fixtures/reborn-production.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {SpriteAnimator,directionIndex,turnTowards} from '../dist/src/reborn/sprite-animator.js';
import {Particles} from '../dist/src/reborn/particles.js';import {Simulation} from '../dist/src/reborn/simulation.js';
import {unitAtlasPath} from '../dist/src/reborn/asset-paths.js';
const read=(kind,team=0)=>JSON.parse(fs.readFileSync(new URL('..'+unitAtlasPath(kind,team)+'.json',import.meta.url)));
const intent=(extra={})=>({moving:false,distance:0,angle:0,attack:false,hit:false,dead:false,...extra});
test('animation: every unit atlas has distinct blue and red faction pixels',()=>{
 for(const kind of ['infantry','medic','engineer','heavy','rover','tank','artillery','scout','gunship','bomber']){
  const png=team=>fs.readFileSync(new URL('..'+unitAtlasPath(kind,team)+'.png',import.meta.url));
  assert.equal(png(0).equals(png(1)),false,kind+' reused the first faction shader');
 }
});
test('animation: infantry roles retain eight directions, moving frames and truthful rig metadata',()=>{
 for(const kind of ['infantry','medic','engineer','heavy'])for(const team of [0,1]){const a=read(kind,team);assert.equal(a.directions,8);assert.ok(a.design.version===2||(kind==='infantry'&&a.design.version===3));assert.ok(Number.isInteger(a.design.parts)&&a.design.parts>0);if(a.design.version===2)assert.ok(a.design.maxGripError<.002);else {assert.equal(a.design.rig,'No skeletal rig; static model with five root motion preview clips');assert.equal(a.timeBasedLocomotion,false);}for(const tag of ['idle','walk','attack','hit','death']){const clip=a.clips[tag];assert.ok(clip.sourceClip);assert.equal(clip.frames.length,8);assert.ok(clip.uniquePhases.every(n=>n>1),kind+' '+tag);for(const row of clip.frames)for(const index of row){const frame=a.frames[index];assert.deepEqual(frame.pivot,[96,156]);assert.ok(frame.x+frame.w<=3072);assert.ok(frame.muzzle.every(Number.isFinite));}}assert.ok(a.clips.walk.frames.every(row=>row.length===8));}
});
test('animation: walk uses distance and state clocks give identical results at 20 and 60 FPS',()=>{
 const data=read('infantry'),a=new SpriteAnimator(data),b=new SpriteAnimator(data);a.update(0,intent());b.update(0,intent());
 for(let i=1;i<=20;i++)a.update(1/20,intent({moving:true,distance:i*2}));for(let i=1;i<=60;i++)b.update(1/60,intent({moving:true,distance:i*2/3}));
 assert.deepEqual(a.frame(),b.frame());const frame=a.frame();for(let i=0;i<30;i++)a.update(.05,intent({moving:true,distance:40}));assert.deepEqual(a.frame(),frame);
 assert.equal(directionIndex(-Math.PI/2,8),6);assert.equal(directionIndex(Math.PI*2,8),0);
});
test('animation: shots finish through incoming hits; flinches yield to fire and death remains terminal',()=>{
 const a=new SpriteAnimator(read('infantry'));a.update(0,intent({attack:true}));assert.equal(a.state,'attack');a.update(.1,intent({moving:true}));assert.equal(a.state,'attack');
 const age=a.age;a.update(.01,intent({hit:true}));assert.equal(a.state,'attack');assert.ok(a.age>age);
 a.update(.6,intent());a.update(.01,intent({hit:true}));assert.equal(a.state,'hit');
 a.update(.01,intent({attack:true,hit:true}));assert.equal(a.state,'attack');
 a.update(.6,intent());a.update(.01,intent({moving:true,distance:8}));assert.equal(a.state,'walk');
 a.update(0,intent({dead:true}));a.update(2,intent({moving:true,attack:true}));assert.equal(a.state,'death');assert.equal(a.finished,true);const frame=a.frame();a.update(5,intent());assert.deepEqual(a.frame(),frame);
});
test('animation: sustained hits cannot lock a soldier in a flinch or hide simultaneous return fire',()=>{
 const a=new SpriteAnimator(read('infantry'));a.update(0,intent({attack:true,hit:true}));assert.equal(a.state,'attack');
 for(let i=0;i<20;i++){a.update(.02,intent({hit:i%2===0}));if(i<17)assert.equal(a.state,'attack');}
 a.update(.01,intent());a.update(.01,intent({hit:true}));assert.equal(a.state,'hit');
 for(let i=0;i<24;i++)a.update(.02,intent({hit:i%2===0}));
 assert.notEqual(a.state,'hit');
 a.update(0,intent({attack:true,hit:true,dead:true}));assert.equal(a.state,'death');
});
test('animation: repeated hits recover and a later clean hit is animated again',()=>{
 const a=new SpriteAnimator(read('infantry'));
 a.update(0,intent({hit:true}));assert.equal(a.state,'hit');
 for(let i=0;i<24;i++)a.update(.02,intent({hit:i%2===0}));
 assert.notEqual(a.state,'hit','repeated damage must not keep the soldier flinching indefinitely');
 for(let i=0;i<24;i++)a.update(.02,intent());
 assert.equal(a.state,'idle');
 a.update(0,intent({hit:true}));assert.equal(a.state,'hit','a genuine later hit can still trigger an animation');
});
test('animation: vehicles use real chassis views and separated turret/barrel frames where the source provides them',()=>{
 for(const k of ['rover','tank','artillery','scout','gunship','bomber']){const a=read(k);assert.equal(a.directions,16);assert.equal(a.clips.idle.frames.length,16);if(['tank','artillery'].includes(k)){assert.equal(a.clips.turret.frames.length,16);assert.equal(a.clips.barrel.frames.length,16);assert.ok(a.clips.walk.uniquePhases.every(n=>n>1));}if(k==='bomber'){
   assert.equal(a.rotor,true,'the new bomber has animated propellers');
   assert.equal(a.timeBasedLocomotion,true,'propellers must rotate even when stationary');
   for(const tag of ['idle','walk']){
    const clip=a.clips[tag];
    assert.equal(clip.sourceClip,'Propellers_Continuous');
    assert.ok(clip.frames.every(row=>row.length===8),tag+' needs eight propeller phases per direction');
    assert.ok(clip.uniquePhases.some(n=>n>1),tag+' must visibly animate');
   }
  }if(k==='scout'||k==='gunship')assert.equal(a.rotor,true);}
});
test('animation: all vehicle and aircraft faction atlases have real 2x source detail',()=>{
 for(const kind of ['rover','tank','artillery','scout','gunship','bomber'])for(const team of [0,1]){
  const asset=read(kind,team);
  assert.deepEqual(asset.cell,[192,192],kind+' '+team);
  assert.equal(asset.renderResolution,192);
  assert.ok(asset.nativeScale>0&&asset.nativeScale<1);
  assert.equal(asset.model,kind+'-'+team+'.glb');
  for(const frame of asset.frames){
   assert.equal(frame.w,192);assert.equal(frame.h,192);
   assert.deepEqual(frame.pivot,[96,156]);
  }
  const png=fs.readFileSync(new URL('..'+unitAtlasPath(kind,team)+'.png',import.meta.url));
  assert.equal(png.readUInt32BE(16),3072,'packed atlas must have real 192px columns');
  assert.ok(png.readUInt32BE(20)>=384);
 }
});

test('animation: bounded particles clear when disabled and turning always takes the shortest bounded angular step',()=>{
 const p=new Particles();for(let i=0;i<100;i++)p.emit('explosion',{x:0,y:0});assert.equal(p.count,240);p.update(3);assert.equal(p.count,0);p.enabled=false;p.emit('dust',{x:0,y:0});assert.equal(p.count,0);
 assert.ok(Math.abs(turnTowards(0,Math.PI,2,.05))<=.1);assert.ok(turnTowards(Math.PI-.05,-Math.PI+.05,2,.1)>Math.PI-.05);
});
test('animation: vehicle acceleration, braking and hull turn rate are bounded and old saves remain usable',()=>{
 const g=new Simulation();g.units=[];g.aiClock=-1e8;const p=g.world.nearest({x:1900,y:2100},g.obstacles(),[],undefined,12);const u=g.spawn(0,p,'tank');u.angle=0;u.hullAngle=0;
 g.command([u.id],{x:p.x+220,y:p.y,kind:'move'});g.step();assert.ok(u.driveSpeed>0&&u.driveSpeed<86);assert.ok(u.x-p.x<86*.05);const first=u.driveSpeed;for(let i=0;i<12;i++)g.step();assert.ok(u.driveSpeed>first&&u.driveSpeed<=86);
 const restored=Simulation.load(g.save());assert.equal(restored.units[0].driveSpeed,u.driveSpeed);assert.equal(restored.units[0].hullAngle,u.hullAngle);
 g.command([u.id],{x:u.x,y:u.y-180,kind:'move'});const angle=u.hullAngle;g.step();assert.ok(Math.abs(u.hullAngle-angle)<=2.5*.05+.00001);
 const old=g.save();delete old.units[0].hullAngle;delete old.units[0].driveSpeed;assert.equal(Simulation.load(old).units[0].kind,'tank');const broken=g.save();broken.units[0].driveSpeed=-1;assert.throws(()=>Simulation.load(broken));
});

test('animation: slow-start vehicles still pass the narrow headquarters exit without cutting a blocked corner',()=>{
 const g=new Simulation();g.aiClock=-1e8;g.credits[0]=5000;
 const factory=addProducer(g,'factory'),airfield=addProducer(g,'airfield');
 for(const kind of ['rover','tank','artillery','scout','gunship','bomber'])assert.equal(g.recruit(['rover','tank','artillery'].includes(kind)?factory.id:airfield.id,kind),true);
 for(let i=0;i<2000;i++)g.step();const army=g.units.filter(u=>['rover','tank','artillery'].includes(u.kind)),before=army.map(u=>({...u}));
 g.command(army.map(u=>u.id),{...g.territories[20].point,kind:'move'});for(let i=0;i<280;i++)g.step();
 army.forEach((u,i)=>{assert.ok(Math.hypot(u.x-before[i].x,u.y-before[i].y)>100,u.kind+' stalled at exit');assert.ok(g.world.walkable(u,g.obstacles(),u.kind==='tank'?12:u.kind==='artillery'?10:6));});
});
