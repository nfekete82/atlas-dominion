import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';
import {RULES} from '../dist/src/reborn/config.js';

const step=(g,seconds)=>{for(let i=0;i<Math.round(seconds/RULES.tick);i++)g.step(RULES.tick);};
function fixture(){
 const g=new Simulation();g.aiClock=-1e8;g.credits[0]=5000;
 g.units=g.units.filter(u=>u.owner!==0);
 function position(){
  for(let y=2100;y<3450;y+=28)for(let x=220;x<1750;x+=28)
   if(!g.buildError(0,'barracks',{x,y}))return {x,y};
  throw Error('No legal site for construction test');
 }
 const first=position(),p=g.world.nearest({x:first.x+BUILDINGS.barracks.radius+32,y:first.y},g.obstacles());
 assert.ok(p,'worker start must be passable');
 const worker=g.spawn(0,p,'engineer');
 return {g,worker,first,position};
}

test('pioneer queue: shift-placement builds two sites in sequence and pays exactly once each',()=>{
 const {g,worker,first,position}=fixture();
 const startingCredits=g.credits[0];
 const a=g.build(0,'barracks',first,[worker.id]);
 assert.ok(a);
 const b=g.build(0,'barracks',position(),[worker.id],0,true);
 assert.ok(b);
 assert.deepEqual(worker.orders.map(o=>o.target),[a.id,b.id]);
 assert.deepEqual(worker.orders.map(o=>o.kind),['build','build']);
 assert.equal(g.credits[0],startingCredits-2*BUILDINGS.barracks.cost);
 // The second site is queued, not built concurrently.
 step(g,1);
 assert.equal(b.buildRemaining,BUILDINGS.barracks.buildTime);
 step(g,90);
 assert.equal(a.buildRemaining,0,'first building should be finished');
 assert.equal(b.buildRemaining,0,'then the second building should finish automatically');
 assert.ok(!worker.orders.some(o=>o.kind==='build'));
});

test('pioneer queue: ordinary new construction still replaces the active job',()=>{
 const {g,worker,first,position}=fixture();
 const a=g.build(0,'barracks',first,[worker.id]);
 const b=g.build(0,'barracks',position(),[worker.id]);
 assert.ok(a&&b);
 assert.deepEqual(worker.orders.map(o=>o.target),[b.id]);
 step(g,2);
 assert.equal(a.buildRemaining,BUILDINGS.barracks.buildTime,'previous site remains paused');
});

test('pioneer queue: canceling the active site leaves the queued building job intact',()=>{
 const {g,worker,first,position}=fixture();
 const a=g.build(0,'barracks',first,[worker.id]);
 const b=g.build(0,'barracks',position(),[worker.id],0,true);
 assert.ok(a&&b);
 assert.equal(g.cancelConstruction(a.id),true);
 assert.deepEqual(worker.orders.map(o=>o.target),[b.id]);
 step(g,90);
 assert.equal(b.buildRemaining,0);
});

test('pioneer queue: existing build and repair jobs survive save/load in order',()=>{
 const {g,worker,first,position}=fixture();
 const a=g.build(0,'barracks',first,[worker.id]);
 const b=g.build(0,'barracks',position(),[worker.id],0,true);
 assert.ok(a&&b);
 step(g,1);
 const saved=Simulation.load(g.save());saved.aiClock=-1e8;
 const restored=saved.units.find(u=>u.id===worker.id);
 assert.deepEqual(restored.orders.map(o=>o.target),[a.id,b.id]);
 assert.deepEqual(saved.credits,g.credits);
 step(saved,90);
 assert.equal(saved.bases.find(base=>base.id===a.id).buildRemaining,0);
 assert.equal(saved.bases.find(base=>base.id===b.id).buildRemaining,0);
});

test('pioneer queue: if a worker is full, do not create or charge a ghost site',()=>{
 const {g,worker,first,position}=fixture();
 const a=g.build(0,'barracks',first,[worker.id]);
 assert.ok(a);
 worker.orders=Array.from({length:32},()=>({...worker.orders[0]}));
 const before=g.credits[0],bases=g.bases.length;
 assert.equal(g.build(0,'barracks',position(),[worker.id],0,true),null);
 assert.equal(g.bases.length,bases);
 assert.equal(g.credits[0],before);
});

test('pioneer queue: explicit vehicle repairs focus one target before the next',()=>{
 const {g,worker}=fixture();
 const v1=g.spawn(0,g.world.nearest({x:worker.x+38,y:worker.y+10},g.obstacles()),'rover');
 const v2=g.spawn(0,g.world.nearest({x:worker.x-35,y:worker.y+14},g.obstacles()),'rover');
 v1.hp=UNITS.rover.hp-70;
 v2.hp=UNITS.rover.hp-70;
 assert.equal(g.command([worker.id],{x:v1.x,y:v1.y,kind:'repair',target:v1.id}),1);
 assert.equal(g.command([worker.id],{x:v2.x,y:v2.y,kind:'repair',target:v2.id},true),1);
 const initialSecond=v2.hp;
 step(g,.5);
 assert.ok(v1.hp>UNITS.rover.hp-70,'first vehicle is being repaired');
 assert.equal(v2.hp,initialSecond,'queued vehicle does not receive parallel targeted repair');
 step(g,12);
 assert.equal(v1.hp,UNITS.rover.hp);
 assert.equal(v2.hp,UNITS.rover.hp,'second repair eventually completes');
});

test('pioneer queue: damaged building is repaired before newly scheduled construction',()=>{
 const {g,worker,first,position}=fixture();
 const finished=g.build(0,'barracks',first,[worker.id]);
 assert.ok(finished);
 step(g,60);
 assert.equal(finished.buildRemaining,0);
 finished.hp=BUILDINGS.barracks.hp-48;
 assert.equal(g.command([worker.id],{x:finished.x,y:finished.y,kind:'repair',target:finished.id}),1);
 const next=g.build(0,'barracks',position(),[worker.id],0,true);
 assert.ok(next);
 assert.deepEqual(worker.orders.map(o=>o.kind),['repair','build']);
 step(g,.5);
 assert.ok(finished.hp>BUILDINGS.barracks.hp-48,'repair work starts first');
 assert.equal(next.buildRemaining,BUILDINGS.barracks.buildTime,'queued construction remains untouched');
 step(g,70);
 assert.equal(finished.hp,BUILDINGS.barracks.hp);
 assert.equal(next.buildRemaining,0);
});
