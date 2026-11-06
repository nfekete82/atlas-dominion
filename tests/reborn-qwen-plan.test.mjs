import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { parseStrategicDecision, strategicMessages } from '../dist/src/reborn/qwen-plan.js';

const briefing = {
  time: 33,
  credits: 400,
  fighters: 6,
  artillery: 1,
  medics: 1,
  phase: 'gather',
  options: [
    { sectorId: 4, owner: 'neutral', score: 500, travel: 400, routeRisk: 1, defenders: 0, turrets: 0, income: 15 },
    { sectorId: 7, owner: 'enemy', score: 680, travel: 340, routeRisk: 3, defenders: 2, turrets: 1, income: 25 },
  ],
};

test('Qwen choice accepts only a known sector ID', () => {
  assert.deepEqual(parseStrategicDecision('{"sectorId":7}', briefing), { sectorId: 7 });
  assert.deepEqual(parseStrategicDecision('<think>unknown</think>\n{"sectorId":4}', briefing), { sectorId: 4 });
  for (const answer of [
    '{"sectorId":8}', '{"sectorId":-1}', '{"sectorId":"7"}', '{"sectorId":7.5}',
    '{"sectorId":null}', '{"sectorId":7', 'go to 7', '{"sectorId":7,"script":"eval()"}',
  ]) {
    if (answer.includes('script')) {
      // Extra keys have no effect: only sectorId is returned, never code.
      assert.deepEqual(parseStrategicDecision(answer, briefing), { sectorId: 7 });
    } else {
      assert.equal(parseStrategicDecision(answer, briefing), null, answer);
    }
  }
  assert.equal(parseStrategicDecision({ sectorId: 7 }, briefing), null);
  assert.equal(parseStrategicDecision(' '.repeat(4100) + '{"sectorId":7}', briefing), null);
});

test('Qwen only receives compact strategic inputs and valid options', () => {
  const messages = strategicMessages(briefing);
  assert.equal(messages.length, 2);
  assert.ok(messages[0].content.includes('only'));
  assert.ok(messages[1].content.includes('"sectorId":7'));
  assert.ok(!messages[1].content.includes('enemyCoordinates'));
  assert.deepEqual(strategicMessages(briefing), messages);
});

test('static production build keeps the worker and explicit opt-in', () => {
  assert.ok(existsSync('dist/src/reborn/qwen-general.worker.js'));
  assert.ok(existsSync('dist/src/reborn/qwen-general.js'));
  assert.ok(existsSync('dist/src/reborn/qwen-plan.js'));
});
