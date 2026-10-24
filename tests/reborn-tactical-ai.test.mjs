import {addProducer} from './fixtures/reborn-production.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES,distance} from '../dist/src/reborn/config.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
const advance=(g,s,dt=.05)=>{for(let i=0;i<Math.round(s/dt);i++)g.step(dt);};
function fixture(version=0){
 const g=new Simulation(2026,version);g.units=[];g.aiClock=-1e8;g.time=30;g.credits=[10000,0];g.world.blocked.fill(0);g.world.opaque.fill(0);
 Object.assign(g.bases[1],{x:900,y:1900});Object.assign(g.bases[0],{x:3200,y:3200});
 for(const t of g.territories){t.owner=-1;t.neighbors=[];}const own=g.territories[0],target=g.territories[1];own.owner=1;own.point={x:900,y:1900};own.neighbors=[1];target.point={x:2600,y:1900};target.neighbors=[0];
 const u=g.spawn(1,{x:1100,y:1900});g.updateVision();return {g,u,target,own};
}
function tower(g,p={x:1900,y:1900}){const b={...g.bases[0],...p,id:1500,kind:'turret',radius:30,hp:650,queue:[],queueTypes:[],cooldown:100};g.bases.push(b);return b;}
function reveal(g,b){const u=g.spawn(1,{x:b.x+180,y:b.y+50},'infantry');g.updateVision();g.units=g.units.filter(v=>v.id!==u.id);g.updateVision();}
function force(g){g.tactical.plan();return g.tactical.state;}
const red=g=>g.units.filter(u=>u.owner===1);

for(const version of [0,2])test(`tactical: v${version} sees towers only through own vision, remembers out of sight, ages stale information and confirms destruction`,()=>{
 const {g}=fixture(version),b=tower(g);g.updateVision();force(g);assert.equal(g.tactical.state.knownTurrets.length,0);
 reveal(g,b);const memory=g.tactical.state.knownTurrets[0];assert.equal(memory.id,b.id);assert.equal(memory.range,600);assert.equal(g.canSee(1,b),false);
 b.hp=0;force(g);assert.equal(g.tactical.state.knownTurrets.length,1,'hidden destruction is not omniscient knowledge');
 const observer=g.spawn(1,{x:b.x+200,y:b.y},'infantry');g.updateVision();assert.equal(g.tactical.state.knownTurrets.length,0);
 b.hp=650;g.updateVision();g.units=g.units.filter(u=>u.id!==observer.id);g.updateVision();g.time+=241;force(g);assert.equal(g.tactical.state.knownTurrets.length,0);
});

test('tactical: risk weighted A* chooses a clear flank around the full known 600 range, and smoothing cannot cut back through it',()=>{
 const {g,u,target}=fixture(),b=tower(g);reveal(g,b);force(g);
 const route=g.tactical.route(u,target.point);assert.ok(route.length>1);let previous=u;
 for(const p of route){assert.ok(g.world.line(previous,p,g.tactical.navigationObstacles()));const steps=Math.ceil(distance(previous,p)/15);for(let i=0;i<=steps;i++)assert.ok(distance({x:previous.x+(p.x-previous.x)*i/steps,y:previous.y+(p.y-previous.y)*i/steps},b)>600,'route crosses known firing radius');previous=p;}
 assert.ok(route.some(p=>Math.abs(p.y-b.y)>600));
 b.hp=0;g.spawn(1,{x:b.x+200,y:b.y},'infantry');g.updateVision();g.tactical.risk=undefined;g.tactical.riskAt=-1;g.tactical.routeCache.clear();const clear=g.tactical.route(u,target.point);assert.deepEqual(clear,[target.point]);
});

test('tactical: unseen player units and unseen towers do not change plans, money, orders or red knowledge',()=>{
 const a=fixture(),b=fixture();tower(b.g,{x:1900,y:1900});b.g.spawn(0,{x:2500,y:2300},'tank');a.g.updateVision();b.g.updateVision();force(a.g);force(b.g);
 assert.deepEqual(a.g.tactical.state,b.g.tactical.state);assert.deepEqual(red(a.g),red(b.g));assert.equal(a.g.credits[1],b.g.credits[1]);
});

test('tactical: two nearby losses create a danger memory without revealing the unknown killer; singles are recalled and no new lone attack is sent',()=>{
 const {g,u}=fixture(),b=tower(g,{x:1920,y:1900});
 for(let i=0;i<2;i++){const victim=g.spawn(1,{x:1350,y:1900+i*40});victim.hp=1;b.cooldown=0;g.damage(b,victim,6,'turret',{x:b.x,y:b.y});}
 g.units=g.units.filter(u=>u.hp>0);assert.equal(g.tactical.state.losses.length,2);assert.equal(g.tactical.state.knownTurrets.length,0);force(g);
 assert.notEqual(g.tactical.state.phase,'attack');assert.ok(u.orders[0]?.tactical.mode==='safe');assert.ok(distance(u.orders[0],b)>600);
 for(let i=0;i<4;i++){g.time+=3;force(g);assert.notEqual(g.tactical.state.phase,'attack');}
});

