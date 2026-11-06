import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,BUILDINGS} from '../dist/src/reborn/catalog.js';
import {rushPolicy} from '../scripts/tower-rush-opponent.mjs';

test('tower benchmark: six early structures are physically built from ordinary income and every purchase is debited',()=>{
 const g=new Simulation(2026,4);g.aiClock=-1e8;assert.deepEqual(g.credits,[950,950]);
 const initialRoster=g.units.map(u=>u.id),build=g.build.bind(g),recruit=g.recruit.bind(g);let spent=0;
 g.build=(owner,kind,...rest)=>{const before=g.credits[owner],b=build(owner,kind,...rest);if(b&&owner===0){assert.equal(before-g.credits[owner],BUILDINGS[kind].cost);spent+=BUILDINGS[kind].cost;}return b;};
 g.recruit=(id,kind)=>{const owner=g.bases.find(b=>b.id===id).owner,before=g.credits[owner],ok=recruit(id,kind);if(ok&&owner===0){assert.equal(before-g.credits[owner],UNITS[kind].cost);spent+=UNITS[kind].cost;}return ok;};
 const metrics={towersOrdered:0,blueTowerCredits:0,peakTowers:0,allTowersReadyAt:null,turretHits:0,turretDamage:0,immediateResponses:0,responseLatency:[]},policy=rushPolicy(6,metrics,UNITS);
 for(let i=0;i<2000&&metrics.peakTowers<6;i++){if(i%30===0)policy(g);g.step(.1);assert.ok(g.credits[0]>=0);}
 assert.equal(metrics.peakTowers,6);assert.equal(metrics.towersOrdered,6);assert.equal(metrics.blueTowerCredits,6*175);assert.ok(spent>=6*175);
 assert.equal(g.bases.filter(b=>b.owner===0&&b.kind==='turret'&&b.buildRemaining===0).length,6);
 assert.ok(initialRoster.every(id=>g.units.some(u=>u.id===id)));assert.ok(g.time<200);
});
