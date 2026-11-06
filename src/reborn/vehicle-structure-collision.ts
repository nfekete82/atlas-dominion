import {BUILDINGS} from './catalog.js';
import type {BuildingKind} from './catalog.js';
import {buildingArtWidth} from './visual-scale.js';
import type {Base} from './simulation.js';

/** Share the exact visible vehicle wall with construction placement. */
export function vehicleStructureCollider(kind:BuildingKind,point:{x:number;y:number},radius=BUILDINGS[kind].radius):{x:number;y:number;radius:number}{
 const spec=BUILDINGS[kind],width=buildingArtWidth(kind,spec.width);
 return {x:point.x,y:point.y-Math.min(26,width*.10),radius:Math.max(radius,width*.50)};
}

/** Ground-vehicle navigation must respect the *visible* base silhouette.
 * Existing Base.radius values remain unchanged for construction and combat.
 * Circle centres are slightly north of the ground anchor because the painted
 * buildings extend mostly upwards from their feet in the RTS sprite. */
export function vehicleStructureColliders(bases:readonly Base[]):{x:number;y:number;radius:number}[]{
  return bases.filter(b=>b.hp>0).map(b=>vehicleStructureCollider(b.kind,b,b.radius));
}