test('tactical: a standard group launches together with shared pace, keeps a home guard and does not overwrite stable commands',()=>{
 const {g,u}=fixture();for(let i=0;i<4;i++)g.spawn(1,{x:1100+i*12,y:1910+i*17});force(g);
 const s=g.tactical.state;assert.equal(s.phase,'attack');assert.equal(s.group.length,4);assert.equal(s.launchSize,4);
 const members=red(g).filter(u=>s.group.includes(u.id));assert.ok(members.every(u=>u.orders[0].tactical.group===s.groupId));assert.ok(members.every(u=>u.orders[0].march.length===4));assert.equal(red(g).filter(u=>!s.group.includes(u.id)&&!u.orders.length).length,1);
 const orders=members.map(u=>u.orders[0]);g.time+=3;force(g);members.forEach((u,i)=>assert.equal(u.orders[0],orders[i]));
 const before=members.map(u=>u.x);advance(g,.5);assert.ok(members.every((u,i)=>u.x>before[i]));
});

test('tactical: a defended bastion waits for six to ten real combat units and then concentrates on the registered tower before capture',()=>{
 const {g,u,target}=fixture();target.point={x:1900,y:1900};const b=tower(g);reveal(g,b);force(g);assert.notEqual(g.tactical.state.phase,'attack');
 for(let i=0;i<7;i++)g.spawn(1,{x:1110+(i%3)*30,y:1870+Math.floor(i/3)*30},i===0?'tank':i<3?'heavy':'infantry');
 const medic=g.spawn(1,{x:1080,y:1900},'medic');force(g);const s=g.tactical.state;assert.equal(s.phase,'attack');assert.ok(s.launchSize>=6&&s.launchSize<=10);assert.equal(s.objective,b.id);assert.equal(s.target,target.id);
 const front=red(g).filter(u=>s.group.includes(u.id)&&u.kind!=='medic');assert.ok(front.every(u=>u.orders[0].target===b.id));assert.equal(medic.orders[0].formation.front.length,s.launchSize);assert.ok(medic.orders[0].formation.rear>=72);
 const hp=b.hp;advance(g,20);assert.ok(b.hp<hp,'group must physically approach and fire, with unchanged damage rules');
 b.hp=0;g.visible[1].fill(1);g.tactical.observe();force(g);assert.equal(g.tactical.state.objective,null);assert.ok(front.filter(u=>u.hp>0).every(u=>u.orders[0]?.target!==target.id));
});

test('tactical: a safer income sector wins over a tower covered objective and repeated failed assaults trigger regrouping',()=>{
 const {g,u,target,own}=fixture();target.point={x:1900,y:1900};const b=tower(g);reveal(g,b);
 const alternative=g.territories[2];alternative.point={x:1150,y:2800};alternative.neighbors=[own.id];own.neighbors.push(alternative.id);force(g);assert.equal(g.tactical.state.target,alternative.id);
 for(let i=0;i<5;i++)g.spawn(1,{x:1100+i*16,y:1900+i*9});g.tactical.state.phase='gather';g.tactical.state.group=[];force(g);assert.equal(g.tactical.state.phase,'attack');const ids=[...g.tactical.state.group];
 for(const id of ids.slice(0,2)){const unit=g.units.find(u=>u.id===id);unit.hp=0;g.tactical.loss(unit);}g.units=g.units.filter(u=>u.hp>0);force(g);
 assert.equal(g.tactical.state.phase,'regroup');assert.ok(g.tactical.state.attempts.some(a=>a.losses===2));assert.ok(red(g).some(u=>u.orders[0]?.tactical.mode==='safe'));
});

test('tactical: an impassable flank selects heavier paid production and regrouping instead of repeated lone attacks',()=>{
 const {g,u,target}=fixture();target.point={x:1900,y:1900};const b=tower(g);reveal(g,b);const barracks=addProducer(g,'barracks',1);g.credits[1]=250;const count=g.units.length;force(g);
 assert.equal(barracks.queueTypes[0],'heavy');assert.equal(g.credits[1],0);assert.equal(g.units.length,count);assert.notEqual(g.tactical.state.phase,'attack');
 // The target itself is covered, so there is no safe route all the way to the capture point.
 for(let i=0;i<18;i++){g.time+=3;force(g);}assert.notEqual(g.tactical.state.phase,'attack');assert.ok(u.orders[0]?.tactical.mode==='safe');assert.ok(g.tactical.state.rally&&distance(g.tactical.state.rally,b)>600);
});

