import {test} from 'node:test';
import assert from 'node:assert/strict';
import {UNITS,TANK_MG,weaponDamage,combatDpsAgainst,canAttack} from '../dist/src/reborn/catalog.js';
import {fightingPowerAgainst} from '../dist/src/reborn/battle-response.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES} from '../dist/src/reborn/config.js';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
const tick=(g,seconds)=>{for(let i=0;i<Math.round(seconds/RULES.tick);i++)g.step(RULES.tick);};
function quiet(){
  const g=new Simulation(2026,4);
  g.aiClock=-1e8;
  g.world.blocked.fill(0);g.world.opaque.fill(0);
  g.units=[];
  return g;
}

test('balance: MBT is tougher and has its own stronger machine gun without price inflation',()=>{
  assert.equal(UNITS.tank.cost,550);
  assert.equal(UNITS.tank.hp,1000);
  assert.equal(UNITS.tank.damage,155);
  assert.equal(UNITS.tank.range,300);
  assert.deepEqual(TANK_MG,{damage:18,cooldown:.55,range:230});
  assert.equal(UNITS.tank.targetsAir,false);
});

test('balance: conventional machine guns are weak against armor and aircraft',()=>{
  close(weaponDamage({kind:'infantry'},{kind:'tank'}),UNITS.infantry.damage*.16);
  close(weaponDamage({kind:'infantry'},{kind:'rover'}),UNITS.infantry.damage*.16);
  close(weaponDamage({kind:'infantry'},{kind:'heavy'}),UNITS.infantry.damage);
  close(weaponDamage({kind:'heavy'},{kind:'tank'}),UNITS.heavy.damage*.20);
  close(weaponDamage({kind:'rover'},{kind:'tank'}),UNITS.rover.damage*.17);
  close(weaponDamage({kind:'heavy'},{kind:'bomber'}),UNITS.heavy.damage*.10);
  close(weaponDamage({kind:'scout'},{kind:'scout'}),UNITS.scout.damage*.12);
});

test('balance: strategic power uses the actual MG DPS, not MBT rockets against infantry',()=>{
  const g=quiet(),tank=g.spawn(0,{x:1900,y:2100},'tank'),heavy=g.spawn(1,{x:2100,y:2100},'heavy');
  close(combatDpsAgainst(tank,heavy),18/.55);
  close(combatDpsAgainst(tank,{kind:'turret',queue:[]}),155/2.35);
  close(combatDpsAgainst(heavy,tank),120*.20/1.15);
  close(fightingPowerAgainst([tank],[heavy]),Math.sqrt(tank.hp*18/.55));
});

test('balance: armor rockets still cannot attack aircraft',()=>{
  assert.equal(canAttack({kind:'tank'},{kind:'bomber'}),false);
  assert.equal(canAttack({kind:'artillery'},{kind:'scout'}),false);
  assert.equal(canAttack({kind:'heavy'},{kind:'bomber'}),true);
});

test('balance: tank beats one heavy infantry at equal initial firing distance',()=>{
  const g=quiet(),tank=g.spawn(0,{x:1900,y:2100},'tank'),
    heavy=g.spawn(1,{x:2100,y:2100},'heavy');
  g.updateVision();
  tick(g,19);
  assert.ok(heavy.hp<=0,'a single heavy infantryman should not defeat a main battle tank');
  assert.ok(tank.hp>0,'tank should survive an unsupported heavy infantryman');
});

test('balance: two MG-equipped infantrymen cannot instantly defeat armored MBT',()=>{
  const g=quiet(),tank=g.spawn(0,{x:1900,y:2100},'tank');
  g.spawn(1,{x:2110,y:2090},'heavy');
  g.spawn(1,{x:2110,y:2120},'heavy');
  g.updateVision();
  tick(g,20);
  assert.ok(tank.hp>0,'a main battle tank should survive infantry MG fire');
});

test('balance: nearby tank MG hits infantry independently of its rocket cooldown',()=>{
  const g=quiet(),tank=g.spawn(0,{x:1900,y:2100},'tank'),
    soldier=g.spawn(1,{x:2100,y:2100},'infantry');
  g.updateVision();
  tick(g,.1);
  assert.ok(soldier.hp<=UNITS.infantry.hp-TANK_MG.damage+1e-8);
});
