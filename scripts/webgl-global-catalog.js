/** Global production-category unlocks.
 * Show tabs only when the player owns the corresponding FINISHED facility.
 * The headquarters unlocks pioneers (Infanterie tab), the barracks expands
 * that same tab. A selected unit or building never changes tab visibility.
 * Recalculate from live bases for construction, capture, loss and save/load.
 */
export function globalCatalogAvailability(game,owner=0){
 const finished=kind=>game.bases.some(b=>b.owner===owner&&b.kind===kind&&
  b.hp>0&&b.buildRemaining<=0);
 return {
  buildings:true,
  units:['headquarters','barracks','factory','airfield'].some(finished),
  infantry:finished('headquarters')||finished('barracks'),
  vehicles:finished('factory'),
  aircraft:finished('airfield'),
  research:finished('research'),
  territories:true // accessible through the minimap sector shortcut
 };
}

export const GLOBAL_PRODUCTION_TABS=Object.freeze([
 'buildings','infantry','vehicles','aircraft','research'
]);
