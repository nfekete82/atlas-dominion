import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';
import {RULES,distance} from '../dist/src/reborn/config.js';
import {inside} from '../dist/src/reborn/world.js';
import {angleDifference} from '../dist/src/reborn/sprite-animator.js';
import {turretPivot,turretMuzzles} from '../dist/src/reborn/turret.js';
const advance=(g,s,dt=.05)=>{for(let i=0;i<Math.round(s/dt);i++)g.step(dt);};
const peaceful=()=>{const g=new Simulation();g.aiClock=-1e8;g.credits=[10000,10000];return g;};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const tower=(g,owner,p={x:1900,y:2100})=>{const b={...g.bases[owner],...p,id:1100+owner,kind:'turret',hp:650,radius:30,queue:[],queueTypes:[],turretAngle:Math.PI};g.bases.push(b);return b;};
const buildSite=(g,territory,kind='barracks')=>{
 for(let y=150;y<3600;y+=30)for(let x=150;x<3600;x+=30){const p={x,y};if(inside(p,territory.polygon)&&g.territories.every(t=>distance(t.point,p)>250)&&!g.buildError(0,kind,p))return p;}
 throw Error('No build site in '+territory.id);
};

for(const owner of [0,1])test(`overhaul: turret ${owner} turns at 180 degrees/s, holds fire until aligned, alternates four registered muzzle shots and persists`,()=>{
 const g=peaceful();g.units=[];const b=tower(g,owner),enemy=g.spawn(1-owner,{x:2080,y:2100});enemy.cooldown=100;g.stop([enemy.id],true);g.updateVision();
 g.step();near(Math.abs(angleDifference(Math.PI,b.turretAngle)),Math.PI*.05);assert.equal(enemy.hp,100);assert.equal(g.shots.length,0);
 for(let i=0;i<30&&!g.shots.length;i++)g.step();assert.equal(enemy.hp,94);advance(g,.25);assert.equal(enemy.hp,76);assert.equal(g.shots.length,4);assert.deepEqual(g.shots.map(s=>s.barrel),[0,1,0,1]);for(const shot of g.shots)assert.deepEqual(shot.from,turretMuzzles(b,b.turretAngle)[shot.barrel]);
 const pivot=turretPivot(b),average={x:(g.shots[0].from.x+g.shots[1].from.x)/2,y:(g.shots[0].from.y+g.shots[1].from.y)/2};
 assert.ok(Math.abs(angleDifference(Math.atan2(average.y-pivot.y,average.x-pivot.x),b.turretAngle))<Math.PI/64+.0001);
 const x=b.x,y=b.y,angle=b.turretAngle;g.paused=true;advance(g,1);near(b.turretAngle,angle);near(b.x,x);near(b.y,y);g.paused=false;
 const restored=Simulation.load(g.save()),loaded=restored.bases.find(v=>v.id===b.id);near(loaded.turretAngle,b.turretAngle);assert.equal(loaded.turretTarget,enemy.id);
 Object.assign(enemy,{x:1900,y:2280});advance(g,.05);assert.ok(Math.abs(angleDifference(angle,b.turretAngle))<=Math.PI*.05+1e-9);
 g.units=[];const before=b.turretAngle;g.step();near(b.turretAngle-before,.14*.05);
 const old=g.save();for(const base of old.bases){delete base.turretAngle;delete base.previousTurretAngle;delete base.turretTarget;}assert.doesNotThrow(()=>Simulation.load(old));
});

test('overhaul: rock blocks turret acquisition and damage even with exploration',()=>{
 const g=peaceful();g.units=[];const b=tower(g,0),enemy=g.spawn(1,{x:2080,y:2100});enemy.cooldown=100;g.stop([enemy.id],true);g.world.blocked[g.world.index({x:1980,y:2100})]=1;g.world.opaque[g.world.index({x:1980,y:2100})]=1;g.updateVision();advance(g,2);assert.equal(enemy.hp,100);assert.equal(b.turretTarget,null);
});

