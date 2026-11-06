import {BUILDINGS} from './catalog.js';
import type {BuildingKind} from './catalog.js';
import {buildingArtWidth} from './visual-scale.js';
import type {Base} from './simulation.js';

/** The same facade footprint is used by navigation and construction placement. */
export function infantryStructureCollider(kind:BuildingKind,point:{x:number;y:number},radius=BUILDINGS[kind].radius):{x:number;y:number;radius:number}{
 const spec=BUILDINGS[kind],width=buildingArtWidth(kind,spec.width);
 return {x:point.x,y:point.y-Math.min(26,width*.10),radius:Math.max(radius,width*.43)};
}

/** Infantries' feet must not cut through baked building walls.
 * Building combat/build radii remain unchanged; this is ground navigation only.
 * Shapes are slightly narrower than vehicle clearance so workers can still
 * reach the repair/construction interaction ring, including large airfields. */
export function infantryStructureColliders(bases:readonly Base[]):{x:number;y:number;radius:number}[]{
 return bases.filter(b=>b.hp>0).map(b=>infantryStructureCollider(b.kind,b,b.radius));
}
