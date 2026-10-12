import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,cellToPoint,landNeighbors} from '../dist/src/engine/game.js';

test('factory levels increase real tick income without changing population',()=>{
 const g=new Game(123,0,'DE');g.factions[0].money=10000;
 const near=landNeighbors(g.cities[0].index).find(i=>g.owner[i]===0&&!g.buildings[i]);
 assert.ok(near!==undefined);
 const p=cellToPoint(near);
 assert.equal(g.build(0,p,'factory').ok,true);
 const before=g.populationOf(0),base=g.factions[0].moneyIncome;
 assert.equal(g.factoryLevel(p),1);
 assert.equal(g.upgradeFactory(0,p).ok,true);
 assert.equal(g.factoryLevel(p),2);
 assert.ok(g.factions[0].moneyIncome>base);
 assert.equal(g.populationOf(0),before);
 for(let i=0;i<3;i++)assert.equal(g.upgradeFactory(0,p).ok,true);
 assert.equal(g.factoryLevel(p),5);
 assert.equal(g.upgradeFactory(0,p).ok,false);
 assert.deepEqual(Game.fromSave(g.exportSave()).exportSave(),g.exportSave());
 const malformed=g.exportSave();malformed.factoryLevels=[{index:near,level:99}];
 assert.throws(()=>Game.fromSave(malformed),/Fabrikstufen/);
});

test('old industry saves without factory level metadata remain loadable',()=>{
 const g=new Game(132,0,'DE');const save=g.exportSave();
 delete save.factoryLevels;
 assert.equal(Game.fromSave(save).factoryLevels.size,0);
});