for(const owner of [-1,1])test(`overhaul: explored territory owned by ${owner} stays owned while a blue barracks is built through real work`,()=>{
 const g=peaceful();g.explored[0].fill(1);const territory=g.territories.find(t=>t.owner===owner),p=buildSite(g,territory),income=g.income(0);g.visible[0].fill(0);assert.equal(g.canSee(0,p),false);assert.equal(g.buildError(0,'barracks',p),null);
 const w=g.spawn(0,g.world.nearest({x:p.x+230,y:p.y},g.obstacles()),'engineer'),credits=g.credits[0],b=g.build(0,'barracks',p,[w.id]);assert.ok(b);assert.equal(b.owner,0);assert.equal(b.territory,territory.id);assert.equal(g.credits[0],credits-200);
 advance(g,.3);assert.equal(b.buildRemaining,12);const loaded=Simulation.load(g.save());loaded.aiClock=-1e8;assert.equal(loaded.units.find(u=>u.id===w.id).orders[0].kind,'build');advance(loaded,30);
 const built=loaded.bases.find(v=>v.id===b.id);assert.equal(built.buildRemaining,0);assert.equal(loaded.territories[territory.id].owner,owner);assert.equal(loaded.income(0),income);
});

test('overhaul: the entire circular footprint needs exploration; territory boundaries and current fog do not limit it',()=>{
 const g=peaceful();g.explored[0].fill(1);const p=buildSite(g,g.territories[20]);g.visible[0].fill(0);g.explored[0].fill(0);assert.match(g.buildError(0,'barracks',p),/erforscht/);
 g.explored[0][g.world.index(p)]=1;assert.match(g.buildError(0,'barracks',p),/Grundfläche/);g.explored[0].fill(1);assert.equal(g.buildError(0,'barracks',p),null);
 assert.ok(g.buildError(0,'barracks',{x:NaN,y:20}));assert.ok(g.buildError(0,'barracks',{x:5,y:5}));
});

test('overhaul: unreachable sites are rejected without booking credits or leaving a free building',()=>{
 const g=peaceful();g.explored[0].fill(1);const p=buildSite(g,g.territories[20]),w=g.spawn(0,{x:1900,y:2100},'engineer'),cell=g.world.index(w),width=RULES.grid;
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)g.world.blocked[cell+dy*width+dx]=1;
 const credits=g.credits[0],count=g.bases.length;assert.equal(g.build(0,'barracks',p,[w.id]),null);assert.equal(g.credits[0],credits);assert.equal(g.bases.length,count);assert.match(g.notices.at(-1),/erreichen/);
});

for(const kind of ['move','attackMove','attack'])test(`overhaul: mixed ${kind} places medics behind the slower front without overtaking and survives reload`,()=>{
 const g=peaceful();g.units=[];const h=g.spawn(0,{x:1900,y:2100},'heavy'),s=g.spawn(0,{x:1900,y:2140}),m=g.spawn(0,{x:1810,y:2100},'medic'),m2=g.spawn(0,{x:1810,y:2140},'medic');
 const enemy=kind==='attack'?g.spawn(1,{x:2400,y:2120}):undefined;if(enemy){enemy.cooldown=100;g.stop([enemy.id],true);g.updateVision();}
 g.command([m.id,s.id,m2.id,h.id],{x:2350,y:2120,kind,target:enemy?.id});assert.ok(m.orders[0].formation);assert.ok(m.orders[0].x<h.orders[0].x);assert.notEqual(m.orders[0].formation.lane,m2.orders[0].formation.lane);
 for(let i=0;i<60;i++){g.step();assert.ok(m.x<Math.min(h.x,s.x)-25);assert.ok(m2.x<Math.min(h.x,s.x)-25);}
 const restored=Simulation.load(g.save());assert.deepEqual(restored.units.find(u=>u.id===m.id).orders,m.orders);const before=m.x;h.hp=0;s.hp=0;g.step();assert.equal(m.orders.length,0);near(m.x,before);
});

