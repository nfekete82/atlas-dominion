import test from 'node:test';
import assert from 'node:assert/strict';
import {groupBattles,locateBattleContact,visualNoise,combatVisualDensity,battleMomentum} from '../dist/src/render/front-battles.js';
import {Game,NEUTRAL,landNeighbors,cellToPoint} from '../dist/src/engine/game.js';

const event=(index,attackerId,defenderId,attacking,defending,tick=8,captured=false)=>({
  index,attackerId,defenderId,attacking,defending,tick,captured,
  attackerLost:attacking*.1,defenderLost:defending,
});

test('true orthogonal border only: owner, AI and neutral front positions cannot teleport or wrap rows',()=>{
  const width=5;
  const owners=Int16Array.from([
    0,0,1,1,-2,
    0,0,1,1,-2,
    0,0,1,1,-2,
  ]);
  const a=locateBattleContact(event(2,0,1,21,5),owners,width);
  assert.ok(a);
  assert.ok(Math.abs(a.x-2)<.1);
  assert.equal(a.dy,0);
  assert.ok(a.dx>0);
  const after=owners.slice();after[2]=0;
  const b=locateBattleContact(event(2,0,1,21,5,8,true),after,width);
  assert.ok(b);
  assert.ok(b.x>2.4);
  // First sector of the next row is NOT adjacent to last sector of prior row.
  const coastal=Int16Array.from([-2,-2,-2,-2,0,1,-2,-2,-2,-2]);
  assert.equal(locateBattleContact(event(5,0,1,21,6),coastal,width),null);
  assert.equal(locateBattleContact(event(2,0,1,21,5),Int16Array.from([0,0,-2,1,1]),width),null);
});

test('front clustering groups nearby real strikes, separating distant wars and country pairs',()=>{
  const owners=Int16Array.from([
    0,0,1,1,1,1,1,1,
    0,0,1,1,1,1,1,1,
    0,0,1,1,1,1,1,1,
    0,0,2,2,2,2,2,2,
  ]);
  const events=[
    event(2,0,1,24,9),event(10,0,1,21,5),event(18,0,1,20,7),
    event(26,0,2,10,3),
  ];
  const groups=groupBattles(events,owners,8);
  assert.equal(groups.length,2);
  assert.equal(groups[0].blue,24);
  assert.equal(groups[0].red,9);
  assert.equal(groups[0].strikes,3);
  assert.equal(groups[0].leftId,0);
  assert.equal(groups[1].rightId,2);
  assert.equal(groups[1].strikes,1);
});

test('blue is ALWAYS player and red is ALWAYS enemy regardless of which nation attacks',()=>{
  const owners=Int16Array.from([0,1,1,0]);
  const playerAttacks=groupBattles([event(1,0,1,21,8)],owners,4);
  const defenderEvents=groupBattles([event(0,1,0,34,6)],owners,4);
  assert.equal(playerAttacks[0].blue,21);
  assert.equal(playerAttacks[0].red,8);
  assert.equal(defenderEvents[0].blue,6);
  assert.equal(defenderEvents[0].red,34);
  assert.equal(playerAttacks[0].playerBattle,true);
  assert.equal(defenderEvents[0].playerBattle,true);
  // Enemy-on-enemy wars do not pretend either side is the player.
  const ai=groupBattles([event(1,2,1,17,11)],Int16Array.from([2,1]),2);
  assert.equal(ai[0].playerBattle,false);
  assert.equal(ai[0].blue,0);
  assert.equal(ai[0].red,0);
});

test('neutral land has no imaginary red soldiers and repeated strikes are not double counted',()=>{
  const owners=Int16Array.from([0,NEUTRAL,NEUTRAL,NEUTRAL]);
  const groups=groupBattles([event(1,0,NEUTRAL,21,0),event(1,0,NEUTRAL,21,0)],owners,4);
  assert.equal(groups.length,1);
  assert.equal(groups[0].blue,21);
  assert.equal(groups[0].red,0);
  assert.equal(groups[0].strikes,2);
});

test('front particle placements and exact battle snapshots are independent of simulation RNG',()=>{
  for(let seed=0;seed<80;seed++){
    assert.equal(visualNoise(seed,3),visualNoise(seed,3));
    assert.ok(visualNoise(seed,3)>=0&&visualNoise(seed,3)<1);
  }
  const g=new Game(221,1,'DE');
  const edge=g.owner.findIndex((o,i)=>o===NEUTRAL && landNeighbors(i).some(n=>g.owner[n]===0));
  assert.ok(edge>=0);
  g.owner[edge]=1;g.defense[edge]=30;g.frontline[edge]=5;g.recount();
  const result=g.launchAttack(0,cellToPoint(edge),80);
  assert.ok(result.ok);
  g.step();
  const before=g.battleEvents.map(e=>({...e}));
  const population=g.populationOf(0),owned=g.owner.slice();
  assert.ok(before.some(e=>e.attackerId===0&&e.defenderId===1&&e.attacking>0));
  assert.ok(before.some(e=>e.attackerId===0&&e.attackerLost>0));
  const groups=groupBattles(g.battleEvents,g.owner,480);
  assert.ok(groups.every(group=>Number.isFinite(group.x)&&group.strikes>0));
  assert.deepEqual(g.battleEvents,before);
  assert.deepEqual([...g.owner],[...owned]);
  assert.equal(g.populationOf(0),population);
});

test('equal command sequences record identical combat telemetry',()=>{
  const a=new Game(4101,2,'DE'),b=new Game(4101,2,'DE');
  const edge=a.owner.findIndex((o,i)=>o===NEUTRAL&&landNeighbors(i).some(n=>a.owner[n]===0));
  assert.deepEqual(a.launchAttack(0,cellToPoint(edge),45),b.launchAttack(0,cellToPoint(edge),45));
  for(let i=0;i<20;i++){
    a.step();b.step();
    assert.deepEqual(a.battleEvents,b.battleEvents);
  }
});

test('new squad visuals scale with actual contacts, respect zoom and never alter the simulation',()=>{
  assert.equal(combatVisualDensity(0,4),0);
  assert.equal(combatVisualDensity(-1,4),0);
  assert.equal(combatVisualDensity(NaN,4),0);
  assert.ok(combatVisualDensity(40,1)>0);
  assert.ok(combatVisualDensity(40,2)>=combatVisualDensity(40,1));
  assert.ok(combatVisualDensity(1000000,4)<=18);
  assert.equal(battleMomentum(20,20),0);
  assert.ok(battleMomentum(50,2)>0);
  assert.ok(battleMomentum(2,50)<0);
  assert.equal(battleMomentum(0,0),0);
  assert.ok(Math.abs(battleMomentum(4,1))<=1);
});
