import {SEA_CROSSINGS} from '../dist/src/data/europe.js';
import {COASTS} from '../dist/src/engine/navigation.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {frontTileOutcome,opposingArmies} from '../dist/src/engine/front-combat.js';
import {Game,NEUTRAL,landNeighbors,cellToPoint,pointToIndex} from '../dist/src/engine/game.js';

function tile(override={}){
  return {
    attackTroops:80,defenderReserve:200,defenderPopulation:200,
    defenderTerritory:50,postedTroops:0,defenseStrength:11,
    friendlySides:1,borderSize:1,relativePower:1,
    neutral:false,capital:false,...override,
  };
}

test('attack cost is a true tick fraction: larger army and wider frontline take land faster',()=>{
  const standard=frontTileOutcome(tile());
  const numerous=frontTileOutcome(tile({attackTroops:400}));
  const wide=frontTileOutcome(tile({friendlySides:3,borderSize:16}));
  assert.ok(numerous.time<standard.time);
  assert.ok(wide.time<standard.time);
  assert.ok(standard.attackerLoss>0);
  assert.ok(standard.defenderLoss>0);
  assert.ok(Number.isFinite(standard.time));
});

test('powerful defenders, dense population and capitals increase assault cost',()=>{
  const base=frontTileOutcome(tile());
  const dense=frontTileOutcome(tile({defenderPopulation:1000,defenderReserve:1000}));
  const bunker=frontTileOutcome(tile({capital:true,defenseStrength:55,postedTroops:80}));
  assert.ok(dense.attackerLoss>base.attackerLoss);
  assert.ok(dense.time>base.time);
  assert.ok(bunker.attackerLoss>base.attackerLoss);
  assert.ok(bunker.time>base.time);
  assert.ok(bunker.postedLoss>0);
});

test('unclaimed land uses finite real marching cost and small genuine attrition',()=>{
  const normal=frontTileOutcome(tile({neutral:true,defenderPopulation:0,defenderReserve:0}));
  const large=frontTileOutcome(tile({neutral:true,defenderPopulation:0,defenderReserve:0,attackTroops:800,borderSize:6}));
  assert.equal(normal.defenderLoss,0);
  assert.ok(normal.attackerLoss>0);
  assert.ok(large.time<normal.time);
  assert.ok(normal.time>0);
});

test('real opposing armies cancel exactly and never create soldiers',()=>{
  assert.deepEqual(opposingArmies(50,30),{a:20,b:0,lossA:30,lossB:30});
  assert.deepEqual(opposingArmies(10,25),{a:0,b:15,lossA:10,lossB:10});
  assert.deepEqual(opposingArmies(0,0),{a:0,b:0,lossA:0,lossB:0});
});

test('a player order captures full neighbouring tiles, pays real losses and keeps army on border',()=>{
  const g=new Game(441,1,'DE');
  const index=g.owner.findIndex((o,i)=>o===NEUTRAL&&landNeighbors(i).some(n=>g.owner[n]===0));
  assert.ok(index>=0);
  const start=g.populationOf(0),t=g.launchAttack(0,cellToPoint(index),100);
  assert.equal(t.ok,true);
  assert.equal(g.populationOf(0),start,'mobilizing the army is not death');
  for(let i=0;i<12;i++)g.step();
  assert.ok(g.factions[0].captured>0);
  assert.ok(g.factions[0].attackFallen>0,'neutral marching should pay a small real cost');
  assert.ok(g.factions[0].population>=0);
  assert.ok(g.battleEvents.every(b=>b.attackerLost>=0&&b.defenderLost>=0));
});

test('both real players and computer nations have persistent paid-for attack orders',()=>{
  const g=new Game(887,4,'DE','intense');
  for(let i=0;i<4;i++)g.step();
  assert.ok(g.attackOrders.some(o=>o.factionId>0&&o.committed>0),
    'bots must use the exact same frontline army orders as human players');
  assert.ok(g.attackOrders.every(o=>o.remaining>=0&&o.remaining<=o.committed));
  assert.ok(g.factions.every(f=>f.troops>=0));
});

test('equal seeds and orders keep population, opposing armies and territory identical',()=>{
  const a=new Game(991,3,'DE'),b=new Game(991,3,'DE');
  for(let i=0;i<25;i++){a.step();b.step();}
  assert.deepEqual([...a.owner],[...b.owner]);
  assert.deepEqual(a.attackOrders,b.attackOrders);
  assert.deepEqual(a.factions.map(f=>[f.troops,f.population,f.defenseSpent,f.attackFallen]),
    b.factions.map(f=>[f.troops,f.population,f.defenseSpent,f.attackFallen]));
});

test('upgraded cities cost progressively more assault time and attacker casualties',()=>{
  const ordinary=frontTileOutcome(tile({builtCity:false,cityLevel:0}));
  const bronze=frontTileOutcome(tile({builtCity:true,cityLevel:0}));
  const silver=frontTileOutcome(tile({builtCity:true,cityLevel:3}));
  const gold=frontTileOutcome(tile({builtCity:true,cityLevel:5}));
  assert.ok(bronze.attackerLoss>ordinary.attackerLoss);
  assert.ok(silver.attackerLoss>bronze.attackerLoss);
  assert.ok(gold.attackerLoss>silver.attackerLoss);
  assert.ok(gold.time>silver.time);
  assert.ok(gold.attackerLoss<80);
});

test('island landing can select same-owner coastal destination away from the precise port',()=>{
  const g=new Game(618,3,'DE');
  // Legacy endpoints may lie on an artificial political boundary (northern
  // Cyprus), surrounded by actual land. Only real coastal endpoints qualify.
  let checked=0;
  for(const [a,b] of SEA_CROSSINGS){
    const start=a, destination=b;
    if(g.owner[start]===-2||g.owner[destination]===-2)continue;
    if(!COASTS.includes(start)||!COASTS.includes(destination))continue;
    g.owner[start]=0;
    g.owner[destination]=-1;
    const point=cellToPoint(destination);
    assert.deepEqual(g.landingTarget(0,point),point);
    assert.equal(g.canLand(0,point),true);
    checked++;
    g.owner[start]=-1;
  }
  assert.ok(checked>5);
  assert.equal(g.landingTarget(0,{x:-1,y:0}),null);
});
