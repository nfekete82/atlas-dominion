import {BUILDINGS,type BuildingKind} from './catalog.js';
import {buildingArtWidth} from './visual-scale.js';

/** Major structures reserve enough space for their enlarged, on-screen artwork. */
const majorBuildings:ReadonlySet<BuildingKind>=new Set(['headquarters','barracks','factory','airfield']);
export const MAJOR_BUILDING_GAP=36;
export const STANDARD_BUILDING_GAP=24;

/** Placement-only radius. Unit collisions and pathfinding retain the gameplay radius. */
export function buildingPlacementRadius(kind:BuildingKind):number {
  const spec=BUILDINGS[kind];
  return majorBuildings.has(kind)
    ? Math.max(spec.radius,buildingArtWidth(kind,spec.width)*.5)
    : spec.radius;
}

/** Minimum centre-to-centre distance between two building sites. */
export function requiredBuildingDistance(a:BuildingKind,b:BuildingKind):number {
  const gap=majorBuildings.has(a)&&majorBuildings.has(b)?MAJOR_BUILDING_GAP:STANDARD_BUILDING_GAP;
  return buildingPlacementRadius(a)+buildingPlacementRadius(b)+gap;
}
