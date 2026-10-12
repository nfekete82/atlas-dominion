import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TurnGame} from '../dist/src/engine/turn-game.js';
import {playAiTurn,playComputerRound} from '../dist/src/engine/turn-ai.js';

test('the AI plays a full deterministic round with real troops and gold',()=>{
  const a=new TurnGame(313,100),b=new TurnGame(313,100);
  for(const g of [a,b])for(let i=0;i<4;i++)g.nextPhase();
  assert.equal(a.active,1);
  const one=playComputerRound(a),two=playComputerRound(b);
  assert.equal(one.length,a.factions.length-1);
  assert.deepEqual(one,two);
  assert.equal(a.active,0);
  assert.equal(a.round,2);
  assert.equal(a.phase,'reinforce');
  assert.deepEqual(a.exportSave(),b.exportSave());
  assert.ok(one.some(s=>s.reinforced>0));
  assert.ok(one.every(s=>s.battles<=8));
});

test('AI uses ordinary paid commands, does not play over the human turn',()=>{
  const g=new TurnGame(441,100);
  assert.throws(()=>playAiTurn(g),/Human turn/);
  for(let i=0;i<4;i++)g.nextPhase();
  const before=g.factions[1].reserve;
  assert.ok(before>=5);
  const result=playAiTurn(g);
  assert.equal(result.faction,1);
  assert.equal(g.active,2);
  assert.equal(g.factions[1].reserve,0);
  assert.equal(result.reinforced,before);
});

test('dice outcomes expose exact deterministic values and never discard troops',()=>{
  const g=new TurnGame(78);
  const src=g.provinces.find(p=>p.owner===0&&p.neighbors.some(n=>g.provinces[n].owner!==0));
  assert.ok(src);
  const dest=src.neighbors.find(n=>g.provinces[n].owner!==0);
  g.nextPhase();g.nextPhase();
  const troopsBefore=g.provinces.reduce((s,p)=>s+p.troops,0);
  const result=g.attack(src.id,dest,3);
  assert.ok(result.ok);
  assert.ok(result.attackerDice.every(d=>d>=1&&d<=6));
  assert.ok(result.defenderDice.every(d=>d>=1&&d<=6));
  assert.deepEqual(result.attackerDice,[...result.attackerDice].sort((a,b)=>b-a));
  const troopsAfter=g.provinces.reduce((s,p)=>s+p.troops,0);
  assert.equal(troopsBefore-troopsAfter,result.attackerLoss+result.defenderLoss);
});

test('standalone risk page and assets are emitted alongside the existing realtime entrypoint',async()=>{
  const [html,realtime,css,js]=await Promise.all([
    readFile('dist/risk.html','utf8'),readFile('dist/index.html','utf8'),
    readFile('dist/risk-style.css','utf8'),readFile('dist/src/risk-main.js','utf8'),
  ]);
  for(const id of ['riskCanvas','nextPhase','deploy','upgrade','attack','quickAttack','move'])
    assert.ok(html.includes('id="'+id+'"'),'missing '+id);
  assert.ok(html.includes('/src/risk-main.js'));
  assert.ok(realtime.includes('battleCanvas'));
  assert.ok(css.includes('.sidebar'));
  assert.ok(js.includes('playComputerRound'));
});
