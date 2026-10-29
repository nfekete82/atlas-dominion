import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,HEAL_RADIUS} from '../dist/src/reborn/simulation.js';
import {Particles} from '../dist/src/reborn/particles.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
const advance=(g,s,dt=.05)=>{for(let i=0;i<Math.round(s/dt);i++)g.step(dt);};
const game=()=>{const g=new Simulation();g.units=[];g.aiClock=-1e8;return g;};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

for(const kind of ['infantry','heavy','medic','engineer'])test(`polish: ${kind} authoritative rounds, total damage, cadence, pause and reload`,()=>{
 for(const dt of [.05,.1]){
  const g=game(),u=g.spawn(0,{x:1900,y:2100},kind),e=g.spawn(1,{x:1980,y:2100},'tank');e.cooldown=100;g.stop([e.id],true);g.command([u.id],{...e,kind:'attack',target:e.id});g.updateVision();
  const hp=e.hp,damage=kind==='heavy'?54:UNITS[kind].damage;g.step(dt);const rounds=kind==='infantry'||kind==='heavy'?3:1;
  near(hp-e.hp,damage/rounds);assert.equal(g.shots.length,1);assert.equal(g.shots[0].source,u.id);assert.equal(g.shots[0].weapon,kind==='infantry'?'rifle':kind==='heavy'?'heavy':'pistol');
  g.paused=true;advance(g,1,dt);assert.equal(g.shots.length,1);g.paused=false;
  advance(g,.3,dt);near(hp-e.hp,damage);assert.equal(g.shots.length,rounds);
  const times=g.shots.map(s=>s.at);assert.ok(times.every((t,i)=>!i||t>times[i-1]));
  advance(g,UNITS[kind].cooldown+.4-g.time,dt);near(hp-e.hp,2*damage);
 }
});

test('polish: pending burst survives save without replay, and a new wall interrupts its remaining damage',()=>{
 const g=game(),u=g.spawn(0,{x:1900,y:2100}),e=g.spawn(1,{x:2050,y:2100},'tank');e.cooldown=100;g.stop([u.id,e.id],true);
 // Hold is defensive-only: explicitly order the attacking unit before testing
 // pending burst serialization. The passive tank remains on hold.
 g.command([u.id],{x:e.x,y:e.y,kind:'attack',target:e.id});g.step();
 const loaded=Simulation.load(g.save());loaded.aiClock=-1e8;assert.equal(loaded.shots.length,0);assert.equal(loaded.workEffects.length,0);
 advance(g,.25);advance(loaded,.25);near(g.units.find(t=>t.id===e.id).hp,loaded.units.find(t=>t.id===e.id).hp);assert.equal(loaded.shots.length,2);
 u.cooldown=0;g.step();const hp=e.hp;g.world.blocked[g.world.index({x:1980,y:2100})]=1;g.world.opaque[g.world.index({x:1980,y:2100})]=1;advance(g,.3);near(e.hp,hp);assert.equal(u.burst,undefined);
 const invalid=g.save();invalid.units[0].burst={remaining:999,index:0,at:g.time,target:e.id};assert.throws(()=>Simulation.load(invalid));
});

test('polish: medic shares twelve HP/s across nearby infantry only, prioritizes urgent others over self, then self heals at three',()=>{
 assert.equal(HEAL_RADIUS,70);const g=game(),m=g.spawn(0,{x:1900,y:2100},'medic'),a=g.spawn(0,{x:1965,y:2100}),b=g.spawn(0,{x:1870,y:2140},'heavy'),tank=g.spawn(0,{x:1860,y:2070},'tank');
 const outside=g.spawn(0,{x:1980,y:2100});outside.hp=10;tank.hp=10;a.hp=10;b.hp=20;m.hp=40;
 advance(g,1);near(a.hp,16);near(b.hp,26);near(m.hp,40);near(tank.hp,10);near(outside.hp,10);
 assert.deepEqual(g.workEffects.filter(e=>e.kind==='heal').map(e=>e.target).sort(),[a.id,b.id].sort());
 a.hp=100;b.hp=UNITS.heavy.hp;advance(g,.5);near(m.hp,41.5);assert.ok(g.workEffects.some(e=>e.target===m.id));
 m.defendUntil=g.time+5;const hp=m.hp;advance(g,1);near(m.hp,hp);m.hp=0;advance(g,1);assert.equal(g.workEffects.length,0);
});

test('polish: real repair is deduplicated per recipient; work interruption stops gains and effects expire',()=>{
 const g=game(),b={...g.bases[0],id:1350,x:1900,y:2100,kind:'barracks',hp:700,radius:53,queue:[],queueTypes:[]};g.bases.push(b);
 const workers=[-1,1].map(sign=>g.spawn(0,{x:b.x+b.radius+32,y:b.y+sign*28},'engineer'));
 g.step();near(b.hp,701.2);assert.equal(g.workEffects.filter(e=>e.target===b.id).length,1);
 for(const w of workers)w.defendUntil=g.time+5;const hp=b.hp;advance(g,1);near(b.hp,hp);assert.equal(g.workEffects.length,0);
 b.hp=800;advance(g,6);assert.equal(g.workEffects.length,0);
});

test('polish: bounded recycled particles, short ballistic trail, actual arrival impacts, pause, disable and reduced motion',()=>{
 const p=new Particles(),from={x:0,y:0},to={x:500,y:0};p.shot(from,to,true,true);
 let segments=[];const ctx={save(){},restore(){},beginPath(){},moveTo(x,y){this.from={x,y};},lineTo(x,y){segments.push(Math.hypot(x-this.from.x,y-this.from.y));},stroke(){},arc(){},fill(){}};
 p.update(.1);p.draw(ctx,()=>true);assert.equal(segments.length,1);assert.ok(segments[0]<=12.001);assert.ok(p.items.some(i=>i.trace&&i.x>0&&i.x<500));
 const snapshot=structuredClone(p.items);p.update(0);assert.deepEqual(p.items,snapshot);
 p.update(.5);assert.ok(!p.items.some(i=>i.trace));assert.ok(p.items.some(i=>i.color==='#ffe6a0'));
 for(let i=0;i<200;i++)p.shot(from,to,true,true);assert.equal(p.count,p.limit);p.enabled=false;p.update(.1);assert.equal(p.count,0);
 p.enabled=true;p.reducedMotion=true;p.shot(from,to);assert.equal(p.count,1);assert.ok(!p.items.some(i=>i.trace));
});
