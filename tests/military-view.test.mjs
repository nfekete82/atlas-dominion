import test from 'node:test';
import assert from 'node:assert/strict';
import {militarySummaries,relativeStrength,strengthLabel} from '../dist/src/military-view.js';

test('strength formatting includes all troops and remains compact',()=>{
  assert.equal(strengthLabel(2300.9),'⚔ 2,3K');
  assert.equal(strengthLabel(0),'⚔ 0');
  assert.equal(strengthLabel(2500000),'⚔ 2,5M');
});
test('relative danger uses the same total and a ten percent similarity band',()=>{
  for(const [total,danger] of [[89,'weaker'],[90,'similar'],[100,'similar'],[110,'similar'],[111,'stronger']])
    assert.equal(relativeStrength(total,100).danger,danger);
  assert.equal(relativeStrength(150,100).text,'150 %');
  assert.equal(relativeStrength(1500,100).text,'1.500 %');
  assert.equal(relativeStrength(0,0).text,'100 %');
  assert.equal(relativeStrength(1,0).text,'∞ %');
  assert.equal(relativeStrength(0,10).danger,'weaker');
});
test('summary conserves mobile, border, attack and naval survivors without counting returning fleets as fronts',()=>{
  const game={tick:10,factions:[{id:0,troops:100,moneyIncome:4,income:2},{id:1,troops:50,moneyIncome:3,income:1}],
    owner:[0,1,0,0,1],cities:[{index:0},{index:1}],cityUpgrades:[0,0,2,4,5],
    attackOrders:[{factionId:0,remaining:30},{factionId:0,remaining:20,landing:true,arrivalTick:20},
      {factionId:0,remaining:10,returning:true},{factionId:1,remaining:5,landing:true,arrivalTick:8}]};
  const result=militarySummaries(game,[40,10],[{index:2,owner:0,code:1},{index:3,owner:0,code:1},
    {index:4,owner:1,code:2}]);
  assert.deepEqual(result[0],{total:200,mobile:100,border:40,deployed:60,fronts:1,cities:3,averageCityLevel:2,income:4,growth:2});
  assert.equal(result[1].total,65);assert.equal(result[1].fronts,1);
  assert.equal(result[1].cities,1);assert.equal(result[1].averageCityLevel,0);
  game.attackOrders=[];game.cities=[];
  assert.equal(militarySummaries(game,[0,0],[])[0].averageCityLevel,0);
});
