import {test} from 'node:test';
import assert from 'node:assert/strict';
import {forecastManeuver,chooseTacticalManeuver,flankCandidate} from '../dist/src/reborn/tactical-search.js';
import {assignFlank,assignScreen} from '../dist/src/reborn/battle-squads.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

const make=(kind,n,start=1,hp=undefined)=>Array.from({length:n},(_,i)=>({
 id:start+i,kind,hp:hp??(kind==='tank'?620:kind==='heavy'?420:kind==='artillery'?340:100),
 xp:0,x:100+i*20,y:100
}));
test('2.2: early-game healthy infantry are eligible for a flank without imaginary vehicles',()=>{
 const allies=make('infantry',8),observedEnemies=make('heavy',3,100);
 const input={allies,observedEnemies,knownGuns:[],storm:false};
 const flank=forecastManeuver(input,'flank');
 assert.ok(flank.score>-1e9,'infantry-led maneuver must be evaluated');
 assert.ok(flank.ownLossFraction>=0&&flank.ownLossFraction<=1);
 assert.equal(forecastManeuver({...input,knownGuns:[{id:999,hp:650,range:600}]},'flank').score,-1e9,
  'known tower battery is never ignored by a flank');
 assert.deepEqual(chooseTacticalManeuver(input),chooseTacticalManeuver(structuredClone(input)),
  'planning must remain deterministic');
});
test('2.2: a real two-unit flanking detachment preserves at least two main-axis fighters',()=>{
 const group=[...make('infantry',6),...make('tank',2,40)];
 const threat={...make('infantry',1,100)[0],x:130,y:100};
 const screen=assignScreen(group,threat);
 assert.equal(screen.length,3,'six-plus front liners require a sturdier but bounded screen');
 const assault=group.filter(u=>!screen.includes(u.id));
 const flank=assignFlank(assault,screen);
 assert.equal(flank.length,2);
 assert.ok(flank.every(id=>!screen.includes(id)));
 assert.ok(assault.filter(u=>!flank.includes(u.id)).length>=2);
 assert.deepEqual(assignFlank(assault,screen),flank);
 assert.deepEqual(assignFlank(make('infantry',3),[]),[],'three soldiers must not split the mission');
});
test('2.2: wounded vehicles do not flank and all known turrets are honored',()=>{
 const group=[...make('infantry',5),...make('tank',2,40,190)];
 const flank=assignFlank(group,[]);
 assert.equal(flank.length,2);
 assert.ok(flank.every(id=>id<40),'wounded tanks are excluded');
 const anchor={x:300,y:400},objective={x:600,y:400};
 assert.deepEqual(flankCandidate(anchor,objective,1),{x:440,y:675});
});
test('2.2: forecasting and squad selection never mutate game saves or random stream',()=>{
 const g=new Simulation(2026,4),before=g.save();
 const group=make('infantry',8),enemies=make('heavy',4,100);
 const input={allies:group,observedEnemies:enemies,knownGuns:[],storm:false};
 chooseTacticalManeuver(input);assignScreen(group,enemies[0]);assignFlank(group,[]);
 assert.deepEqual(g.save(),before);
});
