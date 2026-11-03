import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {captureOpportunityAdjustment,observedSectorThreats,enoughToRetarget} from '../dist/src/reborn/ai-sector-economy.js';
import {OPPONENTS,scriptedOpponent} from '../scripts/ai-tournament-opponents.mjs';

test('frontier bonus favors safe revenue-producing neutral bastions',()=>{
 const neutral=captureOpportunityAdjustment({owner:-1,income:35,distance:300,observedEnemies:0,knownTurrets:0});
 const defended=captureOpportunityAdjustment({owner:0,income:35,distance:300,observedEnemies:2,knownTurrets:1});
 assert.ok(neutral<defended);
 assert.equal(captureOpportunityAdjustment({owner:1,income:35,distance:300,observedEnemies:0,knownTurrets:0}),0);
 assert.ok(captureOpportunityAdjustment({owner:-1,income:15,distance:300,observedEnemies:0,knownTurrets:0})>neutral);
 assert.equal(observedSectorThreats({x:0,y:0},[{x:100,y:0},{x:400,y:0}]),1);
});
test('mission stability: do not abandon an active fight for a merely attractive new objective',()=>{
 assert.equal(enoughToRetarget(0,-500,true),false);
 assert.equal(enoughToRetarget(0,-500,false),true);
 assert.equal(enoughToRetarget(0,-200,false),false);
});
test('default match and savegame retain classic unchanged policy',()=>{
 const a=new Simulation(2026,11),b=new Simulation(2026,11);
 b.tactical.economyPolicy='frontier';
 assert.equal(a.tactical.economyPolicy,'classic');
 assert.deepEqual(a.units,b.units);assert.deepEqual(a.credits,b.credits);
 assert.deepEqual(a.territories,b.territories);assert.deepEqual(a.explored,b.explored);
 const saved=b.save();
 assert.equal(saved.ai?.economyPolicy,undefined);
 assert.equal(Simulation.load(saved).tactical.economyPolicy,'classic');
});
test('tournament includes three distinct legal scripted opponent options',()=>{
 assert.deepEqual(OPPONENTS,['guarded','rush','expansion']);
 for(const p of OPPONENTS)assert.equal(typeof scriptedOpponent(p),'function');
 assert.throws(()=>scriptedOpponent('omniscient'));
});
test('scripted opponents can only use ordinary paid action APIs',()=>{
 for(const p of OPPONENTS){
  const g=new Simulation(2026,11);
  const state={red:structuredClone(g.units.filter(u=>u.owner===1)),credits:g.credits[1],fog:[...g.visible[1]]};
  scriptedOpponent(p)(g);
  assert.equal(g.credits[1],state.credits);
  assert.deepEqual(g.units.filter(u=>u.owner===1),state.red);
  assert.deepEqual([...g.visible[1]],state.fog);
 }
});
