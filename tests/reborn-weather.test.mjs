import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Weather} from '../dist/src/reborn/weather.js';
import {WEATHER_RULES,distance} from '../dist/src/reborn/config.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const fixture=()=>{const g=new Simulation();g.aiClock=-1e8;g.units=[];g.world.blocked.fill(0);g.world.opaque.fill(0);return g;};
const stormTime=seed=>{const w=new Weather(seed);return w.endsAt+WEATHER_RULES.warning;};
const storm=g=>{g.time=stormTime(g.seed);g.weather.update(g.time);g.updateVision();};
test('weather: deterministic seeded warning/storm/recovery/calm sequence, bounded durations and nonpermanent storms',()=>{
 const a=new Weather(72),b=new Weather(72),c=new Weather(73);assert.notEqual(a.endsAt,c.endsAt);assert.ok(a.endsAt>=180&&a.endsAt<=260);
 for(let cycle=0;cycle<10;cycle++){
  const warning=a.endsAt;assert.deepEqual(a.update(warning),['WARNING']);b.update(warning);assert.equal(a.endsAt-warning,12);
  const start=a.endsAt;a.update(start);b.update(start);assert.equal(a.phase,'SANDSTORM');assert.ok(a.remaining>=8&&a.remaining<=10);near(a.intensity,.08);
  a.update(start+2);assert.equal(a.intensity,1);b.update(start+2);assert.deepEqual(a,b);
  const end=a.endsAt;a.update(end);b.update(end);assert.equal(a.phase,'RECOVERY');assert.equal(a.intensity,1);assert.equal(a.storm,false);
  a.update(a.endsAt);b.update(b.endsAt);assert.equal(a.phase,'CLEAR');assert.equal(a.intensity,0);assert.ok(a.remaining>=150&&a.remaining<=240);assert.deepEqual(a,b);
 }
 const replay=new Weather(72);replay.update(a.startedAt);assert.deepEqual(replay,a);
});
test('weather: real fixed ticks emit each radio warning once, pause freezes weather and XP',()=>{
 const g=fixture();g.time=g.weather.endsAt-.05;g.step();assert.deepEqual(g.notices,['ACHTUNG: Sandsturm nähert sich!']);g.notices=[];const end=g.weather.endsAt;g.paused=true;g.step();assert.equal(g.weather.endsAt,end);assert.equal(g.weather.phase,'WARNING');g.paused=false;
 for(let i=0;i<240;i++)g.step();assert.equal(g.weather.phase,'SANDSTORM');assert.deepEqual(g.notices,['SANDSTURM – Sichtweite reduziert!']);g.notices=[];g.time=g.weather.endsAt-.05;g.step();assert.equal(g.weather.phase,'RECOVERY');assert.deepEqual(g.notices,['Sichtbedingungen normalisiert.']);
});
for(const owner of [0,1])test(`weather: faction ${owner} vision shrinks by 77%, invalidates stationary masks and direct target fallback; fog never reveals hidden enemy`,()=>{
 const g=fixture(),u=g.spawn(owner,{x:1900,y:1900}),enemy=g.spawn(1-owner,{x:2150,y:1900});enemy.cooldown=1e8;u.hold=true;g.updateVision();g.updateVision();g.updateVision();assert.equal(g.canSee(owner,enemy),true);near(g.sight(u),310);
 const start=stormTime(g.seed);g.time=start-.05;g.weather.update(g.time);g.step();near(g.sight(u),310*.23);assert.equal(g.canSee(owner,enemy),false);assert.equal(g.acquire(u),undefined);
 assert.equal(g.visible[owner][g.world.index(enemy)],0);assert.equal(g.hasExplored(owner,enemy),true,'explored terrain is remembered, not currently visible');
 const end=g.weather.endsAt;g.time=end-.05;g.step();near(g.sight(u),310);assert.equal(g.canSee(owner,enemy),true);
});
test('weather: an enemy at weapon range but outside reduced sight cannot be attacked by explicit target or lock',()=>{
 const g=fixture(),u=g.spawn(1,{x:1900,y:1900},'tank'),enemy=g.spawn(0,{x:2140,y:1900});u.hold=true;enemy.cooldown=1e8;storm(g);g.command([u.id],{...enemy,kind:'attack',target:enemy.id});g.step();assert.equal(enemy.hp,100);assert.equal(u.combatTarget,null);assert.equal(g.canSee(1,enemy),false);
});
test('weather: aircraft retain sight and fly at exactly 80% speed, retreats still travel and ground movement is unchanged',()=>{
 for(const kind of ['infantry','tank','scout','bomber']){
  const a=fixture(),b=fixture();const us=[a,b].map(g=>{const u=g.spawn(0,{x:1900,y:1900},kind);g.command([u.id],{kind:'move',x:2300,y:1900});u.hullAngle=0;u.driveSpeed=UNITS[kind].speed;return u;});storm(b);a.step();b.step();
  near(distance(us[1],{x:1900,y:1900})/distance(us[0],{x:1900,y:1900}),UNITS[kind].flying?.8:1);near(b.sight(us[1]),UNITS[kind].sight*(UNITS[kind].flying?1:.23));
  if(UNITS[kind].flying){b.command([us[1].id],{kind:'move',x:1500,y:1900});const before=us[1].x;for(let i=0;i<40;i++)b.step();assert.ok(us[1].x<before-10);assert.ok(us[1].hp>0);}
 }
});
test('weather: artillery dispersion is small, deterministic, projectile-specific and preserved in flight saves',()=>{
 const a=fixture(),b=fixture();for(const g of [a,b]){storm(g);const u=g.spawn(0,{x:1900,y:2100},'artillery'),t=g.spawn(1,{x:2400,y:2100},'tank');u.xp=500;g.launch(u,t);const m=g.missiles[0];assert.ok(distance(m.to,t)>0&&distance(m.to,t)<=18);near(m.damage,126);const saved=Simulation.load(g.save());assert.deepEqual(saved.missiles,g.missiles);assert.equal(saved.weather.phase,'SANDSTORM');}
 assert.deepEqual(a.missiles,b.missiles);assert.notDeepEqual(a.weather.artilleryOffset(1,2),a.weather.artilleryOffset(2,2));const clear=new Weather(2026);assert.deepEqual(clear.artilleryOffset(1,2),{x:0,y:0});
});
test('weather: save/load before, during and after storm restores phase, schedule and exact vision with no duplicate messages',()=>{
 for(const phase of ['CLEAR','WARNING','SANDSTORM','RECOVERY']){
  const g=fixture();g.spawn(0,{x:1900,y:1900});while(g.weather.phase!==phase){g.time=g.weather.endsAt;g.weather.update(g.time);}g.updateVision();const loaded=Simulation.load(g.save());loaded.world.blocked.fill(0);loaded.world.opaque.fill(0);loaded.updateVision();assert.deepEqual(loaded.weather,g.weather);assert.deepEqual(loaded.visible,g.visible);assert.deepEqual(loaded.notices,[]);g.step();loaded.step();assert.deepEqual(loaded.weather,g.weather);
 }
 const g=new Simulation(),s=g.save();delete s.weatherVersion;for(const u of s.units)delete u.xp;assert.equal(Simulation.load(s).weather.phase,'CLEAR');
});
test('weather: AI planning ignores hidden live enemies and preserves authoritative retreat orders during storms',()=>{
 const a=new Simulation(2026,4),b=new Simulation(2026,4);for(const g of [a,b]){storm(g);g.credits[1]=1000;g.aiClock=3;}
 const hidden=b.units.find(u=>u.owner===0);hidden.kind='tank';hidden.hp=UNITS.tank.hp;hidden.x=100;hidden.y=2800;b.updateVision();assert.equal(b.canSee(1,hidden),false);a.step();b.step();assert.deepEqual(a.tactical.state,b.tactical.state);
 const u=b.units.find(u=>u.owner===1);b.command([u.id],{kind:'move',x:u.x-100,y:u.y});const before={...u};b.step();assert.equal(u.orders[0]?.kind,'move');assert.ok(distance(u,before)>0);
});
test('weather: combat and in-flight rocket replay retain exact HP, XP and ranks through a storm save/load',()=>{
 const g=fixture();storm(g);const u=g.spawn(0,{x:1900,y:2100},'artillery'),t=g.spawn(1,{x:2050,y:2100},'tank');u.xp=500;u.hold=t.hold=true;t.cooldown=1e8;g.command([u.id],{kind:'attack',x:t.x,y:t.y,target:t.id});g.updateVision();g.step();assert.ok(g.missiles.length);
 const loaded=Simulation.load(g.save());loaded.aiClock=-1e8;loaded.world.blocked.fill(0);loaded.world.opaque.fill(0);
 for(let i=0;i<120;i++){g.step();loaded.step();}
 assert.deepEqual(loaded.units.map(u=>({id:u.id,hp:u.hp,xp:u.xp})),g.units.map(u=>({id:u.id,hp:u.hp,xp:u.xp})));assert.deepEqual(loaded.missiles,g.missiles);assert.deepEqual(loaded.weather,g.weather);assert.ok(g.units.every(u=>Number.isFinite(u.hp)&&u.hp>0));
});
test('weather: real transport boarding and unloading preserve passenger XP during a storm',()=>{
 const g=fixture();storm(g);const h=g.spawn(0,{x:1900,y:2100},'scout'),u=g.spawn(0,{x:1940,y:2135});u.xp=333.5;assert.equal(g.transports.board(h.id,[u.id]),1);
 for(let i=0;i<240&&!u.carrier;i++)g.step();assert.equal(u.carrier,h.id);assert.equal(u.xp,333.5);assert.ok(g.transports.unload(h.id,{x:2000,y:2100}));
 for(let i=0;i<400&&u.carrier;i++)g.step();assert.equal(u.carrier,undefined);assert.equal(u.xp,333.5);assert.ok(h.hp>0);
});
