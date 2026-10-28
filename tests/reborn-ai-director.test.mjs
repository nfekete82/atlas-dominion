import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assaultDecision,abortAssault,preferredRole} from '../dist/src/reborn/ai-director.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {developArmy} from '../dist/src/reborn/army-economy.js';
import {addProducer} from './fixtures/reborn-production.mjs';
import {blueDefense} from '../scripts/benchmark-ai-opponent.mjs';
import {UNITS} from '../dist/src/reborn/catalog.js';

test('director: attacks undefended land with paid small groups instead of waiting forever',()=>{
 const input={defended:false,observedTowers:0,hasArtillery:false,visibleDefenderStrength:0,
  readyUnits:2,readyStrength:2.5,phaseSeconds:16,inRegroup:false,clusteredRecentLosses:false,scoutingOpening:false};
 assert.deepEqual(assaultDecision(input),{launch:true,requiredUnits:2,requiredStrength:2,reason:'ready'});
 assert.equal(assaultDecision({...input,readyUnits:1,scoutingOpening:false}).launch,false);
});

test('director: requires heavier support for actual visible fortifications',()=>{
 const s={defended:true,observedTowers:1,hasArtillery:false,visibleDefenderStrength:2,
  readyUnits:3,readyStrength:5,phaseSeconds:30,inRegroup:false,clusteredRecentLosses:false,scoutingOpening:false};
 assert.equal(assaultDecision(s).launch,false);
 assert.equal(assaultDecision({...s,hasArtillery:true,readyUnits:5,readyStrength:7}).launch,true);
});

test('director: stays committed through two casualties but withdraws from near-annihilation',()=>{
 const scenario={launchSize:10,survivors:8,recentLosses:2,stalledSeconds:20,
  knownUncoveredTurret:false,hasSiegeWeapon:false,destinationStillContested:true};
 assert.equal(abortAssault(scenario),null);
 assert.equal(abortAssault({...scenario,survivors:2,recentLosses:6}),'crippled');
 assert.equal(abortAssault({...scenario,stalledSeconds:110}),'stalled');
 assert.equal(abortAssault({...scenario,knownUncoveredTurret:true}),'uncovered-turret');
 assert.equal(abortAssault({...scenario,knownUncoveredTurret:true,hasSiegeWeapon:true}),null);
 assert.equal(abortAssault({...scenario,destinationStillContested:false}),'captured');
});

test('director: specific roles for each fully paid producer',()=>{
 const counts={engineer:1,infantry:5,heavy:1,medic:0,tank:0,rover:0,artillery:0,
  scout:0,bomber:0};
 assert.equal(preferredRole('factory',counts,1,0)[0],'artillery');
 assert.equal(preferredRole('factory',counts,0,0)[0],'tank');
 assert.equal(preferredRole('airfield',counts,0,1)[0],'scout');
 assert.equal(preferredRole('barracks',counts,0,0)[0],'heavy');
});

test('director: three finished buildings queue simultaneously on one economic tick',()=>{
 const g=new Simulation(2026,5),h=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(h);
 for(let i=0;i<5;i++)g.spawn(1,{x:h.x+140+i*6,y:h.y-125},'infantry');
 const barracks=addProducer(g,'barracks',1);
 const factory=addProducer(g,'factory',1);
 const airfield=addProducer(g,'airfield',1);
 g.credits[1]=8000;
 const before=g.credits[1];
 const army=g.units.filter(u=>u.owner===1&&u.hp>0);
 developArmy(g,g.tactical.state,army,()=>0);
 const queued=[barracks,factory,airfield].map(b=>b.queueTypes[0]);
 assert.equal(queued[0],'heavy');
 assert.equal(queued[1],'tank');
 assert.equal(queued[2],'scout');
 assert.ok(before-g.credits[1]>=3*100,'all queues spend real credits');
 assert.equal(g.queued(1),3);
});

test('director: baseline can still be benchmarked without mutating campaign state',()=>{
 const g=new Simulation(2026,5),h=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 for(let i=0;i<5;i++)g.spawn(1,{x:h.x+140+i*6,y:h.y-125},'infantry');
 const bases=[addProducer(g,'barracks',1),addProducer(g,'factory',1),addProducer(g,'airfield',1)];
 g.credits[1]=8000;g.tactical.mode='baseline';
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.equal(bases.filter(b=>b.queue.length>0).length,1);
});


