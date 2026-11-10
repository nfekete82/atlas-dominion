import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {beginBomberOrbit,advanceBomberOrbit,validBomberOrbit,BOMBER_ORBIT_SPEED,BOMBER_ORBIT_RADII} from '../dist/src/reborn/bomber-orbit.js';
import {steerBomberArc,BOMBER_MAX_TURN_RATE} from '../dist/src/reborn/bomber-attack.js';
import {unitArtScale} from '../dist/src/reborn/visual-scale.js';
import {unitSpec} from '../dist/src/reborn/catalog.js';
import {distance} from '../dist/src/reborn/config.js';

const setup=()=>{
 const game=new Simulation(2026,4);
 game.units=[];game.aiClock=-1e6;
 const bomber=game.spawn(0,{x:1200,y:1400},'bomber');
 bomber.angle=.2;bomber.hullAngle=.2;
 return {game,bomber};
};
const advance=(game,seconds)=>{for(let i=0;i<Math.round(seconds/.05);i++)game.step(.05);};

test('aircraft art grows visually without altering authoritative world size or flight behavior',()=>{
 assert.equal(unitArtScale('bomber'),1.40);
 assert.equal(unitArtScale('scout'),1.52);
 assert.equal(unitArtScale('tank'),1.08);
 assert.equal(unitArtScale('infantry'),.73);
 assert.equal(unitSpec({kind:'bomber'}).width,107);
 assert.equal(unitSpec({kind:'scout'}).width,106);
 assert.equal(unitSpec({kind:'bomber'}).speed,350);
});
test('idle bomber travels a bounded real circle and remains tangent to its previous heading',()=>{
 const {game,bomber}=setup(),start={x:bomber.x,y:bomber.y};
 game.step(.05);
 const orbit=bomber.idleOrbit;
 assert.ok(orbit,'idle bomber acquires an orbit');
 assert.ok(bomber.moving&&bomber.walkDistance>0,'actual position and animation move');
 assert.ok(distance(start,bomber)>0,'not a hover-only drawing trick');
 assert.ok(Math.abs(distance(bomber,{x:orbit.cx,y:orbit.cy})-orbit.radius)<1e-8);
 assert.ok(BOMBER_ORBIT_RADII.includes(orbit.radius),'holding radius is one of the safe, wide supported circles');
 assert.ok(Math.abs(bomber.driveSpeed-BOMBER_ORBIT_SPEED)<1e-8);
 // A complete true circle uses the selected radius and the real 145-unit/s speed.
 advance(game,Math.PI*2*orbit.radius/BOMBER_ORBIT_SPEED);
 assert.ok(distance(bomber,start)<20,'a complete orbit returns near its anchor');
 assert.ok(bomber.x>=8&&bomber.y>=8&&bomber.x<=game.world.size-8&&bomber.y<=game.world.size-8);
});
test('manual move and Hold interrupt the holding circle immediately; no autopilot orders are created',()=>{
 const {game,bomber}=setup();
 advance(game,1);
 assert.ok(bomber.idleOrbit);
 assert.equal(bomber.orders.length,0);
 const destination={x:1750,y:1470,kind:'move'};
 assert.equal(game.command([bomber.id],destination),1);
 game.step(.05);
 assert.equal(bomber.idleOrbit,undefined);
 assert.equal(bomber.orders[0]?.kind,'move');
 assert.ok(bomber.moving,'manual flight begins without waiting for orbit to finish');
 game.stop([bomber.id],true);
 const frozen={x:bomber.x,y:bomber.y};
 advance(game,1);
 assert.equal(bomber.idleOrbit,undefined);
 assert.ok(distance(bomber,frozen)<1e-9);
 game.stop([bomber.id],false);
 game.step(.05);
 assert.ok(bomber.idleOrbit,'free idle flight resumes after releasing Hold');
});
test('the same bomber orbit resumes deterministically after a complete save/load',()=>{
 const {game,bomber}=setup();advance(game,3.2);
 const snapshot=game.save(),loaded=Simulation.load(snapshot);
 const resumed=loaded.units.find(u=>u.id===bomber.id);
 assert.ok(resumed?.idleOrbit);
 assert.deepEqual(resumed.idleOrbit,bomber.idleOrbit);
 advance(game,2.5);advance(loaded,2.5);
 const actual=game.units.find(u=>u.id===bomber.id);
 assert.equal(actual.x,resumed.x);
 assert.equal(actual.y,resumed.y);
 assert.equal(actual.angle,resumed.angle);
 assert.equal(actual.walkDistance,resumed.walkDistance);
 assert.deepEqual(actual.idleOrbit,resumed.idleOrbit);
 assert.deepEqual(game.credits,loaded.credits);
});
test('helicopters keep their existing stationary idle; edge cases never jump or accept corrupt saves',()=>{
 const {game,bomber}=setup();
 const heli=game.spawn(0,{x:1500,y:1500},'scout');
 const h={x:heli.x,y:heli.y};
 advance(game,1.25);
 assert.deepEqual({x:heli.x,y:heli.y},h);
 assert.equal(heli.idleOrbit,undefined);
 assert.equal(beginBomberOrbit({x:3,y:3,id:1,angle:0},game.world.size),null);
 assert.equal(validBomberOrbit(bomber.idleOrbit,'bomber',game.world.size),true);
 const corrupt=game.save();
 corrupt.units.find(u=>u.id===bomber.id).idleOrbit.radius=999;
 assert.throws(()=>Simulation.load(corrupt),/beschädigt/);
});
test('the pure orbital advance is deterministic and consumes no simulated randomness',()=>{
 const a=beginBomberOrbit({x:900,y:900,id:12,angle:-.4},2200);
 assert.ok(a);
 const b=structuredClone(a);
 for(let i=0;i<120;i++){
  const x=advanceBomberOrbit(a,.05),y=advanceBomberOrbit(b,.05);
  assert.deepEqual(x,y);
 }
 assert.deepEqual(a,b);
});


