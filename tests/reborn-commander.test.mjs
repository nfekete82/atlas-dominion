import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {newCampaign,chooseMission,reconGoal,refreshIntelligence,validCampaign} from '../dist/src/reborn/campaign-commander.js';

test('commander: unknown enemy changes cannot influence strategic or recon choices',()=>{
 const a=new Simulation(731,4),b=new Simulation(731,4);
 const hidden=b.bases.find(v=>v.owner===0);hidden.x+=400;hidden.hp=1;hidden.kind='factory';
 const sa=newCampaign(),sb=newCampaign(),origin=a.bases.find(v=>v.owner===1);
 assert.deepEqual(chooseMission(a,sa,origin),chooseMission(b,sb,origin));
 const ua=a.units.find(u=>u.owner===1),ub=b.units.find(u=>u.owner===1);
 assert.deepEqual(reconGoal(a,sa,ua,()=>0),reconGoal(b,sb,ub,()=>0));
 assert.equal(sa.intel.length,0);
});
test('commander: remembered HQ remains a mission in captured territory until observed gone',()=>{
 const g=new Simulation(9109,4),s=newCampaign(),hq=g.bases.find(b=>b.owner===0);
 g.territories[hq.territory].owner=1;
 g.memories[1].push({id:hq.id,kind:hq.kind,owner:0,x:hq.x,y:hq.y,hp:hq.hp,territory:hq.territory});
 const mission=chooseMission(g,s,hq);assert.equal(mission.kind,'structure');assert.equal(mission.objective,hq.id);
 g.time=60;hq.hp=0;assert.equal(chooseMission(g,s,hq),mission,'hidden live state must not erase memory');
 g.memories[1]=[];assert.notEqual(chooseMission(g,s,hq)?.objective,hq.id);
});
test('commander: genuine observed siege damage extends a persistent mission beyond movement timeout',()=>{
 const g=new Simulation(2027,4),s=newCampaign(),hq=g.bases.find(b=>b.owner===0);
 const memory={id:hq.id,kind:hq.kind,owner:0,x:hq.x,y:hq.y,hp:hq.hp,territory:hq.territory};g.memories[1].push(memory);
 const mission=chooseMission(g,s,hq);
 g.time=90;memory.hp-=100;assert.equal(chooseMission(g,s,hq),mission);assert.equal(mission.progressAt,90);
 g.time=150;assert.equal(chooseMission(g,s,hq),mission);assert.equal(s.aborted,0);
});
test('commander: independent scout assignments persist and avoid duplicate fog areas',()=>{
 const g=new Simulation(2026,5),s=newCampaign(),u=g.units.find(u=>u.owner===1),v={...u,id:999};
 const first=reconGoal(g,s,u,()=>0);assert.ok(first);assert.equal(g.canSee(1,first),false);
 g.time=3;const again=reconGoal(g,s,u,()=>0);assert.equal(again.x,first.x);assert.equal(again.y,first.y);
 const second=reconGoal(g,s,v,()=>0);assert.ok(second);assert.notDeepEqual(first,second);
 assert.equal(validCampaign(s,g.time,p=>p.x>=0&&p.y>=0&&p.x<=g.world.size&&p.y<=g.world.size,g.territories.length),true);
});
test('commander: optional state round-trips and malformed missions are rejected',()=>{
 const g=new Simulation(2026,4);g.time=30;g.tactical.plan();
 assert.ok(g.tactical.state.commander);const saved=g.save(),loaded=Simulation.load(saved);
 assert.deepEqual(loaded.tactical.state.commander,g.tactical.state.commander);
 const raw=structuredClone(saved);raw.ai.commander.mission.sector=10000;
 assert.throws(()=>Simulation.load(raw));
 delete raw.ai.commander;assert.ok(Simulation.load(raw));
});

