/**
 * Reconnect stalled 3D construction orders without changing the authoritative
 * Simulation rules or affecting original Canvas/headless AI benchmarks.
 *
 * A building only advances when its Pionier is physically at the job. Never
 * fake progress, teleport units or override an active move/repair/build queue.
 */
export class SandforgeConstructionRecovery {
 constructor(game){
  this.game=game;
  this.watch=new Map();
  this.recovered=0;
 }
 tick(){
  const g=this.game;
  if(g.paused||g.status!=='playing')return;
  const alive=new Set();
  for(const b of g.bases){
   if(b.owner!==0||b.hp<=0||b.buildRemaining<=0)continue;
   alive.add(b.id);
   const pioneers=g.units.filter(u=>u.owner===b.owner&&u.kind==='engineer'&&u.hp>0&&!u.carrier);
   const ordered=pioneers.filter(u=>u.orders.some(o=>o.kind==='build'&&o.target===b.id));
   let state=this.watch.get(b.id);
   if(!state){
    state={remaining:b.buildRemaining,lastAdvance:g.time,lastAttempt:-1e9,
      assigned:new Set(ordered.map(u=>u.id))};
    this.watch.set(b.id,state);
    continue;
   }
   for(const u of ordered)state.assigned.add(u.id);
   if(b.buildRemaining<state.remaining-.0001){
    state.remaining=b.buildRemaining;
    state.lastAdvance=g.time;
    continue;
   }
   if(g.time-state.lastAdvance<4||g.time-state.lastAttempt<5)continue;
   state.lastAttempt=g.time;
   if(ordered.length){
    // Existing job may be blocked by an outdated route or approach. Keep
    // command intent and any queued work intact; recalculate only its path.
    for(const u of ordered){
     const order=u.orders[0];
     if(order?.kind!=='build'||order.target!==b.id||u.defendUntil>g.time)continue;
     if(u.workingTarget===b.id)continue;
     u.path=[];u.repath=0;
     delete order.approach;
    }
    continue;
   }
   // When the original assigned worker became idle, resume its assignment.
   // Existing move/stop/repair queues are never replaced.
   const available=pioneers.filter(u=>u.orders.length===0&&!u.hold&&u.defendUntil<=g.time);
   let candidates=available.filter(u=>state.assigned.has(u.id));
   // Legacy saves may have lost the builder ID: only consider nearby idle
   // pioneers, never commandeer a distant worker.
   if(!candidates.length&&state.assigned.size===0)
    candidates=available.filter(u=>Math.hypot(u.x-b.x,u.y-b.y)<=b.radius+280);
   candidates.sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y)||a.id-c.id);
   const u=candidates[0];
   if(u&&g.command([u.id],{kind:'build',x:b.x,y:b.y,target:b.id})>0){
    state.assigned.add(u.id);
    this.recovered++;
    g.notices.push('Pionier nimmt den unterbrochenen Bau wieder auf.');
   }
  }
  for(const id of this.watch.keys())if(!alive.has(id))this.watch.delete(id);
 }
}
