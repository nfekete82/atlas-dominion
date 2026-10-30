/**
 * Observer-only artillery diagnostics for reproducible AI arena matches.
 * Never sends an order, changes a unit, or influences the AI's observations.
 * Samples are measured AFTER each simulation step, outside measured tick CPU.
 */
export function artilleryFiringState(g,u,UNITS){
 const o=u.orders[0];
 if(!o)return 'idle';
 if(o.kind==='move')return 'moving-to-waypoint';
 if(o.kind!=='attack')return 'other-order';
 const enemy=g.bases.find(e=>e.id===o.target&&e.hp>0)??g.units.find(e=>e.id===o.target&&e.hp>0&&!e.carrier);
 if(!enemy||enemy.owner===u.owner)return 'target-absent';
 if(!g.canSee(u.owner,enemy))return 'target-not-visible';
 const d=Math.hypot(u.x-enemy.x,u.y-enemy.y);
 if(d>UNITS.artillery.range)return 'out-of-range';
 const obstacles=g.obstacles().filter(b=>b.id!==enemy.id);
 if(!g.world.line(u,enemy,obstacles))return 'line-blocked';
 if(u.cooldown>0)return 'reloading';
 return 'can-fire';
}
const add=(map,k,n=1)=>{map[k]=(map[k]??0)+n;};
export function createArtilleryObserver(UNITS){
 const data={samples:0,gunSeconds:{},shots:0,shotsByTargetKind:{},shotsByTargetId:{},
  firstArtillerySeen:null,firstInRange:null,firstShot:null,firstTurretShot:null,
  attackOrderReplacements:0,attackOrderReplacementKinds:{},attackOrdersStopped:0,
  targetAttackSeconds:0,missionAttackSeconds:0,timeline:[]};
 let lastSecond=-1,lastTimeline=-1;
 const inspectOrders=(g,ids)=>{
  const map=new Map();
  for(const u of g.units)if(ids.includes(u.id)&&u.owner===1&&u.kind==='artillery'&&u.hp>0)
   map.set(u.id,u.orders[0]?.kind==='attack'?u.orders[0].target:null);
  return map;
 };
 return {
  beforeCommand:inspectOrders,
  afterCommand(g,prior,append){
   if(append)return;
   for(const [id,target] of prior)if(target!=null){
    const u=g.units.find(u=>u.id===id);
    const next=u?.orders[0];
    if(next?.kind==='attack'&&next.target===target)continue;
    data.attackOrderReplacements++;
    add(data.attackOrderReplacementKinds,next?.kind??'none');
   }
  },
  beforeStop:inspectOrders,
  afterStop(g,prior){
   for(const [id,target] of prior)if(target!=null){
    const next=g.units.find(u=>u.id===id)?.orders[0];
    if(!next||next.kind!=='attack'||next.target!==target)data.attackOrdersStopped++;
   }
  },
  shot(g,u,target){
   if(u.owner!==1||u.kind!=='artillery')return;
   data.shots++;
   add(data.shotsByTargetKind,target.kind??'unknown');
   add(data.shotsByTargetId,String(target.id));
   data.firstShot??=Number(g.time.toFixed(2));
   if(target.kind==='turret')data.firstTurretShot??=Number(g.time.toFixed(2));
  },
  sample(g){
   const second=Math.floor(g.time+1e-7);
   if(second===lastSecond)return;
   lastSecond=second;data.samples++;
   const guns=g.units.filter(u=>u.owner===1&&u.kind==='artillery'&&u.hp>0&&!u.carrier);
   if(guns.length)data.firstArtillerySeen??=second;
   let blocked=0,range=0,attacking=0;
   for(const u of guns){
    const status=artilleryFiringState(g,u,UNITS);
    add(data.gunSeconds,status);
    if(status==='line-blocked')blocked++;
    if(['can-fire','reloading','line-blocked'].includes(status)){
     range++;data.firstInRange??=second;
    }
    if(u.orders[0]?.kind==='attack'){
     attacking++;
     data.targetAttackSeconds++;
     if(g.tactical.state.commander?.mission?.objective===u.orders[0].target)data.missionAttackSeconds++;
    }
   }
   if(second%30===0&&second!==lastTimeline){
    lastTimeline=second;
    const mission=g.tactical.state.commander?.mission;
    data.timeline.push({at:second,guns:guns.length,inRange:range,lineBlocked:blocked,orderedAttack:attacking,
     shots:data.shots,attackReplacements:data.attackOrderReplacements,phase:g.tactical.state.phase,
     mission:mission?{kind:mission.kind,objective:mission.objective,sector:mission.sector,
      since:mission.since,secondsWithoutProgress:Number((g.time-mission.progressAt).toFixed(1))}:null});
   }
  },
  snapshot(){return structuredClone(data);}
 };
}
