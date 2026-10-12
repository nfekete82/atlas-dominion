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
    assert.ok(faction.population>=0);
    assert.equal(faction.population,game.populationOf(faction.id));
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

test('diminishing returns prevent exponential city-population runaway',()=>{
  // More cities still pay off, but doubling them cannot multiply growth.
  const noCities=troopGrowth(2000,800,1,0);
  const tenCities=troopGrowth(2000,800,1,10);
  const hundredCities=troopGrowth(2000,800,1,100);
  assert.ok(tenCities>noCities);
  assert.ok(hundredCities>tenCities);
  assert.ok(hundredCities<tenCities*2);
  assert.ok(troopGrowth(100000,800,1,1000)<75);
  // Same land, many cities: still finite and nowhere near 10^30 residents.
  let people=90,money=90,cities=0;
  for(let tick=0;tick<3000;tick++){
    const grow=troopGrowth(people,58,1,cities);
    const tax=taxRevenue(people,58,1,cities);
    assert.ok(Number.isFinite(grow)&&Number.isFinite(tax));
    people+=grow;money+=tax;
    if(money>=75 && cities<57){money-=75;cities++;}
  }
  assert.ok(people<100000,'12.5 game-minutes should not explode population');
  assert.ok(money<1000000,'cash remains game-scaled even after extended play');
});

test('money tax progression is modest even at large populations',()=>{
  const early=taxRevenue(90,58,1,0);
  const mid=taxRevenue(10000,800,1,60);
  assert.ok(early>0&&early<2);
  assert.ok(mid>early);
  assert.ok(mid<30);
  assert.ok(taxRevenue(2000,30,1,0)>taxRevenue(90,30,1,0)*2);
});

test('new games stay numerically stable through sustained real AI turns',()=>{
  const game=new Game(5123,3,'DE');
  for(let tick=0;tick<200;tick++)game.step();
  for(const faction of game.factions){
    assert.ok(Number.isFinite(faction.troops));
    assert.ok(Number.isFinite(faction.money));
    assert.ok(Number.isFinite(faction.income));
    assert.ok(Number.isFinite(faction.moneyIncome));
    assert.ok(faction.money>=0);
    assert.ok(faction.troops>=0);
    assert.ok(faction.troops<1000000);
    assert.ok(faction.money<100000);
  }
});

test('city can be upgraded five times, each level costs money and boosts growth',()=>{
  const g=new Game(711,1,'DE');
  const idx=g.owner.findIndex((owner,i)=>owner===0&&g.buildings[i]===0);
  assert.ok(idx>=0);
  const point=vacantCitySite(g);
  g.factions[0].money=10000;
  assert.equal(g.build(0,point,'city').ok,true);
  const before=g.factions[0].income;
  let previous=before;
  for(let n=1;n<=5;n++){
    const allowed=g.canUpgradeCity(0,point);
    assert.equal(allowed.ok,true);
    const money=g.factions[0].money;
    const result=g.upgradeCity(0,point);
    assert.equal(result.ok,true);
    assert.equal(g.cityLevelAt(point),n);
    assert.equal(g.factions[0].money,money-result.cost);
    assert.ok(g.factions[0].income>previous);
    previous=g.factions[0].income;
  }
  assert.equal(g.canUpgradeCity(0,point).ok,false);
  assert.equal(g.upgradeCity(0,point).ok,false);
  assert.ok(g.factions[0].income>before);
});
