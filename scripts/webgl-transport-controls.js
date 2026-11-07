/** WebGL hit routing is UI-only; the Simulation remains responsible for
 * transport capacity, pathfinding, transfer, destruction, and savegames. */
export const BOARDABLE_INFANTRY=new Set(['infantry','medic','engineer','heavy']);
export function selectedInfantryForTransport(units,selected,carrier){
 if(!carrier||!['rover','scout'].includes(carrier.kind)||carrier.hp<=0||carrier.carrier)return [];
 const chosen=selected instanceof Set?selected:new Set(selected??[]);
 return units.filter(u=>chosen.has(u.id)&&u.id!==carrier.id&&u.owner===carrier.owner&&
  u.hp>0&&!u.carrier&&BOARDABLE_INFANTRY.has(u.kind)).map(u=>u.id);
}
export function selectedLoadedRovers(units,selected){
 const chosen=selected instanceof Set?selected:new Set(selected??[]);
 return units.filter(u=>chosen.has(u.id)&&u.kind==='rover'&&u.owner===0&&u.hp>0&&
  !u.carrier&&(u.transport?.cargo?.length??0)>0);
}
