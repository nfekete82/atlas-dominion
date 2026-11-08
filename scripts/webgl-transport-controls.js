/** WebGL hit routing is UI-only; the Simulation remains responsible for
 * transport capacity, pathfinding, transfer, destruction, and savegames. */
export const BOARDABLE_INFANTRY=new Set(['infantry','medic','engineer','heavy']);
export function selectedInfantryForTransport(units,selected,carrier){
 if(!carrier||!['rover','scout'].includes(carrier.kind)||carrier.hp<=0||carrier.carrier)return [];
 const chosen=selected instanceof Set?selected:new Set(selected??[]);
 return units.filter(u=>chosen.has(u.id)&&u.id!==carrier.id&&u.owner===carrier.owner&&
  u.hp>0&&!u.carrier&&BOARDABLE_INFANTRY.has(u.kind)).map(u=>u.id);
}
export function selectedLoadedTransports(units,selected){
 const chosen=selected instanceof Set?selected:new Set(selected??[]);
 return units.filter(u=>chosen.has(u.id)&&['rover','scout'].includes(u.kind)&&u.owner===0&&u.hp>0&&
  !u.carrier&&(u.transport?.cargo?.length??0)>0);
}
// Backwards-compatible alias for existing Humvee acceptance tests.
export const selectedLoadedRovers=selectedLoadedTransports;

/** Passenger slots reflect the actual authoritative cargo array, never
 * proximity on the ground or pending pickup orders. Stable IDs survive
 * boarding, an individual unload and save/load. */
export function selectedTransportManifest(units,selected){
 const chosen=selected instanceof Set?selected:new Set(selected??[]);
 if(chosen.size!==1)return null;
 const carrier=units.find(u=>chosen.has(u.id)&&u.owner===0&&u.hp>0&&
  !u.carrier&&['rover','scout'].includes(u.kind));
 if(!carrier)return null;
 const capacity=carrier.kind==='scout'?10:4;
 const ids=carrier.transport?.cargo??[];
 const slots=Array.from({length:capacity},(_,i)=>{
  const passenger=units.find(u=>u.id===ids[i]&&u.carrier===carrier.id&&u.hp>0);
  return passenger?{id:passenger.id,kind:passenger.kind,hp:passenger.hp}:null;
 });
 return {carrier,capacity,occupied:slots.filter(Boolean).length,slots};
}
