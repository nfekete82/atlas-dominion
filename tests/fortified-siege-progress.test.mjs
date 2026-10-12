import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,NEUTRAL,landNeighbors,cellToPoint} from '../dist/src/engine/game.js';
import {frontTileOutcome} from '../dist/src/engine/front-combat.js';

test('a high-cost fortified sector accumulates assault time rather than deadlocking forever',()=>{
  const game=new Game(452,1,'DE','balanced');
  const own=game.owner.findIndex((owner,i)=>owner===0&&
    landNeighbors(i).some(neighbor=>game.owner[neighbor]===NEUTRAL));
  assert.ok(own>=0);
  const target=landNeighbors(own).find(i=>game.owner[i]===NEUTRAL);
  assert.ok(target>=0);
  game.owner[target]=1;
  game.buildings[target]=1;
  game.cityUpgrades[target]=5;
  game.defense[target]=180;
  game.factions[0].troops=120;
  game.factions[1].troops=2000;
  // Keep the test focused on the planned human attack, not unrelated AI wars.
  for(const faction of game.factions)faction.ai=false;
  game.recount();
  const outcome=frontTileOutcome({
    attackTroops:120,defenderReserve:game.factions[1].troops,
    defenderPopulation:game.factions[1].population,
    defenderTerritory:game.factions[1].territory,postedTroops:0,
    defenseStrength:180,friendlySides:1,
    borderSize:1+Math.sqrt(120)*.12,relativePower:.70,
    neutral:false,capital:false,builtCity:true,cityLevel:5,
  });
  assert.ok(outcome.time>2,'fixture must require more than the old permanently stuck budget of 2 ticks');
  const result=game.launchAttack(0,cellToPoint(target),100);
  assert.equal(result.ok,true);
  assert.equal(result.sent,120);
  const originalOwner=game.owner[target];
  game.step();
  assert.equal(game.owner[target],originalOwner,'a fortified sector is not captured instantly');
  const order=game.attackOrders.find(o=>o.factionId===0&&o.targetOwner===1);
  assert.ok(order,'the attacking army must remain committed');
  assert.ok(order.progress>=1.4,'siege time must accumulate instead of resetting to 1');
  for(let tick=0;tick<5&&game.owner[target]!==0;tick++)game.step();
  assert.equal(game.owner[target],0,
    'a sufficiently manned army must eventually take a costly fortified front');
  assert.ok(game.factions[0].attackFallen>0,'capture must still cost real soldiers');
});

test('the same slow fortified encounter replays identically after a save',()=>{
  const original=new Game(713,1,'DE','balanced');
  const own=original.owner.findIndex((owner,i)=>owner===0&&
    landNeighbors(i).some(n=>original.owner[n]===NEUTRAL));
  const target=landNeighbors(own).find(i=>original.owner[i]===NEUTRAL);
  original.owner[target]=1;
  original.buildings[target]=1;
  original.cityUpgrades[target]=5;
  original.defense[target]=180;
  original.factions[0].troops=120;
  original.factions[1].troops=2000;
  original.factions.forEach(f=>f.ai=false);
  original.recount();
  assert.equal(original.launchAttack(0,cellToPoint(target),100).ok,true);
  original.step();
  const restored=Game.fromSave(JSON.parse(JSON.stringify(original.exportSave())));
  for(let i=0;i<6;i++){original.step();restored.step();}
  assert.deepEqual(original.exportSave(),restored.exportSave());
  assert.equal(restored.owner[target],0);
});