test('overhaul: rear medics heal during attack-move, do not pursue enemies, preserve explicit healing and obey solo moves',()=>{
 const g=peaceful();g.units=[];const soldier=g.spawn(0,{x:1900,y:2100}),m=g.spawn(0,{x:1830,y:2100},'medic'),enemy=g.spawn(1,{x:2150,y:2100});enemy.cooldown=100;g.stop([enemy.id],true);soldier.hp=25;g.updateVision();
 g.command([m.id,soldier.id],{x:2350,y:2100,kind:'attackMove'});advance(g,2);assert.ok(soldier.hp>25);assert.ok(m.x<soldier.x-30);assert.ok(m.cooldown<=0);
 g.command([m.id],{x:soldier.x,y:soldier.y,kind:'heal',target:soldier.id});g.command([m.id,soldier.id],{x:2300,y:2100,kind:'move'});assert.equal(m.orders[0].kind,'heal');assert.ok(m.orders[1].formation);
 g.units=g.units.filter(u=>u.owner===0);g.stop([m.id]);const before=m.x;g.command([m.id],{x:m.x+100,y:m.y,kind:'move'});advance(g,1);assert.ok(m.x>before+50);assert.equal(m.orders[0]?.formation,undefined);
});

test('overhaul assets: detailed buildings, 64 real weapon views, compact turret and distinct role geometry are exported for both teams',()=>{
 const read=(path)=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url))),gltf=path=>{const b=fs.readFileSync(new URL('../'+path,import.meta.url));return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));};
 assert.equal(BUILDINGS.turret.width,72);assert.equal(BUILDINGS.turret.radius,30);
 for(const team of [0,1]){
  for(const kind of ['turret','barracks']){const a=read(`src/assets/reborn/buildings-3d/${kind}-${team}.json`);assert.ok(a.design.parts>=120);const g=gltf(`src/assets/reborn/buildings-3d/${a.model}`);assert.ok(g.materials.some(m=>m.name==='Atlas faction enamel'));if(kind==='turret'){assert.equal(a.turret.directions,64);assert.equal(a.turret.frames.length,64);assert.equal(a.turret.muzzles.length,64);assert.ok(g.nodes.some(n=>n.name==='TurretHead'));assert.ok(g.animations.some(c=>c.name==='TurretTraverse'));assert.deepEqual(a.turret.pivot,[256-a.turret.originalBounds.x,382-a.turret.originalBounds.y]);}}
  const parts=[];for(const role of ['infantry','heavy','medic','engineer']){const a=read(`src/assets/reborn/prototype/${role}-${team}.json`);parts.push(a.design.parts);assert.equal(a.design.role,role);assert.ok(a.design.maxGripError<.002);assert.equal(a.frames.length,296);const g=gltf(`src/assets/reborn/prototype/${role}-${team}.glb`);assert.ok(g.materials.some(m=>m.name==='Atlas faction enamel'));}
  assert.ok(new Set(parts).size>=3);
 }
});

test('overhaul: manual healing cannot chase a fleeing patient indefinitely and retains the pending order',()=>{
 const g=peaceful();g.units=[];const m=g.spawn(0,{x:1900,y:2100},'medic'),s=g.spawn(0,{x:1980,y:2100});s.hp=20;
 g.command([m.id],{x:s.x,y:s.y,kind:'heal',target:s.id});Object.assign(s,{x:2300,y:2100});const before={x:m.x,y:m.y};advance(g,2);assert.deepEqual({x:m.x,y:m.y},before);assert.equal(m.orders[0].kind,'heal');assert.equal(m.supportPaused,true);
 const restored=Simulation.load(g.save());assert.equal(restored.units.find(u=>u.id===m.id).orders[0].kind,'heal');Object.assign(s,{x:1940,y:2100});advance(g,1);assert.ok(s.hp>20);assert.equal(m.supportPaused,false);
});
