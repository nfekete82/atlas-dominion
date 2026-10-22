import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {World} from '../dist/src/reborn/world.js';
import {RULES,distance} from '../dist/src/reborn/config.js';
const advance=(g,seconds)=>{for(let i=0;i<Math.round(seconds/RULES.tick);i++)g.step();};
const peaceful=()=>{const g=new Simulation();g.aiClock=-1e8;return g;};

test('reborn: exact start, deterministic map, real fog and configurable economy',()=>{
 const g=new Simulation();assert.equal(g.credits[0],500);assert.equal(g.count(0),1);
 assert.equal(g.territories.length,30);assert.equal(g.territories.filter(t=>t.owner===0).length,3);
 assert.equal(g.bases.length,2);assert.equal(g.income(0),35);
 assert.ok(g.explored[0].reduce((n,v)=>n+v,0)<RULES.grid**2*.05);
 assert.deepEqual(g.save(),new Simulation().save());
 assert.ok(g.world.walkable(g.units[0],g.obstacles()));
});

test('reborn: pathfinding connects every control point and avoids cliffs and buildings',()=>{
 const g=peaceful(),start=g.units[0];
 for(const t of g.territories){
  const path=g.world.path(start,t.point,g.obstacles());assert.ok(path.length,`No path to ${t.id}`);
  let p=start;for(const q of path){assert.ok(g.world.line(p,q,g.obstacles()),`Clipping on route ${t.id}`);p=q;}
 }
 const w=new World();assert.equal(w.walkable({x:-1,y:20}),false);
 assert.equal(w.walkable({x:0,y:0}),false);
});

test('reborn: physical movement explores and captures an adjacent territory after eight seconds',()=>{
 const g=peaceful(),u=g.units[0],t=g.territories[20],before=g.explored[0].reduce((a,b)=>a+b,0);
 g.command([u.id],{...t.point,kind:'move'});advance(g,5);
 assert.ok(distance(u,t.point)<95);assert.equal(t.owner,-1);assert.ok(t.progress>0&&t.progress<8);
 advance(g,8);assert.equal(t.owner,0);assert.equal(g.income(0),40);
 assert.ok(g.explored[0].reduce((a,b)=>a+b,0)>before);assert.equal(g.canSee(0,t.point),true);
 g.command([u.id],{...g.territories[13].point,kind:'move'});advance(g,12);
 assert.equal(g.hasExplored(0,t.point),true);assert.equal(g.canSee(0,t.point),false);
});

test('reborn: disconnected captures fail; enemies contest and interrupt capture',()=>{
 const g=peaceful(),u=g.units[0],t=g.territories[16];Object.assign(u,t.point);advance(g,10);assert.equal(t.owner,-1);assert.equal(t.progress,0);
 const adjacent=g.territories[20];Object.assign(u,adjacent.point);advance(g,3);assert.ok(adjacent.progress>2.8);
 const enemy=g.units[1];Object.assign(enemy,adjacent.point);u.orders=[{...u,kind:'move'}];enemy.orders=[{...enemy,kind:'move'}];
 const progress=adjacent.progress;advance(g,3);assert.equal(adjacent.progress,progress);assert.equal(adjacent.owner,-1);
});

test('reborn: economy never duplicates across pause, save/load or territory loss',()=>{
 const g=peaceful();advance(g,9.95);assert.equal(g.credits[0],500);
 const loaded=Simulation.load(g.save());loaded.step();assert.equal(loaded.credits[0],535);advance(loaded,.1);assert.equal(loaded.credits[0],535);
 assert.doesNotThrow(()=>Simulation.load(loaded.save()));
 loaded.paused=true;advance(loaded,100);assert.equal(loaded.credits[0],535);loaded.paused=false;
 loaded.territories[19].owner=1;assert.equal(loaded.income(0),30);advance(loaded,10);assert.equal(loaded.credits[0],565);
});

test('reborn: production charges once, maintains queue and spawns clear of obstacles with rally orders',()=>{
 const g=peaceful(),b=g.bases[0];b.rally={...g.territories[20].point};
 assert.equal(g.recruit(b.id),true);assert.equal(g.recruit(b.id),true);assert.equal(g.credits[0],300);
 advance(g,4.9);assert.equal(g.count(0),1);advance(g,.1);assert.equal(g.count(0),2);assert.equal(b.queue.length,1);
 const u=g.units.find(u=>u.owner===0&&u.id!==1);assert.ok(g.world.walkable(u,g.obstacles()));assert.equal(u.orders[0].kind,'attackMove');
 g.cancel(b.id);assert.equal(b.queue.length,0);assert.equal(g.credits[0],400);g.cancel(b.id);assert.equal(g.credits[0],400);
 const snapshot=Simulation.load(g.save());assert.deepEqual(snapshot.bases,g.bases);
});

