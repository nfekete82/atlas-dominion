import {RULES,type MapVersion} from './config.js';
import type {BuildingKind} from './catalog.js';

/** Only the current four-bastion campaign. No hidden enemy intelligence,
 * free resources, or stronger AI units: RED starts planning and building sooner.
 * Classic mode exists solely for reproducible paired A/B simulation. */
export type ShortMapTempo='classic'|'responsive';
export const shortMapTempoApplies=(map:MapVersion,tempo:ShortMapTempo):boolean=>
 map===11&&tempo==='responsive';
export function aiOpeningDelay(map:MapVersion,tempo:ShortMapTempo):number{
 return shortMapTempoApplies(map,tempo)?6:RULES.aiOpeningDelay;
}
/** Opening barracks first is viable with the identical 950-credit start.
 * Once a barracks is present, the existing paid generator / factory priorities
 * take over. A threatened HQ never postpones emergency recruitment. */
export function shortMapFirstBarracks(map:MapVersion,tempo:ShortMapTempo,
 buildings:readonly {kind:BuildingKind;hp:number}[]):boolean{
 return shortMapTempoApplies(map,tempo)&&
  !buildings.some(b=>b.hp>0&&b.kind==='barracks');
}
