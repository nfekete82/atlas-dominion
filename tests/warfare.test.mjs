import test from 'node:test';
import assert from 'node:assert/strict';
import { assessInvasion, interceptAttack, attackerCasualties, empirePower, relativeAttackEffect } from '../dist/src/engine/warfare.js';
import { Game } from '../dist/src/engine/game.js';

test('AI refuses disadvantageous assaults and waits with an intact reserve', () => {
  const basic = {
    attackerTroops: 120, attackerIncome: 6,
    defenderTroops: 900, defenderIncome: 15,
    garrison: 25, capital: false, neutral: false, threatenedBorders: 4,
  };
  const weak = assessInvasion(basic);
  assert.equal(weak.worthwhile, false);
  assert.ok(weak.reserveFloor >= 24);
  const strong = assessInvasion({...basic, attackerTroops: 1400, defenderTroops: 90});
  assert.equal(strong.worthwhile, true);
  assert.ok(strong.advantage > 1.16);
  assert.equal(assessInvasion({...basic, attackerTroops: 1400, defenderTroops: 90, capital: true, garrison: 900}).worthwhile, false);
});

test('AI can still expand into neutral land and prefers not to waste tiny reserves', () => {
  const neutral = {
    attackerTroops: 120, attackerIncome: 6,
    defenderTroops: 0, defenderIncome: 0,
    garrison: 12, capital: false, neutral: true, threatenedBorders: 0,
  };
  assert.equal(assessInvasion(neutral).worthwhile, true);
  assert.equal(assessInvasion({...neutral, attackerTroops: 18, threatenedBorders: 3}).worthwhile, false);
});

test('Automatic defense consumes real defender troops, with fortifications adding efficiency', () => {
  const standard = interceptAttack(200, 40, false, false);
  const fortify = interceptAttack(200, 40, true, false);
  assert.ok(standard.used > 0 && standard.used <= 200);
  assert.ok(standard.blocked > 0 && standard.blocked < 40);
  assert.ok(fortify.blocked > standard.blocked);
  assert.deepEqual(interceptAttack(0, 40, true, true), {used:0, blocked:0});
  assert.ok(interceptAttack(5, 40, false, false).used <= 5);
});

test('A city under attack is reinforced automatically without player orders', () => {
  const g = new Game(42);
  const city = g.cities[0];
  const before = g.factions[0].troops;
  const initialDefense = g.defense[city.index];
  assert.equal(g.attackOrders.length, 0);
  // Exercise the actual combat resolution. TS-private methods are JS-visible.
  g.strike(g.factions[1], city.index, 20);
  assert.ok(g.factions[0].troops < before);
  assert.ok(g.factions[0].defenseSpent > 0);
  assert.ok(g.defense[city.index] > initialDefense - 25);
  assert.equal(g.attackOrders.length, 0);
  assert.equal(g.factions[0].intent, 'hold');
  g.factions[0].troops = 0;
  const empty = interceptAttack(g.factions[0].troops, 20, false, false);
  assert.equal(empty.blocked, 0);
});

test('AI decisions remain deterministic including reserves and intentions', () => {
  const a = new Game(9181), b = new Game(9181);
  for(let tick=0; tick<26; tick++){ a.step(); b.step(); }
  assert.deepEqual([...a.owner], [...b.owner]);
  assert.deepEqual(a.factions.map(f=>[f.troops,f.defenseSpent,f.intent]),b.factions.map(f=>[f.troops,f.defenseSpent,f.intent]));
  const player = a.cities[0].index;
  const oldOwner = a.owner[player];
  a.owner[player] = 1;
  assert.notEqual(a.threatenedBorders(0), b.threatenedBorders(0));
  a.owner[player] = oldOwner;
});

test('a more powerful defender steadily reduces offensive damage but never makes conquest impossible',()=>{
  const equal=relativeAttackEffect(1000,1000);
  const strongerOpponent=relativeAttackEffect(1000,3000);
  const enormousOpponent=relativeAttackEffect(1000,100000);
  const weakerOpponent=relativeAttackEffect(3000,1000);
  assert.equal(equal,1);
  assert.ok(strongerOpponent<1);
  assert.ok(enormousOpponent<=strongerOpponent);
  assert.ok(enormousOpponent>=.70);
  assert.ok(weakerOpponent>1);
  assert.ok(weakerOpponent<=1.30);
  assert.equal(relativeAttackEffect(1,1e40),.70);
  assert.equal(relativeAttackEffect(1e40,1),1.30);
});

test('country strength uses total population, controlled land and cities without double-counting reserves',()=>{
  const normal=empirePower(400,100,1);
  assert.ok(empirePower(800,100,1)>normal);
  assert.ok(empirePower(400,300,1)>normal);
  assert.ok(empirePower(400,100,15)>normal);
  assert.equal(empirePower(400,100,1),normal);
  assert.ok(Number.isFinite(empirePower(0,0,0)));
});

test('fighting a larger nation causes higher attacker losses at equal local defense',()=>{
  const matched=attackerCasualties(60,25,false,false,1);
  const stronger=attackerCasualties(60,25,false,false,.70);
  assert.ok(stronger>matched);
  assert.ok(stronger<=60);
  assert.equal(attackerCasualties(60,25,true,true,.70),0);
  assert.ok(attackerCasualties(60,25,false,true,.70)>stronger);
});

test('smart AI uses relative opponent power when judging invasion worthwhile',()=>{
  const factors={attackerTroops:240,attackerIncome:8,defenderTroops:100,
    defenderIncome:6,garrison:15,capital:false,neutral:false,threatenedBorders:3};
  const cautious=assessInvasion({...factors,relativePower:.70});
  const even=assessInvasion({...factors,relativePower:1});
  const confident=assessInvasion({...factors,relativePower:1.30});
  assert.ok(cautious.advantage<even.advantage);
  assert.ok(even.advantage<confident.advantage);
  assert.ok(Number.isFinite(cautious.advantage));
});

test('the same 20-troop assault damages a great power less than a similarly defended weak country',()=>{
  const weak=new Game(432,1);
  const strong=new Game(432,1);
  const target=weak.cities[1].index;
  const alternative=strong.owner.findIndex((o,i)=>o===1 && i!==target);
  assert.ok(alternative>=0);
  weak.factions[1].troops=0;
  strong.factions[1].troops=0;
  strong.frontline[alternative]=5000; // real distant defenders, not a local garrison
  weak.recount(); strong.recount();
  const normal=weak.relativeAttackPower(0,1);
  const disadvantage=strong.relativeAttackPower(0,1);
  assert.ok(disadvantage<normal);
  assert.equal(weak.relativeAttackPower(0,-1),1);
  const initial=weak.defense[target];
  assert.equal(strong.defense[target],initial);
  weak.strike(weak.factions[0],target,20);
  strong.strike(strong.factions[0],target,20);
  assert.ok(strong.defense[target]>weak.defense[target],
    'the strong nation should sustain more residual sector defense');
  assert.ok(strong.lastAttackerLoss>=weak.lastAttackerLoss);
});
