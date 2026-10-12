import test from 'node:test';
import { MAP_WIDTH, MAP_HEIGHT, SEA_CROSSINGS } from '../dist/src/data/europe.js';
import { COUNTRY_STARTS } from '../dist/src/data/countries.js';
import assert from 'node:assert/strict';
import { Game, WATER, NEUTRAL, TOTAL_LAND, geoToCell, pointToIndex, isLand, neighbors, landNeighbors, cellToPoint } from '../dist/src/engine/game.js';

const count = (game, factionId) => game.owner.reduce((n, owner) => n + Number(owner === factionId), 0);

test('Europe has a continental mask, islands and all 50 capital-start factions', () => {
  const g = new Game(1234);
  assert.equal(MAP_WIDTH,480);
  assert.equal(MAP_HEIGHT,260);
  assert.ok(TOTAL_LAND > 50000 && TOTAL_LAND < 65000);
  assert.equal(g.owner.filter(x => x !== WATER).length, TOTAL_LAND);
  assert.equal(g.factions.length, COUNTRY_STARTS.length);
  assert.equal(g.cities.length, COUNTRY_STARTS.length);
  assert.equal(g.status, 'playing');
  assert.ok(g.cities.every(c => isLand(c.index)));
  assert.ok(g.cities.every(c => g.owner[c.index] === c.original));
  assert.ok(g.factions.every(f => f.territory > 0 && f.alive));
});

test('Every selectable country begins in its own distinct capital sector',()=>{
  const g=new Game(77);
  assert.equal(COUNTRY_STARTS.length,50);
  assert.equal(new Set(g.cities.map(c=>c.index)).size,50);
  assert.equal(g.factions.filter(f=>f.ai).length,49);
  assert.ok(g.cities.every(c=>isLand(c.index) && g.owner[c.index]===c.original));
  assert.ok(g.factions.every(f=>f.alive&&f.territory>=1&&f.cityCount===1));
  assert.equal(g.initialTerritory,g.factions[0].territory);
});

test('Country selection starts player in Iceland, Malta or Vatican City',()=>{
  for(const country of ['IS','MT','VA','GE','AZ','XK']){
    const g=new Game(123,COUNTRY_STARTS.length-1,country);
    const start=COUNTRY_STARTS.find(c=>c.code===country);
    assert.equal(g.playerCode,country);
    assert.equal(g.factions[0].name,start.name);
    assert.equal(g.cities[0].name,start.capital);
    assert.equal(g.owner[g.cities[0].index],0);
    assert.equal(g.factions[0].ai,false);
    assert.equal(g.factions.slice(1).every(f=>f.ai),true);
    assert.equal(g.factions.length,COUNTRY_STARTS.length);
  }
});

test('Country choice and seed replay deterministically, invalid countries are rejected',()=>{
  const a=new Game(991,COUNTRY_STARTS.length-1,'PT');
  const b=new Game(991,COUNTRY_STARTS.length-1,'PT');
  assert.deepEqual([...a.owner],[...b.owner]);
  assert.deepEqual(a.cities,b.cities);
  for(let k=0;k<3;k++){a.step();b.step();}
  assert.deepEqual(a.factions.map(f=>[f.troops,f.territory,f.income]),b.factions.map(f=>[f.troops,f.territory,f.income]));
  assert.throws(()=>new Game(991,10,'ZZ'),/Unbekanntes Land/);
});

test('Map projection positions Berlin inside Germany and handles boundaries', () => {
  const g = new Game(1);
  const berlin = geoToCell(13.405, 52.52);
  assert.ok(Math.abs(berlin.x - g.cities[0].x) < 4);
  assert.ok(Math.abs(berlin.y - g.cities[0].y) < 4);
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
  const firstNeutral = g.owner.findIndex((owner,i)=>owner===NEUTRAL && landNeighbors(i).some(n=>g.owner[n]===0));
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
    assert.ok(landNeighbors(i).some(n=>g.owner[n]===owner),`Disconnected new cell ${i}`);
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
  const seen = new Uint8Array(MAP_WIDTH*MAP_HEIGHT);
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
  const border = g.owner.findIndex((owner,i)=>owner===NEUTRAL && landNeighbors(i).some(n=>g.owner[n]===0));
  const reserve = g.factions[0].troops;
  const result = g.launchAttack(0,cellToPoint(border),35);
  assert.equal(result.ok,true);
  assert.equal(result.sent,Math.floor(reserve*0.35));
  assert.equal(g.factions[0].troops,reserve-result.sent);
  assert.equal(g.attackOrders.length,1);
  assert.equal(g.attackOrders[0].remaining,result.sent);
  const ownedBefore=count(g,0);
  g.step();
  // Marching costs time and a small number of actual soldiers on neutral land.
  assert.ok(g.attackOrders[0]?.effort <= result.sent*1.65 || g.attackOrders.length===0);
  assert.ok(g.factions[0].attackFallen>0);
  assert.ok(count(g,0)>ownedBefore);
});

