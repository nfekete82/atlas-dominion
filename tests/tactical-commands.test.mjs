import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,NEUTRAL,landNeighbors,cellToPoint} from '../dist/src/engine/game.js';

function fixture(seed=17819){
  const g=new Game(seed,2,'DE','balanced');
  const own=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]===NEUTRAL));
  assert.ok(own>=0);
  const index=landNeighbors(own).find(i=>g.owner[i]===NEUTRAL);
  assert.ok(index>=0);
  g.owner[index]=1;
  g.factions[0].troops=1000;
  g.factions[1].troops=300;
  g.factions.forEach(f=>f.ai=false);
  g.recount();
  return {g,index,point:cellToPoint(index)};
}

test('battle risk preview estimates actual next front without creating armies or altering any saved state',()=>{
  const {g,point}=fixture();
  const before=JSON.stringify(g.exportSave());
  const a=g.assessAttack(0,point,35);
  const b=g.assessAttack(0,point,35);
  assert.deepEqual(a,b);
  assert.equal(JSON.stringify(g.exportSave()),before);
  assert.equal(a.possible,true);
  assert.equal(a.troops,350);
  assert.equal(a.targetOwner,1);
  assert.ok(a.time>0&&a.loss>=0);
  assert.ok(['low','moderate','high'].includes(a.risk));
  assert.ok(a.front);
  const result=g.launchAttack(0,point,35);
  assert.equal(result.ok,true);
  assert.equal(result.sent,a.troops);
});

test('invalid targets, insufficient mobile troops and allied land have no misleading attack forecast',()=>{
  const {g,point}=fixture();
  assert.equal(g.assessAttack(0,{x:-1,y:0},50).possible,false);
  assert.equal(g.assessAttack(0,point,101).possible,false);
  assert.equal(g.assessAttack(0,cellToPoint(g.cities[0].index),50).possible,false);
  g.factions[0].troops=10;g.recount();
  assert.equal(g.assessAttack(0,point,35).possible,false);
  g.factions[0].troops=1000;g.recount();
  assert.equal(g.offerAlliance(0,1).ok,true);
  assert.equal(g.assessAttack(0,point,50).possible,false);
});

test('a commander can withdraw only OWN real attack orders and survivors return exactly once',()=>{
  const {g,point}=fixture(32563);
  const start=g.populationOf(0);
  const mobile=g.factions[0].troops;
  assert.equal(g.launchAttack(0,point,40).ok,true);
  const order=g.attackOrders.find(o=>o.factionId===0);
  assert.ok(order);
  assert.equal(g.factions[0].troops,mobile-order.remaining);
  assert.equal(g.cancelAttack(order.id,1),false,'other player cannot cancel human army');
  assert.equal(g.cancelAttack(999999,0),false);
  assert.equal(g.cancelAttack(order.id,0),true);
  assert.equal(g.cancelAttack(order.id,0),false,'cannot return same army twice');
  assert.equal(g.factions[0].troops,mobile);
  assert.equal(g.populationOf(0),start);
  assert.equal(g.attackOrders.filter(o=>o.factionId===0).length,0);
});

test('risk preview responds to real fortifications and is independent of seed/RNG',()=>{
  const {g,point,index}=fixture(45111);
  const normal=g.assessAttack(0,point,50);
  g.defense[index]=150;
  g.buildings[index]=1;
  g.cityUpgrades[index]=5;
  g.recount();
  const fortified=g.assessAttack(0,point,50);
  assert.ok(fortified.time>normal.time);
  assert.ok(fortified.loss>=normal.loss);
  const saved=g.exportSave();
  assert.deepEqual(Game.fromSave(JSON.parse(JSON.stringify(saved))).assessAttack(0,point,50),fortified);
});

test('reinforcing a living offensive moves real mobile soldiers without creating a second order',()=>{
  const {g,point}=fixture(56488);
  const before=g.populationOf(0);
  assert.equal(g.launchAttack(0,point,30).ok,true);
  const order=g.attackOrders.find(o=>o.factionId===0);
  assert.ok(order);
  const remaining=order.remaining,mobile=g.factions[0].troops;
  assert.equal(g.reinforceAttack(1,order.id,50).ok,false);
  assert.equal(g.reinforceAttack(0,order.id,101).ok,false);
  const response=g.reinforceAttack(0,order.id,50);
  assert.equal(response.ok,true);
  assert.equal(response.sent,Math.floor(mobile*.5));
  assert.equal(order.remaining,remaining+response.sent);
  assert.equal(g.factions[0].troops,mobile-response.sent);
  assert.equal(g.attackOrders.filter(o=>o.factionId===0).length,1);
  assert.equal(g.populationOf(0),before);
  assert.equal(g.cancelAttack(order.id,0),true);
  assert.equal(g.populationOf(0),before);
  assert.equal(g.reinforceAttack(0,order.id,50).ok,false);
});
