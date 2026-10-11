import { BUILDINGS, BUILDING_CODES } from '../engine/economy.js';

export interface BuildingMarkerStyle {
  readonly label:string;
  readonly symbol:string;
  readonly color:string;
}

/** Only cities can be built. Capital labels already mark starting cities. */
export const BUILDING_MARKER_STYLES:Readonly<Record<number,BuildingMarkerStyle>> = {
  [BUILDING_CODES.city]: {
    label:BUILDINGS[0].name,
    symbol:'▣',
    color:'#f7e1b1',
  },
};
export function buildingMarkerFor(code:number):BuildingMarkerStyle|null {
  return BUILDING_MARKER_STYLES[code] ?? null;
}
export function showBuildingMarker(owner:number,zoom:number,playerId=0):boolean {
  return owner>=0 && Number.isFinite(zoom) &&
    (owner===playerId?zoom>=1.05:zoom>=1.75);
}
export function buildingMarkerFontSize(scale:number):number {
  if(!Number.isFinite(scale)||scale<=0)return 8;
  return Math.max(4.5,Math.min(12,10/scale));
}
