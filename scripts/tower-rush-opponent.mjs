/** Atlas benchmark doctrine. Uses only paid public game commands. */
export function rushPolicy(goal,metrics,UNITS){
 let constructed=0;
 return g=>{
  if(!metrics.initialized){
   metrics.initialized=true;const build=g.build.bind(g),damage=g.damage.bind(g),pending=new Map(),responded=new Set();
   g.build=(owner,kind,p,ids)=>{const before=g.credits[owner],b=build(owner,kind,p,ids);if(b&&owner===0&&kind==='turret'){constructed++;metrics.towersOrdered++;metrics.blueTowerCredits+=before-g.credits[owner];}return b;};
   g.damage=(source,target,amount,weapon,...rest)=>{
    const victim=weapon==='turret'&&source.owner===0&&target.owner===1&&'orders' in target;
    if(victim){metrics.turretHits++;metrics.turretDamage+=Math.min(amount,target.hp);if(!pending.has(target.id)&&!responded.has(target.id))pending.set(target.id,g.time);}
    const oldOrders=victim?target.orders:null;const out=damage(source,target,amount,weapon,...rest);
    if(victim&&pending.has(target.id)&&target.orders!==oldOrders&&target.hp>0&&target.orders[0]?.kind==='move'&&target.orders[0]?.tactical?.mode==='safe'){
     metrics.immediateResponses++;metrics.responseLatency.push(g.time-pending.get(target.id));pending.delete(target.id);responded.add(target.id);
    }return out;
   };
  }
  const own=g.bases.filter(b=>b.owner===0&&b.hp>0),home=own.find(b=>b.kind==='headquarters');if(!home)return;
  metrics.peakTowers=Math.max(metrics.peakTowers,own.filter(b=>b.kind==='turret'&&b.buildRemaining<=0).length);
  if(metrics.peakTowers>=goal)metrics.allTowersReadyAt??=Number(g.time.toFixed(2));
  const worker=g.units.find(u=>u.owner===0&&u.kind==='engineer'&&u.hp>0&&!u.carrier);
  if(!worker){if(!home.queueTypes.includes('engineer'))g.recruit(home.id,'engineer');return;}
  const hold=g.territories[home.territory].point;
  for(const u of g.units.filter(u=>u.owner===0&&u.hp>0&&['infantry','heavy'].includes(u.kind)))if(!u.orders.length&&Math.hypot(u.x-hold.x,u.y-hold.y)>70)g.command([u.id],{...hold,kind:'attackMove'});
  if(own.some(b=>b.buildRemaining>0)||worker.orders.some(o=>o.kind==='build'))return;
  const kind=constructed<goal?'turret':!own.some(b=>b.kind==='barracks')?'barracks':null;
  if(kind){
   // Public sector control guides the forward orientation; no hidden HQ lookup.
   const front=g.territories.filter(t=>t.owner===1).sort((a,b)=>Math.hypot(a.point.x-hold.x,a.point.y-hold.y)-Math.hypot(b.point.x-hold.x,b.point.y-hold.y))[0]?.point??hold;
   const sites=[];for(const t of g.territories.filter(t=>t.owner===0))for(let y=t.point.y-330;y<t.point.y+331;y+=55)for(let x=t.point.x-330;x<t.point.x+331;x+=55){const p={x,y};if(!g.buildError(0,kind,p))sites.push(p);}
   sites.sort((a,b)=>Math.hypot(a.x-front.x,a.y-front.y)-Math.hypot(b.x-front.x,b.y-front.y));
   for(const p of sites.slice(0,8))if(g.build(0,kind,p,[worker.id]))break;
  }
  const barracks=own.find(b=>b.kind==='barracks'&&b.buildRemaining<=0&&b.queue.length<2);
  if(barracks){const roster=g.units.filter(u=>u.owner===0&&u.hp>0),n=k=>roster.filter(u=>u.kind===k).length+own.reduce((s,b)=>s+b.queueTypes.filter(v=>v===k).length,0);const unit=n('infantry')<5?'infantry':n('heavy')<1?'heavy':null;if(unit&&g.credits[0]>=UNITS[unit].cost)g.recruit(barracks.id,unit);}
 };
}
