import {BUILDINGS} from './catalog.js';
import {buildingArtWidth} from './visual-scale.js';
import type {Base} from './simulation.js';

/** Ground-vehicle navigation must respect the *visible* base silhouette.
 * Existing Base.radius values remain unchanged for construction and combat.
 * Circle centres are slightly north of the ground anchor because the painted
 * buildings extend mostly upwards from their feet in the RTS sprite. */
export function vehicleStructureColliders(bases:readonly Base[]):{x:number;y:number;radius:number}[]{
  return bases.filter(b=>b.hp>0).map(b=>{
    const width=buildingArtWidth(b.kind,BUILDINGS[b.kind].width);
    return {x:b.x,y:b.y-Math.min(26,width*.10),radius:Math.max(b.radius,width*.50)};
  });
}
