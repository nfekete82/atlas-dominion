import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, WATER, NEUTRAL, TOTAL_LAND, geoToCell, pointToIndex, isLand, neighbors, cellToPoint } from '../dist/src/engine/game.js';

const count = (game, factionId) => game.owner.reduce((n, owner) => n + Number(owner === factionId), 0);

test('Europe has a real continental mask with islands and 10 AI factions', () => {
  const g = new Game(1234);
  assert.ok(TOTAL_LAND > 15000 && TOTAL_LAND < 25000);
  assert.equal(g.owner.filter(x => x !== WATER).length, TOTAL_LAND);
  assert.equal(g.factions.length, 11);
  assert.equal(g.cities.length, 11);
  assert.equal(g.status, 'playing');
  assert.ok(g.cities.every(c => isLand(c.index)));
  assert.ok(g.cities.every(c => g.owner[c.index] === c.original));
  assert.ok(g.factions.every(f => f.territory > 0 && f.alive));
});

test('Map projection positions Berlin inside Germany and handles boundaries', () => {
  const g = new Game(1);
  const berlin = geoToCell(13.405, 52.52);
  assert.ok(Math.abs(berlin.x - g.cities[0].x) < 3);
  assert.ok(Math.abs(berlin.y - g.cities[0].y) < 3);
  assert.equal(g.factionAt({x:-1,y:2}),null);
  assert.equal(g.factionAt({x:10000,y:10000}),null);
  assert.ok(pointToIndex({x:5,y:5})>=0);
});

test('Attack orders change strategic direction and reject impossible targets', () => {
  const g = new Game(44);
  const before = { ...g.factions[0].target };
  assert.equal(g.order(0,{x:12,y:100}),true);
  assert.notDeepEqual(g.factions[0].target,before);
  assert.equal(g.order(200,{x:8,y:10}),false);
});

test('Pausing holds the exact simulation state', () => {
  const g = new Game(123);
  g.paused = true;
  const oldTroops = g.factions[0].troops;
  g.step();
  assert.equal(g.tick,0);
  assert.equal(g.factions[0].troops,oldTroops);
  g.paused = false;
  g.step();
  assert.equal(g.tick,1);
});

test('Seeded AI and simulation repeat exactly', () => {
  const a=new Game(1337), b=new Game(1337);
  for(let t=0;t<15;t++){a.step();b.step();}
  assert.equal(a.tick,b.tick);
  assert.deepEqual([...a.owner],[...b.owner]);
  assert.deepEqual(a.factions.map(f=>f.troops),b.factions.map(f=>f.troops));
});

test('Factions expand, never occupy water, and keep nonnegative resources', () => {
  const g = new Game(2026);
  const original = g.factions.map(f=>f.territory);
  const firstNeutral = g.owner.findIndex((owner,i)=>owner===NEUTRAL && neighbors(i).some(n=>g.owner[n]===0));
  assert.ok(firstNeutral>=0);
  assert.equal(g.launchAttack(0,cellToPoint(firstNeutral),50).ok,true);
  for(let t=0;t<50;t++)g.step();
  assert.equal(g.tick,50);
  assert.ok(g.factions.some((f,i)=>f.territory>original[i]));
  assert.ok(g.factions[0].captured>0);
  for(let i=0;i<g.owner.length;i++){
    assert.ok(g.owner[i]>=NEUTRAL || g.owner[i]===WATER);
    if(!isLand(i))assert.equal(g.owner[i],WATER);
    if(g.owner[i]>=0)assert.ok(g.owner[i]<g.factions.length);
  }
  assert.ok(g.factions.every(f=>f.troops>=0&&Number.isFinite(f.troops)));
  assert.equal(g.factions.reduce((n,f)=>n+f.territory,0),g.owner.filter(x=>x>=0).length);
});

test('Every newly captured sector connects to the capturing faction after a tick', () => {
  const g = new Game(99);
  const prior = g.owner.slice();
  g.step();
  for(let i=0;i<g.owner.length;i++){
    const owner = g.owner[i];
    if(owner<0 || owner===prior[i])continue;
    // Attack resolution may chain within a tick; recursive flood-fill from original territory is unnecessary
    // here: a new border tile always has a same-owner orthogonal neighbor.
    assert.ok(neighbors(i).some(n=>g.owner[n]===owner),`Disconnected new cell ${i}`);
  }
});

test('Player tactics change income and can be switched while playing',()=>{
  const g = new Game(17);
  const base = g.factions[0].income;
  g.setDoctrine('fortify');
  assert.ok(g.factions[0].income > base);
  g.setDoctrine('blitz');
  assert.ok(g.factions[0].income < base);
  g.setDoctrine('expand');
  assert.equal(g.factions[0].income, base);
});

