import {BUILDINGS,type BuildingKind} from './catalog.js';
import {buildingArtWidth} from './visual-scale.js';

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
