import {addProducer} from './fixtures/reborn-production.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,BUILDINGS} from '../dist/src/reborn/catalog.js';
import {RULES,distance} from '../dist/src/reborn/config.js';

const advance=(g,seconds,dt=RULES.tick)=>{for(let i=0;i<Math.round(seconds/dt);i++)g.step(dt);};
const peaceful=()=>{const g=new Simulation();g.aiClock=-1e8;g.credits[0]=5000;return g;};
const point=(target,kind)=>({x:target.x,y:target.y,kind,target:target.id});
const site=(g,kind)=>{
 for(let y=2100;y<3450;y+=28)for(let x=220;x<1750;x+=28)if(!g.buildError(0,kind,{x,y}))return {x,y};
 throw Error('No legal site');
};
const workerAt=(g,p,kind='barracks')=>g.spawn(0,g.world.nearest({x:p.x+BUILDINGS[kind].radius+32,y:p.y},g.obstacles()),'engineer');
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);

test('support: exact catalog values and medic production price/time at the barracks',()=>{
 const g=peaceful(),hq=addProducer(g,'barracks'),before=g.credits[0];
 assert.equal(UNITS.medic.hp,100);assert.equal(UNITS.medic.cost,175);assert.equal(UNITS.medic.buildTime,8);
 assert.equal(UNITS.engineer.name,'Ingenieur');assert.equal(UNITS.engineer.cost,200);assert.equal(UNITS.engineer.hp,110);
 assert.ok(g.recruit(hq.id,'medic'));assert.equal(g.credits[0],before-175);advance(g,7.95);assert.ok(!g.units.some(u=>u.kind==='medic'));
 advance(g,.05);assert.equal(g.units.filter(u=>u.kind==='medic').length,1);assert.equal(g.credits[0],before-175);
});

test('support: medic approaches infantry, heals at 12 HP/s, caps HP and rejects vehicles, buildings, dead and enemy units',()=>{
 const g=peaceful(),m=g.spawn(0,{x:1900,y:2100},'medic'),soldier=g.spawn(0,{x:2100,y:2100});soldier.hp=20;
 const tank=g.spawn(0,{x:1900,y:2200},'tank');tank.hp=100;
 const dead=g.spawn(0,{x:1940,y:2100});dead.hp=0;
 const enemy=g.units.find(u=>u.owner===1);enemy.hp=20;
 for(const target of [tank,g.bases[0],dead,enemy])assert.equal(g.command([m.id],point(target,'heal')),0);
 assert.equal(g.command([m.id],point(soldier,'heal')),1);advance(g,.5);assert.equal(soldier.hp,20);assert.ok(m.x>1900);
 advance(g,2);assert.ok(soldier.hp>20);assert.ok(distance(m,soldier)<=70);const hp=soldier.hp;
 advance(g,1);near(soldier.hp,hp+12);advance(g,10);assert.equal(soldier.hp,100);assert.equal(tank.hp,100);
});

test('support: idle medics prioritize relative health, heal other medics and never auto-pursue',()=>{
 const g=peaceful(),m=g.spawn(0,{x:1900,y:2100},'medic'),heavy=g.spawn(0,{x:1935,y:2100},'heavy'),other=g.spawn(0,{x:1865,y:2100},'medic');
 heavy.hp=60;other.hp=70;other.defendUntil=1e8;other.orders=[{x:1865,y:2100,kind:'move'}];g.step();near(heavy.hp,60+.4);near(other.hp,70+.2);
 heavy.hp=UNITS.heavy.hp;g.step();near(other.hp,70+.8);
 Object.assign(other,{x:2100,y:2100});const before={x:m.x,y:m.y},hp=other.hp;advance(g,1);assert.deepEqual({x:m.x,y:m.y},before);near(other.hp,hp);
});

test('support: worker repairs only buildings after arrival, once at 12 HP/s, for free; incoming attacks interrupt work',()=>{
 const g=peaceful(),p=site(g,'barracks'),w=workerAt(g,p),b=g.build(0,'barracks',p,[w.id]);advance(g,12.1);assert.equal(b.buildRemaining,0);
 b.hp=400;Object.assign(w,g.world.nearest({x:b.x+b.radius+200,y:b.y},g.obstacles()));g.stop([w.id]);
 const credits=g.credits[0];assert.equal(g.command([w.id],point(b,'repair')),1);advance(g,.5);assert.equal(b.hp,400);advance(g,2);assert.ok(b.hp>400);
 const hp=b.hp;advance(g,1);near(b.hp,hp+12);assert.equal(g.credits[0],credits);
 w.lastAttacker=99999;w.defendUntil=g.time+2;const interrupted=b.hp;advance(g,1);near(b.hp,interrupted);advance(g,2);assert.ok(b.hp>interrupted);
 advance(g,40);assert.equal(b.hp,800);assert.equal(g.command([w.id],point(g.units[0],'heal')),0);
});

