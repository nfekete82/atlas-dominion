import {BUILDINGS} from './catalog.js';
import {buildingArtWidth} from './visual-scale.js';
import type {BuildingKind} from './catalog.js';

/** Ground-vehicle navigation must respect the *visible* base silhouette.
 * Existing Base.radius values remain unchanged for construction and combat.
 * Circle centres are slightly north of the ground anchor because the painted
 * buildings extend mostly upwards from their feet in the RTS sprite. */
export function vehicleStructureColliders(
  bases:readonly {x:number;y:number;radius:number;kind?:BuildingKind;hp?:number}[]
):{x:number;y:number;radius:number}[]{
  return bases.filter(b=>b.hp===undefined||b.hp>0).map(b=>{
    // An AI may remember a structure after its destruction outside vision.
    // Unknown types retain their exact physical clearance.
    const spec=b.kind?BUILDINGS[b.kind]:undefined;
    if(!spec)return {x:b.x,y:b.y,radius:b.radius};
    const width=buildingArtWidth(b.kind!,spec.width);
    return {x:b.x,y:b.y-Math.min(26,width*.10),radius:Math.max(b.radius,width*.50)};
  });
}
