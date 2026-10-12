import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,NEUTRAL,landNeighbors,cellToPoint} from '../dist/src/engine/game.js';
import {frontierBudget} from '../dist/src/engine/frontline.js';
import {upgradedCityRecruitment,cityUpgradeGrowth} from '../dist/src/engine/economy.js';

test('Balanced AI and human transfer the SAME number of real soldiers to a fresh threatened border',()=>{
  const ai=new Game(7005,1,'DE','balanced');
  const human=Game.fromSave(JSON.parse(JSON.stringify(ai.exportSave())));
  // Both worlds have identical geography and starting troops, only who
  // controls the test faction differs.
  human.factions[1].ai=false;
  for(const g of [ai,human]){
    const own=g.owner.findIndex((v,i)=>v===1&&
      landNeighbors(i).some(n=>g.owner[n]===NEUTRAL));
    assert.ok(own>=0);
    const hostile=landNeighbors(own).find(n=>g.owner[n]===NEUTRAL);
    g.owner[hostile]=0;
    g.factions[1].troops=1100;
    g.recount();
    g.redistributeFrontline();
  }
  const aiFront=ai.frontline.reduce((total,t,i)=>total+(ai.owner[i]===1?t:0),0);
  const humanFront=human.frontline.reduce((total,t,i)=>total+(human.owner[i]===1?t:0),0);
  assert.ok(aiFront>0);
  assert.ok(Math.abs(aiFront-humanFront)<.001,'Balanced AI must not obtain triple border funding');
});

test('excess stationed troops return to mobile reserves without duplication or removing all defenses',()=>{
  const g=new Game(7010,1,'DE','balanced');
  const own=g.owner.findIndex((o,i)=>o===0&&
    landNeighbors(i).some(n=>g.owner[n]===NEUTRAL));
  const hostile=landNeighbors(own).find(n=>g.owner[n]===NEUTRAL);
  g.owner[hostile]=1;
  g.factions[0].troops=20;
  g.frontline[own]=2000;
  g.recount();
  const total=g.populationOf(0),mobile=g.factions[0].troops;
  g.redistributeFrontline();
  assert.ok(g.factions[0].troops>mobile,'garrison must demobilize overcrowded defenses');
  assert.ok(g.frontline[own]>0,'exposed sector retains real defenders');
  assert.ok(Math.abs(g.populationOf(0)-total)<.0001,'no gifted or destroyed soldiers');
});

test('fully upgraded cities provide valuable recruitment without unlimited snowballing',()=>{
  for(const territory of [60,150,1000,3000]){
    const base=upgradedCityRecruitment(0,territory,10);
    const one=upgradedCityRecruitment(cityUpgradeGrowth(5),territory,10);
    const all=upgradedCityRecruitment(10*cityUpgradeGrowth(5),territory,10);
    assert.equal(base,0);
    assert.ok(one>1.1,'a fully upgraded city should add material recruits every tick');
    assert.ok(all>one,'developing further cities remains worthwhile');
    assert.ok(all<Math.max(3,Math.sqrt(territory)*.65),'urban bonuses stay safely capped');
  }
  const g=new Game(7011,1,'DE','balanced');
  g.factions[0].money=10000;
  const index=g.owner.findIndex((o,i)=>o===0&&g.canBuild(0,cellToPoint(i),'city').ok);
  const point=cellToPoint(index);
  assert.equal(g.build(0,point,'city').ok,true);
  const before=g.factions[0].income;
  const startingGold=g.factions[0].money;
  for(let i=0;i<5;i++)assert.equal(g.upgradeCity(0,point).ok,true);
  assert.equal(startingGold-g.factions[0].money,4300);
  assert.ok(g.factions[0].income-before>1.1);
});

test('expired diplomatic cooloffs allow renegotiation, old saves remain compatible',()=>{
  const g=new Game(7012,2,'DE','balanced');
  assert.equal(g.offerAlliance(0,1).ok,true);
  assert.equal(g.leaveAlliance(0,1).ok,true);
  const rejected=g.offerAlliance(0,1);
  assert.equal(rejected.ok,false);
  assert.match(rejected.reason,/Abkühlzeit/);
  const restored=Game.fromSave(JSON.parse(JSON.stringify(g.exportSave())));
  assert.deepEqual(restored.exportSave(),g.exportSave());
  restored.tick+=121;
  assert.equal(restored.offerAlliance(0,1).ok,true);
  const legacy=g.exportSave();
  delete legacy.diplomacyCooldowns;
  const old=Game.fromSave(legacy);
  assert.equal(old.diplomacyCooldowns.length,0);
});

test('AI war cooldown stops an immediate second national invasion after a costly campaign',()=>{
  const g=new Game(7013,2,'DE','balanced');
  const actor=g.factions[1];
  actor.troops=2000;
  g.attackOrders.push({id:9001,factionId:1,targetOwner:2,anchor:g.cities[2],
    committed:130,remaining:0,effort:0,fallen:40,conquered:8});
  g.resolveOrders(actor);
  const until=actor.warCooldownUntil;
  assert.ok(until>g.tick+60);
  for(let i=0;i<40;i++)g.step();
  assert.ok(g.tick<until);
  assert.ok(g.attackOrders.filter(o=>o.factionId===1&&o.targetOwner>=0).length===0,
    'neutral expansion is fine, new foreign invasions must wait');
});

test('AI-AI ceasefire blocks a renewed war for ninety ticks but never suppresses neutral expansion',()=>{
  const g=new Game(7014,3,'DE','balanced');
  const actor=g.factions[1];
  actor.troops=1000;
  g.attackOrders.push({id:9002,factionId:1,targetOwner:2,anchor:g.cities[2],
    committed:200,remaining:0,effort:0,fallen:35,conquered:7});
  g.resolveOrders(actor);
  assert.equal(g.isWarTruce(1,2),true);
  assert.equal(g.isWarTruce(2,1),true);
  assert.equal(g.isWarTruce(0,1),false);
  const save=g.exportSave();
  assert.deepEqual(Game.fromSave(JSON.parse(JSON.stringify(save))).exportSave(),save);
  g.tick+=91;
  assert.equal(g.isWarTruce(1,2),false);
  const legacy=structuredClone(save);
  delete legacy.warTruces;
  assert.equal(Game.fromSave(legacy).warTruces.length,0);
  assert.throws(()=>Game.fromSave({...save,warTruces:[{a:-1,b:1,untilTick:500}]}),/Waffenstillstand/);
});