test('director: operational factory buys a real rover before reserving credits for the airfield',()=>{
 const g=new Simulation(2026,4),hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 for(let i=0;i<5;i++)g.spawn(1,{x:hq.x+100+i*12,y:hq.y-120},'infantry');
 addProducer(g,'barracks',1);
 const factory=addProducer(g,'factory',1);
 g.credits[1]=400;
 const before=g.credits[1];
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.equal(factory.queueTypes[0],'rover','first affordable vehicle must be purchased immediately');
 assert.equal(factory.queueCosts[0],UNITS.rover.cost,'the current catalog rover cost is recorded');
 const paid=g.bases.filter(b=>b.owner===1).reduce((total,b)=>total+(b.queueCosts??[]).reduce((sum,cost)=>sum+cost,0),0);
 assert.equal(before-g.credits[1],paid,'all concurrent production is paid, with no phantom credits');
 assert.equal(paid,UNITS.rover.cost,'the first rover is funded while the remaining credits stay banked');
 assert.equal(g.tactical.state.economy?.goal,null,'no premature 450-credit airfield reservation');
 assert.equal(g.credits[1],before-UNITS.rover.cost,'the barracks must preserve vehicle savings rather than draining the treasury');
});

test('director: first aircraft factory waits for actual ground force production',()=>{
 const g=new Simulation(2026,4),hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 for(let i=0;i<5;i++)g.spawn(1,{x:hq.x+100+i*12,y:hq.y-120},'infantry');
 addProducer(g,'barracks',1);const factory=addProducer(g,'factory',1);
 g.credits[1]=1000;
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.ok(factory.queueTypes.some(k=>k==='tank'||k==='rover'));
 assert.ok(!g.bases.some(b=>b.owner===1&&b.kind==='airfield'));
});


test('director: a late reinforcement fights en route instead of accepting a silent move',()=>{
 const g=new Simulation(2026,4);
 g.aiClock=-1e8;
 g.time=35;
 const red=g.units.find(u=>u.owner===1&&u.kind==='infantry');
 const newcomer=g.spawn(1,{x:red.x+42,y:red.y+19},'infantry');
 const target=g.territories.find(t=>t.owner!==1&&t.neighbors.some(i=>g.territories[i].owner===1));
 assert.ok(target);
 const state=g.tactical.state;
 state.phase='attack';state.phaseAt=27;state.launchedAt=27;state.progressAt=30;
 state.groupId=4;state.group=[red.id];state.launchSize=1;
 state.target=target.id;state.rally={x:red.x,y:red.y};
 state.lastProgress=Math.hypot(red.x-target.point.x,red.y-target.point.y);
 g.updateVision();
 g.tactical.plan();
 assert.ok(state.group.includes(newcomer.id),'nearby reinforcement joins active squad');
 assert.equal(newcomer.orders[0]?.kind,'attackMove','reinforcement must attack while advancing');
 assert.equal(newcomer.orders[0]?.tactical?.mode,'assault');
});


test('director: retreat orders remain authoritative even while the main army attacks',()=>{
 const g=new Simulation(2026,4);
 g.aiClock=-1e8;
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.units=[];
 const red=g.spawn(1,{x:1550,y:1650},'infantry');
 const blue=g.spawn(0,{x:1670,y:1650},'infantry');
 g.stop([blue.id],true);
 blue.cooldown=100;
 g.tactical.state.phase='attack';
 g.updateVision();
 const beforeX=red.x,beforeHp=blue.hp;
 g.command([red.id],{x:1200,y:1650,kind:'move'});
 red.orders[0].tactical={group:3,mode:'safe'};
 g.step(.05);
 assert.ok(red.x<beforeX-2,'wounded unit must retreat instead of stopping to fight');
 assert.equal(blue.hp,beforeHp,'safe retreat order must not fire on nearby enemies');
});

test('benchmark: paid blue defenders protect their own bastion without map cheats',()=>{
 const g=new Simulation(2026,4);
 const blue=g.units.find(u=>u.owner===0&&u.kind==='infantry');
 const own=g.territories.find(t=>t.owner===0);
 assert.ok(blue&&own);
 const money=g.credits[0],units=g.units.length;
 blueDefense(g);
 assert.equal(g.units.length,units,'the scripted defender must not spawn free units');
 assert.ok(g.credits[0]<=money,'the defender must spend only its existing credits');
 assert.equal(blue.orders[0]?.kind,'attackMove');
 assert.ok(Math.hypot(blue.orders[0].x-own.point.x,blue.orders[0].y-own.point.y)<135,
  'defenders should guard their owned capture site rather than remaining at HQ');
});


test('repair: an engineer can restore damaged paid ground vehicles through the real repair command',()=>{
 const g=new Simulation(2026,4);
 g.aiClock=-1e8;
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const engineer=g.units.find(u=>u.owner===1&&u.kind==='engineer');
 const tank=g.spawn(1,{x:home.x-260,y:home.y+130},'tank');
 engineer.x=tank.x+45;engineer.y=tank.y+5;
 tank.hp=200;
 assert.equal(g.command([engineer.id],{x:tank.x,y:tank.y,kind:'repair',target:tank.id}),1);
 const before=tank.hp;
 for(let i=0;i<20;i++)g.step(.05);
 assert.ok(tank.hp>before,'engineer repair must restore real HP');
 assert.ok(tank.hp<=620,'repair may never exceed the unit maximum');
 assert.ok(g.workEffects.some(e=>e.kind==='repair'&&e.target===tank.id),'visible repair work effect must target actual vehicle');
});

