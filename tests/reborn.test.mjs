import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,BUILDINGS,unitKinds} from '../dist/src/reborn/catalog.js';
import {World} from '../dist/src/reborn/world.js';
import {RULES,distance} from '../dist/src/reborn/config.js';
const advance=(g,seconds)=>{for(let i=0;i<Math.round(seconds/RULES.tick);i++)g.step();};
const peaceful=()=>{const g=new Simulation();g.aiClock=-1e8;return g;};

test('reborn: exact start, deterministic map, real fog and configurable economy',()=>{
 const g=new Simulation();assert.equal(g.credits[0],500);assert.equal(g.count(0),2);
 assert.equal(g.territories.length,30);assert.equal(g.territories.filter(t=>t.owner===0).length,3);
 assert.equal(g.bases.length,2);assert.equal(g.income(0),35);
 // Nearby cliffs are identified as complete landforms; most of the map stays unknown.
 assert.ok(g.explored[0].reduce((n,v)=>n+v,0)<RULES.grid**2*.25);
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
 assert.equal(g.hasExplored(0,t.point),true);assert.equal(g.canSee(0,t.point),true);
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
 const g=peaceful(),b=g.bases[0],initialIds=new Set(g.units.map(u=>u.id));b.rally={...g.territories[20].point};
 assert.equal(g.recruit(b.id),true);assert.equal(g.recruit(b.id),true);assert.equal(g.credits[0],100);
 advance(g,6.9);assert.equal(g.count(0),2);advance(g,.1);assert.equal(g.count(0),3);assert.equal(b.queue.length,1);
 const u=g.units.find(u=>u.owner===0&&!initialIds.has(u.id));assert.ok(g.world.walkable(u,g.obstacles()));assert.equal(u.orders[0].kind,'attackMove');
 g.cancel(b.id);assert.equal(b.queue.length,0);assert.equal(g.credits[0],300);g.cancel(b.id);assert.equal(g.credits[0],300);
 const snapshot=Simulation.load(g.save());assert.deepEqual(snapshot.bases,g.bases);
});

test('reborn: shift queues, stop, combat damage/death and attack-move continuation',()=>{
 const g=peaceful(),u=g.units[0];g.command([u.id],{x:1400,y:2400,kind:'move'});g.command([u.id],{x:1600,y:2400,kind:'move'},true);assert.equal(u.orders.length,2);g.stop([u.id]);assert.equal(u.orders.length,0);
 g.units=[];const a=g.spawn(0,{x:1900,y:2100}),b=g.spawn(1,{x:2050,y:2100});
 g.updateVision();g.command([a.id],{x:2350,y:2100,kind:'attackMove'});advance(g,1);assert.ok(b.hp<100);assert.ok(a.hp<100);assert.ok(g.shots.length);
 b.hp=17;advance(g,1);assert.equal(g.units.some(u=>u.id===b.id),false);const stand={x:a.x,y:a.y};advance(g,2);assert.ok(distance(a,stand)<.01);assert.equal(a.orders.length,0);assert.equal(a.hold,true);
});