test('tactical: visible enemies near HQ recall defenders; hidden enemies cannot trigger a defense; normal plans resume afterwards',()=>{
 const {g,u}=fixture();for(let i=0;i<4;i++)g.spawn(1,{x:1100+i*20,y:1900});force(g);assert.equal(g.tactical.state.phase,'attack');
 const enemy=g.spawn(0,{x:900,y:2250});g.updateVision();force(g);assert.equal(g.tactical.state.phase,'defend');assert.ok(red(g).filter(u=>u.kind!=='medic').every(u=>u.orders[0]?.target===enemy.id));
 g.units=g.units.filter(u=>u.id!==enemy.id);g.updateVision();force(g);assert.notEqual(g.tactical.state.phase,'defend');
 const hidden=g.spawn(0,{x:900,y:2600});g.visible[1].fill(0);force(g);assert.notEqual(g.tactical.state.phase,'defend');
});

for(const version of [0,1,2])test(`tactical: v${version} optional state saves, loads, pauses and continues deterministically without resource bonuses`,()=>{
 const {g,u}=fixture(version);g.credits[1]=500;const b=tower(g);reveal(g,b);force(g);const saved=g.save(),loaded=Simulation.load(saved);loaded.aiClock=g.aiClock=-1e8;
 assert.deepEqual(loaded.tactical.state,g.tactical.state);assert.equal(loaded.credits[1],g.credits[1]);assert.equal(loaded.units.length,g.units.length);
 const initial=structuredClone(g.tactical.state);g.paused=true;advance(g,2);assert.deepEqual(g.tactical.state,initial);g.paused=false;
 advance(g,2);advance(loaded,2);assert.deepEqual(loaded.credits,g.credits);assert.deepEqual(red(loaded).map(u=>({id:u.id,x:u.x,y:u.y,hp:u.hp})),red(g).map(u=>({id:u.id,x:u.x,y:u.y,hp:u.hp})));
 delete saved.ai;assert.doesNotThrow(()=>Simulation.load(saved));const bad=g.save();bad.ai.knownTurrets[0].range=10000;assert.throws(()=>Simulation.load(bad));
});


test('tactical: a mixed assault actually advances at the heavy pace while the medic stays behind',()=>{
 const {g,target}=fixture();target.point={x:1900,y:1900};const b=tower(g);reveal(g,b);
 for(let i=0;i<7;i++)g.spawn(1,{x:1130+(i%3)*27,y:1880+Math.floor(i/3)*26},i===0?'heavy':i===1?'rover':i===2?'tank':'infantry');
 const m=g.spawn(1,{x:1080,y:1900},'medic');force(g);assert.equal(g.tactical.state.phase,'attack');
 const members=red(g).filter(u=>g.tactical.state.group.includes(u.id)&&u.kind!=='medic'),initial=new Map(members.map(u=>[u.id,{x:u.x,y:u.y}]));
 advance(g,4);const distances=members.map(u=>distance(u,initial.get(u.id)));assert.ok(distances.every(d=>d>200));assert.ok(Math.max(...distances)<UNITS.heavy.speed*4+10);assert.ok(Math.max(...members.map(u=>u.x))-Math.min(...members.map(u=>u.x))<115,'front stays within the coordinated march bound despite local vehicle queuing');assert.ok(m.x<Math.min(...members.map(u=>u.x))-25);
});

for(const version of [0,2])test(`tactical: active v${version} campaign save continues with the same strategy, production and territory`,()=>{
 const g=new Simulation(2026,version);advance(g,70);const loaded=Simulation.load(g.save());
 assert.deepEqual(loaded.tactical.state,g.tactical.state);advance(g,15);advance(loaded,15);
 assert.deepEqual(loaded.credits,g.credits);assert.deepEqual(loaded.territories.map(t=>t.owner),g.territories.map(t=>t.owner));assert.equal(loaded.tactical.state.phase,g.tactical.state.phase);assert.equal(loaded.tactical.state.target,g.tactical.state.target);assert.deepEqual(loaded.tactical.state.group,g.tactical.state.group);
});


test('tactical: loading never reuses a fallen unit ID from the persistent loss memory',()=>{
 const {g}=fixture(),victim=g.spawn(1,{x:1200,y:1900});victim.hp=0;g.tactical.loss(victim);g.units=g.units.filter(u=>u.hp>0);
 const next=g.nextId,loaded=Simulation.load(g.save()),reinforcement=loaded.spawn(1,{x:1150,y:1900});
 assert.ok(reinforcement.id>=next);assert.notEqual(reinforcement.id,victim.id);reinforcement.hp=0;loaded.tactical.loss(reinforcement);assert.equal(loaded.tactical.state.losses.length,2);
});