test('director: damaged armored unit withdraws and is excluded from the active assault',()=>{
 const g=new Simulation(2026,4);
 g.aiClock=-1e8;g.time=90;
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const tank=g.spawn(1,{x:home.x-270,y:home.y+150},'tank');
 tank.hp=185;
 g.tactical.state.phase='attack';
 g.tactical.state.group=[tank.id];g.tactical.state.launchSize=1;
 g.tactical.state.target=g.territories.find(t=>t.owner!==1&&t.neighbors.some(i=>g.territories[i].owner===1)).id;
 g.tactical.plan();
 assert.ok(g.tactical.state.recovering.includes(tank.id),'low health vehicle must enter the recovery roster');
 assert.equal(tank.orders[0]?.kind,'move','vehicle must retreat under strict move orders');
 assert.equal(tank.orders[0]?.tactical?.mode,'safe');
});


test('director: enemy damage triggers emergency armored extraction without waiting for next AI tick',()=>{
 const g=new Simulation(2026,4);
 g.aiClock=-1e8;
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 g.units=[];
 const rover=g.spawn(1,{x:1890,y:2050},'rover'),enemy=g.spawn(0,{x:1980,y:2050},'heavy');
 rover.hp=150;
 enemy.cooldown=0;
 g.updateVision();
 for(let i=0;i<12&&!g.tactical.state.recovering?.includes(rover.id);i++)g.step(.05);
 assert.ok(rover.hp<150,'enemy must actually wound the rover');
 assert.ok(rover.hp>0,'retreat order must be issued before the rover dies');
 assert.ok(g.tactical.state.recovering?.includes(rover.id),'damage event starts extraction immediately');
 assert.equal(rover.orders[0]?.kind,'move','rover must disengage without stopping to return fire');
 assert.equal(rover.orders[0]?.tactical?.mode,'safe');
});

test('director: serviced vehicle receives actual HP and returns to the reserve above 90 percent',()=>{
 const g=new Simulation(2026,4);
 g.aiClock=-1e8;
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 g.credits[1]=0;
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const engineer=g.units.find(u=>u.owner===1&&u.kind==='engineer');
 const edge={x:Math.max(85,Math.min(g.world.size-85,hq.x+(hq.x>=g.world.size/2?165:-165))),
  y:Math.max(85,Math.min(g.world.size-85,hq.y+(hq.y>=g.world.size/2?135:-135)))};
 const dock=g.world.nearest(edge,g.obstacles());
 assert.ok(dock,'service point must be a valid map position');
 const tank=g.spawn(1,dock,'tank');
 tank.hp=400;
 engineer.x=dock.x+45;engineer.y=dock.y+5;
 g.updateVision();
 g.tactical.plan();
 assert.ok(g.tactical.state.recovering?.includes(tank.id));
 assert.equal(engineer.orders[0]?.kind,'repair','director must dispatch a real engineer');
 assert.equal(engineer.orders[0]?.target,tank.id);
 for(let i=0;i<240;i++)g.step(.05);
 assert.ok(tank.hp>=558,'repair must restore at least 90 percent of the tank maximum');
 g.tactical.plan();
 assert.ok(!g.tactical.state.recovering?.includes(tank.id),'repaired tank must rejoin field roster');
});


test('director: armored reserve survives a funded barracks purchase and never mints credits',()=>{
 const g=new Simulation(2026,4),hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 for(let i=0;i<5;i++)g.spawn(1,{x:hq.x+100+i*12,y:hq.y-120},'infantry');
 const barracks=addProducer(g,'barracks',1),factory=addProducer(g,'factory',1);
 g.credits[1]=900;
 const start=g.credits[1];
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.equal(factory.queueTypes[0],'tank');
 assert.equal(factory.queueCosts[0],450,'tank must cost its actual catalog price');
 assert.equal(barracks.queueTypes[0],'infantry','barracks may produce while the next vehicle budget stays protected');
 assert.equal(g.credits[1],350,'remaining credits must stay above the 300-credit armor reserve');
 assert.ok(g.credits[1]>=300,'a funded barracks order must not drain the next vehicle reserve');
 const paid=g.bases.filter(b=>b.owner===1).reduce((total,b)=>total+
  (b.queueCosts??[]).reduce((sum,cost)=>sum+cost,0),0);
 assert.equal(start-g.credits[1],paid,'both simultaneous orders are fully funded without minted credits');
});