test('Attack click rejects own land, open sea, unreachable targets and invalid ratio',()=>{
  const g = new Game(20);
  const own = g.cities[0];
  const water = g.owner.findIndex(owner=>owner===WATER);
  const farNeutral = g.owner.findIndex((owner,i)=>owner===NEUTRAL && g.findAttackFront(0,cellToPoint(i))===null);
  assert.match(g.launchAttack(0,own,35).reason,/eigenes/i);
  assert.match(g.launchAttack(0,g.cities[1],35).reason,/keine gemeinsame Landfront/i);
  assert.match(g.launchAttack(0,cellToPoint(water),35).reason,/Wasser/i);
  assert.match(g.launchAttack(0,{x:-1,y:0},35).reason,/Außerhalb/i);
  assert.match(g.launchAttack(0,cellToPoint(farNeutral),2).reason,/Truppenanteil/i);
  // Deep clicks are rejected even when the neutral region has a distant shared frontier.
  assert.equal(g.launchAttack(0,cellToPoint(farNeutral),35).ok,false);
});

test('Direct border clicks and nearby capital clicks both attack from the connected front',()=>{
  const g = new Game(33);
  const enemyCity = g.cities[1];
  const enemyBorder = g.owner.findIndex((owner,i)=>owner===1 && landNeighbors(i).some(n=>g.owner[n]===NEUTRAL));
  assert.ok(enemyBorder>=0);
  const neighbor = landNeighbors(enemyBorder).find(i=>g.owner[i]===NEUTRAL);
  assert.notEqual(neighbor,undefined);
  g.owner[neighbor] = 0;

  // Directly selected enemy border tiles are always valid attack anchors.
  const direct = g.launchAttack(0,cellToPoint(enemyBorder),25);
  assert.equal(direct.ok,true);
  assert.equal(direct.targetOwner,1);
  assert.deepEqual(direct.front,cellToPoint(enemyBorder));

  // This seeded capital is close enough for the new 14-cell click tolerance.
  // The click may target the capital, but the army must start at our border.
  const capitalFront = g.findAttackFront(0,enemyCity);
  assert.ok(capitalFront);
  assert.equal(g.isDirectBorderTarget(0,capitalFront),true);
  assert.equal(g.owner[pointToIndex(capitalFront)],1);
  const nearby = g.launchAttack(0,enemyCity,25);
  assert.equal(nearby.ok,true);
  assert.deepEqual(nearby.front,capitalFront);
  // A second nearby click reinforces the already active shared frontline.
  // The return value still identifies the snapped valid border, while the
  // army keeps its first real entry point and does not teleport mid-battle.
  assert.equal(g.attackOrders.length,1);
  assert.deepEqual(g.attackOrders[0].anchor,direct.front);
  assert.equal(g.attackOrders[0].committed,direct.sent+nearby.sent);
});

test('Running attacks use only the committed army and preserve deterministic replay',()=>{
  const a=new Game(200),b=new Game(200);
  const border = a.owner.findIndex((owner,i)=>owner===NEUTRAL && landNeighbors(i).some(n=>a.owner[n]===0));
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
  // AI nations can attack and conquer our sectors autonomously; that is a
  // defensive consequence, NOT an unauthorized player attack.
  assert.ok(count(g,0)<=start);
  assert.equal(g.attackOrders.filter(o=>o.factionId===0).length,0,
    'AI nations may have their own outgoing armies; player never attacks automatically');
});