for(const kind of ['turret','barracks'])test(`support: ${kind} needs a living nearby assigned worker; death pauses and another worker resumes`,()=>{
 const g=peaceful();g.units=g.units.filter(u=>u.owner!==0||u.kind!=='engineer');const p=site(g,kind),credits=g.credits[0];assert.equal(g.build(0,kind,p),null);assert.equal(g.credits[0],credits);
 const w=g.spawn(0,g.world.nearest({x:p.x+BUILDINGS[kind].radius+250,y:p.y},g.obstacles()),'engineer');
 const b=g.build(0,kind,p,[w.id]);assert.ok(b);assert.equal(g.credits[0],credits-BUILDINGS[kind].cost);
 assert.equal(g.build(0,kind,p,[w.id]),null);assert.equal(g.credits[0],credits-BUILDINGS[kind].cost);
 advance(g,.5);assert.equal(b.buildRemaining,BUILDINGS[kind].buildTime);advance(g,4);assert.ok(b.buildRemaining<BUILDINGS[kind].buildTime);
 w.hp=0;g.step();const remaining=b.buildRemaining;advance(g,2);assert.equal(b.buildRemaining,remaining);assert.equal(b.constructionActive,false);
 const replacement=workerAt(g,p,kind);assert.equal(g.command([replacement.id],point(b,'build')),1);
 g.paused=true;advance(g,2);assert.equal(b.buildRemaining,remaining);g.paused=false;advance(g,remaining+.1);assert.equal(b.buildRemaining,0);near(b.hp,BUILDINGS[kind].hp);
 if(kind==='barracks'){
  b.rally=g.world.nearest({x:b.x+180,y:b.y+150},g.obstacles());const before=g.credits[0];assert.ok(g.recruit(b.id,'medic'));assert.equal(g.credits[0],before-175);
  advance(g,8);const medic=g.units.find(u=>u.kind==='medic');assert.ok(medic);assert.ok(distance(medic,b)<220);assert.equal(medic.orders[0].kind,'attackMove');assert.equal(b.queue.length,0);
 }
});

test('support: shared construction has a 1.5x cap; stopping/cancelling pauses and refunds exactly once',()=>{
 const g=peaceful(),p=site(g,'barracks'),workers=Array.from({length:5},()=>workerAt(g,p)),b=g.build(0,'barracks',p,workers.map(w=>w.id));
 g.step();near(b.buildRemaining,12-.05*1.5);const remain=b.buildRemaining;
 g.stop(workers.map(w=>w.id));advance(g,1);near(b.buildRemaining,remain);
 const credits=g.credits[0];assert.equal(g.cancelConstruction(b.id),true);assert.equal(g.credits[0],credits+150);assert.equal(g.cancelConstruction(b.id),false);assert.equal(g.credits[0],credits+150);
 assert.equal(g.buildError(0,'barracks',p),null);
});

test('support: pending heal, repair, construction, hold and paid queues survive save/load without duplicate credits',()=>{
 const g=peaceful(),p=site(g,'barracks'),w=workerAt(g,p),b=g.build(0,'barracks',p,[w.id]);
 const m=g.spawn(0,{x:1900,y:2100},'medic'),s=g.spawn(0,{x:1940,y:2100});s.hp=10;g.command([m.id],point(s,'heal'));
 const repair=g.spawn(0,g.world.nearest({x:g.bases[0].x+200,y:g.bases[0].y},g.obstacles()),'engineer');g.bases[0].hp-=200;g.command([repair.id],point(g.bases[0],'repair'));
 const held=g.spawn(0,{x:2100,y:2200},'engineer');g.stop([held.id],true);g.recruit(g.bases[0].id,'engineer');advance(g,1);
 const loaded=Simulation.load(g.save());loaded.aiClock=-1e8;assert.equal(loaded.units.find(u=>u.id===held.id).hold,true);
 for(const u of [m,w,repair])assert.deepEqual(loaded.units.find(v=>v.id===u.id).orders,u.orders);
 assert.deepEqual(loaded.credits,g.credits);advance(g,2);advance(loaded,2);
 near(loaded.bases.find(v=>v.id===b.id).buildRemaining,b.buildRemaining);near(loaded.units.find(v=>v.id===s.id).hp,s.hp);assert.deepEqual(loaded.credits,g.credits);
 const old=g.save();delete old.supportVersion;delete old.bases[0].queueCosts;old.bases[0].queue=[7];old.bases[0].queueTypes=['engineer'];old.bases[0].production=0;
 const legacy=Simulation.load(old),credits=legacy.credits[0];legacy.cancel(old.bases[0].id);assert.equal(legacy.credits[0],credits+150);
});

