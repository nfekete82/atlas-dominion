import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {distance} from '../dist/src/reborn/config.js';
import {ROVER_CAPACITY,TRANSPORT_CAPACITY,transportCapacity} from '../dist/src/reborn/transports.js';

const advance=(g,seconds)=>{for(let i=0;i<Math.round(seconds/.05);i++)g.step(.05);};
function fixture(){
 const game=new Simulation();
 game.aiClock=-1e8;game.units=[];
 const rover=game.spawn(0,{x:1900,y:2100},'rover');
 const infantry=Array.from({length:5},(_,i)=>game.spawn(0,{x:1840+(i%3)*23,y:2058+Math.floor(i/3)*24},
  ['infantry','medic','engineer','heavy','infantry'][i]));
 return {game,rover,infantry};
}
test('Humvee recon carrier is faster than ordinary units, armed and restricted to four seats',()=>{
 assert.equal(UNITS.rover.name,'Humvee');
 assert.equal(ROVER_CAPACITY,4);
 assert.equal(TRANSPORT_CAPACITY,10);
 assert.equal(transportCapacity('rover'),4);
 assert.equal(transportCapacity('scout'),10);
 assert.equal(transportCapacity('tank'),0);
 assert.ok(UNITS.rover.speed>UNITS.scout.speed);
 assert.ok(UNITS.rover.speed>UNITS.infantry.speed);
 assert.ok(UNITS.rover.range>=200);
 assert.ok(UNITS.rover.cooldown<1);
 assert.ok(UNITS.rover.hp<UNITS.tank.hp);
});
test('four infantry load on the ground; five cannot; loaded crew remains hidden, saved and later deployed',()=>{
 const {game,rover,infantry}=fixture();
 const hp=infantry.map(u=>u.hp);
 assert.equal(game.transports.board(rover.id,infantry.map(u=>u.id)),4);
 assert.equal(rover.transport.phase,'loading');
 assert.equal(rover.flightHeight,undefined,'wheeled transport never flies');
 advance(game,9);
 assert.equal(rover.transport.phase,'cruise');
 assert.equal(rover.transport.cargo.length,4);
 assert.equal(game.transports.board(rover.id,[infantry[4].id]),0);
 assert.ok(infantry.slice(0,4).every(u=>u.carrier===rover.id));
 assert.equal(game.command([infantry[0].id],{kind:'move',x:2000,y:2150}),0);
 const snapshot=game.save(),loaded=Simulation.load(snapshot);
 loaded.aiClock=-1e8;
 const loadedRover=loaded.units.find(u=>u.id===rover.id);
 assert.equal(loadedRover.transport.cargo.length,4);
 assert.equal(loadedRover.flightHeight,undefined);
 assert.ok(loaded.transports.unload(rover.id,{x:2120,y:2100}));
 advance(loaded,15);
 assert.equal(loadedRover.transport.phase,'cruise');
 assert.equal(loadedRover.transport.cargo.length,0);
 for(const passenger of infantry.slice(0,4)){
  const soldier=loaded.units.find(u=>u.id===passenger.id);
  assert.equal(soldier.carrier,undefined);
  assert.equal(soldier.hp,hp[infantry.indexOf(passenger)]);
  assert.ok(loaded.world.walkable(soldier,loaded.obstacles()));
  assert.ok(distance(soldier,loadedRover)<100);
 }
 assert.equal(loaded.units.find(u=>u.id===infantry[4].id).carrier,undefined);
});
test('ground carrier rejects hostile or non-infantry and protects passengers in combat/capture queries',()=>{
 const {game,rover,infantry}=fixture();
 const enemy=game.spawn(1,{x:1930,y:2090},'infantry');
 const tank=game.spawn(0,{x:1990,y:2050},'tank');
 assert.equal(game.transports.board(rover.id,[enemy.id,tank.id]),0);
 game.transports.board(rover.id,infantry.slice(0,2).map(u=>u.id));
 advance(game,9);
 game.updateVision();
 assert.ok(infantry.slice(0,2).every(u=>!game.spatial.query(rover,200).includes(u)));
 rover.hp=0;
 game.step(.05);
 assert.ok(infantry.slice(0,2).every(u=>u.hp<=0));
 assert.ok(!game.units.some(u=>u.carrier));
});
test('both factions have a real 3D rover with 4-seat metadata, MG muzzle, 16 headings and moving wheels',()=>{
 for(const team of [0,1]){
  const root='src/assets/reborn/animation/rover-'+team;
  const metadata=JSON.parse(fs.readFileSync(root+'.json','utf8'));
  const glb=fs.readFileSync(root+'.glb');
  assert.equal(glb.toString('ascii',0,4),'glTF');
  assert.ok(glb.length>300000,'expected textured, high-detail GLB');
  assert.equal(metadata.model,'rover-'+team+'.glb');
  assert.equal(metadata.design.seats,4);
  assert.equal(metadata.design.team,team);
  assert.match(metadata.design.weapon,/machine gun/i);
  assert.equal(metadata.design.wheelCount,4);
  assert.match(metadata.design.wheelType,/rounded 64-segment offroad tyres/);
  assert.equal(metadata.design.teamFlag,team===0?'blue':'red');
  assert.match(metadata.design.flagGeometry,/double-sided curved cloth/);
  for(const node of ['TerrainTireSidewall','StaggeredTreadLug','AlloyWheelFace',
   'AlloyRimSpoke','WheelHubBolt','TeamFlagMast','TeamFlagCloth','RoverFactionFlag']){
   assert.ok(glb.includes(Buffer.from(node)),`team ${team} missing GLB node ${node}`);
  }
  assert.ok(!glb.includes(Buffer.from('TreadBlock')),'no old oversized block tyres');
  assert.equal(metadata.directions,16);
  assert.deepEqual(metadata.cell,[192,192]);
  assert.ok(metadata.frames.every(f=>Array.isArray(f.muzzle)&&f.muzzle.every(Number.isFinite)));
  assert.equal(metadata.clips.walk.frames.length,16);
  assert.ok(metadata.clips.walk.frames.every(row=>row.length===11),'11 wheel rotation frames per view');
  assert.ok(metadata.clips.walk.uniquePhases.every(n=>n>=5),'wheels have multiple visibly different rotations');
  assert.equal(metadata.stride,52,'wheel spin advances with actual distance traveled');
  const len=glb.readUInt32LE(12),json=JSON.parse(glb.subarray(20,20+len));
  const spin=json.animations?.find(c=>c.name==='Humvee_Wheels');
  assert.ok(spin,'GLB includes real 3D wheel animation, not only tactical sprites');
  assert.equal(spin.channels.length,4,'all four wheels spin independently');
 }
});
