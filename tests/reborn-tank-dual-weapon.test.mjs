import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {Weather} from '../dist/src/reborn/weather.js';
import {WEATHER_RULES} from '../dist/src/reborn/config.js';

const fixture=()=>{
 const game=new Simulation(2026,8,true);
 game.aiClock=-1e8;game.units=[];game.world.blocked.fill(0);game.world.opaque.fill(0);
 return game;
};
test('tank: dual-weapon combat has more armor and expensive 550-credit production',()=>{
 assert.equal(UNITS.tank.hp,850);
 assert.equal(UNITS.tank.cost,550);
 assert.equal(UNITS.tank.damage,135);
 assert.equal(UNITS.tank.targetsAir,false);
 assert.equal(UNITS.tank.range,300);
});
test('tank: guided anti-armor rocket and separate roof MG both fire when targets present',()=>{
 const g=fixture(),tank=g.spawn(0,{x:1650,y:1600},'tank'),
  enemyArmor=g.spawn(1,{x:1885,y:1600},'tank'),
  enemyInfantry=g.spawn(1,{x:1770,y:1660},'infantry');
 enemyArmor.cooldown=1e8;enemyInfantry.cooldown=1e8;
 g.updateVision();g.step();
 assert.ok(g.missiles.some(m=>m.source===tank.id&&m.type==='antiArmor'),'main anti-armor rocket fired');
 assert.ok(g.shots.some(s=>s.source===tank.id&&s.weapon==='machinegun'),'roof MG fired independently');
 const rocket=g.missiles.find(m=>m.source===tank.id);
 assert.equal(rocket.damage,UNITS.tank.damage);
 assert.equal(rocket.to.x,enemyArmor.x);
 assert.ok(enemyInfantry.hp<UNITS.infantry.hp,'MG damaged infantry');
 const saved=Simulation.load(g.save());
 assert.deepEqual(saved.missiles,g.missiles,'rocket flight survives save/load');
 assert.equal(saved.units.find(u=>u.id===tank.id).mgCooldown,tank.mgCooldown,'MG clock persists');
 for(let i=0;i<16;i++)g.step();
 assert.ok(enemyArmor.hp<UNITS.tank.hp,'rocket impacts armored target');
});
test('tank: roof MG does not attack unseen infantry during intense sandstorm',()=>{
 const g=fixture(),tank=g.spawn(0,{x:1600,y:1600},'tank'),
  enemy=g.spawn(1,{x:1830,y:1600},'infantry');
 enemy.cooldown=1e8;tank.hold=true;
 const stormStarts=g.weather.endsAt+WEATHER_RULES.warning;
 g.time=stormStarts;g.weather.update(g.time);g.updateVision();g.step();
 assert.equal(g.weather.phase,'SANDSTORM');
 assert.equal(g.canSee(0,enemy),false);
 assert.equal(enemy.hp,UNITS.infantry.hp);
 assert.equal(g.shots.some(s=>s.weapon==='machinegun'),false);
});
test('weather: storm lasts at most ten seconds, fades quickly and sharply limits ground sight',()=>{
 assert.deepEqual(WEATHER_RULES.storm,[8,10]);
 assert.equal(WEATHER_RULES.groundSight,.23);
 for(const seed of [1,2,2026,98765]){
  const w=new Weather(seed);w.update(w.endsAt);w.update(w.endsAt);
  assert.equal(w.phase,'SANDSTORM');
  assert.ok(w.remaining>=8&&w.remaining<=10);
  const end=w.endsAt;w.update(w.startedAt+2);assert.equal(w.intensity,1);
  w.update(end);assert.equal(w.phase,'RECOVERY');
 }
});
