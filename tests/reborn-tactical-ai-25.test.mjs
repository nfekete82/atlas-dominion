import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {chooseSiegeShot,chooseRaidFront,replanAfterLoss,allowSecondaryPressure} from '../dist/src/reborn/ai25-doctrine.js';
import {newCampaign,chooseMission} from '../dist/src/reborn/campaign-commander.js';
import {distance} from '../dist/src/reborn/config.js';

test('2.5: artillery prefers the safer reachable fire angle, not the nearest exposed shot',()=>{
 const options=[
  {gunId:3,at:{x:500,y:200},travel:150,risk:9,gunHp:300,primary:true},
  {gunId:5,at:{x:900,y:450},travel:290,risk:0,gunHp:400,primary:false},
  {gunId:8,at:{x:950,y:450},travel:Infinity,risk:0,gunHp:25,primary:false},
 ];
 const chosen=chooseSiegeShot(options);
 assert.equal(chosen.gunId,5,'a 140-unit detour beats known lethal tower exposure');
 assert.equal(chooseSiegeShot(options.slice(0,1)).gunId,3);
 assert.equal(chooseSiegeShot([]),undefined);
 assert.equal(chooseSiegeShot([{...options[1],gunHp:0}]),undefined);
 assert.deepEqual(options[0].at,{x:500,y:200},'candidate scorer must not mutate observations');
});

test('2.5: second front selects a safe neighboring sector, never the main fight or an observed gun',()=>{
 const fronts=[
  {id:1,x:200,y:400,owner:0,income:35,routeLength:120,routeRisk:0,observedThreat:false},
  {id:2,x:300,y:400,owner:-1,income:25,routeLength:200,routeRisk:0,observedThreat:false},
  {id:3,x:400,y:400,owner:-1,income:25,routeLength:90,routeRisk:1,observedThreat:true},
  {id:4,x:500,y:400,owner:-1,income:25,routeLength:100,routeRisk:15,observedThreat:false}
 ];
 assert.equal(chooseRaidFront(fronts,1)?.id,2);
 assert.equal(chooseRaidFront(fronts.filter(x=>x.id!==2),1),undefined);
 assert.equal(allowSecondaryPressure(10,8,8,2),true);
 assert.equal(allowSecondaryPressure(8,6,6,2),false);
 assert.equal(allowSecondaryPressure(10,8,8,1),false);
});

test('2.5: only recorded losses or repeated real failed fronts justify replanning',()=>{
 const x={elapsed:60,freshDamage:false,progressAge:45,recentLosses:3,frontFailures:0,frontAge:0};
 assert.equal(replanAfterLoss(x),true);
 assert.equal(replanAfterLoss({...x,frontFailures:2,recentLosses:0,frontAge:30}),true);
 assert.equal(replanAfterLoss({...x,frontFailures:2,recentLosses:0,frontAge:110}),false);
 assert.equal(replanAfterLoss({...x,freshDamage:true}),false);
 assert.equal(replanAfterLoss({...x,progressAge:7}),false);
 assert.equal(replanAfterLoss({...x,elapsed:20}),false);
 assert.equal(replanAfterLoss({...x,recentLosses:0}),false);
});