for(const kind of ['medic','engineer'])test(`support: ${kind} does not proactively attack or chase, but defends and obeys explicit attack`,()=>{
 const g=peaceful(),u=g.spawn(0,{x:1900,y:2100},kind),enemy=g.spawn(1,{x:1980,y:2100});enemy.cooldown=100;g.updateVision();advance(g,1);
 assert.equal(enemy.hp,100);near(u.x,1900);enemy.cooldown=0;g.step();assert.equal(u.lastAttacker,enemy.id);g.step();assert.equal(enemy.hp,96);
 Object.assign(enemy,{x:2150,y:2100});advance(g,1);near(u.x,1900);
 g.command([u.id],point(enemy,'attack'));advance(g,2);assert.ok(u.x>1900);assert.ok(enemy.hp<96);
});

test('support: healing takes priority over pistol defence, and equal simulated time has equal healing at .05/.1 ticks',()=>{
 for(const dt of [.05,.1]){
  const g=peaceful(),m=g.spawn(0,{x:1900,y:2100},'medic'),s=g.spawn(0,{x:1940,y:2100}),enemy=g.spawn(1,{x:1820,y:2100});
  enemy.cooldown=100;s.hp=10;s.cooldown=100;m.lastAttacker=enemy.id;m.defendUntil=g.time+5;g.command([m.id],point(s,'heal'));advance(g,2,dt);near(s.hp,34);assert.equal(enemy.hp,100);
 }
});

for(const kind of ['medic','engineer'])test(`support: ${kind} also identifies and returns direct turret fire`,()=>{
 const g=peaceful(),u=g.spawn(0,{x:1900,y:2100},kind),tower={...g.bases[1],id:1020,x:1980,y:2100,kind:'turret',radius:30,hp:650,queue:[],queueTypes:[],cooldown:0};
 g.bases.push(tower);g.updateVision();for(let i=0;i<25&&u.lastAttacker!==tower.id;i++)g.step();assert.equal(u.lastAttacker,tower.id);near(u.hp,UNITS[kind].hp-6);g.step();near(tower.hp,646);
});

test('support: engineers share an 18 HP/s area budget between wounded ground vehicles and aircraft',()=>{
 const g=peaceful();g.units=[];const e=g.spawn(0,{x:1900,y:2100},'engineer');
 const tank=g.spawn(0,{x:1940,y:2100},'tank'),heli=g.spawn(0,{x:1870,y:2120},'gunship');
 const farther=g.spawn(0,{x:2150,y:2100},'rover'),enemy=g.spawn(1,{x:1930,y:2110},'tank');
 for(const u of [tank,heli,farther,enemy]){u.hp=100;u.cooldown=1e8;}
 e.cooldown=1e8;advance(g,1);
 near(tank.hp+heli.hp,218);
 near(farther.hp,100);near(enemy.hp,100);
 assert.ok(g.workEffects.some(effect=>effect.kind==='repair'&&effect.target===tank.id));
 assert.ok(g.workEffects.some(effect=>effect.kind==='repair'&&effect.target===heli.id));
 assert.deepEqual(e.orders,[],'idle engineer stays put instead of chasing');
 near(e.x,1900);
 const saved=Simulation.load(g.save());assert.equal(saved.units.find(u=>u.id===tank.id).hp,tank.hp);
 const closeFlight=saved.units.find(u=>u.id===heli.id);closeFlight.hp=30;
 const engineer=saved.units.find(u=>u.id===e.id);saved.aiClock=-1e8;
 assert.equal(saved.command([engineer.id],point(closeFlight,'repair')),1,'explicit aircraft repair order accepted');
 advance(saved,1);
 assert.ok(closeFlight.hp>30,'aircraft receives repairs');
});
test('support: engineers reject hostile aircraft, infantry and full-health vehicles',()=>{
 const g=peaceful(),e=g.units.find(u=>u.owner===0&&u.kind==='engineer');
 const enemy=g.spawn(1,{x:1980,y:2100},'gunship'),full=g.spawn(0,{x:2010,y:2100},'tank'),soldier=g.spawn(0,{x:2050,y:2100},'infantry');
 assert.equal(g.command([e.id],point(enemy,'repair')),0);
 assert.equal(g.command([e.id],point(full,'repair')),0);
 soldier.hp-=20;assert.equal(g.command([e.id],point(soldier,'repair')),0);
});
