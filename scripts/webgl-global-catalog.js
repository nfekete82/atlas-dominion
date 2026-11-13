/** Global production-category unlocks for the 3D HUD.
 * The three main tabs remain visible, but unavailable producers disable
 * the matching category. The aggregate Units tab exposes only unit subtypes
 * backed by a FINISHED headquarters, barracks, factory or airfield.
 * Always recalculate from actual game state, including after save/load.
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
 'buildings','units','research'
]);