test('commander: newly discovered HQ interrupts its blocked capture mission and a covering tower becomes the stable objective',()=>{
 const g=new Simulation(2026,4),s=newCampaign(),hq=g.bases.find(b=>b.owner===0);
 s.mission={kind:'capture',x:g.territories[hq.territory].point.x,y:g.territories[hq.territory].point.y,sector:hq.territory,objective:null,hp:0,since:0,progressAt:0,distance:50};
 const remember=b=>({id:b.id,kind:b.kind,owner:0,x:b.x,y:b.y,hp:b.hp,territory:b.territory});
 g.memories[1].push(remember(hq));assert.equal(chooseMission(g,s,hq).objective,hq.id);
 const turret={id:9999,kind:'turret',owner:0,x:hq.x+180,y:hq.y,hp:650,territory:hq.territory};g.memories[1].push(turret);
 const mission=chooseMission(g,s,hq);assert.equal(mission.objective,turret.id);
 g.time=3;assert.equal(chooseMission(g,s,hq),mission);
});
test('commander: unchanged structure orders survive macro pulses without resetting their path',()=>{
 const g=new Simulation(731,4),hq=g.bases.find(b=>b.owner===0),home=g.bases.find(b=>b.owner===1);
 const tank=g.spawn(1,{x:home.x-200,y:home.y+160},'tank'),heavy=g.spawn(1,{x:home.x-250,y:home.y+160},'heavy'),arty=g.spawn(1,{x:home.x-300,y:home.y+160},'artillery');
 g.memories[1].push({id:hq.id,kind:hq.kind,owner:0,x:hq.x,y:hq.y,hp:hq.hp,territory:hq.territory});
 const s=g.tactical.state;s.phase='attack';s.group=[tank.id,heavy.id,arty.id];s.launchSize=3;g.time=50;
 s.commander=newCampaign();s.commander.mission={kind:'structure',x:hq.x,y:hq.y,sector:hq.territory,objective:hq.id,hp:hq.hp,since:50,progressAt:50,distance:3000};
 g.tactical.plan();const orders=tank.orders;assert.equal(orders[0].target,hq.id);
 tank.path=[{x:tank.x-50,y:tank.y+50}];g.time+=3;g.tactical.plan();
 assert.equal(tank.orders,orders);assert.equal(tank.path.length,1);
});

test('logistics: a failed forward landing returns real passengers to own ground',()=>{
 const g=new Simulation(731,4),home=g.bases.find(b=>b.owner===1);g.aiClock=-1e8;g.credits[1]=0;g.time=200;
 const h=g.spawn(1,{x:home.x-200,y:home.y+150},'scout'),rider=g.spawn(1,{x:h.x-40,y:h.y},'heavy');
 assert.equal(g.transports.board(h.id,[rider.id]),1);for(let i=0;i<180;i++)g.step(.05);
 assert.equal(h.transport.cargo.length,1);
 const target={x:1500,y:1800},s=g.tactical.state;s.airlift={heli:h.id,target,phase:'delivery',since:g.time};
 const unload=g.transports.unload.bind(g.transports);let rejected=false;
 g.transports.unload=(id,p)=>{if(p.x===target.x&&p.y===target.y){rejected=true;return false;}return unload(id,p);};
 g.tactical.airlift(g.units.filter(u=>u.owner===1),home);assert.equal(rejected,true);assert.notDeepEqual(s.airlift.target,target);
 for(let i=0;i<500;i++)g.step(.05);assert.equal(h.transport.cargo.length,0);assert.equal(rider.carrier,undefined);
});

test('commander: a safer fourth approach beats three short but hazardous attack routes',()=>{
 const g=new Simulation(2026,4),state=newCampaign(),home=g.bases.find(b=>b.owner===1);
 // At least four different frontier objectives; no hidden enemy knowledge.
 g.territories.forEach((sector,index)=>{sector.owner=index%2===0?1:-1;});
 g.memories[1]=[];
 const queried=[];
 const context={strategy:'unknown',force:[],losses:[],fronts:[],route:point=>{
  queried.push({...point});
  return {length:120,risk:queried.length<=3?10000:0};
 }};
 const mission=chooseMission(g,state,home,context);
 assert.ok(queried.length>=4,'consider at least one alternative after three risky routes');
 assert.ok(queried.length<=8,'cap expensive real-world pathfinding each macro pulse');
 assert.ok(mission,'a reachable campaign objective exists');
 assert.ok(queried.slice(3).some(p=>p.x===mission.x&&p.y===mission.y),
  'choose a safely reachable target rather than a tempting but dangerous first-three candidate');
 g.time+=3;
 const again=chooseMission(g,state,home,{...context,route:()=>{throw Error('stable mission must not replan every pulse');}});
 assert.equal(again,mission,'keep the same mission until meaningful progress or new tactical evidence');
});
