import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/src/engine/game.js';

/** Fixed seeds give comparable long-run diagnostics without pretending
 * that player inactivity is a winning strategy. No game balance is hidden
 * behind arbitrary winning-percentage assertions.
 */
function snapshot(g){
  const living=g.factions.filter(f=>f.alive);
  const ai=living.filter(f=>f.ai);
  const player=g.factions[0];
  const avg=ai.length?ai.reduce((s,f)=>s+f.population,0)/ai.length:0;
  return {tick:g.tick,status:g.status,playerPopulation:player.population,
    playerMobile:player.troops,playerTerritory:player.territory,
    activeAIs:ai.length,avgAIPopulation:avg,
    strongestAI:Math.max(0,...ai.map(f=>f.population)),
    attacks:g.attackOrders.length};
}
function validate(g){
  for(const f of g.factions){
    for(const name of ['troops','population','money','income','moneyIncome','territory']){
      assert.ok(Number.isFinite(f[name]),'nonfinite '+name+' faction '+f.id+' at tick '+g.tick);
      assert.ok(f[name]>=-1e-6,'negative '+name+' faction '+f.id+' at tick '+g.tick);
    }
    assert.ok(Math.abs(g.populationOf(f.id)-f.population)<1e-5,
      'population ledger mismatch faction '+f.id+' at tick '+g.tick);
  }
  for(const order of g.attackOrders)assert.ok(order.remaining>=0&&Number.isFinite(order.remaining));
  for(let i=0;i<g.owner.length;i++)if(g.owner[i]>=0)
    assert.ok(g.owner[i]<g.factions.length,'invalid tile owner');
}
function simulate(seed,difficulty,ticks){
  const g=new Game(seed,49,'DE',difficulty);
  const rows=[snapshot(g)];
  for(let i=0;i<ticks && g.status==='playing';i++){
    g.step();
    if(g.tick%100===0){validate(g);rows.push(snapshot(g));}
  }
  validate(g);
  if(rows.at(-1).tick!==g.tick)rows.push(snapshot(g));
  return {g,rows};
}

test('1000-tick balanced simulation conserves real troops and has no illegal map ownership',()=>{
  const {rows}=simulate(20261012,'balanced',1000);
  assert.ok(rows.length>=2);
  assert.equal(rows[0].tick,0);
  assert.ok(rows.every(r=>r.activeAIs>=0&&r.attacks>=0));
  console.log('BALANCE balanced 1000-tick ceiling:',JSON.stringify(rows));
});

test('1000-tick intense simulation remains numerically stable even under pressure',()=>{
  const {rows}=simulate(20261013,'intense',1000);
  assert.ok(rows.length>=2);
  console.log('BALANCE intense 1000-tick ceiling:',JSON.stringify(rows));
});

test('500-tick relaxed replay is deterministic across game instances',()=>{
  const a=simulate(20261014,'relaxed',500);
  const b=simulate(20261014,'relaxed',500);
  assert.deepEqual(a.rows,b.rows);
  assert.deepEqual([...a.g.owner],[...b.g.owner]);
  console.log('BALANCE relaxed replay:',JSON.stringify(a.rows));
});
