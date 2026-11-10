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
