import {BUILDINGS,type BuildingKind} from './catalog.js';
import {buildingArtWidth} from './visual-scale.js';
import {distance,type Point} from './config.js';

/** Conservative radius of the *painted* façade projected onto the ground.
 * Do not let new buildings overlap visibly even though build circles are smaller.
 * Gameplay geometry for existing buildings and saves stays unchanged. */
export function buildingVisualRadius(kind:BuildingKind):number{
 const s=BUILDINGS[kind];
 return Math.max(s.radius,buildingArtWidth(kind,s.width)*.41);
}
export function constructionVisualClearance(a:BuildingKind,b:BuildingKind):number{
 const left=BUILDINGS[a],right=BUILDINGS[b];
 return Math.max(left.radius+right.radius+24,
   buildingVisualRadius(a)+buildingVisualRadius(b)+24);
}

/** Lower = preferable. A healthy ring around the base is better than a wall
 * of nearly touching prefabs, but long hikes and remote unguarded towers lose. */
export function aiBuildSiteScore(p:Point,kind:BuildingKind,home:Point,worker:Point,
 existing:readonly (Point&{kind:BuildingKind;hp:number})[]):number{
 const nearby=existing.filter(b=>b.hp>0);
 const open=nearby.length?Math.min(...nearby.map(b=>distance(p,b)-constructionVisualClearance(kind,b.kind))):400;
 return distance(p,home)*.42+distance(p,worker)*.18+
   Math.max(0,130-open)*3.2;
}
