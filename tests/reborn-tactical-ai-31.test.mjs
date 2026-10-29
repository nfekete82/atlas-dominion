import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 newExperience,recordLesson,observeOwnedLosses,finishExperience,lessonScore,
 learnedMissionBias,defenseLessonsLost,portableExperience,readPortableExperience,validExperience
} from '../dist/src/reborn/battle-learning.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {chooseTacticalManeuver} from '../dist/src/reborn/tactical-search.js';
test('3.1: actual lost bastions are lessons, no duplicate losses on repeated pulses',()=>{
 const s=newExperience();
 assert.deepEqual(observeOwnedLosses(s,[1,2,3],5),[]);
 assert.deepEqual(observeOwnedLosses(s,[1,3],5),[2]);
 assert.equal(s.lastLostSector,2);
 assert.equal(defenseLessonsLost(s),1);
 assert.deepEqual(observeOwnedLosses(s,[1,3],5),[]);
 assert.equal(defenseLessonsLost(s),1);
 assert.deepEqual(observeOwnedLosses(s,[1,2,3],5),[]);
 assert.equal(defenseLessonsLost(s),1);
});
test('3.1: siege and maneuver lessons change actual mission utility within strict limits',()=>{
 const s=newExperience();
 const baseline=learnedMissionBias(s,'siege',2,10);
 for(let i=0;i<3;i++)recordLesson(s,'siege',2,10,false,.3);
 assert.ok(learnedMissionBias(s,'siege',2,10)>baseline);
 assert.ok(learnedMissionBias(s,'maneuver',0,10)===0);
 for(let i=0;i<8;i++)recordLesson(s,'siege',2,10,true,.9);
 assert.ok(learnedMissionBias(s,'siege',2,10)<baseline);
 assert.ok(Math.abs(learnedMissionBias(s,'siege',2,10))<=195.000001);
});
test('3.1: a successful tracked flank is recorded distinct from ordinary capture and siege',()=>{
 const s=newExperience();s.active={sector:2,tactic:'flank',guns:0,force:8,at:20,initialUnits:8,initialHP:800,progress:0};
 finishExperience(s,true,650);
 assert.equal(s.active,undefined);
 assert.equal(s.records[0].tactic,'flank');
 assert.equal(s.records[0].wins,1);
 assert.ok(lessonScore(s,'flank',0,8)>0);
 assert.equal(lessonScore(s,'maneuver',0,8),0);
});
test('3.1: flank and siege bonuses adjust viable forecasts but never enable impossible tactics',()=>{
 const allies=Array.from({length:8},(_,i)=>({id:i,kind:'heavy',hp:420}));
 const observedEnemies=Array.from({length:4},(_,i)=>({id:100+i,kind:'infantry',hp:100}));
 const context={allies,observedEnemies,knownGuns:[],storm:false};
 const base=chooseTacticalManeuver(context);
 const positive=chooseTacticalManeuver({...context,learned:{flank:.3,siege:0}});
 const flankScore=choice=>choice.forecasts.find(f=>f.mode==='flank')?.score;
 assert.equal(flankScore(positive)-flankScore(base),54);
 const noFlank=chooseTacticalManeuver({...context,observedEnemies:observedEnemies.slice(0,1),learned:{flank:100,siege:100}});
 assert.notEqual(noFlank.mode,'flank');
 assert.notEqual(noFlank.mode,'siege');
});
test('3.1: new campaigns transfer only aggregate lessons, never active missions or map IDs',()=>{
 const s=newExperience();
 recordLesson(s,'defense',0,4,false);
 recordLesson(s,'flank',0,7,true);
 s.held=[2,6];s.lastLostSector=2;
 s.active={sector:2,tactic:'siege',guns:1,force:7,at:20,initialUnits:7,initialHP:600,progress:0,objective:1900,target:{x:1400,y:2000}};
 const profile=portableExperience(s);
 assert.equal(profile.held,undefined);
 assert.equal(profile.lastLostSector,undefined);
 assert.equal(profile.active,undefined);
 assert.equal(profile.records.length,2);
 const imported=readPortableExperience(JSON.parse(JSON.stringify(profile)));
 assert.deepEqual(imported,profile);
 const g=Simulation.campaign(3104,3);
 g.tactical.state.experience=imported;
 const again=Simulation.load(g.save());
 assert.deepEqual(again.tactical.state.experience,profile);
 assert.equal(again.tactical.state.experience.held,undefined);
});
test('3.1: forged, unbounded or location-contaminated transfer profiles are rejected',()=>{
 assert.equal(readPortableExperience({version:1,records:[],active:{sector:0}}),undefined);
 assert.equal(readPortableExperience({version:1,records:[],held:[0]}),undefined);
 assert.equal(readPortableExperience({version:1,records:[],lastLostSector:0}),undefined);
 assert.equal(readPortableExperience({version:1,records:[{tactic:'flank',guns:0,force:0,wins:0,losses:0,score:1000}]}),undefined);
 const s=newExperience();
 for(let i=0;i<200;i++)recordLesson(s,'maneuver',i%4,i%20,i%2===0);
 assert.ok(s.records.length<=36);
 assert.equal(validExperience(s,10,8),true);
 assert.equal(validExperience({...s,lastLostSector:8},10,8),false);
});
