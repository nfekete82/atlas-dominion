import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {keepEndgameBatteryFiring} from '../dist/src/reborn/tactical-ai.js';
import {newCampaign,keepCleanupTowerObjective,chooseMission} from '../dist/src/reborn/campaign-commander.js';

const good={confirmedEndgame:true,knownTurret:true,hasArtillery:true,
 missionSeconds:43,recentNearbyLosses:0,recentIntel:true};
test('5.0: only a recently observed post-HQ turret with a living rocket earns a bounded lock',()=>{
 assert.equal(keepCleanupTowerObjective(good),true);
 for(const bad of [
  {confirmedEndgame:false},{knownTurret:false},{hasArtillery:false},
  {missionSeconds:70},{missionSeconds:-1},{recentNearbyLosses:2},{recentIntel:false}
 ])assert.equal(keepCleanupTowerObjective({...good,...bad}),false,JSON.stringify(bad));
});

function missionScene(){
 const g=new Simulation(2026,5),s=newCampaign();
 const tower=g.bases.find(b=>b.owner===0&&b.kind==='turret')??{
  id:90004,kind:'turret',owner:0,territory:0,x:g.world.size*.6,y:g.world.size*.4,hp:650
 };
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 g.time=405;g.memories[1].push({...tower});
 s.enemyHQEliminatedAt=300;
 s.intel=[{id:tower.id,seenAt:400}];
 const old={kind:'structure',sector:tower.territory,objective:tower.id,
  x:tower.x,y:tower.y,hp:tower.hp,since:355,progressAt:360,distance:480};
 s.mission=old;
 const gun=g.spawn(1,{x:home.x+100,y:home.y+100},'artillery');
 const frontline=g.spawn(1,{x:home.x+120,y:home.y+100},'heavy');
 const ctx={strategy:'tower',force:[gun,frontline],losses:[],
  fronts:[{sector:tower.territory,at:400,until:430,power:100,towers:1,failures:2,x:tower.x,y:tower.y}],
  intelligent:true,route:()=>({length:600,risk:2})};
 return {g,s,old,gun,ctx,tower};
}
test('5.0: observed last turret is not discarded for a barracks after failed-front history',()=>{
 const {g,s,old,ctx}=missionScene();
 const next=chooseMission(g,s,{x:0,y:0},ctx);
 assert.equal(next,old,'keep the same tower/mission until the screen can complete a supported assault');
 assert.equal(s.aborted,0);
});
test('5.0: real losses, expired lock and stale intelligence still allow a different strategy',()=>{
 for(const variant of ['losses','expired','unseen','no-artillery','hq-present']){
  const {g,s,old,ctx,tower}=missionScene();
  if(variant==='losses')ctx.losses=[{id:2,x:tower.x,y:tower.y,at:400,strength:100},{id:3,x:tower.x,y:tower.y,at:400,strength:100}];
  if(variant==='expired')old.since=320;
  if(variant==='unseen')s.intel[0].seenAt=325;
  if(variant==='no-artillery')ctx.force=ctx.force.filter(u=>u.kind!=='artillery');
  if(variant==='hq-present')s.enemyHQEliminatedAt=undefined;
  chooseMission(g,s,{x:0,y:0},ctx);
  assert.notEqual(s.mission,old,variant+' must permit evidence-based replanning');
  assert.ok(s.aborted>0,variant);
 }
});
test('5.0: destroyed tower is not locked by a stale mission',()=>{
 const {g,s,old,ctx,tower}=missionScene();
 g.memories[1]=g.memories[1].filter(m=>m.id!==tower.id);
 chooseMission(g,s,{x:0,y:0},ctx);
 assert.notEqual(s.mission,old);
});

test('5.0: only observed healthy batteries beyond turret range keep firing during regroup',()=>{
 const x={confirmedEndgame:true,visibleTurret:true,livingGun:true,healthyGun:true,
  distanceToTurret:650,turretRange:600,artilleryRange:680,
  clearLine:true,mobileThreat:false};
 assert.equal(keepEndgameBatteryFiring(x),true);
 for(const bad of [
  {confirmedEndgame:false},{visibleTurret:false},{livingGun:false},
  {healthyGun:false},{distanceToTurret:620},{distanceToTurret:710},
  {clearLine:false},{mobileThreat:true}
 ])assert.equal(keepEndgameBatteryFiring({...x,...bad}),false,JSON.stringify(bad));
});
