import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {RULES} from '../dist/src/reborn/config.js';

function quiet(){
  const g=new Simulation();
  g.aiClock=-1e8;
  g.world.blocked.fill(0);
  g.world.opaque.fill(0);
  g.units=[];
  return g;
}
const advance=(g,seconds)=>{for(let i=0;i<Math.round(seconds/RULES.tick);i++)g.step(RULES.tick);};
const go={kind:'move',x:2500,y:2100};

test('escort: pioneer and medic share rear formation behind heavy infantry',()=>{
  const g=quiet(),heavy=g.spawn(0,{x:1900,y:2100},'heavy'),
    engineer=g.spawn(0,{x:1870,y:2110},'engineer'),
    medic=g.spawn(0,{x:1870,y:2090},'medic');
  assert.equal(g.command([heavy.id,engineer.id,medic.id],go),3);
  assert.deepEqual(engineer.orders[0].formation.front,[heavy.id]);
  assert.deepEqual(medic.orders[0].formation.front,[heavy.id]);
  assert.equal(heavy.orders[0].formation,undefined,'combat infantry stays in front');
  assert.notEqual(engineer.orders[0].formation.lane,medic.orders[0].formation.lane,
    'support workers should not march in exactly the same lane');
  advance(g,1);
  assert.ok(engineer.x<heavy.x-25,'pioneer must not outrun heavy infantry');
  assert.ok(medic.x<heavy.x-25,'medic remains behind front');
});

test('escort: even a fast pioneer stays behind a slower tank',()=>{
  const g=quiet(),tank=g.spawn(0,{x:1900,y:2100},'tank'),
    worker=g.spawn(0,{x:1830,y:2100},'engineer');
  assert.equal(g.command([tank.id,worker.id],go),2);
  assert.ok(worker.orders[0].formation);
  advance(g,2);
  assert.ok(worker.x<=tank.x-30,'pioneer stays behind armored unit');
});

test('escort: solo pioneer retains its full independent speed',()=>{
  const g=quiet(),worker=g.spawn(0,{x:1800,y:2100},'engineer');
  assert.equal(UNITS.engineer.speed,105);
  assert.equal(g.command([worker.id],go),1);
  assert.equal(worker.orders[0].formation,undefined);
  const start=worker.x;
  advance(g,1);
  assert.ok(worker.x>start+60,'alone pioneer should move freely at the catalog speed');
});

test('escort: pure support group has no nonexistent frontline anchor',()=>{
  const g=quiet(),worker=g.spawn(0,{x:1800,y:2100},'engineer'),
    medic=g.spawn(0,{x:1800,y:2150},'medic');
  assert.equal(g.command([worker.id,medic.id],go),2);
  assert.equal(worker.orders[0].formation,undefined);
  assert.equal(medic.orders[0].formation,undefined);
  const start=worker.x;
  advance(g,1);
  assert.ok(worker.x>start+40);
});

test('escort: pioneer repairs an injured frontline vehicle while following',()=>{
  const g=quiet(),tank=g.spawn(0,{x:1900,y:2100},'tank'),
    worker=g.spawn(0,{x:1840,y:2100},'engineer');
  tank.hp=UNITS.tank.hp-110;
  assert.equal(g.command([tank.id,worker.id],go),2);
  advance(g,.5);
  assert.ok(tank.hp>UNITS.tank.hp-110,'support pioneer repairs the passing tank');
  assert.ok(worker.x<tank.x,'repair may not pull the worker ahead of the tank');
});

test('escort: explicit repair overrides a former marching escort',()=>{
  const g=quiet(),heavy=g.spawn(0,{x:1900,y:2100},'heavy'),
    worker=g.spawn(0,{x:1840,y:2100},'engineer'),
    rover=g.spawn(0,{x:1840,y:2130},'rover');
  rover.hp=UNITS.rover.hp-50;
  assert.equal(g.command([heavy.id,worker.id],go),2);
  assert.ok(worker.orders[0].formation);
  assert.equal(g.command([worker.id],{kind:'repair',x:rover.x,y:rover.y,target:rover.id}),1);
  assert.equal(worker.orders[0].kind,'repair');
  assert.equal(worker.orders[0].formation,undefined);
  advance(g,.5);
  assert.ok(rover.hp>UNITS.rover.hp-50,'dedicated repair still works');
});

test('escort: queued group formation persists across save/load',()=>{
  const g=quiet(),heavy=g.spawn(0,{x:1900,y:2100},'heavy'),
    worker=g.spawn(0,{x:1840,y:2100},'engineer');
  assert.equal(g.command([heavy.id,worker.id],go),2);
  advance(g,.5);
  const loaded=Simulation.load(g.save());
  loaded.aiClock=-1e8;
  const pioneer=loaded.units.find(u=>u.id===worker.id);
  assert.deepEqual(pioneer.orders[0].formation.front,[heavy.id]);
  advance(loaded,1);
  assert.ok(pioneer.x<loaded.units.find(u=>u.id===heavy.id).x);
});
