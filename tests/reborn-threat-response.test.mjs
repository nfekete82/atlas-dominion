import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES,distance} from '../dist/src/reborn/config.js';
import {newBattle,assessBattle,recordFailure,retryFront} from '../dist/src/reborn/battle-response.js';
function scene(){
 const g=new Simulation(2026,4);g.units=[];g.aiClock=-1e8;g.credits=[0,0];g.world.blocked.fill(0);g.world.opaque.fill(0);
 for(const t of g.territories)t.owner=-1;
 const tower={...g.bases[0],id:1900,kind:'turret',x:1500,y:1500,hp:650,radius:30,buildRemaining:0,queue:[],queueTypes:[],turretAngle:0,cooldown:0};g.bases.push(tower);
 const unit=g.spawn(1,{x:1950,y:1500},'infantry');g.updateVision();return {g,tower,unit};
}
test('tower response: first actual hit triggers an authoritative retreat within the same fixed tick',()=>{
 const {g,tower,unit}=scene();g.command([unit.id],{x:1300,y:1500,kind:'attackMove'});g.step(.05);
 assert.ok(unit.hp<100);assert.equal(unit.orders[0]?.kind,'move');assert.equal(unit.orders[0]?.tactical?.mode,'safe');
 assert.ok(g.tactical.state.battle.withdrawals.some(w=>w.unit===unit.id));
 assert.ok(distance(unit.orders[0],tower)>RULES.turret.range);
 const before={x:unit.x,y:unit.y};g.step(.05);assert.ok(distance(unit,before)>0);
});
test('tower response: a fogged shooter grants no enemy building ID, position or HP',()=>{
 const {g,tower,unit}=scene();assert.equal(g.canSee(1,tower),false);g.step(.05);
 assert.equal(g.tactical.state.knownTurrets.length,0);assert.equal(g.memories[1].some(m=>m.id===tower.id),false);
 const b=g.tactical.state.battle;assert.ok(b.withdrawals.length);assert.equal(JSON.stringify(b).includes('1900'),false);
});
test('tower response: macro gathering cannot overwrite the immediate retreat',()=>{
 const {g,unit}=scene();g.step(.05);const first={...unit.orders[0]};g.time+=3;g.tactical.plan();
 assert.equal(unit.orders[0]?.kind,'move');assert.equal(unit.orders[0]?.tactical?.mode,'safe');assert.equal(unit.orders[0].x,first.x);assert.equal(unit.orders[0].y,first.y);
});
test('tower response: burst damage coalesces commands instead of replanning each round',()=>{
 const {g,unit}=scene();let commands=0;const command=g.command.bind(g);g.command=(...a)=>{commands++;return command(...a);};
 for(let i=0;i<8;i++)g.step(.05);assert.ok(unit.hp<100);assert.equal(commands,1);
});
test('tower response: player, legacy maps and explicit baseline retain existing controls',()=>{
 for(const label of ['player','legacy','baseline']){
  const {g,unit}=scene();if(label==='player')unit.owner=0;if(label==='legacy')Object.defineProperty(g.world,'mapVersion',{value:2});if(label==='baseline')g.tactical.mode='baseline';
  g.tactical.underTowerFire(unit);assert.equal(g.tactical.state.battle,undefined);assert.equal(unit.orders.length,0);
 }
});
test('battle assessment: HP, opponent strength and genuine siege range distinguish all four decisions',()=>{
 const {g,unit,tower}=scene(),guns=[tower,{...tower,id:1901,x:1650},{...tower,id:1902,y:1650}];
 assert.equal(assessBattle([unit],[],guns,0).stance,'reinforce');assert.equal(assessBattle([unit],[],guns,0,true).stance,'withdraw');
 const heavies=Array.from({length:8},(_,i)=>g.spawn(1,{x:2000+i*25,y:1500},'heavy'));
 assert.equal(assessBattle(heavies,[],[tower],0).stance,'attack');
 const rocket=g.spawn(1,{x:2200,y:1500},'artillery');assert.equal(assessBattle([rocket,...heavies],[],guns,0).stance,'siege');
 assert.ok(assessBattle([unit],heavies,guns,0).deficit>assessBattle([unit],[],guns,0).deficit);
});
test('failed front: same weak wave is held; real reinforcement, siege or cooldown permits a retry',()=>{
 const b=newBattle();recordFailure(b,2,{x:1000,y:1000},100,3,10);
 assert.equal(retryFront(b,2,100,3,0,11),false);assert.equal(retryFront(b,2,150,3,0,11),true);
 assert.equal(retryFront(b,2,100,3,1,11),true);assert.equal(retryFront(b,2,100,3,0,31),true);
});
test('battle state: saves round-trip without changing old-save requirements; malformed fields fail validation',()=>{
 const {g}=scene();g.step(.05);const raw=g.save(),loaded=Simulation.load(raw);assert.deepEqual(loaded.tactical.state.battle,g.tactical.state.battle);
 const invalid=structuredClone(raw);invalid.ai.battle.withdrawals[0].x=-1;assert.throws(()=>Simulation.load(invalid));
 delete raw.ai.battle;assert.ok(Simulation.load(raw));
});

