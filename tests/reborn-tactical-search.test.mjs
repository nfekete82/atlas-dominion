import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chooseTacticalManeuver,forecastManeuver,flankCandidate} from '../dist/src/reborn/tactical-search.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES} from '../dist/src/reborn/config.js';

const roster=(kind,number,hp,xp=0,start=1)=>Array.from({length:number},(_,i)=>({id:start+i,kind,hp,xp}));

test('tactical search: bounded, deterministic forecasts use only supplied observed intelligence',()=>{
 const allies=[...roster('infantry',4,100,250),...roster('tank',2,620,500,20)];
 const seen=roster('infantry',5,100,0,100);
 const context={allies,observedEnemies:seen,knownGuns:[],storm:false};
 const x=chooseTacticalManeuver(context),y=chooseTacticalManeuver(structuredClone(context));
 assert.deepEqual(x,y);
 assert.equal(x.forecasts.length,3);
 assert.ok(x.forecasts.every(f=>Number.isFinite(f.score)&&f.seconds<=24&&f.ownLoss>=0&&f.enemyLoss>=0));
 const noThreat=chooseTacticalManeuver({...context,observedEnemies:[]});
 assert.equal(noThreat.mode,'assault');assert.equal(noThreat.reason,'uncontested');
 const hidden=chooseTacticalManeuver(context);
 assert.deepEqual(x,hidden,'no global simulation state may influence the calculation');
});

test('tactical search: veterancy raises expected combat damage and reduces relative losses',()=>{
 const allies=roster('infantry',5,100,0);
 const enemies=roster('infantry',5,100,0,100);
 const green=forecastManeuver({allies,observedEnemies:enemies,knownGuns:[],storm:false},'assault');
 const veteran=forecastManeuver({allies:allies.map(u=>({...u,xp:500})),observedEnemies:enemies,knownGuns:[],storm:false},'assault');
 assert.ok(veteran.enemyLoss>=green.enemyLoss);
 assert.ok(veteran.ownLoss<=green.ownLoss);
});

test('tactical search: tracked guns require real rockets for the standoff siege alternative',()=>{
 const allies=[...roster('infantry',4,100),...roster('artillery',2,340,100,20)];
 const context={allies,observedEnemies:roster('infantry',1,100,0,100),knownGuns:[{id:500,hp:650,range:RULES.turret.range}],storm:false};
 const options=chooseTacticalManeuver(context).forecasts;
 assert.ok(options.some(f=>f.mode==='siege'&&f.score>-1e9));
 const without=forecastManeuver({...context,allies:roster('infantry',5,100)},'siege');
 assert.equal(without.score,-1e9,'no imaginary artillery');
});

test('tactical search: a flank needs enough real mobile units and defenders',()=>{
 const base={allies:[...roster('infantry',5,100),...roster('rover',2,295,0,20)],observedEnemies:roster('infantry',5,100,0,100),knownGuns:[],storm:false};
 assert.ok(forecastManeuver(base,'flank').score>-1e9);
 assert.equal(forecastManeuver({...base,allies:roster('infantry',7,100)},'flank').score,-1e9);
 assert.equal(forecastManeuver({...base,knownGuns:[{id:900,hp:650,range:600}]},'flank').score,-1e9);
 assert.deepEqual(flankCandidate({x:100,y:100},{x:400,y:100},1),{x:240,y:375});
 assert.deepEqual(flankCandidate({x:100,y:100},{x:400,y:100},-1),{x:240,y:-175});
});

test('tactical search: extreme visible inputs remain finite, storm changes estimates and no RNG is consumed',()=>{
 const context={allies:[...roster('infantry',8,100),...roster('artillery',2,340,500,20)],observedEnemies:roster('tank',5,620,500,100),
  knownGuns:[{id:900,hp:650,range:600},{id:901,hp:650,range:600}],storm:false};
 const clear=chooseTacticalManeuver(context),storm=chooseTacticalManeuver({...context,storm:true});
 assert.ok(clear.forecasts.every(f=>Number.isFinite(f.score)&&f.ownLossFraction<=1&&f.enemyLossFraction<=1));
 assert.notDeepEqual(clear.forecasts,storm.forecasts);
 const g=new Simulation(42,4),before=g.save();
 chooseTacticalManeuver(context);assert.deepEqual(g.save(),before,'pure planning must not affect the simulation or its seed');
});

test('tactical search: benchmark can switch the integrated director without save-format mutations',()=>{
 const g=new Simulation(2026,4),save=g.save();
 assert.equal(g.tactical.planningMode,'tactical');
 g.tactical.planningMode='classic';
 assert.deepEqual(g.save(),save);
 g.tactical.planningMode='tactical';
 for(let i=0;i<10;i++)g.step();
 assert.ok(g.units.every(u=>Number.isFinite(u.hp)&&u.hp>0));
});
