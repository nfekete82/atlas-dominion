import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../dist/src/reborn/simulation.js';
import { UNITS } from '../dist/src/reborn/catalog.js';

const advance=(g,seconds)=>{for(let i=0;i<Math.round(seconds/.05);i++)g.step(.05);};
function quiet() {
 const g=new Simulation();
 g.aiClock=-1e8;
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.units=[];
 return g;
}

for(const kind of ['scout','bomber','heavy']){
 test(`control: ${kind} obeys immediate retreat while an enemy is in attack range`,()=>{
  const g=quiet(),pilot=g.spawn(0,{x:1900,y:2100},kind);
  const enemy=g.spawn(1,{x:1900+Math.min(175,UNITS[kind].range-25),y:2100},'heavy');
  g.stop([enemy.id],true);g.updateVision();
  advance(g,.5);
  assert.ok(enemy.hp<UNITS.heavy.hp,`${kind} should have fired before retreat`);
  const before=pilot.x,enemyHp=enemy.hp;
  assert.equal(g.command([pilot.id],{kind:'move',x:1500,y:2100}),1);
  assert.equal(pilot.orders[0].kind,'move');
  advance(g,.5);
  assert.ok(pilot.x<before-4,`${kind} must move immediately instead of freezing to fire`);
  assert.equal(enemy.hp,enemyHp,'move order must suppress further auto-fire until destination');
  assert.equal(pilot.combatTarget,null);
  assert.equal(pilot.pursuitOrigin,null);
 });
}

test('control: queued movement orders advance even if a combat target remains visible',()=>{
 const g=quiet(),h=g.spawn(0,{x:1900,y:2100},'bomber'),enemy=g.spawn(1,{x:2050,y:2100},'heavy');
 enemy.cooldown=100;g.stop([enemy.id],true);g.updateVision();
 assert.equal(g.command([h.id],{kind:'move',x:1860,y:2100}),1);
 assert.equal(g.command([h.id],{kind:'move',x:1750,y:2100},true),1);
 advance(g,1.2);
 assert.ok(h.x<1865);
 assert.ok(h.orders.length<=1,'queued orders must progress rather than being blocked by combat');
});

test('combat AI: red heavy infantry prioritizes a visible rocket launcher over a slightly closer rifleman',()=>{
 const g=quiet(),red=g.spawn(1,{x:1900,y:2100},'heavy'),rifle=g.spawn(0,{x:2075,y:2100},'infantry'),
  rocket=g.spawn(0,{x:2110,y:2100},'artillery');
 g.stop([rifle.id,rocket.id],true);rifle.cooldown=rocket.cooldown=100;g.updateVision();
 g.step();
 assert.ok(rocket.hp<UNITS.artillery.hp,'enemy rocket launcher should be the preferred threat');
 assert.equal(rifle.hp,UNITS.infantry.hp);
 assert.equal(red.combatTarget,rocket.id);
});

test('combat AI: real enemy artillery threatening the red HQ outranks nearby infantry',()=>{
 const g=quiet(),base=g.bases[1];
 Object.assign(base,{x:1800,y:2100});
 const scout=g.spawn(1,{x:base.x+130,y:base.y},'scout');
 const infantry=g.spawn(0,{x:base.x+210,y:base.y},'infantry');
 const rocket=g.spawn(0,{x:base.x+385,y:base.y},'artillery');
 g.stop([scout.id,infantry.id,rocket.id],true);
 g.updateVision();
 assert.equal(g.canSee(1,rocket),true);
 g.tactical.plan();
 assert.equal(g.tactical.state.phase,'defend');
 assert.equal(g.tactical.state.objective,rocket.id);
});
