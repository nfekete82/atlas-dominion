import {RULES,type MapVersion} from './config.js';
import type {BuildingKind} from './catalog.js';

/** Only the current four-bastion campaign. No hidden enemy intelligence,
 * free resources, or stronger AI units: RED starts planning and building sooner.
 * Classic mode exists solely for reproducible paired A/B simulation. */
export type ShortMapTempo='classic'|'responsive'|'prepared';
export const shortMapTempoApplies=(map:MapVersion,tempo:ShortMapTempo):boolean=>
 map===11&&tempo!=='classic';
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

/** The first version attacked with a lone soldier and lost more men.
 * Stage a paid two-soldier opening unless the opponent is already attacking
 * our visible home. At 38 seconds the gate expires to prevent a deadlock if
 * a barracks was destroyed or the builder is stuck. */
export function waitForOpeningScreen(map:MapVersion,tempo:ShortMapTempo,
 elapsed:number,combatReady:number,homeThreat:boolean):boolean{
 return map===11&&tempo==='prepared'&&elapsed<38&&combatReady<2&&!homeThreat;
}
