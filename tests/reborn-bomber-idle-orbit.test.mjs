import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {beginBomberOrbit,advanceBomberOrbit,validBomberOrbit,BOMBER_ORBIT_SPEED} from '../dist/src/reborn/bomber-orbit.js';
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
 assert.equal(unitArtScale('tank'),.98);
 assert.equal(unitArtScale('infantry'),.73);
 assert.equal(unitSpec({kind:'bomber'}).width,107);
 assert.equal(unitSpec({kind:'scout'}).width,106);
 assert.equal(unitSpec({kind:'bomber'}).speed,125);
});
test('idle bomber travels a bounded real circle and remains tangent to its previous heading',()=>{
 const {game,bomber}=setup(),start={x:bomber.x,y:bomber.y};
 game.step(.05);
 const orbit=bomber.idleOrbit;
 assert.ok(orbit,'idle bomber acquires an orbit');
 assert.ok(bomber.moving&&bomber.walkDistance>0,'actual position and animation move');
 assert.ok(distance(start,bomber)>0,'not a hover-only drawing trick');
 assert.ok(Math.abs(distance(bomber,{x:orbit.cx,y:orbit.cy})-orbit.radius)<1e-8);
 assert.ok(Math.abs(orbit.radius-78)<1e-8);
 assert.ok(Math.abs(bomber.driveSpeed-BOMBER_ORBIT_SPEED)<1e-8);
 advance(game,14);
 assert.ok(distance(bomber,start)<40,'a full holding turn remains near its anchor');
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
