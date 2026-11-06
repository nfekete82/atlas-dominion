import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hqConfirmationGate,batteryGate,createEndgameObserver} from '../scripts/ai-51-endgame-observer.mjs';
import {endgameReport} from '../scripts/ai-51-endgame-report.mjs';

test('5.1: exhaustive, ordered, observable HQ confirmation gate reasons',()=>{
 assert.equal(hqConfirmationGate({}),'hq-not-yet-observed');
 assert.equal(hqConfirmationGate({observed:true}),'hq-coordinate-out-of-sight');
 assert.equal(hqConfirmationGate({observed:true,locationVisible:true,rememberedHq:true}),'hq-still-in-memory');
 assert.equal(hqConfirmationGate({observed:true,locationVisible:true,visibleLiveHq:true}),'hq-visibly-alive');
 assert.equal(hqConfirmationGate({observed:true,locationVisible:true}),'confirmation-eligible-awaiting-ai-pulse');
 assert.equal(hqConfirmationGate({confirmed:true}),'confirmed');
});
test('5.1: first-failed artillery gate does not call an absent endgame a safe shot',()=>{
 const x={confirmed:true,missionTower:true,towerVisible:true,continuing:false,healthyGuns:1,safeGuns:1};
 assert.equal(batteryGate(x),'eligible-to-preserve-fire');
 for(const [bad,reason] of [
  [{confirmed:false},'hq-not-confirmed'],
  [{missionTower:false},'mission-not-observed-turret'],
  [{towerVisible:false},'turret-not-currently-visible'],
  [{continuing:true},'attack-already-in-progress'],
  [{healthyGuns:0},'no-healthy-artillery'],
  [{safeGuns:0},'no-safe-firing-lane']
 ])assert.equal(batteryGate({...x,...bad}),reason);
});
function scene(){
 const hq={id:1000,owner:0,kind:'headquarters',hp:1200,x:500,y:500};
 const tower={id:1004,owner:0,kind:'turret',hp:650,x:700,y:500};
 const gun={id:22,owner:1,kind:'artillery',hp:340,x:42,y:500,carrier:false,
  orders:[{kind:'attack',target:1004,x:700,y:500}]};
 const state={phase:'gather',group:[],knownTurrets:[{id:1004,range:600}],
  commander:{phase:'buildup',observedEnemyHQ:{id:1000,x:500,y:500},
   mission:{kind:'structure',sector:0,objective:1004,since:100,progressAt:180},aborted:0}};
 const g={time:200,units:[gun],bases:[hq,tower],memories:[[],[hq,tower]],
  tactical:{state},canSee:()=>false,world:{line:()=>true},obstacles:()=>[]};
 return {g,hq,tower,gun,state};
}
test('5.1: observer sees a dead real HQ without leaking the truth to commander',()=>{
 const {g,hq,state}=scene(),obs=createEndgameObserver(hq.id,{artillery:{hp:340,range:680}});
 const original=JSON.stringify(state);
 obs.sample(g);
 g.time=201;hq.hp=0;obs.sample(g);obs.sample(g);
 assert.equal(obs.snapshot().worldHqDownSeconds,1);
 assert.equal(obs.snapshot().unconfirmedAfterWorldHqDownSeconds,1);
 assert.equal(obs.snapshot().confirmationReasonsAfterActualDestruction['hq-coordinate-out-of-sight'],1);
 assert.equal(obs.snapshot().batteryReasonsAfterActualDestruction['hq-not-confirmed'],1);
 assert.equal(obs.snapshot().samplingSeconds,2,'no repeated sample in same simulated second');
 assert.equal(JSON.stringify(state),original,'the observer must never set enemyHQEliminatedAt or a command');
});
test('5.1: confirmed HQ and seen turret record battery window and mission changes',()=>{
 const {g,hq,tower,state,gun}=scene();
 const obs=createEndgameObserver(hq.id,{artillery:{hp:340,range:680}});
 hq.hp=0;g.canSee=()=>true;g.memories[1]=[tower];
 state.commander.enemyHQEliminatedAt=195;
 g.time=210;obs.sample(g);
 assert.equal(obs.snapshot().batteryReasonsAfterActualDestruction['eligible-to-preserve-fire'],1);
 assert.equal(obs.snapshot().firstConfirmedHqGone,210);
 state.commander.mission={...state.commander.mission,objective:1002};
 state.commander.aborted=2;g.time=211;obs.sample(g);
 assert.equal(obs.snapshot().postHqMissionChanges,1);
 assert.equal(obs.snapshot().postHqAbortedIncrements,2);
 assert.equal(obs.snapshot().batteryReasonsAfterActualDestruction['mission-not-observed-turret'],1);
});
test('5.1: report explicitly separates genuine HQ destruction from confirmed commander endgame',()=>{
 const record=(seed,confirmed)=>({
  mapVersion:5,seed,mode:'director',outcome:'timeout',firstEnemyHQDestroyed:289.5,
  endgameTelemetry:{
   firstWorldHqGone:290,firstConfirmedHqGone:confirmed?310:null,
   samplingSeconds:420,unconfirmedAfterWorldHqDownSeconds:confirmed?20:130,
   postHqMissionChanges:3,postHqAbortedIncrements:4,
   confirmationReasonsAfterActualDestruction:{'hq-coordinate-out-of-sight':130},
   batteryReasonsAfterActualDestruction:{'hq-not-confirmed':130},
   commanderPhasesAfterWorldHqDown:{buildup:130}
  }
 });
 const {summary,markdown}=endgameReport({complete:true,modes:['director'],details:[record(2026,false),record(2033,true)]});
 assert.equal(summary.timeoutsWithHqDestroyed,2);
 assert.equal(summary.timeoutsWithHqDestroyedUnconfirmed,1);
 assert.match(markdown,/289.5/);
 assert.match(markdown,/hq-coordinate-out-of-sight/);
 assert.throws(()=>endgameReport({complete:true,modes:['director'],details:[{outcome:'timeout'}]}),/Missing/);
});
