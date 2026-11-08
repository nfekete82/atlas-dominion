/** Elimination is the only result trigger.
 * A lost headquarters, lack of engineers, controlled sectors, or an empty
 * production queue is a tactical disadvantage, not destruction of the army.
 *
 * Keep boarded troops: their carrier flag must never hide them from defeat
 * checks. Unfinished construction counts as long as HP remains positive.
 * Destroyed legacy HQ records deliberately remain in bases at HP=0 and do
 * NOT count. This pure function is independent of renderer and save format.
 */
export interface FactionAsset {
 owner:number;
 hp:number;
 carrier?:number;
 buildRemaining?:number;
}
export type MatchOutcome='playing'|'victory'|'defeat';
export function hasFactionAssets(
 units:readonly FactionAsset[],bases:readonly FactionAsset[],owner:0|1
):boolean {
 return units.some(u=>u.owner===owner&&u.hp>0)||
  bases.some(b=>b.owner===owner&&b.hp>0);
}
export function eliminationOutcome(
 units:readonly FactionAsset[],bases:readonly FactionAsset[]
):MatchOutcome {
 // Simultaneous mutual elimination cannot be called a player victory.
 // The existing save/status schema has no draw state; prefer defeat.
 if(!hasFactionAssets(units,bases,0))return 'defeat';
 if(!hasFactionAssets(units,bases,1))return 'victory';
 return 'playing';
}
