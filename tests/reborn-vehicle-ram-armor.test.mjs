import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,armorMultiplier,weaponDamage} from '../dist/src/reborn/catalog.js';
import {RULES} from '../dist/src/reborn/config.js';

const advance=(g,seconds)=>{for(let i=0;i<Math.ceil(seconds/RULES.tick);i++)g.step();};
const scene=()=>{const g=new Simulation();g.units=[];g.aiClock=-1e8;return g;};

test('rover, tank and artillery run over enemy infantry for 25% of maximum HP per contact',()=>{
  for(const kind of ['rover','tank','artillery']){
    const g=scene();
    const vehicle=g.spawn(0,{x:1900,y:2100},kind);
    const infantry=g.spawn(1,{x:1960,y:2100},'heavy');
    vehicle.cooldown=100;infantry.cooldown=100;infantry.hold=true;
    assert.equal(g.command([vehicle.id],{x:2200,y:2100,kind:'move'}),1);
    advance(g,4);
    assert.equal(infantry.hp,UNITS.heavy.hp*.75,`${kind}: exactly one 25% hit`);
    assert.equal(infantry.lastAttacker,vehicle.id);
    assert.equal(infantry.x,1960,`${kind}: moving vehicle must not drag target forward`);
  }
});

test('vehicle can hit the same soldier again only on a genuinely separate later pass',()=>{
  const g=scene();
  const tank=g.spawn(0,{x:1900,y:2100},'tank');
  const soldier=g.spawn(1,{x:1960,y:2100},'heavy');
  tank.cooldown=100;soldier.cooldown=100;soldier.hold=true;
  g.command([tank.id],{x:2200,y:2100,kind:'move'});
  advance(g,5);
  assert.equal(soldier.hp,315,'first crossing deals exactly one quarter');
  assert.ok(tank.x>2150,'vehicle fully leaves the target area');
  advance(g,1.6);
  g.command([tank.id],{x:1850,y:2100,kind:'move'});
  advance(g,8);
  assert.equal(soldier.hp,210,'the new return crossing causes one fresh quarter');
});

test('stationary vehicles, friendly infantry and aircraft do not cause run-over damage',()=>{
  const g=scene();
  const tank=g.spawn(0,{x:1900,y:2100},'tank');
  const enemy=g.spawn(1,{x:1930,y:2100},'infantry');
  tank.cooldown=100;enemy.cooldown=100;enemy.hold=true;
  advance(g,1);
  assert.equal(enemy.hp,UNITS.infantry.hp,'parked tanks must not cause collision damage');

  const friendly=g.spawn(0,{x:2010,y:2100},'infantry');
  friendly.cooldown=100;
  const heli=g.spawn(0,{x:1900,y:2180},'scout');
  heli.cooldown=100;
  const pedestrian=g.spawn(1,{x:1950,y:2180},'heavy');
  pedestrian.cooldown=100;pedestrian.hold=true;
  g.command([tank.id],{x:2200,y:2100,kind:'move'});
  g.command([heli.id],{x:2200,y:2180,kind:'move'});
  advance(g,5);
  assert.equal(friendly.hp,UNITS.infantry.hp,'friendly units are excluded from trampling');
  assert.equal(pedestrian.hp,UNITS.heavy.hp,'airborne helicopters do not trample');
});

test('ram cooldown survives save/load without repeating damage in the same contact',()=>{
  const g=scene();
  const tank=g.spawn(0,{x:1900,y:2100},'tank');
  const enemy=g.spawn(1,{x:1960,y:2100},'infantry');
  tank.cooldown=100;enemy.cooldown=100;enemy.hold=true;
  g.command([tank.id],{x:2200,y:2100,kind:'move'});
  for(let i=0;i<100&&enemy.hp===UNITS.infantry.hp;i++)g.step();
  assert.equal(enemy.hp,75);
  const loaded=Simulation.load(g.save());
  assert.deepEqual(loaded.units.find(u=>u.id===tank.id).ramCooldown,tank.ramCooldown);
  advance(loaded,.5);
  assert.equal(loaded.units.find(u=>u.id===enemy.id).hp,75);
});

test('tank takes sharply reduced machine-gun and turret damage but full cannon and rocket hits',()=>{
  const tank={kind:'tank'};
  assert.equal(armorMultiplier(tank,'rifle'),.12);
  assert.equal(armorMultiplier(tank,'pistol'),.10);
  assert.equal(armorMultiplier(tank,'turret'),.15);
  assert.equal(armorMultiplier(tank,'heavy'),.28);
  assert.equal(armorMultiplier(tank,'cannon'),1);
  assert.equal(armorMultiplier(tank,'rocket'),1);
  assert.equal(armorMultiplier({kind:'infantry'},'rifle'),1);
  assert.equal(armorMultiplier({kind:'rover'},'rifle'),1);
  assert.equal(armorMultiplier({kind:'turret',queue:[]},'turret'),1);
  assert.equal(weaponDamage({kind:'heavy'},tank),UNITS.heavy.damage*.45);

  const g=scene();
  const rifle=g.spawn(0,{x:1900,y:2100},'infantry');
  const armored=g.spawn(1,{x:2030,y:2100},'tank');
  armored.cooldown=100;armored.hold=true;
  g.step();
  const expected=UNITS.tank.hp-UNITS.infantry.damage/3*.12;
  assert.ok(Math.abs(armored.hp-expected)<1e-8,`MG shot: expected ${expected}, got ${armored.hp}`);
  assert.equal(rifle.hp,UNITS.infantry.hp);
});
