import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,cellToPoint,landNeighbors} from '../dist/src/engine/game.js';
import {FACTORY_INCOME,FACTORY_CONNECTION_MULTIPLIER} from '../dist/src/engine/economy.js';

test('factory creates recurring income, paid city link increases it and save replay persists',()=>{
  const g=new Game(456,0,'DE','balanced');
  g.factions[0].money=1000;
  const capital=g.cities[0];
  const site=landNeighbors(capital.index).find(i=>g.owner[i]===0&&g.buildings[i]===0);
  assert.ok(site!==undefined);
  const p=cellToPoint(site);
  const before=g.factions[0].moneyIncome;
  assert.equal(g.build(0,p,'factory').ok,true);
  assert.equal(g.factions[0].money,800);
  assert.ok(Math.abs(g.factions[0].moneyIncome-before-FACTORY_INCOME)<1e-5);
  assert.equal(g.connectFactory(0,p,capital).ok,true);
  assert.ok(Math.abs(g.factions[0].moneyIncome-before-FACTORY_INCOME*FACTORY_CONNECTION_MULTIPLIER)<1e-5);
  assert.deepEqual(Game.fromSave(g.exportSave()).exportSave(),g.exportSave());
  const legacy=g.exportSave();delete legacy.factoryLinks;
  assert.equal(Game.fromSave(legacy).factoryLinks.size,0);
});

test('factory linkage cannot cross enemy ownership and bonus stops on conquest',()=>{
  const g=new Game(457,1,'DE','balanced');
  g.factions[0].money=1000;
  const capital=g.cities[0];
  const site=landNeighbors(capital.index).find(i=>g.owner[i]===0&&!g.buildings[i]);
  assert.ok(site!==undefined);
  const p=cellToPoint(site);
  assert.equal(g.build(0,p,'factory').ok,true);
  assert.equal(g.connectFactory(0,p,capital).ok,true);
  const linked=g.factions[0].moneyIncome;
  g.owner[site]=1;
  g.recount();
  assert.ok(g.factions[0].moneyIncome<linked);
  assert.throws(()=>Game.fromSave({...g.exportSave(),factoryLinks:[{factory:site,city:capital.index}]}),/Fabrikverbindungen/);
});
