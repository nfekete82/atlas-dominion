import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,cellToPoint} from '../dist/src/engine/game.js';

function setup(count=3){
  const game=new Game(9901,1,'DE');
  game.factions[0].money=20000;
  const points=[];
  for(let n=0;n<count;n++){
    const index=game.owner.findIndex((owner,i)=>
      owner===0&&game.buildings[i]===0&&
      game.canBuild(0,cellToPoint(i),'city').ok);
    assert.ok(index>=0,'available owned building site');
    const point=cellToPoint(index);
    assert.equal(game.build(0,point,'city').ok,true);
    points.push(point);
  }
  return {game,points};
}

test('one click raises an owned city to level 5 and pays all five existing tier prices',()=>{
  const {game,points}=setup(1),point=points[0];
  game.factions[0].money=5000;
  const beforeIncome=game.factions[0].income;
  const preview=game.previewCityUpgrades(0,'single',point);
  assert.equal(preview.ok,true);
  assert.deepEqual([preview.cost,preview.upgrades,preview.cities,preview.finalLevel],[4300,5,1,5]);
  assert.equal(game.cityLevelAt(point),0,'preview must not spend money or upgrade');
  assert.equal(game.factions[0].money,5000);
  const result=game.upgradeCities(0,'single',point);
  assert.equal(result.cost,4300);
  assert.equal(game.factions[0].money,700);
  assert.equal(game.cityLevelAt(point),5);
  assert.ok(game.factions[0].income>beforeIncome);
  assert.equal(game.events.filter(e=>/Ausbaustufen/.test(e.text)).length,1,'one batch event');
  assert.equal(game.upgradeCities(0,'single',point).ok,false);
});

test('single-city max buys only affordable tiers when the budget is insufficient',()=>{
  const {game,points}=setup(1);
  game.factions[0].money=700;
  const preview=game.previewCityUpgrades(0,'single',points[0]);
  assert.deepEqual([preview.cost,preview.upgrades,preview.finalLevel],[700,2,2]);
  const result=game.upgradeCities(0,'single',points[0]);
  assert.equal(result.ok,true);
  assert.equal(game.factions[0].money,0);
  assert.equal(game.cityLevelAt(points[0]),2);
  assert.equal(game.upgradeCities(0,'single',points[0]).ok,false);
  assert.equal(game.cityLevelAt(points[0]),2);
});

test('all cities upgrade cheapest tiers first, in stable sector order, with no debt',()=>{
  const {game,points}=setup();
  game.factions[0].money=1000;
  const preview=game.previewCityUpgrades(0,'all');
  assert.deepEqual([preview.cost,preview.upgrades,preview.cities],[750,3,3]);
  assert.equal(game.factions[0].money,1000);
  const result=game.upgradeCities(0,'all');
  assert.equal(result.ok,true);
  assert.equal(game.factions[0].money,250);
  assert.deepEqual(points.map(point=>game.cityLevelAt(point)),[1,1,1]);
  assert.equal(game.upgradeCities(0,'all').ok,false);
  game.factions[0].money=450;
  assert.equal(game.upgradeCities(0,'all').upgrades,1);
  assert.deepEqual(points.map(point=>game.cityLevelAt(point)),[2,1,1],
    'equal-cost ties must be stable by sector index');
});

test('bulk upgrades exclude foreign cities, invalid coordinates and do not create any buildings',()=>{
  const {game,points}=setup(3);
  const enemy=points[2],index=enemy.y*480+enemy.x;
  game.owner[index]=1;game.recount();
  game.factions[0].money=10000;
  const beforeBuildingCount=game.buildings.reduce((count,code)=>count+(code===1?1:0),0);
  const refused=game.upgradeCities(0,'single',enemy);
  assert.equal(refused.ok,false);
  assert.equal(game.upgradeCities(0,'single',{x:-1,y:20}).ok,false);
  assert.equal(game.upgradeCities(0,'single',{x:Infinity,y:0}).ok,false);
  const all=game.upgradeCities(0,'all');
  assert.deepEqual([all.upgrades,all.cities,all.cost],[10,2,8600]);
  assert.equal(game.factions[0].money,1400);
  assert.equal(game.cityLevelAt(enemy),0);
  assert.deepEqual(points.slice(0,2).map(p=>game.cityLevelAt(p)),[5,5]);
  assert.equal(game.buildings.reduce((count,code)=>count+(code===1?1:0),0),beforeBuildingCount);
});

test('bulk city upgrade results and savegame replay remain deterministic',()=>{
  const {game,points}=setup(3);
  game.factions[0].money=14000;
  const same=Game.fromSave(JSON.parse(JSON.stringify(game.exportSave())));
  assert.deepEqual(game.upgradeCities(0,'all'),same.upgradeCities(0,'all'));
  assert.deepEqual(game.exportSave(),same.exportSave());
  assert.ok(points.every(p=>game.cityLevelAt(p)>=3));
  for(let i=0;i<8;i++){game.step();same.step();}
  assert.deepEqual(game.exportSave(),same.exportSave());
});