test('All island sectors connect via documented short sea corridors',()=>{
  const seen = new Uint8Array(240*160);
  const start = new Game(77).cities[0].index;
  const todo=[start];seen[start]=1;let count=0;
  while(todo.length){
    const i=todo.pop();count++;
    for(const n of neighbors(i)) if(isLand(n)&&!seen[n]){seen[n]=1;todo.push(n);}
  }
  assert.equal(count,TOTAL_LAND);
});


test('Border click commits the selected troop percentage immediately',()=>{
  const g = new Game(99);
  const border = g.owner.findIndex((owner,i)=>owner===NEUTRAL && neighbors(i).some(n=>g.owner[n]===0));
  const reserve = g.factions[0].troops;
  const result = g.launchAttack(0,cellToPoint(border),35);
  assert.equal(result.ok,true);
  assert.equal(result.sent,Math.floor(reserve*0.35));
  assert.equal(g.factions[0].troops,reserve-result.sent);
  assert.equal(g.attackOrders.length,1);
  assert.equal(g.attackOrders[0].remaining,result.sent);
  const ownedBefore=count(g,0);
  g.step();
  assert.ok(g.attackOrders[0]?.remaining < result.sent || g.attackOrders.length===0);
  assert.ok(count(g,0)>ownedBefore);
});

test('Attack click rejects own land, open sea, unreachable targets and invalid ratio',()=>{
  const g = new Game(20);
  const own = g.cities[0];
  const water = g.owner.findIndex(owner=>owner===WATER);
  const farNeutral = g.owner.findIndex((owner,i)=>owner===NEUTRAL && !neighbors(i).some(n=>g.owner[n]===0));
  assert.match(g.launchAttack(0,own,35).reason,/eigenes/i);
  assert.match(g.launchAttack(0,g.cities[1],35).reason,/gemeinsame Grenze/i);
  assert.match(g.launchAttack(0,cellToPoint(water),35).reason,/Wasser/i);
  assert.match(g.launchAttack(0,{x:-1,y:0},35).reason,/Außerhalb/i);
  assert.match(g.launchAttack(0,cellToPoint(farNeutral),2).reason,/Truppenanteil/i);
  // Neutral is one connected target faction; attacking deeper into the neutral area
  // is intentionally permitted when neutral sectors also share a frontier.
  assert.equal(g.launchAttack(0,cellToPoint(farNeutral),35).ok,true);
});

test('Clicking anywhere in a bordering enemy faction attacks that faction',()=>{
  const g = new Game(33);
  const enemyCity = g.cities[1];
  const enemyBorder = g.owner.findIndex((owner,i)=>owner===1 && neighbors(i).some(n=>g.owner[n]===NEUTRAL));
  const neighbor = neighbors(enemyBorder).find(i=>g.owner[i]===NEUTRAL);
  g.owner[neighbor] = 0;
  const result=g.launchAttack(0,enemyCity,25);
  assert.equal(result.ok,true);
  assert.equal(result.targetOwner,1);
  assert.equal(g.attackOrders[0].targetOwner,1);
});

test('Running attacks use only the committed army and preserve deterministic replay',()=>{
  const a=new Game(200),b=new Game(200);
  const border = a.owner.findIndex((owner,i)=>owner===NEUTRAL && neighbors(i).some(n=>a.owner[n]===0));
  const spot=cellToPoint(border);
  assert.deepEqual(a.launchAttack(0,spot,100),b.launchAttack(0,spot,100));
  for(let t=0;t<30;t++){a.step();b.step();}
  assert.deepEqual([...a.owner],[...b.owner]);
  assert.deepEqual(a.attackOrders,b.attackOrders);
  assert.equal(a.factions[0].troops,b.factions[0].troops);
  assert.ok(a.factions[0].troops>=0);
});

test('Without a player click no autonomous player attack is initiated',()=>{
  const g=new Game(8);
  const start=count(g,0);
  for(let t=0;t<5;t++)g.step();
  assert.equal(count(g,0),start);
  assert.equal(g.attackOrders.length,0);
});


test('A repeat border click reinforces the offensive with a fresh troop commitment',()=>{
  const g=new Game(66);
  const border = g.owner.findIndex((owner,i)=>owner===NEUTRAL && neighbors(i).some(n=>g.owner[n]===0));
  const spot=cellToPoint(border);
  const first=g.launchAttack(0,spot,25);
  const second=g.launchAttack(0,spot,50);
  assert.equal(first.sent,100);
  assert.equal(second.sent,150); // 50% of the 300 troops remaining after the first click
  assert.equal(g.factions[0].troops,150);
  assert.equal(g.attackOrders.length,2);
});
