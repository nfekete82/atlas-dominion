import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES} from '../dist/src/reborn/config.js';
import {BASTION_NAVIGATION_RADIUS} from '../dist/src/reborn/bastion-structure-collision.js';
import {segmentDistance} from '../dist/src/reborn/world-generation.js';

test('old maps retain legacy bastion navigation; spacious maps make each tower solid',()=>{
 for(const old of [15,16,17,18])
  assert.equal(Simulation.campaign(2074,old).bastionColliders().length,0);
 for(const version of [19,20,21,22]){
  const game=Simulation.campaign(2074,version);
  const towers=game.bastionColliders();
  assert.equal(towers.length,game.territories.length);
  assert.ok(towers.every(t=>t.radius===BASTION_NAVIGATION_RADIUS));
  for(const t of towers){
   assert.equal(game.world.walkable(t,towers),false,'bastion center must be solid');
  }
 }
 assert.ok(BASTION_NAVIGATION_RADIUS+RULES.infantry.radius<RULES.captureRadius-10,
  'tower must retain a ring wide enough for infantry to capture');
});

test('infantry and vehicles can route around tower without cutting through the visible structure',()=>{
 const game=Simulation.campaign(2074,19),world=game.world;
 const towers=game.bastionColliders();
 let routed=0;
 for(const tower of towers){
  const obstacles=[...game.obstacles(),...towers];
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   const dx=Math.cos(angle),dy=Math.sin(angle);
   const a={x:tower.x-195*dx,y:tower.y-195*dy};
   const b={x:tower.x+195*dx,y:tower.y+195*dy};
   if(!world.walkable(a,obstacles)||!world.walkable(b,obstacles))continue;
   const route=world.path(a,b,obstacles,0,undefined,false,true);
   if(!route.length)continue;
   let previous=a;
   for(const point of route){
    const gap=segmentDistance(tower,previous,point);
    assert.ok(gap>=BASTION_NAVIGATION_RADIUS+RULES.infantry.radius-1,
     'path clips the 3D tower: '+gap);
    previous=point;
   }
   const final=route.at(-1);
   assert.ok(Math.hypot(final.x-b.x,final.y-b.y)<world.cell*1.6);
   routed++;
   break;
  }
 }
 assert.ok(routed>=1,'at least one fully blocked tower must still be routable');
});

test('sector capture ring remains reachable outside the tower for every spacious version',()=>{
 for(const version of [19,20,21,22]){
  const game=Simulation.campaign(2074,version),world=game.world,colliders=game.bastionColliders();
  let accessible=0;
  for(const tower of colliders){
   for(let i=0;i<16;i++){
    const theta=i*Math.PI/8;
    const p={x:tower.x+82*Math.cos(theta),y:tower.y+82*Math.sin(theta)};
    if(world.walkable(p,[...game.obstacles(),...colliders])){
     accessible++;break;
    }
   }
  }
  assert.ok(accessible>=1,'all capture rings blocked on map '+version);
 }
});
