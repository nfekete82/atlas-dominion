import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,NEUTRAL,landNeighbors,cellToPoint,pointToIndex,WATER} from '../dist/src/engine/game.js';
import {MAP_WIDTH} from '../dist/src/data/europe.js';

function makeInvadedFront(seed=182){
  const game=new Game(seed,1,'DE');
  // Pick an owned sector with a genuine orthogonal neutral border.
  const own=game.owner.findIndex((owner,i)=>owner===0 &&
    landNeighbors(i).some(n=>game.owner[n]===NEUTRAL) &&
    landNeighbors(i).every(n=>game.owner[n]===0||game.owner[n]===NEUTRAL||game.owner[n]===WATER));
  assert.ok(own>=0);
  const invaded=landNeighbors(own).find(n=>game.owner[n]===NEUTRAL);
  assert.ok(invaded>=0);
  game.owner[invaded]=1;
  game.defense[invaded]=12;
  game.recount();
  return {game,own,invaded};
}

test('real reserve soldiers die when their country is invaded even without pre-stationed guards',()=>{
  const {game,own}=makeInvadedFront();
  assert.equal(game.frontline[own],0);
  const enemy=game.factions[1],defender=game.factions[0];
  const before=game.populationOf(0),fallen=defender.defenseSpent;
  assert.equal(game.attack(enemy,own),true);
  assert.ok(game.populationOf(0)<before,'real citizens must die on a hostile invasion');
  assert.ok(defender.defenseSpent>fallen);
  assert.ok(defender.defenseFallenTick>0);
  assert.ok(enemy.enemyFallen>0);
  assert.ok(defender.troops>=0);
});

test('manually reinforcing a threatened owned border transfers soldiers, never creates or kills them',()=>{
  const {game,own}=makeInvadedFront();
  const before=game.populationOf(0),reserve=game.factions[0].troops;
  const order=game.reinforceBorder(0,cellToPoint(own),35);
  assert.equal(order.ok,true);
  assert.ok(order.sent>=8);
  assert.ok(game.frontline[own]>=order.sent);
  assert.ok(game.factions[0].troops<reserve);
  assert.ok(Math.abs(game.populationOf(0)-before)<1e-8);
  assert.equal(game.reinforceBorder(0,cellToPoint(own),2).ok,false);
  const quiet=game.cities[0].index;
  // Capital may itself be threatened; a distant quiet cell must reject.
  const inland=game.owner.findIndex((o,i)=>o===0 && !game.isThreatenedBorder(0,cellToPoint(i)));
  assert.ok(inland>=0 || game.isThreatenedBorder(0,cellToPoint(quiet)));
  if(inland>=0)assert.equal(game.reinforceBorder(0,cellToPoint(inland),35).ok,false);
  assert.equal(game.reinforceBorder(0,cellToPoint(game.cities[1].index),35).ok,false);
});

test('left-clicking an owned frontline NEVER deploys troops or creates counterattacks',()=>{
  const {game,own,invaded}=makeInvadedFront();
  const before=game.populationOf(0);
  const reserve=game.factions[0].troops;
  const existing=structuredClone(game.attackOrders);
  const ownPoint=cellToPoint(own);
  const friendly=game.launchAttack(0,ownPoint,35);
  assert.deepEqual(friendly,{ok:false,reason:'Eigenes Gebiet – keine Truppen versendet.',sent:0});
  assert.equal(game.populationOf(0),before);
  assert.equal(game.factions[0].troops,reserve);
  assert.deepEqual(game.attackOrders,existing);
  assert.equal(game.battleEvents.length,0);

  // Explicitly clicking the hostile side is still a proper counterattack.
  const enemyPoint=cellToPoint(invaded);
  const counter=game.launchAttack(0,enemyPoint,35);
  assert.equal(counter.ok,true);
  assert.equal(counter.targetOwner,1);
  assert.deepEqual(counter.front,enemyPoint);
  assert.equal(game.attackOrders.at(-1).targetOwner,1);
  assert.equal(game.populationOf(0),before,'mobilizing does not create/kill soldiers');
});

test('friendly left clicks are inert even with Shift, near enemies or deep in owned land',()=>{
  const {game,own}=makeInvadedFront();
  const places=[own,game.cities[0].index,
    game.owner.findIndex(o=>o===0)];
  const total=game.populationOf(0);
  const reserve=game.factions[0].troops;
  for(const i of places){
    assert.ok(i>=0);
    assert.equal(game.launchAttack(0,cellToPoint(i),35).ok,false);
    assert.equal(game.launchLanding(0,cellToPoint(i),35).ok,false);
  }
  assert.equal(game.factions[0].troops,reserve);
  assert.equal(game.populationOf(0),total);
  assert.equal(game.attackOrders.length,0);
  const water=game.owner.findIndex(o=>o===WATER);
  assert.equal(game.launchAttack(0,cellToPoint(water),35).ok,false);
  assert.equal(game.launchAttack(0,{x:-1,y:0},35).ok,false);
  assert.equal(game.launchAttack(0,{x:MAP_WIDTH,y:0},35).ok,false);
});

test('loss and explicit hostile-border attacks remain deterministic across ticks',()=>{
  const a=makeInvadedFront(721),b=makeInvadedFront(721);
  const x=a.game,y=b.game;
  assert.deepEqual(x.reinforceBorder(0,cellToPoint(a.own),35),
    y.reinforceBorder(0,cellToPoint(b.own),35));
  assert.deepEqual(x.launchAttack(0,cellToPoint(a.invaded),40),
    y.launchAttack(0,cellToPoint(b.invaded),40));
  for(let i=0;i<12;i++){x.step();y.step();}
  assert.deepEqual([...x.owner],[...y.owner]);
  assert.deepEqual(x.attackOrders,y.attackOrders);
  assert.deepEqual(x.factions.map(f=>[f.troops,f.defenseSpent,f.defenseFallenTick,f.attackFallen]),
    y.factions.map(f=>[f.troops,f.defenseSpent,f.defenseFallenTick,f.attackFallen]));
});
