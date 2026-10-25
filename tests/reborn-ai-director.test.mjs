import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assaultDecision,abortAssault,preferredRole} from '../dist/src/reborn/ai-director.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {developArmy} from '../dist/src/reborn/army-economy.js';
import {addProducer} from './fixtures/reborn-production.mjs';

test('director: attacks undefended land with paid small groups instead of waiting forever',()=>{
 const input={defended:false,observedTowers:0,hasArtillery:false,visibleDefenderStrength:0,
  readyUnits:2,readyStrength:2.5,phaseSeconds:16,inRegroup:false,clusteredRecentLosses:false,scoutingOpening:false};
 assert.deepEqual(assaultDecision(input),{launch:true,requiredUnits:2,requiredStrength:2,reason:'ready'});
 assert.equal(assaultDecision({...input,readyUnits:1,scoutingOpening:false}).launch,false);
});

test('director: requires heavier support for actual visible fortifications',()=>{
 const s={defended:true,observedTowers:1,hasArtillery:false,visibleDefenderStrength:2,
  readyUnits:3,readyStrength:5,phaseSeconds:30,inRegroup:false,clusteredRecentLosses:false,scoutingOpening:false};
 assert.equal(assaultDecision(s).launch,false);
 assert.equal(assaultDecision({...s,hasArtillery:true,readyUnits:5,readyStrength:7}).launch,true);
});

test('director: stays committed through two casualties but withdraws from near-annihilation',()=>{
 const scenario={launchSize:10,survivors:8,recentLosses:2,stalledSeconds:20,
  knownUncoveredTurret:false,hasSiegeWeapon:false,destinationStillContested:true};
 assert.equal(abortAssault(scenario),null);
 assert.equal(abortAssault({...scenario,survivors:2,recentLosses:6}),'crippled');
 assert.equal(abortAssault({...scenario,stalledSeconds:110}),'stalled');
 assert.equal(abortAssault({...scenario,knownUncoveredTurret:true}),'uncovered-turret');
 assert.equal(abortAssault({...scenario,knownUncoveredTurret:true,hasSiegeWeapon:true}),null);
 assert.equal(abortAssault({...scenario,destinationStillContested:false}),'captured');
});

test('director: specific roles for each fully paid producer',()=>{
 const counts={engineer:1,infantry:5,heavy:1,medic:0,tank:0,rover:0,artillery:0,
  scout:0,gunship:0,bomber:0};
 assert.equal(preferredRole('factory',counts,1,0)[0],'artillery');
 assert.equal(preferredRole('factory',counts,0,0)[0],'tank');
 assert.equal(preferredRole('airfield',counts,0,1)[0],'gunship');
 assert.equal(preferredRole('barracks',counts,0,0)[0],'heavy');
});

test('director: three finished buildings queue simultaneously on one economic tick',()=>{
 const g=new Simulation(2026,5),h=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(h);
 for(let i=0;i<5;i++)g.spawn(1,{x:h.x+140+i*6,y:h.y-125},'infantry');
 const barracks=addProducer(g,'barracks',1);
 const factory=addProducer(g,'factory',1);
 const airfield=addProducer(g,'airfield',1);
 g.credits[1]=8000;
 const before=g.credits[1];
 const army=g.units.filter(u=>u.owner===1&&u.hp>0);
 developArmy(g,g.tactical.state,army,()=>0);
 const queued=[barracks,factory,airfield].map(b=>b.queueTypes[0]);
 assert.equal(queued[0],'heavy');
 assert.equal(queued[1],'tank');
 assert.equal(queued[2],'gunship');
 assert.ok(before-g.credits[1]>=3*100,'all queues spend real credits');
 assert.equal(g.queued(1),3);
});

test('director: baseline can still be benchmarked without mutating campaign state',()=>{
 const g=new Simulation(2026,5),h=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 for(let i=0;i<5;i++)g.spawn(1,{x:h.x+140+i*6,y:h.y-125},'infantry');
 const bases=[addProducer(g,'barracks',1),addProducer(g,'factory',1),addProducer(g,'airfield',1)];
 g.credits[1]=8000;g.tactical.mode='baseline';
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.equal(bases.filter(b=>b.queue.length>0).length,1);
});


test('director: operational factory buys a real rover before reserving credits for the airfield',()=>{
 const g=new Simulation(2026,4),hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 for(let i=0;i<5;i++)g.spawn(1,{x:hq.x+100+i*12,y:hq.y-120},'infantry');
 addProducer(g,'barracks',1);
 const factory=addProducer(g,'factory',1);
 g.credits[1]=400;
 const before=g.credits[1];
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.equal(factory.queueTypes[0],'rover','first affordable vehicle must be purchased immediately');
 assert.equal(factory.queueCosts[0],300,'the real 300-credit rover cost is recorded');
 const paid=g.bases.filter(b=>b.owner===1).reduce((total,b)=>total+(b.queueCosts??[]).reduce((sum,cost)=>sum+cost,0),0);
 assert.equal(before-g.credits[1],paid,'all concurrent production is paid, with no phantom credits');
 assert.equal(paid,400,'the 300-credit rover and an additional 100-credit infantry order were both funded');
 assert.equal(g.tactical.state.economy?.goal,null,'no premature 450-credit airfield reservation');
});

test('director: first aircraft factory waits for actual ground force production',()=>{
 const g=new Simulation(2026,4),hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 for(let i=0;i<5;i++)g.spawn(1,{x:hq.x+100+i*12,y:hq.y-120},'infantry');
 addProducer(g,'barracks',1);const factory=addProducer(g,'factory',1);
 g.credits[1]=1000;
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.ok(factory.queueTypes.some(k=>k==='tank'||k==='rover'));
 assert.ok(!g.bases.some(b=>b.owner===1&&b.kind==='airfield'));
});
