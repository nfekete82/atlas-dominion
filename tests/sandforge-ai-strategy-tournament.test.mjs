import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {TOURNAMENT_OPPONENTS,blueTournamentOpponent,plannedConstruction,publicSectorGoal,placementCandidates} from '../scripts/ai-tournament-opponents.mjs';
import {AI_CANDIDATES,tournamentRating,aggregateTournament,qualifyCandidate} from '../scripts/ai-tournament-rankings.mjs';

test('five BLUE opponents and five legitimate existing RED policies exist',()=>{
 assert.deepEqual(TOURNAMENT_OPPONENTS,['guarded','rush','expansion','armor','siege']);
 assert.ok(AI_CANDIDATES.current);
 assert.equal(AI_CANDIDATES.current.planningMode,'tactical');
 assert.equal(AI_CANDIDATES.current.waveMode,'coordinated');
 assert.equal(AI_CANDIDATES.current.doctrineMode,'intelligent');
 for(const cfg of Object.values(AI_CANDIDATES)){
  assert.ok(['baseline','director'].includes(cfg.mode));
  assert.ok(['classic','tactical'].includes(cfg.planningMode));
  assert.ok(['legacy','coordinated'].includes(cfg.waveMode));
 }
});

test('opponent strategy uses public sector ownership, not hidden enemy positions',()=>{
 const home={x:200,y:200};
 const sectors=[
  {id:0,owner:0,income:15,point:{x:250,y:250}},
  {id:1,owner:-1,income:25,point:{x:420,y:200}},
  {id:2,owner:1,income:25,point:{x:490,y:200}}];
 assert.equal(publicSectorGoal('expansion',sectors,home).id,1);
 assert.equal(publicSectorGoal('rush',sectors,home).id,2);
 assert.equal(publicSectorGoal('siege',sectors,home).id,2);
 assert.equal(publicSectorGoal('rush',sectors.map(t=>({...t,owner:0})),home),null);
 const a=placementCandidates(home);
 assert.equal(a.length,144);
 assert.equal(new Set(a.map(p=>p.x.toFixed(4)+','+p.y.toFixed(4))).size,144);
});

test('opponent economic opening is distinct and limited to paid construction',()=>{
 assert.equal(plannedConstruction('rush',[]),'barracks');
 assert.equal(plannedConstruction('armor',[]),'factory');
 assert.equal(plannedConstruction('siege',[]),'factory');
 assert.equal(plannedConstruction('expansion',[]),'barracks');
 assert.equal(plannedConstruction('rush',[{kind:'barracks',hp:BUILDINGS.barracks.hp}]),null);
 const g=new Simulation(2026,11),before=g.credits[0];
 const startingBases=g.bases.length,startingUnits=g.units.length;
 blueTournamentOpponent(g,'rush');
 assert.equal(g.units.length,startingUnits,'construction cannot spawn free troops');
 assert.equal(g.bases.length,startingBases+1,'rush orders one real construction project');
 const building=g.bases.find(b=>b.owner===0&&b.kind==='barracks');
 assert.ok(building&&building.buildRemaining>0);
 assert.equal(before-g.credits[0],BUILDINGS.barracks.cost);
 assert.ok(g.units.some(u=>u.owner===0&&u.kind==='engineer'&&u.orders.some(o=>o.kind==='build')));
 assert.throws(()=>blueTournamentOpponent(g,'omniscient'));
});

test('real victories outrank any timeout score, and timeouts are never counted as wins',()=>{
 const base={redSectorSeconds:0,blueSectorSeconds:4000,redSectors:1,captures:0,
   redUnitsLost:30,blueUnitsLost:0,enemyHQDamage:0};
 const win=tournamentRating({...base,outcome:'win'});
 const loss=tournamentRating({...base,outcome:'loss'});
 const timeout=tournamentRating({...base,outcome:'timeout',redSectorSeconds:4000,
  blueSectorSeconds:0,redSectors:4,blueUnitsLost:40,enemyHQDamage:1200});
 assert.ok(win>timeout);
 assert.ok(loss<timeout);
 const standing=aggregateTournament([
  {...base,outcome:'timeout',policy:'current',opponent:'rush',rating:0},
  {...base,outcome:'win',policy:'classicPlanner',opponent:'rush',rating:1000000}
 ]);
 assert.equal(standing[0].policy,'classicPlanner');
 assert.equal(standing.find(s=>s.policy==='current').timeouts,1);
 assert.equal(standing.find(s=>s.policy==='current').wins,0);
});

test('paired promotion gate rejects regressions on ANY opponent or missing seeds',()=>{
 const row=(opponent,seed,policy,outcome,redSectorSeconds)=>({
  opponent,seed,policy,outcome,redSectorSeconds
 });
 const rows=[
  row('rush',2026,'current','timeout',200),row('rush',2027,'current','loss',100),
  row('armor',2026,'current','timeout',150),row('armor',2027,'current','timeout',170),
  row('rush',2026,'classicPlanner','timeout',230),row('rush',2027,'classicPlanner','timeout',130),
  row('armor',2026,'classicPlanner','timeout',160),row('armor',2027,'classicPlanner','timeout',180)];
 assert.equal(qualifyCandidate(rows,'classicPlanner').qualified,true);
 assert.equal(qualifyCandidate(rows.filter(r=>!(r.policy==='classicPlanner'&&r.seed===2027&&r.opponent==='armor')),'classicPlanner').qualified,false);
 const regressed=rows.map(r=>r.policy==='classicPlanner'&&r.opponent==='armor'
   ?{...r,redSectorSeconds:r.redSectorSeconds-50}:r);
 assert.equal(qualifyCandidate(regressed,'classicPlanner').qualified,false);
 assert.equal(qualifyCandidate(rows,'current').qualified,false);
});

test('default production RED tactical behavior remains unchanged by benchmarks',()=>{
 const g=new Simulation(2026,11);
 assert.equal(g.tactical.mode,'director');
 assert.equal(g.tactical.planningMode,'tactical');
 assert.equal(g.tactical.waveMode,'coordinated');
 assert.equal(g.tactical.doctrineMode,'intelligent');
});