test('standoff siege: rockets use a reachable firing point outside every known gun and preserve queued orders',()=>{
 const {g,tower}=scene();g.units=[];const rocket=g.spawn(1,{x:2350,y:1500},'artillery'),heavy=g.spawn(1,{x:2300,y:1550},'heavy');
 const second={...tower,id:1901,x:1660,y:1520,queue:[],queueTypes:[]};g.bases.push(second);
 for(const t of [tower,second])g.tactical.state.knownTurrets.push({id:t.id,x:t.x,y:t.y,hp:t.hp,seenAt:0,range:600});
 g.tactical.state.rally={x:2400,y:1500};assert.equal(g.tactical.siege([rocket,heavy],tower),true);
 const orders=rocket.orders;assert.equal(orders[0].kind,'move');assert.equal(orders[1].kind,'attack');
 for(const t of [tower,second])assert.ok(distance(t,orders[0])>RULES.turret.range+30);
 assert.ok(distance(g.bases.find(b=>b.id===orders[1].target),orders[0])<=680);
 g.tactical.siege([rocket,heavy],tower);assert.equal(rocket.orders,orders,'keep the live route and firing command');
});
test('siege: visible builders and counter-battery targets are engaged only from safe current range',()=>{
 const {g,tower}=scene();g.units=[];
 const rocket=g.spawn(1,{x:2140,y:1500},'artillery'),heavy=g.spawn(1,{x:2250,y:1500},'heavy');
 const worker=g.spawn(0,{x:1640,y:1500},'engineer');
 g.tactical.state.knownTurrets=[{id:tower.id,x:tower.x,y:tower.y,hp:tower.hp,seenAt:0,range:600}];
 g.tactical.state.rally={x:2300,y:1500};g.updateVision();assert.ok(g.canSee(1,worker));
 assert.equal(g.tactical.siegeThreat(rocket),worker);
 g.tactical.siege([rocket,heavy],tower);assert.equal(rocket.orders[0].target,worker.id);
 const gun=g.spawn(0,{x:1660,y:1530},'artillery');g.updateVision();assert.equal(g.tactical.siegeThreat(rocket),gun);
 const visible=g.canSee.bind(g);g.canSee=(owner,p)=>p.id===worker.id||p.id===gun.id?false:visible(owner,p);
 assert.equal(g.tactical.siegeThreat(rocket),undefined,'fogged units supply no target');
 g.canSee=visible;rocket.x=2500;assert.equal(g.tactical.siegeThreat(rocket),undefined,'do not chase a builder beyond firing range');
 rocket.x=2050;assert.equal(g.tactical.siegeThreat(rocket),undefined,'withdrawal from a gun retains priority');
});
test('defense squads: bounded local force handles a visible intruder without reassigning the whole assault',()=>{
 const {g}=scene();g.units=[];const home=g.bases.find(b=>b.owner===1);
 const near=g.spawn(1,{x:home.x-120,y:home.y+70},'heavy'),far=g.spawn(1,{x:home.x-800,y:home.y+400},'tank');
 const enemy=g.spawn(0,{x:home.x-240,y:home.y+70},'infantry');g.updateVision();assert.equal(g.canSee(1,enemy),true);
 g.tactical.state.group=[far.id];g.tactical.state.battle=newBattle();g.tactical.state.battle.squads=[{role:'assault',ids:[far.id],target:1000,since:0}];
 const first=g.tactical.localDefense([near,far],[],[enemy],home);assert.deepEqual([...first],[near.id]);
 assert.equal(far.orders.length,0);const commands=near.orders;g.time+=3;g.tactical.localDefense([near,far],[],[enemy],home);assert.equal(near.orders,commands);
 const squads=g.tactical.state.battle.squads;assert.ok(squads.find(q=>q.role==='assault').ids.includes(far.id));assert.ok(squads.find(q=>q.role==='defense').ids.includes(near.id));
});

test('expansion squad: separate units keep a safe capture mission while the siege army builds up',()=>{
 const g=new Simulation(2026,4),home=g.bases.find(b=>b.owner===1);g.units=[];g.world.blocked.fill(0);g.world.opaque.fill(0);g.credits[1]=0;g.time=100;
 const units=Array.from({length:5},(_,i)=>g.spawn(1,{x:home.x-200-i*20,y:home.y+120},i<3?'infantry':'tank'));
 g.tactical.state.battle=newBattle();g.tactical.state.battle.assessment={at:100,own:200,enemy:900,deficit:700,towers:3,neededSiege:2,stance:'reinforce'};
 const assigned=g.tactical.expansionRaid(units,home);assert.equal(assigned.size,2);
 const squad=g.tactical.state.battle.squads.find(q=>q.role==='raid');assert.ok(squad);assert.equal(squad.ids.some(id=>g.tactical.state.group.includes(id)),false);
 const first=units.find(u=>assigned.has(u.id)).orders;g.time+=3;assert.deepEqual(g.tactical.expansionRaid(units,home),assigned);assert.equal(units.find(u=>assigned.has(u.id)).orders,first);
 g.territories[squad.target].owner=1;g.tactical.state.battle.assessment.stance='siege';assert.equal(g.tactical.expansionRaid(units,home).size,0);
 assert.equal(g.tactical.state.battle.squads.some(q=>q.role==='raid'),false);
});
