import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {defensiveTowerLimit,rankBastionDefenses,buildBastionDefense} from '../dist/src/reborn/bastion-defense.js';

const scene=()=>{
 const g=new Simulation(2026,4);
 g.aiClock=-1e8;g.time=200;g.credits=[0,1500];
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);g.world.cliffIds.fill(-1);
 g.explored[1].fill(1);
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const acquired=g.territories.find(t=>t.owner!==1&&t.neighbors.includes(hq.territory));
 assert.ok(acquired);
 acquired.owner=1;
 const hostile=g.territories.find(t=>t.owner!==1&&t.neighbors.includes(acquired.id));
 assert.ok(hostile);
 hostile.owner=0; // Public enemy ownership; no fog-based enemy unit lookups.
 const worker=g.units.find(u=>u.owner===1&&u.kind==='engineer');
 worker.x=acquired.point.x-110;worker.y=acquired.point.y-100;worker.orders=[];
 const oldHQ=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 for(const [i,kind] of ['barracks','factory'].entries()){
  const spec=BUILDINGS[kind];g.bases.push({...oldHQ,id:1900+i,kind,hp:spec.hp,radius:spec.radius,
   x:oldHQ.x+(i+1)*300,y:oldHQ.y,territory:hq.territory,queue:[],queueTypes:[],buildRemaining:0,production:0});
 }
 for(let i=0;i<5;i++)g.spawn(1,{x:worker.x+i*22,y:worker.y+140},'heavy');
 return {g,hq,acquired,hostile,worker};
};

test('bastion defense scales from 4 to 16 objectives without tower spam',()=>{
 assert.deepEqual([4,8,12,16].map(defensiveTowerLimit),[1,2,3,4]);
});
test('AI prioritizes an owned forward bastion over passive HQ defense',()=>{
 const {g,acquired}=scene();
 const choices=rankBastionDefenses(g);
 assert.equal(choices[0].sector,acquired.id);
});
test('AI builds a paid, safe turret inside its own forward bastion and saves its order',()=>{
 const {g,acquired,worker}=scene();
 const credits=g.credits[1];
 const built=buildBastionDefense(g,[worker],()=>0);
 assert.equal(built,acquired.id);
 const towers=g.bases.filter(b=>b.owner===1&&b.kind==='turret');
 assert.equal(towers.length,1);
 assert.equal(g.credits[1],credits-BUILDINGS.turret.cost);
 assert.equal(towers[0].territory,acquired.id);
 assert.ok(Math.hypot(towers[0].x-acquired.point.x,towers[0].y-acquired.point.y)>100);
 assert.equal(towers[0].buildRemaining,BUILDINGS.turret.buildTime);
 assert.equal(worker.orders[0].kind,'build');
 assert.equal(worker.orders[0].target,towers[0].id);
 assert.ok(Simulation.load(g.save()).bases.some(b=>b.id===towers[0].id&&b.kind==='turret'));
});
test('AI never builds a second tower guarding the same bastion or through unknown terrain',()=>{
 const {g,acquired,worker}=scene();
 assert.equal(buildBastionDefense(g,[worker],()=>0),acquired.id);
 worker.orders=[];g.credits[1]+=500;
 assert.notEqual(rankBastionDefenses(g)[0]?.sector,acquired.id);
 g.explored[1].fill(0);
 assert.equal(buildBastionDefense(g,[worker],()=>0),null);
});
test('economic planner defers towers until barracks, factory and a real cash buffer exist',()=>{
 const {g}=scene();
 g.credits[1]=400;
 g.tactical.plan();
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='turret').length,0);
 g.credits[1]=1500;
 g.tactical.plan();
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='turret').length,1);
 assert.equal(g.tactical.state.economy?.built.turret,1);
 const raw=g.save();
 assert.ok(Simulation.load(raw).tactical.state.economy?.towerAttemptAt>=0);
});