test('reborn: line of sight blocks both reconnaissance and weapon fire through rock',()=>{
 const g=peaceful();g.units=[];const a=g.spawn(0,{x:1900,y:2100}),b=g.spawn(1,{x:2050,y:2100});
 const wall=g.world.index({x:1980,y:2100});g.world.blocked[wall]=1;g.world.opaque[wall]=1;g.updateVision();
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

test('reborn: attacked marching infantry defend in place until a fresh player command',()=>{
 const g=peaceful();g.units=[];const blue=g.spawn(0,{x:1900,y:2100}),red=g.spawn(1,{x:2050,y:2100});
 g.command([blue.id],{x:2350,y:2100,kind:'attackMove'});g.command([blue.id],{x:2400,y:2250,kind:'attackMove'},true);g.updateVision();
 advance(g,.1);assert.ok(blue.hp<100);assert.ok(red.hp<100);assert.equal(blue.lastAttacker,red.id);
 assert.equal(blue.orders.length,0,'all queued march legs are cancelled after damage');
 assert.equal(blue.hold,true);
 red.hp=0;advance(g,.15);
 const stand={x:blue.x,y:blue.y};advance(g,2);
 assert.ok(distance(blue,stand)<.01,'never resume a saved route after combat');
 const save=Simulation.load(g.save());const restored=save.units.find(u=>u.id===blue.id);
 assert.equal(restored.hold,true);assert.deepEqual(restored.orders,[]);
 g.command([blue.id],{x:2350,y:2100,kind:'move'});
 assert.equal(blue.hold,false,'a new player click explicitly releases hold');
 advance(g,1);
 assert.ok(distance(blue,stand)>40,'new player command moves the soldier again');
});

test('reborn: finer navigation blocks complete hill edges and places the headquarters footprint on flat ground',()=>{
 const g=peaceful(),w=g.world;assert.equal(RULES.grid,240);
 for(const b of g.bases)for(let i=0;i<16;i++)assert.ok(w.walkable({x:b.x+Math.cos(i*Math.PI/8)*b.radius,y:b.y+Math.sin(i*Math.PI/8)*b.radius}));
 for(const rock of w.rocks){const middle={x:rock.reduce((n,p)=>n+p.x,0)/rock.length,y:rock.reduce((n,p)=>n+p.y,0)/rock.length};assert.equal(w.walkable(middle),false);}
 assert.ok(w.blocked.reduce((n,v)=>n+v,0)>2000);
});

test('reborn: existing saves migrate explored fog to the finer grid without losing economy or orders',()=>{
 const g=peaceful();g.command([1],{...g.territories[20].point,kind:'move'});advance(g,3);
 const old=g.save();old.explored=old.explored.map(a=>Array.from({length:120**2},(_,i)=>a[Math.floor(i/120)*2*240+(i%120)*2]));
 for(const u of old.units)for(const key of ['angle','walkDistance','fire','previousX','previousY','lastAttacker','defendUntil'])delete u[key];
 const loaded=Simulation.load(old);assert.equal(loaded.explored[0].length,240**2);assert.deepEqual(loaded.credits,g.credits);assert.equal(loaded.incomeClock,g.incomeClock);
 assert.deepEqual(loaded.units[0].orders,g.units[0].orders);assert.ok(Number.isFinite(loaded.units[0].angle));assert.ok(loaded.world.walkable(loaded.units[0],loaded.obstacles()));
 assert.ok(loaded.explored[0].reduce((n,v)=>n+v,0)>=old.explored[0].reduce((n,v)=>n+v,0)*4);
});

test('reborn: low rubble beside the headquarters casts no permanent black visibility hole',()=>{
 const g=peaceful(),p={x:960,y:2610},i=g.world.index(p);
 assert.equal(g.world.blocked[i],1);assert.equal(g.world.opaque[i],0);assert.equal(g.canSee(0,p),true);
 const loaded=Simulation.load(g.save());assert.equal(loaded.canSee(0,p),true);
});

test('reborn: units and headquarters always reveal their own tile and close surroundings',()=>{
 const g=peaceful();g.units=[];const u=g.spawn(0,{x:960,y:2610});g.updateVision();
 for(const source of [u,g.bases[0]])for(const [dx,dy] of [[0,0],[20,0],[-20,0],[0,20],[0,-20]])assert.ok(g.canSee(0,{x:source.x+dx,y:source.y+dy}));
 const hidden=g.units.find(u=>u.owner===1);assert.equal(hidden,undefined);
});

test('reborn: approaching a cliff explores its inaccessible interior without revealing enemies behind it',()=>{
 const g=peaceful(),discovered=g.world.cliffCells.filter(cells=>cells.some(i=>g.visible[0][i]));
 assert.ok(discovered.length>0);
 for(const cells of discovered)assert.ok(cells.every(i=>g.explored[0][i]===1));
 assert.ok(discovered.some(cells=>cells.some(i=>!g.visible[0][i])));
 assert.equal(g.canSee(0,g.bases[1]),false);
 assert.ok(g.explored[0].some((v,i)=>!v&&g.world.cliffIds[i]>=0));
});

test('reborn: orders into deep impassable mountains resolve to a reachable edge beyond the old search limit',()=>{
 const g=peaceful(),u=g.units[0],target={x:2100,y:60};assert.equal(g.world.walkable(target),false);
 assert.equal(g.command([u.id],{...target,kind:'move'}),1);const goal=u.orders[0];
 assert.ok(g.world.walkable(goal,g.obstacles()));assert.equal(g.world.components[g.world.index(goal)],g.world.components[g.world.index(u)]);
 assert.ok(g.world.path(u,goal,g.obstacles()).length>0);assert.ok(distance(target,goal)>22*g.world.cell);
});

test('reborn: captured bastions retain local sight without infantry and transfer it immediately on recapture',()=>{
 const g=peaceful(),u=g.units[0],t=g.territories[20];
 assert.equal(g.canSee(0,t.point),false);
 g.command([u.id],{...t.point,kind:'move'});advance(g,14);assert.equal(t.owner,0);
 g.command([u.id],{x:g.bases[0].x+125,y:g.bases[0].y+100,kind:'move'});advance(g,14);
 assert.ok(distance(u,t.point)>RULES.infantry.sight);assert.equal(g.canSee(0,t.point),true);
 const nearby={x:t.point.x+160,y:t.point.y};assert.ok(g.world.sightLine(t.point,nearby));assert.equal(g.canSee(0,nearby),true);
 const restored=Simulation.load(g.save());assert.equal(restored.canSee(0,nearby),true);
 // A legal adjacent red foothold permits an actual eight-second recapture.
 g.units=[];g.territories[14].owner=1;g.spawn(1,{...t.point});g.updateVision();
 for(let i=0;i<161&&t.owner!==1;i++)g.step();
 assert.equal(t.owner,1);assert.equal(g.canSee(1,nearby),true);assert.equal(g.canSee(0,nearby),false);assert.equal(g.hasExplored(0,nearby),true);
 const lost=Simulation.load(g.save());assert.equal(lost.canSee(0,nearby),false);assert.equal(lost.canSee(1,nearby),true);
});

test('reborn: both teams proactively fire during attack-move before taking any damage and keep queued orders',()=>{
 for(const owner of [0,1]){
  const g=peaceful();g.units=[];const sentry=g.spawn(owner,{x:1900,y:2100}),target=g.spawn(1-owner,{x:2050,y:2100});
  target.cooldown=100;
  g.command([sentry.id],{x:2350,y:2100,kind:'attackMove'});g.command([sentry.id],{x:2400,y:2250,kind:'attackMove'},true);g.updateVision();
  g.step();assert.equal(sentry.hp,100);assert.equal(target.hp,100-17/3);assert.equal(sentry.lastAttacker,null);assert.equal(sentry.moving,false);assert.equal(sentry.orders.length,2);
  assert.ok(g.shots.some(shot=>shot.owner===owner));
  g.units=g.units.filter(u=>u.id!==target.id);advance(g,1);assert.ok(sentry.x>1930);assert.equal(sentry.orders.length,2);
 }
});

const buildSite=(g,kind)=>{
 for(let y=2100;y<3450;y+=28)for(let x=220;x<1750;x+=28)if(!g.buildError(0,kind,{x,y}))return {x,y};
 throw Error('No construction site for '+kind);
};
const buildWithWorker=(g,owner,kind,site)=>{
 if(!g.buildError(owner,kind,site)){
  let worker=g.units.find(u=>u.owner===owner&&u.kind==='engineer');
  const point=g.world.nearest({x:site.x+BUILDINGS[kind].radius+32,y:site.y},g.obstacles());
  assert.ok(point,`No reachable worker approach for ${kind} at ${site.x},${site.y}`);
  if(worker)Object.assign(worker,point);else worker=g.spawn(owner,point,'engineer');
 }
 return g.build(owner,kind,site);
};
test('reborn: construction respects ownership, terrain, occupied footprints, credits, pause and completion',()=>{
 const g=peaceful(),site=buildSite(g,'barracks'),before=g.credits[0];
 assert.ok(g.buildError(0,'barracks',{x:2200,y:900}));assert.ok(g.buildError(0,'barracks',g.bases[0]));
 const b=buildWithWorker(g,0,'barracks',site);assert.ok(b);assert.equal(g.credits[0],before-200);assert.equal(b.buildRemaining,12);assert.equal(g.recruit(b.id,'heavy'),false);
 assert.equal(buildWithWorker(g,0,'barracks',site),null);assert.equal(g.credits[0],before-200);g.paused=true;advance(g,10);assert.equal(b.buildRemaining,12);g.paused=false;
 advance(g,13);assert.equal(b.buildRemaining,0);assert.ok(b.hp>799);assert.equal(g.recruit(b.id,'heavy'),true);assert.equal(g.credits[0],85);advance(g,9);assert.ok(g.units.some(u=>u.kind==='heavy'&&u.hp===UNITS.heavy.hp));
});
test('reborn: typed production enforces the producer, refunds each type and preserves later queue timing',()=>{
 const g=peaceful();g.credits[0]=3000;const factory=buildWithWorker(g,0,'factory',buildSite(g,'factory'));advance(g,19);
 assert.equal(g.recruit(factory.id,'bomber'),false);assert.equal(g.recruit(factory.id,'tank'),true);assert.equal(g.recruit(factory.id,'rover'),true);
 advance(g,2);const progress=factory.production,credits=g.credits[0];g.cancel(factory.id,1);assert.equal(g.credits[0],credits+UNITS.rover.cost);assert.equal(factory.production,progress);
 assert.equal(g.recruit(factory.id,'artillery'),true);g.cancel(factory.id,0);assert.equal(factory.production,0);assert.deepEqual(factory.queueTypes,['artillery']);advance(g,19);
 const artillery=g.units.find(u=>u.kind==='artillery');assert.ok(artillery);assert.equal(artillery.hp,340);assert.ok(g.world.walkable(artillery,g.obstacles(),10));
});
test('reborn: old saves migrate types and new saves preserve construction and heterogeneous production',()=>{
 const g=new Simulation();g.recruit(1000);const old=g.save();delete old.productionVersion;old.units=old.units.filter(u=>u.kind==='infantry');old.credits[0]=400;old.bases[0].queue=[5];old.bases[0].queueCosts=[100];for(const u of old.units)delete u.kind;for(const b of old.bases)for(const key of ['kind','queueTypes','buildRemaining','cooldown'])delete b[key];
 const migrated=Simulation.load(old);assert.equal(migrated.units[0].kind,'infantry');assert.deepEqual(migrated.bases[0].queueTypes,[]);assert.equal(migrated.credits[0],500);
 g.credits[0]=3000;const barracks=buildWithWorker(g,0,'barracks',buildSite(g,'barracks'));advance(g,13);g.recruit(barracks.id,'heavy');g.recruit(barracks.id,'medic');advance(g,3);const airfield=buildWithWorker(g,0,'airfield',buildSite(g,'airfield'));
 assert.ok(airfield,'The expanded airfield must remain constructible in the legacy migration test');
 const restored=Simulation.load(g.save());assert.deepEqual(restored.bases,g.bases);advance(g,25);advance(restored,25);
 assert.deepEqual(restored.units.map(u=>({kind:u.kind,hp:u.hp})),g.units.map(u=>({kind:u.kind,hp:u.hp})));assert.deepEqual(restored.credits,g.credits);assert.equal(restored.bases.find(b=>b.id===airfield.id).buildRemaining,0);
});
test('reborn: generators earn only after construction; cancelling a site refunds once and frees it',()=>{
 const g=peaceful(),income=g.income(0),site=buildSite(g,'generator'),b=buildWithWorker(g,0,'generator',site);assert.equal(g.income(0),income);advance(g,9.1);assert.equal(g.income(0),income+10);
 const otherSite=buildSite(g,'barracks'),credits=g.credits[0],other=buildWithWorker(g,0,'barracks',otherSite);assert.equal(g.cancelConstruction(other.id),true);assert.equal(g.credits[0],credits-50);assert.equal(g.cancelConstruction(other.id),false);assert.equal(g.buildError(0,'barracks',otherSite),null);
});
test('reborn: air units cross rock and scout over it; vehicles retain terrain clearance',()=>{
 const g=peaceful();g.units=[];const air=g.spawn(0,{x:1900,y:2100},'scout'),destination={x:2100,y:60};assert.equal(g.world.walkable(destination),false);
 g.command([air.id],{...destination,kind:'move'});advance(g,distance(air,destination)/UNITS.scout.speed+2);assert.ok(distance(air,destination)<20);assert.equal(g.canSee(0,air),true);
 g.units=[];const tank=g.spawn(0,{x:1900,y:2100},'tank');g.command([tank.id],{x:2350,y:2250,kind:'move'});for(let i=0;i<100;i++){g.step();assert.ok(g.world.walkable(tank,g.obstacles(),12));}
});

for(const kind of ['scout','bomber'])for(const owner of [0,1])test(`reborn: ${kind} captures for faction ${owner} through movement, save/load, sight and income`,()=>{
 const g=peaceful();g.units=[];
 const t=g.territories.find(t=>t.owner===-1&&t.neighbors.some(i=>g.territories[i].owner===owner)),income=g.income(owner);
 const air=g.spawn(owner,{x:t.point.x,y:t.point.y+240},kind);
 assert.equal(g.command([air.id],{...t.point,kind:'move'}),1);advance(g,3);
 assert.ok(distance(air,t.point)<RULES.captureRadius);assert.equal(t.owner,-1);assert.equal(t.capturing,owner);assert.ok(t.progress>0&&t.progress<RULES.captureTime);
 const restored=Simulation.load(g.save());restored.aiClock=-1e8;advance(restored,RULES.captureTime-t.progress-RULES.tick);
 const captured=restored.territories[t.id];assert.equal(captured.owner,-1);
 restored.step();assert.equal(captured.owner,owner);assert.equal(captured.progress,0);assert.equal(captured.capturing,-1);
 assert.equal(restored.income(owner),income+t.income);assert.equal(restored.canSee(owner,t.point),true);
 const credits=restored.credits[owner];restored.incomeClock=10-RULES.tick;restored.step();assert.equal(restored.credits[owner],credits+income+t.income);
 if(owner===0)assert.ok(restored.notices.some(n=>n.includes(t.name)));
});

test('reborn: air and ground units contest each other and air recapture transfers ownership and income',()=>{
 for(const [blueKind,redKind] of [['scout','infantry'],['infantry','bomber']]){
  const g=peaceful();g.units=[];const t=g.territories[20],blue=g.spawn(0,{x:t.point.x-20,y:t.point.y},blueKind);blue.cooldown=1e6;
  advance(g,3);const progress=t.progress;assert.ok(progress>0);
  const red=g.spawn(1,{x:t.point.x+20,y:t.point.y},redKind);red.cooldown=1e6;
  advance(g,3);assert.equal(t.progress,progress);assert.equal(t.owner,-1);
  g.units=[blue];advance(g,5);assert.equal(t.owner,0);
 }
 const g=peaceful();g.units=[];const t=g.territories[20];t.owner=0;
 g.territories[t.neighbors.find(i=>g.territories[i].owner===-1)].owner=1;
 const incomes=[g.income(0),g.income(1)],red=g.spawn(1,t.point,'bomber');red.cooldown=1e6;
 advance(g,RULES.captureTime);assert.equal(t.owner,1);assert.equal(g.income(0),incomes[0]-t.income);assert.equal(g.income(1),incomes[1]+t.income);
});

test('reborn: air capture still requires ground proximity, a connected sector and an undefended headquarters',()=>{
 const g=peaceful();g.units=[];const adjacent=g.territories[20],disconnected=g.territories[16];
 const air=g.spawn(0,{x:adjacent.point.x+RULES.captureRadius+10,y:adjacent.point.y},'bomber');air.cooldown=1e6;
 advance(g,9);assert.equal(adjacent.owner,-1);assert.equal(adjacent.progress,0);
 Object.assign(air,disconnected.point);advance(g,9);assert.equal(disconnected.owner,-1);assert.equal(disconnected.progress,0);
 const hq=g.bases[1],target=g.territories[hq.territory];g.territories[4].owner=0;g.territories[11].owner=0;
 Object.assign(air,target.point);advance(g,9);assert.equal(target.owner,1);assert.equal(target.progress,0);
 hq.hp=0;advance(g,RULES.captureTime);assert.equal(target.owner,0);assert.equal(hq.owner,0);assert.equal(hq.hp,RULES.headquarters.hp*.5);
});
test('reborn: engineers repair nearby buildings and a completed turret independently defends its perimeter',()=>{
 const g=peaceful();g.credits[0]=3000;const tower=buildWithWorker(g,0,'turret',buildSite(g,'turret'));advance(g,11);tower.hp=400;
 const repair=g.spawn(0,g.world.nearest({x:tower.x+55,y:tower.y},g.obstacles()),'engineer');advance(g,2);assert.ok(tower.hp>410);
 const enemyPoint=g.world.nearest({x:tower.x+150,y:tower.y},g.obstacles());g.units=g.units.filter(u=>u.id!==repair.id);const enemy=g.spawn(1,enemyPoint);enemy.cooldown=100;g.updateVision();advance(g,.9);assert.ok(enemy.hp<100);assert.ok(tower.hp>=400);
});

test('reborn: every roster type trains through its matching finished producer',()=>{
 for(const kind of unitKinds){
  const g=peaceful(),hq=g.bases[0],spec=UNITS[kind],initialIds=new Set(g.units.map(u=>u.id));g.credits[0]=2000;Object.assign(hq,{kind:spec.producers[0],hp:spec.producers[0]==='headquarters'?1200:spec.producers[0]==='barracks'?800:spec.producers[0]==='factory'?1100:900});
  assert.equal(g.producer(0,kind)?.id,hq.id);assert.equal(g.recruit(hq.id,kind),true);
  assert.equal(g.credits[0],2000-spec.cost);assert.deepEqual(hq.queueTypes,[kind]);
  const restored=Simulation.load(g.save());assert.deepEqual(restored.bases[0].queueTypes,[kind]);
  assert.equal(restored.credits[0],g.credits[0]);advance(restored,spec.buildTime+.1);
  assert.ok(restored.units.some(u=>u.owner===0&&u.kind===kind&&!initialIds.has(u.id)));assert.equal(restored.bases.length,2);
 }
});

test('reborn: two soldiers capture together after a high tower click instead of stopping north of its radius',()=>{
 const g=new Simulation(2026,1);g.aiClock=-1e8;g.units=[];const t=g.territories[20];
 for(let i=0;i<2;i++)g.spawn(0,g.world.nearest({x:t.point.x,y:t.point.y+240},g.obstacles(),g.units));
 assert.equal(g.command(g.units.map(u=>u.id),{x:t.point.x,y:t.point.y-100,kind:'move'}),2);
 advance(g,20);assert.equal(t.owner,0);assert.ok(g.units.every(u=>distance(u,t.point)<=RULES.captureRadius));
});

test('reborn: incomplete group formations remain centred on their requested destination',()=>{
 for(const count of [2,3,5,7,10]){
  const g=peaceful();g.units=[];for(let i=0;i<count;i++)g.spawn(0,{x:1900+i*22,y:2100});
  const target={x:2100,y:2200};assert.equal(g.command(g.units.map(u=>u.id),{...target,kind:'move'}),count);
  const destinations=g.units.map(u=>u.orders[0]);assert.ok(Math.abs(destinations.reduce((n,p)=>n+p.x,0)/count-target.x)<1e-8);
  assert.ok(Math.abs(destinations.reduce((n,p)=>n+p.y,0)/count-target.y)<1e-8);
 }
});

test('reborn: friendly groups can capture three adjacent bastions simultaneously without multiplying the capture clock',()=>{
 const g=new Simulation(2026,1);g.aiClock=-1e8;g.units=[];const targets=[13,20,24].map(i=>g.territories[i]);
 for(const t of targets)for(const dx of [-16,16])g.spawn(0,{x:t.point.x+dx,y:t.point.y});
 advance(g,3);for(const t of targets){assert.equal(t.owner,-1);assert.ok(Math.abs(t.progress-3)<1e-8);}
 const restored=Simulation.load(g.save());restored.aiClock=-1e8;advance(restored,5);
 for(const t of targets){assert.equal(restored.territories[t.id].owner,0);assert.equal(restored.territories[t.id].progress,0);}
});
