import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, BUILDING_CODES, troopGrowth, taxRevenue } from '../dist/src/engine/economy.js';
import { Game, cellToPoint, landNeighbors, NEUTRAL } from '../dist/src/engine/game.js';

function vacantCitySite(game,id=0){
  const index=game.owner.findIndex((owner,i)=>owner===id &&
    !game.cities.some(c=>c.index===i) && game.buildings[i]===0);
  assert.ok(index>=0,'expected empty owned land for a new city');
  return cellToPoint(index);
}

test('one shared population and army number, only cities buildable, money replaces supplies',()=>{
  const game=new Game(114);
  assert.equal(BUILDINGS.length,1);
  assert.equal(BUILDINGS[0].type,'city');
  assert.deepEqual(BUILDING_CODES,{city:1});
  for(const faction of game.factions){
    assert.equal(faction.troops,90);
    assert.equal(faction.money,90);
    assert.equal(faction.population,undefined);
    assert.equal(faction.supplies,undefined);
    assert.ok(faction.moneyIncome>0);
  }
  assert.ok(game.buildings.every(v=>v===0));
});

test('people and soldiers grow together and generate money each simulation tick',()=>{
  const g=new Game(127,0),f=g.factions[0];
  const start=f.troops, money=f.money, growth=f.income, revenue=f.moneyIncome;
  assert.ok(growth>0);
  assert.ok(revenue>0);
  g.step();
  assert.ok(Math.abs(f.troops-start-growth)<1e-5);
  assert.ok(Math.abs(f.money-money-revenue)<1e-5);
  assert.ok(Math.abs(g.populationOf(0)-f.troops)<1e-5);
});

test('higher population creates more taxes and faster natural growth',()=>{
  assert.ok(taxRevenue(2000,30,1,0)>taxRevenue(90,30,1,0)*2);
  assert.ok(troopGrowth(2000,30,1,0)>troopGrowth(90,30,1,0));
  assert.equal(taxRevenue(500,0,0,0),0);
  assert.equal(troopGrowth(500,0,0,0),0);
});

test('only one city per owned sector; headquarters and enemy terrain protected',()=>{
  const g=new Game(33,1),p=vacantCitySite(g),f=g.factions[0],before=f.money;
  assert.equal(g.canBuild(0,p,'city').ok,true);
  assert.ok(g.build(0,p,'city').ok);
  assert.equal(f.money,before-BUILDINGS[0].cost);
  assert.equal(g.buildingAt(p),'city');
  assert.equal(g.build(0,p,'city').ok,false);
  assert.equal(f.money,before-BUILDINGS[0].cost);
  assert.equal(g.canBuild(0,cellToPoint(g.cities[0].index),'city').ok,false);
  const neutral=g.owner.findIndex(owner=>owner===NEUTRAL);
  assert.equal(g.canBuild(0,cellToPoint(neutral),'city').ok,false);
  assert.equal(g.canBuild(1,p,'city').ok,false);
  assert.equal(g.canBuild(0,p,'barracks').ok,false);
});

test('building a city immediately and permanently accelerates troop growth',()=>{
  const g=new Game(12,0),f=g.factions[0],p=vacantCitySite(g);
  const initial=f.income;
  const status=g.build(0,p,'city');
  assert.equal(status.ok,true);
  assert.equal(f.builtCities,1);
  assert.ok(f.income>initial);
  const soldiers=f.troops, growth=f.income;
  g.step();
  assert.ok(Math.abs(f.troops-soldiers-growth)<1e-5);
});

test('city construction needs sufficient real money and cannot overdraw',()=>{
  const g=new Game(19,0),p=vacantCitySite(g);
  g.factions[0].money=5;
  assert.equal(g.build(0,p,'city').ok,false);
  assert.equal(g.factions[0].money,5);
  g.factions[0].money=BUILDINGS[0].cost;
  assert.equal(g.build(0,p,'city').ok,true);
  assert.equal(g.factions[0].money,0);
  assert.equal(g.build(0,p,'city').ok,false);
});

test('city ownership and growth shift to the conqueror on the next recount',()=>{
  const g=new Game(911,1),p=vacantCitySite(g),i=p.y*480+p.x;
  assert.ok(g.build(0,p,'city').ok);
  assert.equal(g.factions[0].builtCities,1);
  g.owner[i]=1;
  g.step();
  assert.equal(g.factions[0].builtCities,0);
  assert.ok(g.factions[1].builtCities>=1);
});

test('the one-resource economy and all city placement actions remain deterministic',()=>{
  const a=new Game(1234,1),b=new Game(1234,1),p=vacantCitySite(a);
  assert.deepEqual(a.build(0,p,'city'),b.build(0,p,'city'));
  for(let i=0;i<20;i++){a.step();b.step();}
  assert.deepEqual([...a.buildings],[...b.buildings]);
  assert.deepEqual(a.factions.map(f=>[f.troops,f.money,f.income,f.moneyIncome,f.builtCities]),
    b.factions.map(f=>[f.troops,f.money,f.income,f.moneyIncome,f.builtCities]));
});

test('stationed and currently attacking forces still count as inhabitants',()=>{
  const g=new Game(77,1),p=g.owner.findIndex((o,i)=>o===NEUTRAL&&landNeighbors(i).some(n=>g.owner[n]===0));
  const totalBefore=g.populationOf(0);
  const result=g.launchAttack(0,cellToPoint(p),35);
  assert.ok(result.ok);
  assert.ok(Math.abs(g.populationOf(0)-totalBefore)<1e-6);
  assert.ok(g.factions[0].troops<totalBefore);
});
