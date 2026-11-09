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
export function nearestEngineer(units,origin,owner=0){
 return units.filter(u=>u.owner===owner&&u.kind==='engineer'&&u.hp>0&&!u.carrier)
  .sort((a,b)=>{
   const da=(a.x-origin.x)**2+(a.y-origin.y)**2;
   const db=(b.x-origin.x)**2+(b.y-origin.y)**2;
   return da-db||a.id-b.id;
  })[0]??null;
}