test('180-degree bomber redirect flies a physical circle, never snaps or slides sideways',()=>{
 const target={x:1200,y:2000};
 let plane={x:1600,y:2000,angle:0,hullAngle:0};
 const first=steerBomberArc(plane,target,.05,350,4160);
 assert.ok(first.x>plane.x,'jet initially flies forward, not west toward the cursor');
 assert.ok(first.y>plane.y,'real curved path has lateral displacement');
 assert.ok(Math.abs(first.heading-plane.angle)<=BOMBER_MAX_TURN_RATE*.05+1e-9,
  'instantaneous 180-degree turning is forbidden');
 let total=0,min=Infinity,travel=0,turns=0;
 for(let i=0;i<400;i++){
  const p=steerBomberArc(plane,target,.05,350,4160);
  const actual=Math.hypot(p.x-plane.x,p.y-plane.y);
  const angular=Math.atan2(Math.sin(p.heading-plane.angle),
   Math.cos(p.heading-plane.angle));
  assert.ok(Math.abs(angular)<=3.15*.05+1e-9,
   'maximum steering angle is rate-limited at 20 Hz');
  if(Math.abs(angular)>.001)turns++;
  travel+=actual;total+=.05;
  assert.ok(actual<=350*.05+1e-6);
  plane={x:p.x,y:p.y,angle:p.heading,hullAngle:p.heading};
  min=Math.min(min,Math.hypot(plane.x-target.x,plane.y-target.y));
  if(min<35)break;
 }
 assert.ok(turns>=15,'large turn needs many physical flight ticks');
 assert.ok(total>2,'the bomber actually performs a sweeping arc');
 assert.ok(travel>420,'it travels around, not through, its pivot');
 assert.ok(min<35,'the turn still converges to the ordered destination');
});

test('simulation bomber and 3D heading follow the same curved path',()=>{
 const {game,bomber}=setup();
 bomber.angle=0;bomber.hullAngle=0;
 const before={x:bomber.x,y:bomber.y};
 assert.equal(game.command([bomber.id],{kind:'move',x:before.x-430,y:before.y}),1);
 game.step(.05);
 assert.ok(bomber.x>before.x,'physical movement must remain initially forward');
 assert.ok(bomber.y>before.y,'flight must bank into a loop');
 assert.ok(Math.abs(bomber.angle)<.07);
 assert.ok(Math.abs(bomber.hullAngle-bomber.angle)<1e-8,
  'WebGL model heading and authoritative movement must match');
 assert.equal(bomber.idleOrbit,undefined);
 let near=Infinity;
 for(let i=0;i<260&&bomber.orders.length;i++){
  game.step(.05);
  near=Math.min(near,Math.hypot(bomber.x-(before.x-430),bomber.y-before.y));
 }
 assert.ok(near<40,'curved bomber movement reaches its direct move destination');
});
