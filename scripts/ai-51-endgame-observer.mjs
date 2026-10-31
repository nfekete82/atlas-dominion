/**
 * Passive, observer-only endgame forensics in 1-second simulation samples.
 * WORLD TRUTH is used ONLY by this offline benchmark and is NEVER handed
 * back to the controller or persisted in game save state.
 */
const add=(map,key,n=1)=>{map[key]=(map[key]??0)+n;};
const round=n=>Math.round(n*100)/100;
export function hqConfirmationGate({
 confirmed=false,observed=false,locationVisible=false,rememberedHq=false,visibleLiveHq=false
}={}){
 if(confirmed)return 'confirmed';
 if(!observed)return 'hq-not-yet-observed';
 if(!locationVisible)return 'hq-coordinate-out-of-sight';
 if(rememberedHq)return 'hq-still-in-memory';
 if(visibleLiveHq)return 'hq-visibly-alive';
 return 'confirmation-eligible-awaiting-ai-pulse';
}
export function batteryGate({
 confirmed=false,missionTower=false,towerVisible=false,continuing=false,
 healthyGuns=0,safeGuns=0
}={}){
 if(!confirmed)return 'hq-not-confirmed';
 if(!missionTower)return 'mission-not-observed-turret';
 if(!towerVisible)return 'turret-not-currently-visible';
 if(continuing)return 'attack-already-in-progress';
 if(healthyGuns===0)return 'no-healthy-artillery';
 if(safeGuns===0)return 'no-safe-firing-lane';
 return 'eligible-to-preserve-fire';
}
export function createEndgameObserver(initialHQId,UNITS){
 const data={
  samplingSeconds:0,firstWorldHqGone:null,firstCommanderHqObserved:null,
  firstConfirmedHqGone:null,firstWorldHqSeen:null,
  worldHqDownSeconds:0,unconfirmedAfterWorldHqDownSeconds:0,
  confirmationReasonsAfterActualDestruction:{},batteryReasonsAfterActualDestruction:{},
  missionKindsAfterWorldHqDown:{},commanderPhasesAfterWorldHqDown:{},
  tacticalPhasesAfterWorldHqDown:{},artilleryAttackOrderSecondsAfterWorldHqDown:0,
  postHqMissionChanges:0,postHqAbortedIncrements:0,
  timeline:[]
 };
 let lastSecond=-1,lastMissionKey=null,lastAborted=0,lastTimeline=-1;
 const snapshot=()=>structuredClone(data);
 return {snapshot,sample(g){
  const second=Math.floor(g.time+1e-7);
  if(second===lastSecond)return;
  lastSecond=second;data.samplingSeconds++;
  const c=g.tactical?.state?.commander??null,s=g.tactical?.state??{};
  const enemyHq=g.bases?.find(b=>b.id===initialHQId&&b.owner===0&&b.hp>0);
  const worldGone=initialHQId!==undefined&&!enemyHq;
  const known=c?.observedEnemyHQ??null;
  const confirmed=c?.enemyHQEliminatedAt!==undefined&&c?.enemyHQEliminatedAt!==null;
  const visibleCoord=!!known&&g.canSee(1,known);
  const memoryHq=!!known&&g.memories?.[1]?.some(m=>m.id===known.id&&m.owner===0&&m.kind==='headquarters'&&m.hp>0);
  const visibleLiveHq=!!known&&g.bases?.some(b=>b.id===known.id&&b.owner===0&&b.hp>0&&g.canSee(1,b));
  const hqReason=hqConfirmationGate({confirmed,observed:!!known,locationVisible:visibleCoord,
   rememberedHq:memoryHq,visibleLiveHq});
  if(known)data.firstCommanderHqObserved??=second;
  if(enemyHq&&g.canSee(1,enemyHq))data.firstWorldHqSeen??=second;
  if(confirmed)data.firstConfirmedHqGone??=second;
  if(worldGone)data.firstWorldHqGone??=second;
  const mission=c?.mission??null;
  const missionKey=mission?[mission.kind,mission.sector,mission.objective].join(':'):'none';
  const aborted=c?.aborted??0;
  const guns=(g.units??[]).filter(u=>u.owner===1&&u.kind==='artillery'&&u.hp>0&&!u.carrier);
  const orderedArtillery=guns.filter(u=>u.orders?.[0]?.kind==='attack').length;
  const rememberedTower=mission?.objective!=null?g.memories?.[1]?.find(m=>m.id===mission.objective&&m.kind==='turret'&&m.owner===0&&m.hp>0):null;
  const towerVisible=!!rememberedTower&&g.canSee(1,rememberedTower);
  let healthy=0,safe=0;
  if(worldGone){
   data.worldHqDownSeconds++;
   if(!confirmed){data.unconfirmedAfterWorldHqDownSeconds++;add(data.confirmationReasonsAfterActualDestruction,hqReason);}
   add(data.missionKindsAfterWorldHqDown,mission?.kind??'none');
   add(data.commanderPhasesAfterWorldHqDown,c?.phase??'none');
   add(data.tacticalPhasesAfterWorldHqDown,s.phase??'none');
   data.artilleryAttackOrderSecondsAfterWorldHqDown+=orderedArtillery;
   if(lastMissionKey!==null&&missionKey!==lastMissionKey)data.postHqMissionChanges++;
   if(aborted>lastAborted)data.postHqAbortedIncrements+=aborted-lastAborted;
   if(confirmed&&towerVisible){
    const blockers=typeof g.obstacles==='function'?g.obstacles().filter(o=>o.id!==rememberedTower.id):[];
    for(const gun of guns){
     if(gun.hp<(UNITS.artillery?.hp??Infinity)*.7)continue;
     healthy++;
     const d=Math.hypot(gun.x-rememberedTower.x,gun.y-rememberedTower.y);
     const turretRange=g.tactical?.state?.knownTurrets?.find(t=>t.id===rememberedTower.id)?.range??600;
     const mobileThreat=g.units.some(e=>e.owner===0&&e.hp>0&&!e.carrier&&g.canSee(1,e)
      &&Math.hypot(gun.x-e.x,gun.y-e.y)<(UNITS[e.kind]?.range??0)+90);
     if(d>turretRange+25&&d<=(UNITS.artillery?.range??0)-10
      &&g.world?.line(gun,rememberedTower,blockers,10)&&!mobileThreat)safe++;
    }
   }
   add(data.batteryReasonsAfterActualDestruction,batteryGate({
    confirmed,missionTower:!!rememberedTower,towerVisible,
    continuing:s.phase==='attack'&&(s.group?.length??0)>0,healthyGuns:healthy,safeGuns:safe}));
  }
  lastMissionKey=missionKey;lastAborted=aborted;
  if(second%30===0&&lastTimeline!==second){
   lastTimeline=second;
   data.timeline.push({at:second,worldHqGone:worldGone,hqConfirmation:hqReason,
    mission:mission?{kind:mission.kind,sector:mission.sector,objective:mission.objective,
     age:round(g.time-mission.since),progressAge:round(g.time-mission.progressAt)}:null,
    commanderPhase:c?.phase??null,tacticalPhase:s.phase??null,
    fighters:g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier&&!['engineer','medic','scout'].includes(u.kind)).length,
    guns:guns.length,artilleryAttackOrders:orderedArtillery,
    currentGroupSize:s.group?.length??0,confirmationFlag:confirmed,healthyGuns:healthy,safeGuns:safe,
    commanderAborted:aborted});
  }
 }};
}
