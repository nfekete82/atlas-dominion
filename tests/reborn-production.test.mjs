import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,BUILDINGS,unitKinds} from '../dist/src/reborn/catalog.js';
import {distance} from '../dist/src/reborn/config.js';
const advance=(g,seconds)=>{for(let i=0;i<Math.round(seconds/.05);i++)g.step();};
function buildSite(g,kind,owner=0){
 const home=g.bases.find(b=>b.owner===owner&&b.kind==='headquarters');
 for(let radius=180;radius<=600;radius+=25)for(let i=0;i<32;i++){
  const p={x:home.x+Math.cos(i*Math.PI/16)*radius,y:home.y+Math.sin(i*Math.PI/16)*radius};if(!g.buildError(owner,kind,p))return p;
 }throw Error('No legal '+kind+' site');
}
for(const version of [0,1,2])test(`production: map ${version} starts both factions with exactly one builder and one soldier`,()=>{
 const g=new Simulation(2026,version);for(const owner of [0,1]){
  const units=g.units.filter(u=>u.owner===owner);assert.equal(units.length,2);assert.deepEqual(units.map(u=>u.kind).sort(),['engineer','infantry']);
  assert.ok(units.every(u=>g.world.walkable(u,g.obstacles())));assert.ok(distance(units[0],units[1])>21);assert.equal(g.credits[owner],500);
  assert.equal(g.producer(owner,'engineer').kind,'headquarters');for(const k of unitKinds.filter(k=>k!=='engineer'))assert.equal(g.producer(owner,k),undefined);
 }
});
test('production: every building rejects foreign roles without spending credits or queuing them',()=>{
 const g=Simulation.campaign(2026);g.aiClock=-1e8;g.credits[0]=10000;
 for(const kind of ['headquarters','barracks','factory','airfield']){
  const b={...g.bases[0],id:1700+g.bases.length,kind,queue:[],queueTypes:[],queueCosts:[]};g.bases.push(b);
  for(const role of unitKinds){const before=g.credits[0],ok=g.recruit(b.id,role);assert.equal(ok,UNITS[role].producers.includes(kind));if(ok){assert.equal(g.credits[0],before-UNITS[role].cost);g.cancel(b.id);}else{assert.equal(g.credits[0],before);assert.equal(b.queue.length,0);}}
 }
});
test('production: real worker construction unlocks barracks, factory and airfield only on completion',()=>{
 const g=Simulation.campaign(2026);g.aiClock=-1e8;g.credits[0]=10000;const worker=g.units.find(u=>u.owner===0&&u.kind==='engineer');
 for(const kind of ['barracks','factory','airfield']){
  const site=buildSite(g,kind),b=g.build(0,kind,site,[worker.id]);assert.ok(b);const roles=unitKinds.filter(k=>UNITS[k].producers.includes(kind));assert.equal(roles.length,kind==='airfield'?2:3);
  for(const role of roles){assert.equal(g.producer(0,role),undefined);assert.equal(g.recruit(b.id,role),false);}
  for(let i=0;i<1800&&b.buildRemaining>0;i++)g.step();assert.equal(b.buildRemaining,0);
  for(const role of roles){assert.equal(g.producer(0,role).id,b.id);assert.ok(g.recruit(b.id,role));}
  const loaded=Simulation.load(g.save());assert.deepEqual(loaded.bases.find(v=>v.id===b.id).queueTypes,roles);
  advance(g,roles.reduce((n,k)=>n+UNITS[k].buildTime,0)+1);for(const role of roles)assert.ok(g.units.some(u=>u.owner===0&&u.kind===role));
 }
});
test('production: destroyed or enemy facilities do not unlock units, full queues do not count as missing buildings',()=>{
 const g=Simulation.campaign(2026);g.aiClock=-1e8;g.credits[0]=5000;const b={...g.bases[0],id:1700,kind:'barracks',queue:[],queueTypes:[]};g.bases.push(b);
 for(let i=0;i<8;i++)assert.ok(g.recruit(b.id,'infantry'));assert.equal(g.recruit(b.id,'infantry'),false);b.queue=[];b.queueTypes=[];b.queueCosts=[];
 b.owner=1;assert.equal(g.producer(0,'infantry'),undefined);b.owner=0;b.hp=0;assert.equal(g.producer(0,'infantry'),undefined);
});
test('production: old mixed HQ queues refund unsupported orders once and retain paid workers and existing troops',()=>{
 const g=Simulation.campaign(2026);g.aiClock=-1e8;const raw=g.save(),hq=raw.bases[0];delete raw.productionVersion;
 hq.queue=[UNITS.infantry.buildTime,UNITS.engineer.buildTime,UNITS.tank.buildTime];hq.queueTypes=['infantry','engineer','tank'];hq.queueCosts=[100,200,450];hq.production=2;raw.credits[0]=50;
 const loaded=Simulation.load(raw);assert.equal(loaded.credits[0],600);assert.deepEqual(loaded.bases[0].queueTypes,['engineer']);assert.deepEqual(loaded.bases[0].queueCosts,[200]);assert.equal(loaded.bases[0].production,0);assert.equal(loaded.units.length,raw.units.length);
 const again=Simulation.load(loaded.save());assert.equal(again.credits[0],600);assert.equal(again.units.length,raw.units.length);assert.equal(again.save().productionVersion,1);
 const noWorkers=g.save();noWorkers.units=noWorkers.units.filter(u=>u.kind!=='engineer');assert.equal(Simulation.load(noWorkers).units.length,noWorkers.units.length,'loading does not insert free starting workers');
 const corrupt=g.save();corrupt.bases[0].queue=[5];corrupt.bases[0].queueTypes=['infantry'];corrupt.bases[0].queueCosts=[100];assert.throws(()=>Simulation.load(corrupt));
});
test('production: the AI builds a paid barracks from the ordinary start and recruits soldiers there',()=>{
 const g=Simulation.campaign(2026),ledger=[],build=g.build.bind(g),recruit=g.recruit.bind(g);
 g.build=(owner,kind,p,ids)=>{const before=g.credits[owner],b=build(owner,kind,p,ids);if(b&&owner===1){assert.equal(g.credits[1],before-BUILDINGS[kind].cost);ledger.push({kind,at:g.time});}return b;};
 g.recruit=(id,kind)=>{const b=g.bases.find(b=>b.id===id),ok=recruit(id,kind);if(ok&&b.owner===1){const type=b.queueTypes.at(-1);assert.ok(UNITS[type].producers.includes(b.kind));ledger.push({unit:type,producer:b.kind,at:g.time});}return ok;};
 advance(g,100);const barracks=ledger.find(e=>e.kind==='barracks'),soldier=ledger.find(e=>e.unit==='infantry');assert.ok(barracks);assert.ok(soldier);assert.equal(soldier.producer,'barracks');assert.ok(soldier.at>=barracks.at+BUILDINGS.barracks.buildTime);assert.ok(g.count(1)>2);
});
test('production: the AI replaces a missing builder instead of waiting for unavailable infantry',()=>{
 const g=Simulation.campaign(2026);g.units=g.units.filter(u=>u.owner!==1||u.kind!=='engineer');g.tactical.plan();assert.deepEqual(g.bases[1].queueTypes,['engineer']);
});