test('reborn: shift queues, stop, combat damage/death and attack-move continuation',()=>{
 const g=peaceful(),u=g.units[0];g.command([u.id],{x:1400,y:2400,kind:'move'});g.command([u.id],{x:1600,y:2400,kind:'move'},true);assert.equal(u.orders.length,2);g.stop([u.id]);assert.equal(u.orders.length,0);
 g.units=[];const a=g.spawn(0,{x:1900,y:2100}),b=g.spawn(1,{x:2050,y:2100});
 g.updateVision();g.command([a.id],{x:2350,y:2100,kind:'attackMove'});advance(g,1);assert.ok(b.hp<100);assert.ok(a.hp<100);assert.ok(g.shots.length);
 b.hp=17;advance(g,1);assert.equal(g.units.some(u=>u.id===b.id),false);advance(g,2);assert.ok(a.x>1900);assert.ok(a.orders.length>0);
});

test('reborn: line of sight blocks both reconnaissance and weapon fire through rock',()=>{
 const g=peaceful();g.units=[];const a=g.spawn(0,{x:1900,y:2100}),b=g.spawn(1,{x:2050,y:2100});
 const wall=g.world.index({x:1980,y:2100});g.world.blocked[wall]=1;g.updateVision();
 assert.equal(g.world.line(a,b),false);assert.equal(g.canSee(0,b),false);advance(g,3);assert.equal(a.hp,100);assert.equal(b.hp,100);
});

test('reborn: AI funds production, navigates and expands from its own start territories',()=>{
 const g=new Simulation();advance(g,150);
 assert.ok(g.count(1)>1);assert.ok(g.territories.filter(t=>t.owner===1).length>3);
 assert.ok(g.credits[1]>=0);assert.ok(g.explored[1].reduce((a,b)=>a+b,0)>700);
});

test('reborn: fog, AI, partial capture and production survive a deterministic save/load continuation',()=>{
 const g=new Simulation();g.recruit(1000);advance(g,3);g.command([1],{...g.territories[20].point,kind:'move'});advance(g,4);
 const restored=Simulation.load(g.save());assert.equal(restored.time,g.time);assert.deepEqual(restored.explored,g.explored);
 assert.deepEqual(restored.credits,g.credits);assert.deepEqual(restored.bases,g.bases);
 advance(g,35);advance(restored,35);
 assert.deepEqual(restored.credits,g.credits);assert.deepEqual(restored.territories.map(t=>t.owner),g.territories.map(t=>t.owner));
 assert.equal(restored.count(0),g.count(0));assert.equal(restored.count(1),g.count(1));
 assert.throws(()=>Simulation.load({version:1}));const corrupt=g.save();corrupt.credits[0]=-20;assert.throws(()=>Simulation.load(corrupt));
});

test('reborn: victory requires headquarters capture plus enemy start territories; defeat requires losing all production and infantry',()=>{
 const g=peaceful();g.bases[1].owner=0;g.step();assert.equal(g.status,'playing');for(const id of [4,5,11])g.territories[id].owner=0;g.step();assert.equal(g.status,'victory');
 const lost=peaceful();lost.bases[0].hp=0;lost.step();assert.equal(lost.status,'playing');lost.units=lost.units.filter(u=>u.owner!==0);lost.step();assert.equal(lost.status,'defeat');
});

test('reborn: an intact enemy headquarters prevents capture; real siege damage and relay capture produce victory',()=>{
 const g=peaceful();g.credits[1]=0;g.units=[];const b=g.bases[1],t=g.territories[5];
 for(const id of [4,11])g.territories[id].owner=0;
 const scout=g.spawn(0,{...t.point});advance(g,9);assert.equal(t.owner,1);assert.equal(t.progress,0);
 g.units=[];
 for(let i=0;i<4;i++)g.spawn(0,g.world.nearest({x:b.x-145-i*25,y:b.y-70},g.obstacles(),g.units));
 g.updateVision();g.command(g.units.map(u=>u.id),{...b,kind:'attack',target:b.id});advance(g,50);
 assert.equal(b.hp,0);assert.equal(t.owner,1);assert.equal(g.status,'playing');
 g.command(g.units.map(u=>u.id),{...t.point,kind:'move'});advance(g,30);
 assert.equal(b.owner,0);assert.equal(b.hp,600);assert.equal(t.owner,0);assert.equal(g.status,'victory');
});

test('reborn: AI decisions do not depend on player infantry hidden by its fog',()=>{
 const a=new Simulation(),b=new Simulation();b.units[0].x+=100;b.units[0].y-=100;b.updateVision();
 advance(a,65);advance(b,65);
 assert.deepEqual(a.units.filter(u=>u.owner===1),b.units.filter(u=>u.owner===1));
 assert.deepEqual(a.explored[1],b.explored[1]);assert.equal(a.credits[1],b.credits[1]);
});
