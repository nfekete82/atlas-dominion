import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/src/engine/game.js';

test('save/load keeps territory, armies, cities, upgrades and current attack orders',()=>{
  const g=new Game(415,3,'DE','balanced');
  const point=(()=>{
    const i=g.owner.findIndex((v,i)=>v===0&&g.buildings[i]===0&&!g.cities.some(c=>c.index===i));
    assert.ok(i>=0);
    return {x:i%480,y:Math.floor(i/480)};
  })();
  g.factions[0].money=1000;
  assert.equal(g.build(0,point,'city').ok,true);
  assert.equal(g.upgradeCity(0,point).ok,true);
  for(let i=0;i<65;i++)g.step();
  const save=g.exportSave();
  const loaded=Game.fromSave(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(loaded.exportSave(),save);
  assert.equal(loaded.cityLevelAt(point),1);
});

test('a reloaded simulation follows the exact same future as an uninterrupted run',()=>{
  const g=new Game(20261012,9,'DE','intense');
  for(let i=0;i<135;i++)g.step();
  const restored=Game.fromSave(JSON.parse(JSON.stringify(g.exportSave())));
  for(let i=0;i<120;i++){g.step();restored.step();}
  assert.deepEqual(restored.exportSave(),g.exportSave());
});

test('invalid and incompatible saves fail safely',()=>{
  assert.throws(()=>Game.fromSave(null));
  const save=new Game(7,1).exportSave();
  assert.throws(()=>Game.fromSave({...save,version:999}));
  assert.throws(()=>Game.fromSave({...save,owner:[1,2]}));
  assert.throws(()=>Game.fromSave({...save,rngCalls:-1}));
});
