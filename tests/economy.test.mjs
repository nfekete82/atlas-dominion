import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, populationGrowth, recruitmentRate, supplyRate } from '../dist/src/engine/economy.js';
import { Game, cellToPoint, landNeighbors, NEUTRAL } from '../dist/src/engine/game.js';

function emptyHome(game) {
  const index=game.owner.findIndex((owner,i)=>owner===0 && !game.cities.some(c=>c.index===i) && game.buildings[i]===0);
  assert.ok(index>=0);
  return cellToPoint(index);
}

test('New games have low and separate armies, civilians and construction resources',()=>{
  const game=new Game(114);
  for(const faction of game.factions) {
    assert.equal(faction.troops,90);
    assert.equal(faction.population,240);
    assert.equal(faction.supplies,90);
    assert.ok(faction.supplyIncome>0);
  }
  assert.equal(game.buildings.some(Boolean),false);
  assert.equal(BUILDINGS.length,5);
});

test('Population grows naturally, and troop recruitment is paid from civilians',()=>{
  const g=new Game(127,0);
  const f=g.factions[0];
  const pop=f.population,rate=f.income, growth=populationGrowth(f.territory,f.cityCount,0,0);
  assert.ok(rate>0&&rate<3);
  g.step();
  assert.ok(Math.abs(f.troops-(90+rate))<1e-6);
  assert.ok(Math.abs(f.population-(pop+growth-rate))<1e-6);
  assert.ok(f.supplies>90);
  assert.ok(f.population>0);
});

test('Only the owner can build, construction consumes supplies once and occupies its sector',()=>{
  const g=new Game(33,0);
  const p=emptyHome(g);
  const f=g.factions[0];
  const old=f.supplies;
  assert.equal(g.canBuild(0,p,'settlement').ok,true);
  const first=g.build(0,p,'settlement');
  assert.equal(first.ok,true);
  assert.equal(first.cost,35);
  assert.equal(f.supplies,old-35);
  assert.equal(g.buildingAt(p),'settlement');
  assert.equal(g.build(0,p,'settlement').ok,false);
  assert.equal(f.supplies,old-35);
  assert.equal(g.build(1,p,'settlement').ok,false);
  const hostile=g.owner.findIndex(v=>v===NEUTRAL);
  assert.equal(g.canBuild(0,cellToPoint(hostile),'settlement').ok,false);
  assert.equal(g.canBuild(0,cellToPoint(g.cities[0].index),'settlement').ok,false);
});

test('City upgrades require a settlement and increase population and recruitment',()=>{
  const g=new Game(12,0);
  const p=emptyHome(g),f=g.factions[0];
  assert.equal(g.canBuild(0,p,'city').ok,false);
  assert.ok(g.build(0,p,'settlement').ok);
  const oldGrowth=populationGrowth(f.territory,f.cityCount,f.settlements,f.builtCities);
  const oldRecruit=recruitmentRate(f.territory,f.cityCount,f.settlements,f.builtCities,f.barracks);
  f.supplies+=90;
  assert.ok(g.build(0,p,'city').ok);
  assert.equal(g.buildingAt(p),'city');
  assert.equal(f.settlements,0);
  assert.equal(f.builtCities,1);
  assert.ok(populationGrowth(f.territory,f.cityCount,f.settlements,f.builtCities)>oldGrowth);
  assert.ok(recruitmentRate(f.territory,f.cityCount,f.settlements,f.builtCities,f.barracks)>oldRecruit);
});

test('Barracks increase real recruitment; fortresses protect one tile',()=>{
  const a=new Game(182,0);
  const p=emptyHome(a),index=p.y*480+p.x;
  const beforeRate=a.factions[0].income;
  assert.ok(a.build(0,p,'barracks').ok);
  assert.ok(a.factions[0].income>beforeRate);
  const b=new Game(182,0);
  const defenseBefore=b.defense[index];
  assert.ok(b.build(0,p,'fortress').ok);
  assert.ok(b.defense[index]>defenseBefore);
  assert.equal(b.buildingAt(p),'fortress');
});

test('Harbors require real owned coastline and increase supplies',()=>{
  const land=new Game(321,0,'DE');
  const inland=land.owner.findIndex((owner,i)=>owner===0 && !land.cities.some(c=>c.index===i) && landNeighbors(i).every(n=>land.owner[n]!==-2));
  assert.ok(inland>=0);
  assert.equal(land.canBuild(0,cellToPoint(inland),'harbor').ok,false);

  const island=new Game(321,0,'MT');
  const coast=island.owner.findIndex((owner,i)=>owner===0 && !island.cities.some(c=>c.index===i) && landNeighbors(i).some(n=>island.owner[n]===-2));
  assert.ok(coast>=0,'Malta needs an owned coastline');
  const f=island.factions[0],supplies=f.supplies;
  assert.ok(island.build(0,cellToPoint(coast),'harbor').ok);
  assert.equal(f.supplies,supplies-70);
  assert.ok(f.harbors>0);
  assert.ok(supplyRate(f.territory,f.cityCount,f.settlements,f.builtCities,f.harbors)>supplyRate(f.territory,f.cityCount,f.settlements,f.builtCities,0));
});

test('A conquered building changes economic owner after next recount',()=>{
  const g=new Game(911,1),f=g.factions[0];
  const p=emptyHome(g),index=p.y*480+p.x;
  assert.ok(g.build(0,p,'settlement').ok);
  assert.equal(f.settlements,1);
  g.owner[index]=1;
  g.step();
  assert.equal(f.settlements,0);
  assert.ok(g.factions[1].settlements>=1);
});

test('Construction and demographic simulation remain deterministic',()=>{
  const a=new Game(1234,1),b=new Game(1234,1);
  const p=emptyHome(a);
  assert.deepEqual(a.build(0,p,'settlement'),b.build(0,p,'settlement'));
  for(let i=0;i<15;i++){a.step();b.step();}
  assert.deepEqual([...a.buildings],[...b.buildings]);
  assert.deepEqual(a.factions.map(f=>[f.troops,f.population,f.supplies,f.income,f.supplyIncome]),
    b.factions.map(f=>[f.troops,f.population,f.supplies,f.income,f.supplyIncome]));
});