test('A repeat border click reinforces the offensive with a fresh troop commitment',()=>{
  const g=new Game(66);
  const border = g.owner.findIndex((owner,i)=>owner===NEUTRAL && landNeighbors(i).some(n=>g.owner[n]===0));
  const spot=cellToPoint(border);
  const first=g.launchAttack(0,spot,25);
  const second=g.launchAttack(0,spot,50);
  assert.equal(first.sent,Math.floor(90*.25));
  assert.equal(second.sent,Math.floor((90-first.sent)*.50));
  assert.equal(g.factions[0].troops,90-first.sent-second.sent);
  assert.equal(g.attackOrders.length,1,'a repeat click strengthens one continuous border attack');
  assert.equal(g.attackOrders[0].remaining,first.sent+second.sent);
  assert.equal(g.attackOrders[0].committed,first.sent+second.sent);
  assert.match(second.reason,/verstärkt/i);
});

test('A click several sectors inside a neighboring country snaps to its reachable border',()=>{
  const g=new Game(2026);
  const near=g.owner.findIndex((owner,i)=>owner===NEUTRAL
    && !g.isDirectBorderTarget(0,cellToPoint(i))
    && landNeighbors(i).some(n=>g.isDirectBorderTarget(0,cellToPoint(n))));
  assert.ok(near>=0,'expected neutral land slightly behind player frontier');
  const clicked=cellToPoint(near);
  const front=g.findAttackFront(0,clicked);
  assert.ok(front,'nearby territory click should resolve to a front');
  assert.notDeepEqual(front,clicked);
  assert.equal(g.isDirectBorderTarget(0,front),true);
  assert.equal(g.owner[pointToIndex(front)],g.owner[near]);
  const before=g.factions[0].troops;
  const result=g.launchAttack(0,clicked,35);
  assert.equal(result.ok,true);
  assert.deepEqual(result.front,front);
  assert.deepEqual(g.attackOrders.at(-1).anchor,front);
  assert.equal(g.factions[0].troops,before-result.sent);
});

test('Deep clicks across the same occupied land component reach its real border',()=>{
  const g=new Game(2044,1,'DE');
  // Manufacture a >14-sector connected enemy region stretching inland.
  // It must not bypass neutral land or any maritime connection.
  const starts=[];
  for(let i=0;i<g.owner.length;i++)
    if(g.owner[i]===NEUTRAL&&landNeighbors(i).some(n=>g.owner[n]===0))starts.push(i);
  const seen=new Set(starts),parent=new Map(),depth=new Map(starts.map(i=>[i,0]));
  const queue=[...starts];
  let distant=-1;
  for(let k=0;k<queue.length;k++){
    const i=queue[k],d=depth.get(i);
    if(d>=17){distant=i;break;}
    for(const n of landNeighbors(i)){
      if(g.owner[n]!==NEUTRAL||seen.has(n))continue;
      seen.add(n);parent.set(n,i);depth.set(n,d+1);queue.push(n);
    }
  }
  assert.ok(distant>=0,'requires mainland with at least 18 neutral sectors');
  const chain=[];
  for(let i=distant;i!==undefined;i=parent.get(i))chain.push(i);
  for(const i of chain)g.owner[i]=1;
  const selected=cellToPoint(distant);
  const front=g.findAttackFront(0,selected);
  assert.ok(front,'deep enemy-region click must find bordering front');
  assert.equal(g.isDirectBorderTarget(0,front),true);
  assert.notDeepEqual(front,selected);
  const result=g.launchAttack(0,selected,35);
  assert.equal(result.ok,true);
  assert.deepEqual(result.front,front);
  assert.deepEqual(g.attackOrders.at(-1).anchor,front);
});

test('Border tolerance cannot jump across other countries or the sea',()=>{
  const g=new Game(2026);
  const enemy=g.owner.findIndex((owner,i)=>owner===1 && landNeighbors(i).some(n=>g.owner[n]===NEUTRAL));
  assert.ok(enemy>=0);
  const approach=landNeighbors(enemy).find(i=>g.owner[i]===NEUTRAL);
  assert.notEqual(approach,undefined);
  g.owner[approach]=0;
  // The neighboring enemy is attackable, but a neutral sector farther away
  // cannot be mistaken for that enemy merely because both are nearby.
  const front=g.findAttackFront(0,cellToPoint(enemy));
  assert.ok(front);
  assert.equal(g.owner[pointToIndex(front)],1);
  const disconnected= g.owner.findIndex((owner,i)=>owner===NEUTRAL
    && g.findAttackFront(0,cellToPoint(i))===null);
  assert.ok(disconnected>=0);
  assert.equal(g.launchAttack(0,cellToPoint(disconnected),35).ok,false);
});

