import {addProducer} from './fixtures/reborn-production.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {distance} from '../dist/src/reborn/config.js';
const advance=(g,s)=>{for(let i=0;i<Math.round(s/.05);i++)g.step();};
function fixture(){
 const g=new Simulation();g.units=[];g.aiClock=-1e8;g.time=30;g.credits=[10000,0];g.world.blocked.fill(0);g.world.opaque.fill(0);
 Object.assign(g.bases[1],{x:900,y:1900});Object.assign(g.bases[0],{x:3300,y:3300});
 for(const t of g.territories){t.owner=-1;t.neighbors=[];}
 const own=g.territories[0],target=g.territories[1];own.owner=1;own.point={x:900,y:1900};own.neighbors=[1];target.point={x:3100,y:1900};target.neighbors=[0];
 for(let i=0;i<5;i++)g.spawn(1,{x:1100+i*18,y:1900+i*12});g.updateVision();return g;
}
test('AI pressure: paid reinforcements leave home, keep a guard and join the active attack without stopping the original column',()=>{
 const g=fixture();g.tactical.plan();assert.equal(g.tactical.state.phase,'attack');
 const oldGroup=[...g.tactical.state.group],oldIds=new Set(g.units.map(u=>u.id)),barracks=addProducer(g,'barracks',1);g.credits[1]=200;
 assert.ok(g.recruit(barracks.id,'infantry'));assert.ok(g.recruit(barracks.id,'infantry'));assert.equal(g.credits[1],0);
 advance(g,11);const recruits=g.units.filter(u=>!oldIds.has(u.id));assert.equal(recruits.length,2);
 g.tactical.plan();const travelling=recruits.find(u=>u.orders[0]?.tactical?.mode==='safe');assert.ok(travelling,'reinforcements must leave the production area');assert.equal(travelling.orders[0].march,undefined,'the distant recruit must not hold up the front');
 assert.ok(g.units.some(u=>u.owner===1&&!g.tactical.state.group.includes(u.id)&&!u.orders.length),'retain a real home guard');
 const before={...travelling};advance(g,1);assert.ok(distance(before,travelling)>50);
 const front=g.units.filter(u=>oldGroup.includes(u.id)),anchor=front.reduce((p,u)=>({x:p.x+u.x/front.length,y:p.y+u.y/front.length}),{x:0,y:0});Object.assign(travelling,{x:anchor.x+30,y:anchor.y+30});
 g.tactical.plan();assert.ok(g.tactical.state.group.includes(travelling.id));assert.ok(oldGroup.every(id=>g.tactical.state.group.includes(id)));assert.ok(travelling.orders.length);
});
test('AI pressure: rallying troops approach independently instead of waiting on a marching cohort',()=>{
 const g=fixture();g.tactical.state.rally={x:1500,y:1700};g.tactical.plan();assert.equal(g.tactical.state.phase,'gather');
 const waiting=g.units.filter(u=>u.orders[0]?.tactical?.mode==='safe');assert.ok(waiting.length>=4);assert.ok(waiting.every(u=>u.orders[0].march===undefined));
 const before=waiting.map(u=>({...u}));advance(g,1);assert.ok(waiting.every((u,i)=>distance(u,before[i])>50));
});
test('AI pressure: a late reinforcement cannot hold three ready fighters at an undefended rally forever',()=>{
 const g=fixture();g.units=[];for(let i=0;i<3;i++)g.spawn(1,{x:1100+i*15,y:1900});
 const late=g.spawn(1,{x:900,y:2900}),guard=g.spawn(1,{x:900,y:1800});g.time=60;g.tactical.state.phase='gather';g.tactical.state.phaseAt=60;g.tactical.state.rally={x:1100,y:1900};g.updateVision();
 g.tactical.plan();assert.equal(g.tactical.state.phase,'gather');g.time+=19;g.tactical.plan();assert.equal(g.tactical.state.phase,'attack');assert.equal(g.tactical.state.group.length,3);assert.ok(!g.tactical.state.group.includes(late.id));assert.ok(!g.tactical.state.group.includes(guard.id));
});
test('director: tank, infantry and heavy form a shared local assault pace while artillery and distant recruits are independent',()=>{
 const g=new Simulation(2026,4);g.units=[];g.aiClock=-1e8;g.world.blocked.fill(0);g.world.opaque.fill(0);
 const tank=g.spawn(1,{x:1710,y:1700},'tank');
 const heavy=g.spawn(1,{x:1680,y:1730},'heavy');
 const foot=g.spawn(1,{x:1650,y:1700},'infantry');
 const artillery=g.spawn(1,{x:1660,y:1640},'artillery');
 const far=g.spawn(1,{x:880,y:1700},'rover');
 const goal={x:2800,y:1700};
 g.tactical.state.phase='attack';g.tactical.state.groupId=9;
 g.tactical.issue([tank,heavy,foot,artillery,far],goal,'assault');
 const cohort=[tank,heavy,foot].map(u=>u.id);
 for(const u of [tank,heavy,foot]){
  assert.deepEqual(u.orders[0].march,cohort,'nearby front shares one marching unit set');
  assert.equal(u.orders[0].kind,'attackMove');
 }
 assert.equal(artillery.orders[0].march,undefined,'rocket battery takes its own safe standoff path');
 assert.equal(far.orders[0].march,undefined,'far-away reinforcements never anchor an attack');
 const starting=[tank,heavy,foot].map(u=>({...u}));
 advance(g,1);
 assert.ok([tank,heavy,foot].every((u,i)=>distance(u,starting[i])>15),'coordinated troops do advance');
 assert.ok(distance(tank,starting[0])<=78+12,'tank does not outrun its heavy-infantry screen');
 assert.ok(distance(far,goal)<distance({x:880,y:1700},goal),'distant vehicle is free to catch up');
});

test('AI pressure: a rock detour does not freeze the leader; open-ground cohesion remains bounded',()=>{
 const g=fixture();g.units=[];const leader=g.spawn(1,{x:2400,y:2100}),lagger=g.spawn(1,{x:1200,y:2100}),goal={x:2700,y:2100};
 for(const u of [leader,lagger]){u.orders=[{...goal,kind:'move',tactical:{group:1,mode:'safe'},march:[leader.id,lagger.id]}];u.repath=10;}
 leader.path=[goal];lagger.path=[{x:1200,y:2300},goal];g.step();assert.ok(leader.x>2400,'do not deadlock around a bend');
 Object.assign(leader,{x:2400,y:2100});Object.assign(lagger,{x:1200,y:2100});leader.path=[goal];lagger.path=[goal];g.step();assert.equal(leader.x,2400,'wait for the lagging front on clear straight ground');
});
for(const seed of [2026,42])test(`AI pressure: real campaign ${seed} reaches the player front and fires within five simulated minutes`,()=>{
 const g=Simulation.campaign(seed),blue=new Set(g.territories.filter(t=>t.owner===0).map(t=>t.id));let firstFire=null,firstCapture=null;
 for(let i=0;i<3000&&g.status==='playing';i++){
  g.step(.1);if(firstFire===null&&g.shots.some(s=>s.owner===1))firstFire=g.time;
  if(firstCapture===null&&g.territories.some(t=>blue.has(t.id)&&t.owner===1))firstCapture=g.time;
 }
 assert.ok(firstFire!==null&&firstFire<300,`no real attack in seed ${seed}`);assert.ok(firstCapture!==null&&firstCapture<240,`no player-front pressure in seed ${seed}`);
});
