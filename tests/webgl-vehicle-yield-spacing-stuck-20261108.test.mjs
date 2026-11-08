import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {distance} from '../dist/src/reborn/config.js';
import {
 formationSlotPitch,vehicleSpacingGap,preservesVehicleProgress,vehicleYieldWaypoint
} from '../dist/src/reborn/vehicle-spacing.js';

const fixture=()=>{
 const g=new Simulation(2074,23);
 g.units=[];g.bases=[];g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.aiClock=1e8;g.tactical.plan=()=>{};g.status='playing';g.paused=false;
 return g;
};
test('3 tanks receive physically separated slots rather than 27-unit overlaps',()=>{
 const g=fixture();
 const tanks=[0,1,2].map(i=>g.spawn(0,{x:1760+i*100,y:1620},'tank'));
 assert.ok(formationSlotPitch(tanks)>=100);
 assert.equal(formationSlotPitch([{kind:'infantry'},{kind:'medic'}]),27);
 const accepted=g.command(tanks.map(u=>u.id),{kind:'move',x:2900,y:2500});
 assert.equal(accepted,3);
 const positions=tanks.map(u=>u.orders[0]);
 for(let i=0;i<positions.length;i++)
  for(let j=i+1;j<positions.length;j++)
   assert.ok(distance(positions[i],positions[j])>=90,
    'final formation destinations must not overlap: '+i+', '+j);
});

test('soft spacing yields to forward progress and never becomes hard path obstacle',()=>{
 const tank={kind:'tank',moving:true,x:500,y:500,
  orders:[{x:800,y:500}],path:[{x:600,y:500}]};
 const other={kind:'tank',moving:false,x:560,y:500,orders:[],path:[]};
 const gap=vehicleSpacingGap(tank,other);
 assert.ok(gap.comfortable>gap.hard);
 assert.ok(gap.hard>=45);
 assert.equal(preservesVehicleProgress(tank,{x:-4,y:0}),false);
 assert.equal(preservesVehicleProgress(tank,{x:3,y:1}),true);
 assert.equal(preservesVehicleProgress(other,{x:-4,y:0}),true);
 assert.equal(preservesVehicleProgress({...tank,moving:false},{x:-4,y:0}),true);
});

test('safe sideways escape chooses only traversable points and rejects impossible corridors',()=>{
 const at={x:1000,y:1000},to={x:1550,y:1000},stopped={x:1070,y:1000};
 const leftOnly=p=>p.y<1000&&p.x>1000;
 const detour=vehicleYieldWaypoint(at,to,stopped,82,leftOnly);
 assert.ok(detour);
 assert.ok(detour.y<1000);
 assert.ok(distance(detour,stopped)>65);
 assert.equal(vehicleYieldWaypoint(at,to,stopped,82,()=>false),null);
 assert.equal(vehicleYieldWaypoint(at,at,stopped,82,()=>true),null);
});

test('tank behind stopped tank continues along route; spacing cannot freeze both indefinitely',()=>{
 const g=fixture();
 const front=g.spawn(0,{x:2050,y:2000},'tank');
 const rear=g.spawn(0,{x:1930,y:2000},'tank');
 g.stop([front.id]);
 const initial=rear.x;
 assert.equal(g.command([rear.id],{kind:'move',x:2800,y:2000}),1);
 for(let i=0;i<340;i++)g.step(.05);
 assert.ok(rear.x>initial+300,'rear tank should make meaningful progress');
 assert.ok(g.world.walkable(rear,g.movingColliders().vehicle,12),
  'tank must never ghost through static world obstacles');
 assert.ok(g.units.includes(front)&&g.units.includes(rear));
});

test('stalled tank reroutes toward a legal flank without adding live vehicles to A* obstacles',()=>{
 const g=fixture();
 const moving=g.spawn(0,{x:1000,y:1000},'tank');
 const blocker=g.spawn(0,{x:1080,y:1000},'tank');
 g.stop([blocker.id]);
 assert.equal(g.command([moving.id],{kind:'move',x:1600,y:1000}),1);
 // Force a genuine no-progress interval (the path used during normal
 // movement remains legal). This exercises the watchdog and detour.
 moving.path=[{x:1450,y:1000}];
 g.vehicleProgress.set(moving,{x:moving.x,y:moving.y,since:g.time-5,retryAt:-10});
 const before=moving.x;
 g.move(moving,moving.orders[0],.05);
 assert.equal(moving.x,before,'watchdog queues a safe detour, no teleport');
 assert.ok(moving.path.length>=2,'legal sideways waypoint precedes original route');
 assert.notEqual(moving.path[0].y,1000);
 assert.ok(g.world.walkable(moving.path[0],g.movingColliders().vehicle,12));
});

test('same scenario and commands produce bit-identical saved game even with spacing recovery',()=>{
 const a=fixture(),b=fixture();
 for(const g of [a,b]){
  const tanks=[0,1,2,3].map(i=>g.spawn(0,{x:1500+i*65,y:1700+i%2*15},'tank'));
  g.command(tanks.map(u=>u.id),{kind:'attackMove',x:3000,y:2600});
 }
 for(let i=0;i<200;i++){a.step(.05);b.step(.05);}
 assert.deepEqual(a.save(),b.save());
});

test('original buildings, cliffs and terrain still block vehicles; spacing stays a soft preference',()=>{
 const text=readFileSync('src/reborn/simulation.ts','utf8');
 assert.match(text,/this\.world\.walkable\(p,collisionObstacles,clearance\)/);
 assert.match(text,/this\.world\.line\(u,p,collisionObstacles,clearance\)/);
 assert.match(text,/this\.spatial\.rebuild\(this\.units\);\s*\/\/ Comfort separation/);
 assert.match(text,/preservesVehicleProgress\(a,delta\)/);
 assert.match(text,/formationSlotPitch\(members\)/);
 assert.match(text,/this\.vehicleProgress\.get\(u\)/);
});
