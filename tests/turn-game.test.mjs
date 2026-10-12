import test from 'node:test';
import assert from 'node:assert/strict';
import {generateProvinces,TurnGame} from '../dist/src/engine/turn-game.js';
import {LAND_ROWS,MAP_WIDTH,MAP_HEIGHT} from '../dist/src/data/europe.js';
import {COUNTRY_STARTS} from '../dist/src/data/countries.js';

test('turn-based provinces cover land, exclude water, and have symmetric land neighbors',()=>{
  const {provinces,cellProvince}=generateProvinces();
  assert.ok(provinces.length>=COUNTRY_STARTS.length);
  assert.ok(provinces.length<=260,'approximately 200 regions');
  let land=0;
  for(let i=0;i<MAP_WIDTH*MAP_HEIGHT;i++){
    const isLand=LAND_ROWS[Math.floor(i/MAP_WIDTH)][i%MAP_WIDTH]==='1';
    assert.equal(cellProvince[i]>=0,isLand);
    if(isLand)land++;
  }
  assert.equal(provinces.reduce((sum,p)=>sum+p.cells,0),land);
  for(const p of provinces)for(const n of p.neighbors){
    assert.ok(provinces[n].neighbors.includes(p.id),'neighbors must be symmetric');
  }
  assert.equal(new Set(provinces.slice(0,COUNTRY_STARTS.length).map(p=>p.center)).size,COUNTRY_STARTS.length);
});

test('risk-hybrid uses distinct economy, sequential phases and no realtime activity',()=>{
  const g=new TurnGame(23);
  const owned=g.provinces.find(p=>p.owner===0);
  const before=owned.troops;
  assert.equal(g.deploy(owned.id,3).ok,true);
  assert.equal(owned.troops,before+3);
  assert.equal(g.deploy(owned.id,999).ok,false);
  g.nextPhase();assert.equal(g.phase,'develop');
  const gold=g.factions[0].gold;
  assert.equal(g.upgrade(owned.id).ok,true);
  assert.ok(g.factions[0].gold<gold);
  g.nextPhase();assert.equal(g.phase,'attack');
  g.nextPhase();assert.equal(g.phase,'fortify');
  g.nextPhase();
  assert.equal(g.active,1);assert.equal(g.phase,'reinforce');
  assert.ok(g.factions[1].gold>10);
  assert.equal(g.round,1);
});

test('risk dice are deterministic and the attacker must keep a home garrison',()=>{
  const a=new TurnGame(517),b=new TurnGame(517);
  const source=a.provinces.find(p=>p.owner===0&&p.neighbors.some(n=>a.provinces[n].owner!==0));
  assert.ok(source);
  const target=source.neighbors.find(n=>a.provinces[n].owner!==0);
  for(const g of [a,b]){
    g.provinces[source.id].troops=20;
    g.provinces[target].troops=2;
    g.nextPhase();g.nextPhase();
  }
  assert.equal(a.attack(source.id,target,20).ok,false,'cannot empty province');
  const first=a.attack(source.id,target,3);
  assert.ok(first.ok);assert.ok(first.attackerLoss+first.defenderLoss>=1);
  assert.deepEqual(first,b.attack(source.id,target,3));
  assert.deepEqual(a.exportSave(),b.exportSave());
});

test('risk-hybrid save/load preserves rounds, turns, economy and dice state',()=>{
  const g=new TurnGame(901,100);
  const source=g.provinces.find(p=>p.owner===0&&p.neighbors.some(n=>g.provinces[n].owner!==0));
  const target=source.neighbors.find(n=>g.provinces[n].owner!==0);
  g.nextPhase();g.nextPhase();
  g.attack(source.id,target,3);
  const restored=TurnGame.fromSave(JSON.parse(JSON.stringify(g.exportSave())));
  assert.deepEqual(restored.exportSave(),g.exportSave());
  const a=g.attack(source.id,target,3),b=restored.attack(source.id,target,3);
  assert.deepEqual(a,b);assert.deepEqual(g.exportSave(),restored.exportSave());
});
