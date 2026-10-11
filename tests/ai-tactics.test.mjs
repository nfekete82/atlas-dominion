import test from 'node:test';
import assert from 'node:assert/strict';
import {aiMarchRecovery,aiAttacksPerTick,aiStrikeSize,aiDefenseAllocation,aiRiskTolerance} from '../dist/src/engine/ai-tactics.js';
import {assessInvasion} from '../dist/src/engine/warfare.js';
import {Game,NEUTRAL,landNeighbors} from '../dist/src/engine/game.js';

test('all AI personalities become faster without infinite actions',()=>{
  for(const kind of ['aggressive','expansion','opportunist','defensive']){
    assert.ok(aiMarchRecovery(1.6,kind)>=12);
    assert.ok(aiAttacksPerTick(30,kind)>=6);
    assert.ok(aiAttacksPerTick(20000,kind)<=20);
    assert.ok(aiRiskTolerance(kind)>0);
  }
  assert.ok(aiMarchRecovery(3,'aggressive')>aiMarchRecovery(3,'defensive'));
  assert.ok(aiAttacksPerTick(90,'aggressive')>aiAttacksPerTick(90,'defensive'));
});

test('AI advances in one neutral strike but never spends hidden soldiers',()=>{
  assert.ok(aiStrikeSize(90,true,'expansion')>=12);
  assert.ok(aiStrikeSize(90,false,'aggressive')>aiStrikeSize(90,true,'expansion'));
  for(const reserve of [8,12,20,50,90,500]){
    for(const kind of ['aggressive','expansion','opportunist','defensive']){
      for(const neutral of [true,false]){
        const spent=aiStrikeSize(reserve,neutral,kind);
        assert.ok(spent<=reserve && spent>=8);
      }
    }
  }
  assert.equal(aiStrikeSize(7,true,'aggressive'),0);
});

test('AI border defense is stronger but preserves a real mobile reserve',()=>{
  assert.equal(aiDefenseAllocation(30,2,2),0);
  assert.ok(aiDefenseAllocation(90,2,4)>4);
  assert.ok(aiDefenseAllocation(90,2,4)<=90-30);
  assert.ok(aiDefenseAllocation(200,9,6)>aiDefenseAllocation(90,2,4));
});

test('AI may now challenge a weak neighbor while remaining wary of overwhelming rivals',()=>{
  const base={attackerTroops:100,attackerIncome:2,defenderTroops:34,defenderIncome:1,
    garrison:10,capital:false,neutral:false,threatenedBorders:1};
  const usual=assessInvasion(base);
  const bold=assessInvasion({...base,riskTolerance:aiRiskTolerance('aggressive')});
  assert.ok(bold.advantage>=usual.advantage);
  assert.ok(bold.reserveFloor<=usual.reserveFloor);
  assert.equal(assessInvasion({...base,defenderTroops:1500,relativePower:.7,
    riskTolerance:aiRiskTolerance('aggressive')}).worthwhile,false);
});

test('AI directly captures multiple neighboring neutral sectors using finite marching stamina',()=>{
  const g=new Game(719,1,'DE');
  const ai=g.factions[1];
  const original=ai.troops;
  let captures=0;
  for(let turn=0;turn<5;turn++){
    const index=g.owner.findIndex((o,i)=>o===NEUTRAL&&landNeighbors(i).some(n=>g.owner[n]===1));
    if(index<0)break;
    const energyBefore=ai.campaignEnergy;
    assert.equal(g.attack(ai,index),true);
    assert.ok(ai.campaignEnergy<energyBefore);
    if(g.owner[index]===1)captures++;
  }
  assert.ok(captures>=3,'AI should rapidly expand into genuinely adjacent empty land');
  assert.equal(ai.attackFallen,0,'unoccupied land cannot kill attacking soldiers');
  assert.equal(ai.troops,original,'marching stamina does not secretly create or consume population');
});

test('the new AI defense posts real soldiers along enemy borders promptly',()=>{
  const g=new Game(825,1,'DE');
  const border=g.owner.findIndex((o,i)=>o===NEUTRAL && landNeighbors(i).some(n=>g.owner[n]===0));
  assert.ok(border>=0);
  g.owner[border]=1; // deliberately introduce an adjacent rival frontier
  const ai=g.factions[1],reserve=ai.troops;
  g.redistributeFrontline();
  const deployed=[...g.frontline].reduce((sum,v,i)=>sum+(g.owner[i]===1?v:0),0);
  assert.ok(deployed>0);
  assert.ok(ai.troops<reserve);
  assert.ok(Math.abs(ai.troops+deployed-reserve)<1e-6);
});

test('faster AI expansion stays deterministic with real territory and troop ownership',()=>{
  const a=new Game(942,4,'DE'),b=new Game(942,4,'DE');
  for(let i=0;i<22;i++){a.step();b.step();}
  assert.deepEqual([...a.owner],[...b.owner]);
  assert.deepEqual([...a.frontline],[...b.frontline]);
  assert.deepEqual(a.factions.map(f=>[f.troops,f.campaignEnergy,f.battleFocus,f.captured]),
    b.factions.map(f=>[f.troops,f.campaignEnergy,f.battleFocus,f.captured]));
  assert.ok(a.factions.slice(1).some(f=>f.captured>0));
  assert.ok(a.factions.every(f=>f.troops>=0&&f.campaignEnergy>=0));
});
