import test from 'node:test';
import assert from 'node:assert/strict';
import {aiStyle,scoreAIFront} from '../dist/src/engine/ai-strategy.js';

const neutral={neutral:true,advantage:3,friendlySides:2,capital:false,city:false,
  distance:3,opponentCommitted:0,opponentReserve:0,threatenedBorders:3,focus:false};
const enemy={...neutral,neutral:false,advantage:2.2,opponentCommitted:90,opponentReserve:9};
test('AI personalities are stable and expansionists prefer neutral terrain',()=>{
  assert.equal(aiStyle(4),aiStyle(8));
  assert.ok(scoreAIFront(neutral,'expansion')>scoreAIFront(neutral,'defensive'));
});
test('aggressive and opportunist bots prefer exposed weak defenders and real cities',()=>{
  const weak=scoreAIFront(enemy,'opportunist');
  const reinforced=scoreAIFront({...enemy,opponentReserve:120},'opportunist');
  assert.ok(weak>reinforced);
  assert.ok(scoreAIFront({...enemy,city:true},'aggressive')>scoreAIFront(enemy,'aggressive'));
  assert.ok(scoreAIFront({...enemy,focus:true},'aggressive')>scoreAIFront(enemy,'aggressive'));
});
test('front scoring is deterministic even when called in a different order',()=>{
  const a=scoreAIFront({...enemy,capital:true},aiStyle(19));
  scoreAIFront(neutral,aiStyle(12));
  assert.equal(scoreAIFront({...enemy,capital:true},aiStyle(19)),a);
});
