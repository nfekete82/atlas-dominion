import type {MapVersion,Point} from './config.js';

/** Physical footprint of the WebGL bastion's visible 116-unit-wide tower.
 * 55+infantry radius 10 leaves a walkable 65–95 capture annulus.
 * Older map versions keep their original obstacle and save geometry.
 * This affects navigation only; it never modifies the static World grid. */
export const BASTION_NAVIGATION_RADIUS=55;
export function bastionStructureColliders(
 territories:readonly {point:Point}[],version:MapVersion
):{x:number;y:number;radius:number}[]{
 if(version<19)return [];
 return territories.map(t=>({x:t.point.x,y:t.point.y,radius:BASTION_NAVIGATION_RADIUS}));
}