test('director: a threatened base may recruit infantry instead of preserving the vehicle reserve',()=>{
 const g=new Simulation(2026,4),hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 for(let i=0;i<5;i++)g.spawn(1,{x:hq.x+100+i*12,y:hq.y-120},'infantry');
 const barracks=addProducer(g,'barracks',1),factory=addProducer(g,'factory',1);
 g.credits[1]=UNITS.rover.cost+UNITS.infantry.cost;
 assert.ok(g.recruit(factory.id,'rover'),'fund the rover first so the emergency tests the remaining infantry budget');
 const foe=g.spawn(0,{x:hq.x+130,y:hq.y+25},'infantry');
 g.updateVision();
 assert.ok(g.canSee(1,foe),'the budget override requires an actually visible threat');
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.equal(factory.queueTypes[0],'rover');
 assert.ok(barracks.queue.length>0,'emergency infantry remains allowed when the base is under attack');
 assert.equal(g.credits[1],0,'both urgent orders must be fully paid');
});


test('director: a sighted enemy HQ triggers a fully paid rocket siege rather than random rovers',()=>{
 const g=new Simulation(2026,4),hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 for(let i=0;i<5;i++)g.spawn(1,{x:hq.x+105+i*9,y:hq.y-110},'infantry');
 const factory=addProducer(g,'factory',1),barracks=addProducer(g,'barracks',1);
 const blueHQ=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 g.memories[1].push({id:blueHQ.id,owner:0,x:blueHQ.x,y:blueHQ.y,hp:blueHQ.hp,
  territory:blueHQ.territory,kind:'headquarters'});
 g.credits[1]=500;
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.equal(factory.queue.length,0,'HQ siege must save for artillery, not spend on cheap rovers');
 assert.equal(barracks.queue.length,0,'barracks cannot drain the 600-credit artillery budget');
 assert.equal(g.credits[1],500);
 g.credits[1]=650;
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.equal(factory.queueTypes[0],'artillery','sighted HQ requires a real siege weapon');
 assert.equal(factory.queueCosts[0],600);
 assert.equal(g.credits[1],50);
});


test('director: barracks stays idle exactly at the minimum reserve threshold',()=>{
 const g=new Simulation(2026,4),hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 for(let i=0;i<5;i++)g.spawn(1,{x:hq.x+100+i*12,y:hq.y-120},'infantry');
 const barracks=addProducer(g,'barracks',1),factory=addProducer(g,'factory',1);
 g.credits[1]=750;
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.equal(factory.queueTypes[0],'tank','factory must pay for the tank before barracks');
 assert.equal(barracks.queue.length,0,'barracks must not spend the 300-credit minimum reserve');
 assert.equal(g.credits[1],300,'exact armor reserve stays banked for the next vehicle');
});


test('director: once a rover exists it saves for a real tank rather than buying another rover',()=>{
 const g=new Simulation(2026,4),hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 for(let i=0;i<5;i++)g.spawn(1,{x:hq.x+110+i*10,y:hq.y-120},'infantry');
 g.spawn(1,{x:hq.x+110,y:hq.y+135},'rover');
 const factory=addProducer(g,'factory',1),barracks=addProducer(g,'barracks',1);
 g.credits[1]=400;
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.equal(factory.queue.length,0,'400 credits must be saved for tank rather than a second rover');
 assert.equal(barracks.queue.length,0,'barracks must protect the entire 450-credit tank budget');
 assert.equal(g.credits[1],400);
 g.credits[1]=500;
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.equal(factory.queueTypes[0],'tank');
 assert.equal(factory.queueCosts[0],450);
 assert.equal(g.credits[1],50);
});

test('director: after rover and tank it finances a real artillery unit at mature income',()=>{
 const g=new Simulation(2026,4),hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 for(let i=0;i<5;i++)g.spawn(1,{x:hq.x+110+i*10,y:hq.y-120},'infantry');
 g.spawn(1,{x:hq.x+115,y:hq.y+110},'rover');
 g.spawn(1,{x:hq.x+155,y:hq.y+135},'tank');
 for(const territory of g.territories.filter(t=>t.owner===-1))territory.owner=1;
 assert.ok(g.income(1)>=35,'mature-economy test must have enough legitimate sector income');
 const factory=addProducer(g,'factory',1),barracks=addProducer(g,'barracks',1);
 g.credits[1]=500;
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.equal(factory.queue.length,0,'do not substitute a tank or rover for the planned rocket launcher');
 assert.equal(barracks.queue.length,0,'hold the artillery reserve');
 assert.equal(g.credits[1],500);
 g.credits[1]=650;
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.equal(factory.queueTypes[0],'artillery');
 assert.equal(factory.queueCosts[0],600);
 assert.equal(g.credits[1],50);
});
