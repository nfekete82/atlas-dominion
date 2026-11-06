import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {vehicleStructureColliders} from '../dist/src/reborn/vehicle-structure-collision.js';
import {visibleBasePropColliders} from '../dist/src/reborn/vehicle-decor-collision.js';
import {UNITS,BUILDINGS} from '../dist/src/reborn/catalog.js';
import {buildingArtWidth} from '../dist/src/reborn/visual-scale.js';

const clearance=Math.max(0,UNITS.tank.radius-10);
const clearWorld=g=>{g.world.blocked.fill(0);g.world.components.fill(0);g.aiClock=1e8;};

test('vehicle collision: painted HQ/factory silhouettes are larger than construction circles',()=>{
 const g=new Simulation(2026,4);
 const buildings=vehicleStructureColliders(g.obstacles());
 for(const kind of ['headquarters']){
  const base=g.bases.find(b=>b.kind===kind);
  const hit=buildings.find(b=>b.x===base.x);
  assert.ok(hit.radius>=buildingArtWidth(kind,BUILDINGS[kind].width)*.50);
  assert.ok(hit.radius>base.radius);
 }
 assert.equal(g.bases.find(b=>b.kind==='headquarters').radius,83,'gameplay building radius remains untouched');
});

test('factory: tank spawns outside nearby visually large HQ and never crosses it while rallying',()=>{
 const g=new Simulation(2026,4);clearWorld(g);
 const factory={...g.bases[0],id:1700,x:1700,y:1700,kind:'factory',radius:BUILDINGS.factory.radius,buildRemaining:0,hp:BUILDINGS.factory.hp,queue:[0],queueTypes:['tank'],production:0,rally:{x:2210,y:1470}};
 const hq={...g.bases[1],owner:0,id:1701,x:1890,y:1570,kind:'headquarters',radius:BUILDINGS.headquarters.radius,buildRemaining:0,hp:BUILDINGS.headquarters.hp,queue:[],queueTypes:[],production:0,rally:null};
 g.bases=[factory,hq];g.units=[];g.step();
 const tank=g.units.find(u=>u.kind==='tank'&&u.owner===0);
 assert.ok(tank,'tank produced');
 assert.ok(tank.orders.length,'rally command assigned');
 const visual=[...g.obstacles(),...vehicleStructureColliders(g.obstacles()),...visibleBasePropColliders(g)];
 assert.ok(g.world.walkable(tank,visual,clearance),'tank must not spawn in structure art or decor');
 let advanced=0;
 for(let i=0;i<260;i++){
  const before={x:tank.x,y:tank.y};g.step();
  if(Math.hypot(tank.x-before.x,tank.y-before.y)>0.001)advanced++;
  assert.ok(g.world.walkable(tank,visual,clearance),'tank entered building/decor at tick '+i);
 }
 assert.ok(advanced>25,'tank should progress around the HQ, not remain stuck');
});

test('vehicle collision: pathfinding detours rather than taking a straight line through full HQ artwork',()=>{
 const g=new Simulation(2026,4);clearWorld(g);
 const hq=g.bases.find(b=>b.kind==='headquarters'&&b.owner===0);
 const obs=[...g.obstacles(),...vehicleStructureColliders(g.obstacles()),...visibleBasePropColliders(g)];
 const start={x:hq.x-320,y:hq.y-80},end={x:hq.x+320,y:hq.y-80};
 assert.equal(g.world.line(start,end,obs,clearance),false);
 const route=g.world.path(start,end,obs,clearance,undefined,false,true);
 assert.ok(route.length,'navigation should find a safe detour around the whole building');
 let prev=start;
 for(const next of route){assert.ok(g.world.line(prev,next,obs,clearance),'segment intersects painted building');prev=next;}
});
