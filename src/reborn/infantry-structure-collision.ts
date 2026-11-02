import {BUILDINGS} from './catalog.js';
import {buildingArtWidth} from './visual-scale.js';
import type {Base} from './simulation.js';

/** Infantries' feet must not cut through baked building walls.
 * Building combat/build radii remain unchanged; this is ground navigation only.
 * Shapes are slightly narrower than vehicle clearance so workers can still
 * reach the repair/construction interaction ring, including large airfields. */
export function infantryStructureColliders(bases:readonly Base[]):{x:number;y:number;radius:number}[]{
 return bases.filter(b=>b.hp>0).map(b=>{
  const width=buildingArtWidth(b.kind,BUILDINGS[b.kind].width);
  return {x:b.x,y:b.y-Math.min(26,width*.10),radius:Math.max(b.radius,width*.43)};
 });
}
