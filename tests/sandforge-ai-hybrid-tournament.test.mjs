import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {AI_CANDIDATES} from '../scripts/ai-tournament-rankings.mjs';

test('hybrid handoff times are explicit, positive and ordered',()=>{
 assert.equal(AI_CANDIDATES.hybrid120.mode,'baseline');
 assert.equal(AI_CANDIDATES.hybrid120.switchAt,120);
 assert.equal(AI_CANDIDATES.hybrid240.switchAt,240);
 assert.equal(AI_CANDIDATES.hybrid120.doctrineMode,'intelligent');
 assert.equal(AI_CANDIDATES.current.switchAt,undefined);
});

test('mode switch preserves paid world state, opponent fog and local production',()=>{
 const original=new Simulation(2026,11);
 const candidate=new Simulation(2026,11);
 original.tactical.mode='baseline';candidate.tactical.mode='baseline';
 for(let i=0;i<40;i++){original.step(.05);candidate.step(.05);}
 assert.deepEqual(candidate.units,original.units);
 assert.deepEqual(candidate.credits,original.credits);
 assert.deepEqual(candidate.bases,original.bases);
 assert.deepEqual(candidate.visible,original.visible);
 candidate.tactical.mode='director'; // benchmark-only switch
 assert.deepEqual(candidate.credits,original.credits);
 assert.deepEqual(candidate.territories,original.territories);
 assert.deepEqual(candidate.visible,original.visible);
 for(let i=0;i<90;i++)candidate.step(.05);
 assert.ok(candidate.units.every(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)));
 assert.ok(candidate.credits.every(Number.isFinite));
});
test('normal game default never becomes hybrid and savegame does not persist the experiment',()=>{
 const g=new Simulation(2026,11);
 assert.equal(g.tactical.mode,'director');
 g.tactical.mode='baseline';
 assert.equal(Simulation.load(g.save()).tactical.mode,'director');
});