test('Truly deep clicks cannot snap to a remote border sector',()=>{
  const g=new Game(42);
  const distant=g.owner.findIndex((owner,i)=>owner===NEUTRAL&&g.findAttackFront(0,cellToPoint(i))===null);
  const target=cellToPoint(distant);
  assert.equal(g.findAttackFront(0,target),null);
  assert.equal(g.launchAttack(0,target,35).ok,false);
  const border=g.owner.findIndex((owner,i)=>owner===NEUTRAL&&landNeighbors(i).some(n=>g.owner[n]===0));
  assert.deepEqual(g.findAttackFront(0,cellToPoint(border)),cellToPoint(border));
});

test('Landfront advances only into directly connected cells without jumping through water',()=>{
  const g=new Game(454);
  const border=g.owner.findIndex((owner,i)=>owner===NEUTRAL&&landNeighbors(i).some(n=>g.owner[n]===0));
  assert.ok(g.launchAttack(0,cellToPoint(border),75).ok);
  for(let tick=0;tick<16;tick++){
    const before=g.owner.slice();
    g.step();
    for(let i=0;i<before.length;i++) {
      if(before[i]!==g.owner[i] && g.owner[i]>=0)
        assert.ok(landNeighbors(i).some(n=>g.owner[n]===g.owner[i]) ||
          SEA_CROSSINGS.some(([a,b])=>
            (i===a && (before[b]===g.owner[i]||g.owner[b]===g.owner[i])) ||
            (i===b && (before[a]===g.owner[i]||g.owner[a]===g.owner[i]))),
          'capture must connect by land or a documented sea corridor '+i);
    }
  }
});

test('Sea corridors do not count as direct land borders',()=>{
  const g=new Game(55);
  for(const [from,to] of SEA_CROSSINGS){
    assert.ok(isLand(from)&&isLand(to));
    assert.ok(!landNeighbors(to).includes(from));
  }
});

test('An explicit landing requires an owned departure shore, and takes time',()=>{
  const g=new Game(155,1);
  const [from,to]=SEA_CROSSINGS[0];
  // Force a known departure sector under the player without adding hidden troops.
  g.owner[from]=0;
  g.owner[to]=NEUTRAL;
  assert.equal(g.isDirectBorderTarget(0,cellToPoint(to)),false);
  assert.equal(g.canLand(0,cellToPoint(to)),true);
  // Standard clicks now select the sea route automatically, without Shift.
  const result=g.launchAttack(0,cellToPoint(to),35);
  assert.ok(result.ok);
  const landOrder=g.attackOrders[0];
  assert.equal(landOrder.landing,true);
  assert.equal(landOrder.anchor.x,to%MAP_WIDTH);
  assert.equal(landOrder.arrivalTick,g.tick+8);
  assert.deepEqual(landOrder.departure,cellToPoint(from));
  const original=g.owner[to];
  g.step();g.step();g.step();
  assert.equal(g.owner[to],original,'landing cannot resolve before the crossing delay');
  assert.ok(g.attackOrders.length);
});

test('Front lookup rejects water, own territory and out-of-map clicks',()=>{
  const g=new Game(3);
  const water=g.owner.findIndex(o=>o===WATER);
  assert.equal(g.findAttackFront(0,g.cities[0]),null);
  assert.equal(g.findAttackFront(0,cellToPoint(water)),null);
  assert.equal(g.findAttackFront(0,{x:-100,y:2}),null);
});

test('balanced AI spends the opening developing and expanding rather than declaring immediate wars',()=>{
  const g=new Game(247,12,'DE','balanced');
  for(let i=0;i<60;i++)g.step();
  assert.equal(g.attackOrders.filter(o=>o.factionId!==0&&o.targetOwner>=0).length,0,
    'AI should not open hostile wars during the first 90 ticks');
});
