import test from 'node:test';
import assert from 'node:assert/strict';
import {aiMarchRecovery,aiAttacksPerTick,aiStrikeSize,aiDefenseAllocation,aiRiskTolerance} from '../dist/src/engine/ai-tactics.js';
import {assessInvasion} from '../dist/src/engine/warfare.js';

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
