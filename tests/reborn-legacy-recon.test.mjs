import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankLegacyFrontiers} from '../dist/src/reborn/legacy-campaign.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

test('legacy recon prioritizes public hostile frontiers before nearer neutrals without mutating map order',()=>{
 const sectors=[{id:0,owner:-1,point:{x:10,y:0}},{id:1,owner:0,point:{x:900,y:0}},{id:2,owner:0,point:{x:500,y:0}}];
 assert.deepEqual(rankLegacyFrontiers(sectors,{x:0,y:0}).map(t=>t.id),[2,1,0]);
 assert.deepEqual(sectors.map(t=>t.id),[0,1,2]);
});

test('legacy recon order depends only on public sectors and own position',()=>{
 const a=new Simulation(2026,2),b=new Simulation(2026,2),from=a.bases[1];
 // Arbitrary hidden enemy additions and hidden HQ relocation cannot affect it.
 Object.assign(b.bases[0],{x:1800,y:1800});b.spawn(0,{x:1900,y:1700},'tank');
 const frontier=g=>g.territories.filter(t=>t.owner!==1&&t.neighbors.some(id=>g.territories[id].owner===1));
 assert.deepEqual(rankLegacyFrontiers(frontier(a),from),rankLegacyFrontiers(frontier(b),from));
});
