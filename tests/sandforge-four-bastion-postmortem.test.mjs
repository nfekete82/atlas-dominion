import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {initialRouteAudit,phaseSnapshot,routeLength} from '../scripts/ai-four-bastion-postmortem.mjs';

test('postmortem: distance measurements use actual routed waypoints',()=>{
 assert.equal(routeLength({x:0,y:0},[]),null);
 assert.equal(routeLength({x:0,y:0},[{x:3,y:4}]),5);
 assert.equal(routeLength({x:0,y:0},[{x:3,y:4},{x:6,y:8}]),10);
});
test('postmortem: map audit has both factions, equal starts, real routes and no game modifications',()=>{
 for(const seed of [2026,2030]){
  const a=initialRouteAudit(seed),b=initialRouteAudit(seed);
  assert.deepEqual(a,b,'deterministic map route audit');
  assert.equal(a.equalInitialCredits,true);
  assert.equal(a.startPositions.length,2);
  assert.equal(a.pathOptions[0].length,2);
  assert.equal(a.pathOptions[1].length,2);
  assert.equal(a.initialIncome.length,2);
  for(const owner of [0,1])for(const row of a.pathOptions[owner]){
   assert.ok(row.straight>0);
   assert.equal(typeof row.navigable,'boolean');
   if(row.navigable){
    assert.ok(row.actual>0);
    assert.ok(row.detourRatio>0);
   }
  }
 }
});
test('postmortem: snapshots are read-only and never reveal unseen enemy positions',()=>{
 const g=new Simulation(2031,11);
 const before=g.save();
 const s=phaseSnapshot(g);
 assert.deepEqual(g.save(),before);
 assert.equal(s.time,0);
 assert.equal(s.redCredits,950);
 assert.equal(s.blueCredits,950);
 assert.equal(s.redSectors.length,1);
 assert.equal(s.blueSectors.length,1);
 assert.equal(s.neutralSectors.length,2);
 assert.ok(s.redCombat>0);
 assert.equal(Object.hasOwn(s,'bluePositions'),false);
 assert.equal(Object.hasOwn(s,'unseenUnits'),false);
});