test('2.5: independent raid uses two paid spare rovers and leaves main squad and HQ guard untouched',()=>{
 const g=new Simulation(2026,4);g.units=[];g.aiClock=-1e8;g.time=90;
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.memories[1]=[];g.visible[1].fill(0);
 for(const t of g.territories){t.owner=1;t.neighbors=[];}
 const own=g.territories[0],main=g.territories[1],other=g.territories[2];
 own.owner=1;own.point={x:900,y:2000};own.neighbors=[main.id,other.id];
 main.owner=0;main.point={x:2800,y:2000};main.neighbors=[own.id];
 other.owner=-1;other.point={x:1500,y:2100};other.neighbors=[own.id];
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');Object.assign(home,{x:900,y:2000});
 const rovers=[g.spawn(1,{x:1050,y:2100},'rover'),g.spawn(1,{x:1090,y:2100},'rover')];
 const infantry=Array.from({length:9},(_,i)=>g.spawn(1,{x:930+i*17,y:1940},'infantry'));
 const mainIds=infantry.slice(0,6).map(u=>u.id);
 g.tactical.state.group=mainIds;g.tactical.state.phase='attack';g.tactical.state.groupId=12;
 g.tactical.field();
 const fighters=g.units.filter(u=>u.owner===1);
 const selected=g.tactical.secondaryPressure(fighters,{sector:main.id},home);
 assert.deepEqual([...selected].sort((a,b)=>a-b),rovers.map(u=>u.id).sort((a,b)=>a-b));
 assert.equal(g.tactical.state.battle.squads.find(q=>q.role==='raid').target,other.id);
 assert.ok(rovers.every(u=>u.orders[0]?.kind==='attackMove'));
 assert.ok(rovers.every(u=>!mainIds.includes(u.id)),'never borrow a member of the main assault');
 assert.equal(g.tactical.diagnostics.secondaryRaids,1);
 const earlier=rovers.map(u=>u.orders);
 g.time+=3;g.tactical.secondaryPressure(fighters,{sector:main.id},home);
 assert.deepEqual(rovers.map(u=>u.orders),earlier,'stable raid is not retargeted on each macro tick');
 other.owner=1;
 const gone=g.tactical.secondaryPressure(fighters,{sector:main.id},home);
 assert.equal(gone.size,0,'completed frontier is released for the main attack');
});

test('2.5: a concealed opponent cannot influence raid choice until observed',()=>{
 const g=new Simulation(2026,4);g.aiClock=-1e8;g.time=65;g.units=[];
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.memories[1]=[];g.visible[1].fill(0);
 for(const t of g.territories){t.owner=1;t.neighbors=[];}
 const own=g.territories[0],sector=g.territories[1],main=g.territories[2];own.neighbors=[1,2];
 sector.owner=-1;sector.point={x:1500,y:1800};sector.neighbors=[0];
 main.owner=0;main.point={x:2900,y:2300};main.neighbors=[0];
 const home=g.bases.find(b=>b.owner===1);Object.assign(home,{x:900,y:1800});
 const two=[g.spawn(1,{x:1150,y:1800},'rover'),g.spawn(1,{x:1180,y:1800},'rover')];
 const other=Array.from({length:9},(_,i)=>g.spawn(1,{x:900+i*5,y:1750},'heavy'));
 g.tactical.state.group=other.slice(0,5).map(u=>u.id);g.tactical.state.groupId=4;
 const enemy=g.spawn(0,{x:sector.point.x+20,y:sector.point.y+15},'heavy');
 const fighters=[...two,...other];g.tactical.field();
 assert.equal(g.tactical.secondaryPressure(fighters,{sector:main.id},home).size,2);
 g.tactical.state.battle.squads=[];two.forEach(u=>u.orders=[]);
 g.visible[1][g.world.index(enemy)]=1;
 assert.equal(g.tactical.secondaryPressure(fighters,{sector:main.id},home).size,0);
});

test('2.5: mission selection considers a fourth reachable frontage when higher-ranked three are blocked',()=>{
 const g=new Simulation(2026,4);g.time=60;g.memories[1]=[];
 for(const t of g.territories){t.owner=1;t.neighbors=[];}
 const own=g.territories[0];own.point={x:0,y:100};own.neighbors=[1,2,3,4];
 for(let id=1;id<=4;id++){
  const t=g.territories[id];t.owner=-1;t.point={x:id*150,y:100};t.neighbors=[0];t.income=25;
 }
 const checked=[],context={strategy:'unknown',intelligent:true,force:g.units.filter(u=>u.owner===1),
  losses:[],fronts:[],route:p=>{
   checked.push(p.x);
   return p.x>=600?{length:600,risk:0}:undefined;
  }};
 const m=chooseMission(g,newCampaign(),own.point,context);
 assert.equal(m?.sector,4);
 assert.ok(checked.length>=4,'must not stop after testing three blocked high-score candidates');
});

test('2.5: doctrine flags and forecasting are deterministic and never alter persisted savegames',()=>{
 const g=new Simulation(2026,4),saved=g.save();
 const x={elapsed:80,freshDamage:false,progressAge:30,recentLosses:3,frontFailures:2,frontAge:12};
 assert.equal(replanAfterLoss(x),replanAfterLoss(structuredClone(x)));
 g.tactical.doctrineMode='legacy';assert.deepEqual(g.save(),saved);
 g.tactical.doctrineMode='intelligent';assert.deepEqual(g.save(),saved);
});
