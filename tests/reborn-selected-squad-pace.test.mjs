import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {unitSpec} from '../dist/src/reborn/catalog.js';

function fixture(){
 const g=new Simulation(2074,4);
 g.aiClock=1e8;
 g.units=[];g.bases=[];
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.status='playing';g.paused=false;
 // An isolated movement fixture still needs one remote opposing survivor:
 // the current elimination rule stops the match once a faction is extinct.
 const observer=g.spawn(1,{x:300,y:300},'infantry');g.stop([observer.id],true);
 g.tactical.plan=()=>{};
 return g;
}
function group(g,kinds,owner=0){
 return kinds.map((kind,i)=>g.spawn(owner,{x:1450+i*95,y:1700+i*75},kind));
}
const target={kind:'move',x:2900,y:2800};

test('selected infantry, heavy, support and armor share one ground march roster',()=>{
 const g=fixture(),squad=group(g,['infantry','heavy','medic','engineer','rover','tank','artillery']);
 const ids=squad.map(u=>u.id);
 assert.equal(g.command(ids,target),ids.length);
 for(const u of squad){
  assert.equal(u.orders[0].kind,'move');
  assert.deepEqual(u.orders[0].march,ids,'every ground member must pace with the same selected squad');
 }
 assert.equal(Math.min(...squad.map(u=>unitSpec(u).speed)),65);
 const before=new Map(squad.map(u=>[u.id,{x:u.x,y:u.y}]));
 // 20 Hz: group movement may turn/brake or follow rear slots, but cannot
 // exceed the slowest member's movement speed on level unobstructed terrain.
 for(let i=0;i<40;i++){
  const previous=new Map(squad.map(u=>[u.id,{x:u.x,y:u.y}]));
  g.step(.05);
  for(const u of squad){
   const p=previous.get(u.id);
   const displacement=Math.hypot(u.x-p.x,u.y-p.y);
   assert.ok(displacement<=65*.05+.12,
    `${u.kind} exceeded slowest member: ${displacement.toFixed(3)}`);
  }
 }
 assert.ok(squad.some(u=>Math.hypot(u.x-before.get(u.id).x,u.y-before.get(u.id).y)>15),
  'the squad must still advance');
});

test('single unit and aircraft are not slowed by a ground squad',()=>{
 const g=fixture(),squad=group(g,['infantry','rover','heavy']);
 const helicopter=g.spawn(0,{x:1840,y:2100},'scout');
 assert.equal(g.command([...squad.map(u=>u.id),helicopter.id],target),4);
 for(const u of squad)assert.deepEqual(u.orders[0].march,squad.map(v=>v.id));
 assert.equal(helicopter.orders[0].march,undefined,
  'aircraft must keep their own flight speed');
 assert.equal(g.command([squad[1].id],{kind:'move',x:3050,y:2400}),1);
 assert.equal(squad[1].orders[0].march,undefined,'independent order restores native speed');
});

test('selected attack-move also marches together; AI receives no new squad constraint',()=>{
 const g=fixture(),players=group(g,['infantry','heavy','rover']);
 assert.equal(g.command(players.map(u=>u.id),{...target,kind:'attackMove'}),3);
 for(const u of players)assert.deepEqual(u.orders[0].march,players.map(v=>v.id));
 const enemies=group(g,['infantry','heavy'],1);
 assert.equal(g.command(enemies.map(u=>u.id),target),2);
 assert.equal(enemies[0].orders[0].march,undefined);
 assert.equal(enemies[1].orders[0].march,undefined);
});

test('stopping and redirecting a slow member releases the remaining squad from its speed',()=>{
 const g=fixture(),squad=group(g,['rover','heavy','artillery']);
 assert.equal(g.command(squad.map(u=>u.id),target),3);
 assert.deepEqual(squad[0].orders[0].march,squad.map(u=>u.id));
 g.command([squad[2].id],{kind:'move',x:2350,y:1850});
 assert.equal(squad[2].orders[0].march,undefined);
 assert.deepEqual(squad[0].orders[0].march,squad.map(u=>u.id),
  'existing orders need no rewrite; active reciprocal membership excludes redirected units');
 g.stop([squad[1].id]);
 assert.equal(squad[1].orders.length,0);
 assert.equal(g.command([squad[0].id],target),1);
 assert.equal(squad[0].orders[0].march,undefined);
});

test('queued multi-unit movement keeps cohort identity per waypoint',()=>{
 const g=fixture(),squad=group(g,['infantry','medic','heavy']);
 const ids=squad.map(u=>u.id);
 assert.equal(g.command(ids,target),3);
 assert.equal(g.command(ids,{kind:'move',x:2600,y:2400},true),3);
 for(const u of squad){
  assert.equal(u.orders.length,2);
  assert.deepEqual(u.orders[0].march,ids);
  assert.deepEqual(u.orders[1].march,ids);
 }
});
