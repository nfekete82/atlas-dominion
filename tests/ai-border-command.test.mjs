import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,NEUTRAL,landNeighbors} from '../dist/src/engine/game.js';

test('AI border intelligence conserves soldiers and remains deterministic',()=>{
  const setup=()=>{
    const g=new Game(9411,2,'DE','balanced');
    const own=g.owner.findIndex((id,i)=>id===1&&landNeighbors(i).some(n=>g.owner[n]===NEUTRAL));
    assert.ok(own>=0);
    const neighbor=landNeighbors(own).find(n=>g.owner[n]===NEUTRAL);
    g.owner[neighbor]=0;
    g.factions[1].troops=1200;
    g.recount();
    return g;
  };
  const a=setup(),b=setup();
  const initial=a.populationOf(1);
  for(let i=0;i<15;i++){a.redistributeFrontline();b.redistributeFrontline();}
  assert.ok(Math.abs(a.populationOf(1)-initial)<1e-5);
  assert.deepEqual([...a.frontline],[...b.frontline]);
  assert.equal(a.exportSave().borderOrders?.length,0,'AI requires no player-only orders');
});
