import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,cellToPoint,landNeighbors,NEUTRAL} from '../dist/src/engine/game.js';

function world(seed=42){return new Game(seed,3,'DE','balanced');}

test('alliances are bilateral, capped at two and never gift soldiers or territory',()=>{
  const g=world();
  const money=g.factions.map(f=>f.money);
  const population=g.factions.map(f=>f.population);
  const owner=Array.from(g.owner);
  assert.equal(g.offerAlliance(0,1).ok,true);
  assert.equal(g.isAllied(0,1),true);
  assert.equal(g.isAllied(1,0),true);
  assert.deepEqual(g.alliesOf(0),[1]);
  assert.equal(g.offerAlliance(0,1).ok,false);
  assert.equal(g.offerAlliance(0,2).ok,true);
  assert.equal(g.offerAlliance(0,3).ok,false);
  assert.deepEqual(g.factions.map(f=>f.money),money);
  assert.deepEqual(g.factions.map(f=>f.population),population);
  assert.deepEqual([...g.owner],owner);
  assert.equal(g.leaveAlliance(0,1).ok,true);
  assert.equal(g.isAllied(0,1),false);
});

test('allied countries cannot be attacked directly, by sea, by local strikes or at borders',()=>{
  const g=world(144);
  const own=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]===NEUTRAL));
  const border=landNeighbors(own).find(i=>g.owner[i]===NEUTRAL);
  assert.ok(own>=0&&border>=0);
  g.owner[border]=1;g.recount();
  assert.equal(g.offerAlliance(0,1).ok,true);
  const before=g.factions[0].troops,orders=g.attackOrders.length;
  assert.equal(g.findAttackFront(0,cellToPoint(border)),null);
  assert.equal(g.isDirectBorderTarget(0,cellToPoint(border)),false);
  assert.equal(g.isThreatenedBorder(0,cellToPoint(own)),false);
  assert.equal(g.launchAttack(0,cellToPoint(border),45).ok,false);
  assert.equal(g.launchLanding(0,cellToPoint(border),45).ok,false);
  assert.equal(g.attack(g.factions[0],border),false);
  assert.equal(g.factions[0].troops,before);
  assert.equal(g.attackOrders.length,orders);
  assert.equal(g.owner[border],1,'treaty preserves territorial ownership');
  assert.equal(g.leaveAlliance(0,1).ok,true);
  assert.equal(g.isDirectBorderTarget(0,cellToPoint(border)),true);
  assert.equal(g.launchAttack(0,cellToPoint(border),35).ok,true);
});

test('active attacks prevent peace treaties rather than silently deleting real armies',()=>{
  const g=world(77);
  const own=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]===NEUTRAL));
  const enemy=landNeighbors(own).find(i=>g.owner[i]===NEUTRAL);
  g.owner[enemy]=1;g.recount();
  assert.equal(g.launchAttack(0,cellToPoint(enemy),35).ok,true);
  const before=structuredClone(g.attackOrders);
  const deal=g.offerAlliance(0,1);
  assert.equal(deal.ok,false);
  assert.match(deal.reason,/Krieg/);
  assert.deepEqual(g.attackOrders,before);
});

test('AI offers to player can be accepted or declined explicitly',()=>{
  const g=world(111);
  assert.equal(g.offerAlliance(1,0).ok,true);
  assert.equal(g.isAllied(0,1),false,'offers do not create treaties without consent');
  assert.equal(g.offers.length,1);
  assert.equal(g.respondAlliance(1,false).ok,true);
  assert.equal(g.offers.length,0);
  assert.equal(g.offerAlliance(1,0).ok,true);
  assert.equal(g.respondAlliance(1,true).ok,true);
  assert.equal(g.isAllied(0,1),true);
  assert.equal(g.offers.length,0);
});

test('alliances and incoming offers survive save/load; old saves migrate safely',()=>{
  const g=world(83);
  g.offerAlliance(0,1);
  g.offerAlliance(2,0);
  const save=g.exportSave();
  const restored=Game.fromSave(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(restored.exportSave(),save);
  assert.equal(restored.isAllied(1,0),true);
  assert.equal(restored.offers.length,1);
  const legacy=structuredClone(save);
  delete legacy.alliances;delete legacy.offers;
  const old=Game.fromSave(legacy);
  assert.equal(old.alliances.length,0);
  assert.equal(old.offers.length,0);
  assert.throws(()=>Game.fromSave({...save,alliances:[{a:1,b:1,sinceTick:0}]}),/Bündnisdaten/);
  assert.throws(()=>Game.fromSave({...save,alliances:[{a:0,b:999,sinceTick:0}]}),/Bündnisdaten/);
});

test('alliance AI produces deterministic diplomacy and cannot attack own treaty partners',()=>{
  const a=world(71),b=world(71);
  for(let tick=0;tick<270;tick++){a.step();b.step();}
  assert.deepEqual(a.alliances,b.alliances);
  assert.deepEqual(a.offers,b.offers);
  assert.deepEqual(a.exportSave(),b.exportSave());
  for(const order of a.attackOrders){
    assert.equal(a.isAllied(order.factionId,order.targetOwner),false,
      'live attack orders must never target an ally');
  }
});

test('AI refuses a weak coalition proposal when it has little strategic value',()=>{
  const g=world(214);
  g.factions[0].troops=1;
  g.factions[1].troops=2500;
  g.recount();
  const judgment=g.evaluateAlliance(0,1);
  assert.ok(judgment.score<judgment.threshold);
  assert.equal(judgment.accepted,false);
  assert.match(judgment.reason,/militärischer Nutzen|strategischer Vorteil/);
  const money=g.factions.map(f=>f.money);
  const troops=g.factions.map(f=>f.troops);
  const result=g.offerAlliance(0,1);
  assert.equal(result.ok,false);
  assert.match(result.reason,/lehnt|abgelehnt/);
  assert.equal(g.alliances.length,0,'rejected offers must not create a pact');
  assert.deepEqual(g.factions.map(f=>f.money),money);
  assert.deepEqual(g.factions.map(f=>f.troops),troops);
});

test('AI can accept the very same offer after the proposer becomes strategically useful',()=>{
  const g=world(228);
  g.factions[0].troops=1;
  g.factions[1].troops=2300;
  g.recount();
  const refused=g.evaluateAlliance(0,1);
  assert.equal(refused.accepted,false);
  g.factions[0].troops=5200;
  g.recount();
  const attractive=g.evaluateAlliance(0,1);
  assert.equal(attractive.accepted,true);
  assert.ok(attractive.score>refused.score);
  assert.equal(g.offerAlliance(0,1).ok,true);
  assert.equal(g.isAllied(0,1),true);
  assert.equal(g.isAllied(1,0),true);
});

test('coalition evaluation is a pure deterministic calculation with no hidden side effects',()=>{
  const g=world(312);
  const snapshot=JSON.stringify(g.exportSave());
  const first=g.evaluateAlliance(0,2);
  const second=g.evaluateAlliance(0,2);
  assert.deepEqual(first,second);
  assert.equal(JSON.stringify(g.exportSave()),snapshot);
  assert.equal(g.evaluateAlliance(0,0).accepted,false);
  assert.equal(g.evaluateAlliance(0,999).accepted,false);
  assert.equal(g.evaluateAlliance(999,1).accepted,false);
});
