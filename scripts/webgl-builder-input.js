/** Pure RTS pointer semantics: a click jitter must not disarm a builder.
 * Construction and rally drags must NEVER become a box-select gesture.
 */
export const POINTER_CLICK_SLOP=12;
export const PLACEMENT_CLICK_SLOP=24;
export function pointerGestureIntent({distance,button,building=false,rally=false,strategic=false}){
 if(button!==0)return distance<=POINTER_CLICK_SLOP?'click':'ignore-drag';
 if(distance<=POINTER_CLICK_SLOP)return 'click';
 if(building||rally||strategic)
  return distance<=PLACEMENT_CLICK_SLOP?'click':'ignore-drag';
 return 'selection-box';
}
export function availableEngineers(units,selection,owner=0){
 return units.filter(u=>u.owner===owner&&u.kind==='engineer'&&u.hp>0&&
  !u.carrier&&selection.has(u.id));
}
export function shouldAppendBuild(workers,shift=false){
 return Boolean(shift||workers.some(u=>u.orders?.some(o=>o.kind==='build')));
}
/** Choosing a build crew must not queue a new site behind a busy pioneer
 * while a second selected pioneer is idle. Shift explicitly queues for all.
 * Without Shift, use all free builders immediately; if everyone is working,
 * queue for the pioneer with the shortest existing order list.
 */
export function chooseConstructionCrew(workers,shift=false){
 if(!workers.length)return {workers:[],append:false};
 if(shift)return {workers,append:true};
 const free=workers.filter(u=>!u.orders?.some(o=>o.kind==='build'));
 if(free.length)return {workers:free,append:false};
 const waiting=[...workers].sort((a,b)=>
  (a.orders?.length??0)-(b.orders?.length??0)||a.id-b.id);
 return {workers:[waiting[0]],append:true};
}

/** Reliable WebGL build commit. A pioneer can be inside the newly finished
 * airfield/factory, have an obsolete 'build' order, or be unable to reach a
 * particular side of the next building. Never lock the whole building menu
 * to that one worker. Prefer currently selected idle pioneers, then any
 * other free friendly pioneer, then queue on a busy one. Retry a different
 * real worker if the simulation's supportApproach rejects the first.
 *
 * The authoritative Simulation.build()/buildError() remains in control of
 * credits, uniqueness, terrain, rotation, collision and map borders. No
 * temporary buildings, teleports, bypasses or phantom construction.
 */
export function submitConstruction(game,kind,point,selection,facing=0,shift=false,owner=0){
 const all=(game.units??[]).filter(u=>u.owner===owner&&u.kind==='engineer'&&
  u.hp>0&&!u.carrier);
 if(!all.length)return {base:null,workers:[],append:false,
  reason:'Kein lebender Pionier verfügbar'};
 const selected=all.filter(u=>selection.has(u.id));
 const inProgress=new Set((game.bases??[]).filter(b=>b.hp>0&&b.buildRemaining>0)
  .map(b=>b.id));
 const busy=u=>(u.orders??[]).some(o=>o.kind==='build'&&inProgress.has(o.target));
 const ordered=(units)=>[...units].sort((a,b)=>
  (a.x-point.x)**2+(a.y-point.y)**2-
  ((b.x-point.x)**2+(b.y-point.y)**2)||a.id-b.id);
 const plans=[];
 if(shift){
  const chosen=selected.length?selected:ordered(all).slice(0,1);
  plans.push({workers:chosen,append:true});
 }else{
  const freeSelected=ordered(selected.filter(u=>!busy(u)));
  const freeOthers=ordered(all.filter(u=>!selection.has(u.id)&&!busy(u)));
  if(freeSelected.length)plans.push({workers:freeSelected,append:false});
  for(const u of freeSelected)plans.push({workers:[u],append:false});
  for(const u of freeOthers)plans.push({workers:[u],append:false});
  // If all pioneers are already building, CREATE the next site with a
  // queued order instead of making the UI look permanently disabled.
  for(const u of ordered(selected.filter(busy)))plans.push({workers:[u],append:true});
  for(const u of ordered(all.filter(u=>!selection.has(u.id)&&busy(u))))
   plans.push({workers:[u],append:true});
 }
 let tried=0;
 for(const plan of plans){
  tried++;
  const base=game.build(owner,kind,point,plan.workers.map(u=>u.id),
   facing,plan.append);
  if(base)return {...plan,base,reason:null,tried};
 }
 return {base:null,workers:[],append:false,tried,
  reason:'Kein Pionier kann diesen Bauplatz erreichen – anderen Standort versuchen'};
}

/** Runways must fit inside the real desert boundary. Unlike a 116-unit
 * collision circle, a 980-unit runway extends far beyond its hangar.
 * Check its four actual rotated footprint corners before accepting a click.
 * This is visual placement validation only; the simulation's pathfinding,
 * saved game and old sites retain their existing collision footprint.
 */
export function airfieldRunwayPlacementError(point,facing,size){
 if(!point||!Number.isFinite(size)||size<=0)return null;
 const angle=[0,Math.PI,Math.PI/2,Math.PI*1.5][facing??0]??0;
 const cs=Math.cos(angle),sn=Math.sin(angle);
 for(const x of [-242,215])for(const z of [-326,680]){
  const wx=point.x+x*cs+z*sn;
  const wz=point.y-x*sn+z*cs;
  if(wx<12||wz<12||wx>size-12||wz>size-12)
   return 'Die lange Landebahn würde über den Kartenrand hinausragen.';
 }
 return null;
}

export function nearestEngineer(units,origin,owner=0){
 return units.filter(u=>u.owner===owner&&u.kind==='engineer'&&u.hp>0&&!u.carrier)
  .sort((a,b)=>{
   const da=(a.x-origin.x)**2+(a.y-origin.y)**2;
   const db=(b.x-origin.x)**2+(b.y-origin.y)**2;
   return da-db||a.id-b.id;
  })[0]??null;
}
