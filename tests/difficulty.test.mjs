import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIFFICULTIES,DIFFICULTY_SETTINGS,isDifficulty,
  difficultyAttempts,difficultyDefenseBudget,difficultyRisk
} from '../dist/src/engine/difficulty.js';
import {Game} from '../dist/src/engine/game.js';

test('all four OpenFront-inspired difficulty choices are explicit and balanced is the default',()=>{
  assert.deepEqual(DIFFICULTIES,['relaxed','balanced','intense','impossible']);
  for(const d of DIFFICULTIES)assert.equal(isDifficulty(d),true);
  assert.equal(isDifficulty('expert'),false);
  assert.equal(isDifficulty('__proto__'),false);
  assert.equal(new Game(11,1,'DE').difficulty,'balanced');
  assert.throws(()=>new Game(11,1,'DE','experimental'),/Schwierigkeitsgrad/);
});

test('difficulty changes only AI starts, never human armies, treasury or map ownership',()=>{
  const matches=DIFFICULTIES.map(d=>new Game(1410,3,'DE',d));
  const human=matches[0].factions[0];
  for(let j=0;j<matches.length;j++){
    const game=matches[j],difficulty=DIFFICULTIES[j],cfg=DIFFICULTY_SETTINGS[difficulty];
    assert.equal(game.factions[0].troops,90);
    assert.equal(game.factions[0].money,90);
    assert.equal(game.factions[0].campaignEnergy,110);
    assert.equal(game.factions[0].income,human.income);
    assert.equal(game.factions[0].moneyIncome,human.moneyIncome);
    assert.equal(game.factions[1].troops,cfg.aiStartingTroops);
    assert.equal(game.factions[1].campaignEnergy,110*cfg.marchMultiplier);
    assert.deepEqual([...game.owner],[...matches[0].owner]);
    assert.equal(game.playerCode,'DE');
  }
});

test('AI population growth is multiplied by difficulty but player remains unchanged',()=>{
  const easy=new Game(12,2,'DE','relaxed');
  const normal=new Game(12,2,'DE','balanced');
  const hard=new Game(12,2,'DE','intense');
  const impossible=new Game(12,2,'DE','impossible');
  for(const g of [easy,normal,hard,impossible]){
    g.factions[1].troops=90;
    g.recount();
  }
  const base=normal.factions[1].income;
  assert.ok(base>0);
  assert.ok(Math.abs(easy.factions[1].income/base-.85)<1e-8);
  assert.ok(Math.abs(hard.factions[1].income/base-1.14)<1e-8);
  assert.ok(Math.abs(impossible.factions[1].income/base-1.28)<1e-8);
  assert.equal(easy.factions[0].income,impossible.factions[0].income);
});

test('difficulty affects AI aggression, defense and risk with bounded numerical behavior',()=>{
  const baseAttempts=10,reserve=180,allocation=20;
  assert.equal(difficultyAttempts(baseAttempts,'balanced'),baseAttempts);
  assert.ok(difficultyAttempts(baseAttempts,'relaxed')<baseAttempts);
  assert.ok(difficultyAttempts(baseAttempts,'intense')>baseAttempts);
  assert.ok(difficultyAttempts(baseAttempts,'impossible')>difficultyAttempts(baseAttempts,'intense'));
  assert.ok(difficultyAttempts(1e9,'impossible')<=25);
  assert.equal(difficultyDefenseBudget(reserve,allocation,'balanced'),allocation);
  assert.ok(difficultyDefenseBudget(reserve,allocation,'relaxed')<allocation);
  assert.ok(difficultyDefenseBudget(reserve,allocation,'impossible')>allocation);
  assert.ok(difficultyDefenseBudget(10,100,'impossible')===0);
  assert.ok(difficultyRisk(.12,'relaxed')<difficultyRisk(.12,'impossible'));
  assert.ok(difficultyRisk(1,'impossible')<=.22);
});

test('each difficulty replays deterministically, with real troop losses and no hidden soldiers',()=>{
  for(const difficulty of DIFFICULTIES){
    const a=new Game(1616,3,'DE',difficulty),b=new Game(1616,3,'DE',difficulty);
    for(let i=0;i<16;i++){a.step();b.step();}
    assert.deepEqual([...a.owner],[...b.owner]);
    assert.deepEqual(a.factions.map(f=>[f.troops,f.income,f.campaignEnergy,f.territory,f.defenseSpent]),
      b.factions.map(f=>[f.troops,f.income,f.campaignEnergy,f.territory,f.defenseSpent]));
    assert.ok(a.factions.every(f=>Number.isFinite(f.troops)&&f.troops>=0));
    assert.ok(a.factions.every(f=>Number.isFinite(f.campaignEnergy)));
  }
});
