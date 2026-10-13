import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,NEUTRAL,landNeighbors,cellToPoint} from '../dist/src/engine/game.js';
import {frontTileOutcome} from '../dist/src/engine/front-combat.js';

test('towers cost real gold and can only be placed on owned empty tiles',()=>{
  const game=new Game(9125,2,'DE','balanced');
  const index=game.owner.findIndex((owner,i)=>owner===0&&!game.cities.some(c=>c.index===i));
  assert.ok(index>=0);
  const point=cellToPoint(index);
  game.factions[0].money=500;
  assert.equal(game.canBuild(0,point,'tower').ok,true);
  const money=game.factions[0].money;
  const result=game.build(0,point,'tower');
  assert.equal(result.ok,true);
  assert.equal(game.factions[0].money,money-180);
  assert.equal(game.buildingAt(point),'tower');
  assert.equal(game.build(0,point,'tower').ok,false);
  assert.equal(game.build(1,point,'tower').ok,false);
  assert.equal(game.exportSave().buildings[index],2);
  assert.deepEqual(Game.fromSave(game.exportSave()).exportSave(),game.exportSave());
});

test('tower support increases actual hostile casualties, bounded at two towers',()=>{
  const base={attackTroops:200,defenderReserve:120,defenderPopulation:250,
    defenderTerritory:50,postedTroops:12,defenseStrength:15,friendlySides:1,
    borderSize:3,relativePower:1,neutral:false,capital:false,builtCity:false};
  const normal=frontTileOutcome(base),tower=frontTileOutcome({...base,towerSupport:1});
  const stacked=frontTileOutcome({...base,towerSupport:2});
  assert.ok(tower.attackerLoss>normal.attackerLoss);
  assert.ok(stacked.attackerLoss>tower.attackerLoss);
  assert.deepEqual(frontTileOutcome({...base,towerSupport:100}),stacked);
  assert.ok(frontTileOutcome({...base,builtCity:true,cityLevel:5}).time>
    frontTileOutcome({...base,builtCity:true,cityLevel:1}).time);
});
