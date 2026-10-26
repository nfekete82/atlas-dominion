import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {newAdaptive,updateAdaptive,rateMission} from '../dist/src/reborn/adaptive-strategy.js';
import {newCampaign,chooseMission} from '../dist/src/reborn/campaign-commander.js';
function scene(){const g=new Simulation(2026,4);g.time=100;g.visible[1].fill(0);return {g,s:newAdaptive(),home:g.bases.find(b=>b.owner===1)};}
function see(g,u){g.visible[1][g.world.index(u)]=1;}
test('adaptation: hidden unit types, positions, health and cargo never influence doctrine',()=>{
 const a=scene(),b=scene();const x=a.g.spawn(0,{x:400,y:2300},'gunship'),y=b.g.spawn(0,{x:1300,y:2600},'bomber');x.hp=1;y.hp=600;
 updateAdaptive(a.g,a.s,a.home,[]);updateAdaptive(b.g,b.s,b.home,[]);assert.deepEqual(a.s,b.s);assert.equal(a.s.strategy,'unknown');
});
test('adaptation: actual combat air is recognized; a transport alone does not become an air attack',()=>{
 const {g,s,home}=scene();const transport=g.spawn(0,{x:700,y:2000},'scout');see(g,transport);updateAdaptive(g,s,home,[]);assert.equal(s.counts.air,0);assert.equal(s.strategy,'unknown');
 const enemy=g.spawn(0,{x:800,y:2000},'gunship');see(g,enemy);g.time+=3;updateAdaptive(g,s,home,[]);assert.equal(s.strategy,'air');assert.ok(s.confidence>=.55);
 g.visible[1].fill(0);g.time+=46;updateAdaptive(g,s,home,[]);assert.equal(s.counts.air,0);
});
test('adaptation: hysteresis retains a plan during brief observation changes then permits a real switch',()=>{
 const {g,s,home}=scene(),air=g.spawn(0,{x:700,y:2000},'gunship');see(g,air);updateAdaptive(g,s,home,[]);
 for(let i=0;i<4;i++)see(g,g.spawn(0,{x:home.x-200+i*30,y:home.y+100},'infantry'));
 g.time++;updateAdaptive(g,s,home,[]);assert.equal(s.strategy,'air');g.time+=13;updateAdaptive(g,s,home,[]);assert.equal(s.strategy,'infantry');
});
test('adaptation: public territory gains identify expansion and repeated observed losses identify attrition',()=>{
 const {g,s,home}=scene();updateAdaptive(g,s,home,[]);g.time+=20;g.territories[0].owner=0;g.territories[1].owner=0;updateAdaptive(g,s,home,[]);assert.equal(s.strategy,'expansion');
 g.time+=20;const losses=[1,2,3,4].map(id=>({id,x:1000,y:1000,at:g.time,strength:1}));
 updateAdaptive(g,s,home,losses,{fronts:[{sector:2,x:1000,y:1000,at:g.time,until:g.time+40,power:1,towers:3,failures:6}]});assert.equal(s.strategy,'attrition');
});
test('mission utility: insufficient counters, reinforcement cost, age and losses alter opportunity cost',()=>{
 const p={base:100,distance:600,income:50,missingCredits:0,ownHP:1000,foeDPS:90,visiblePower:200,ownPower:500,towers:3,siege:true,age:0,failures:0,capture:false,enemyOwned:true};
 const ready=rateMission(p,'tower'),unready=rateMission({...p,siege:false,missingCredits:600},'tower');assert.ok(unready.score>ready.score);assert.ok(unready.expectedLoss>ready.expectedLoss);assert.ok(unready.budgetCost>0);
 assert.ok(rateMission({...p,age:100,failures:3},'attrition').score>ready.score);
 assert.ok(rateMission({...p,capture:true},'expansion').score<rateMission({...p,capture:true},'unknown').score);
});
test('mission planner: unreachable top-ranked choices do not hide a reachable alternative',()=>{
 const {g,s,home}=scene(),c=newCampaign();for(const t of g.territories)if(t.id!==home.territory)t.neighbors=[home.territory];let calls=0;
 const mission=chooseMission(g,c,home,{strategy:'unknown',force:g.units.filter(u=>u.owner===1),losses:[],fronts:[],route:()=>++calls<4?undefined:{length:500,risk:0}});
 assert.ok(calls>=4);assert.ok(mission);assert.ok(c.alternatives.length>0);
});
test('adaptation: saved learning is optional, bounded and round-trips with the real loader',()=>{
 const {g,home}=scene();g.tactical.plan();assert.ok(g.tactical.state.adaptive);
 const raw=g.save(),loaded=Simulation.load(raw);assert.deepEqual(loaded.tactical.state.adaptive,g.tactical.state.adaptive);
 const bad=structuredClone(raw);bad.ai.adaptive.confidence=2;assert.throws(()=>Simulation.load(bad));delete raw.ai.adaptive;assert.ok(Simulation.load(raw));
});

test('support screen: a visible heavy attacking artillery is intercepted without abandoning the firing queue',()=>{
 const {g,home}=scene();g.units=[];g.world.blocked.fill(0);g.world.opaque.fill(0);
 const rocket=g.spawn(1,{x:2100,y:1600},'artillery'),guard=g.spawn(1,{x:2150,y:1650},'heavy'),enemy=g.spawn(0,{x:2000,y:1600},'heavy');
 g.updateVision();const assigned=g.tactical.screenThreats([rocket,guard],{x:1500,y:1600});assert.ok(assigned.has(guard.id));assert.equal(guard.orders[0]?.target,enemy.id);
 assert.equal(rocket.orders.length,0,'screen control does not rewrite artillery mission');
 const before=guard.orders;g.time+=3;g.tactical.screenThreats([rocket,guard],home);assert.equal(guard.orders,before);
});
