import { BUILDINGS, BUILDING_CODES } from '../engine/economy.js';

export interface BuildingMarkerStyle {
  readonly label: string;
  readonly symbol: string;
  readonly color: string;
}

/** The glyph is the marker itself: no badge, rectangle, ring or background. */
const SYMBOLS: Readonly<Record<string, {symbol:string; color:string}>> = {
  settlement:{symbol:'⌂',color:'#f7e1b1'},
  city:{symbol:'♜',color:'#f7e1b1'},
  barracks:{symbol:'⚔',color:'#dbe8de'},
  fortress:{symbol:'⬡',color:'#f2c48c'},
  harbor:{symbol:'⚓',color:'#a8dcee'},
};

export const BUILDING_MARKER_STYLES: Readonly<Record<number,BuildingMarkerStyle>> =
  Object.fromEntries(BUILDINGS.map(b=>{
    const style=SYMBOLS[b.type];
    return [BUILDING_CODES[b.type],{label:b.name,...style}];
  }));

export function buildingMarkerFor(code:number):BuildingMarkerStyle|null {
  return BUILDING_MARKER_STYLES[code] ?? null;
}

/** At world overview show only own buildings; others appear when zoomed in. */
export function showBuildingMarker(owner:number,zoom:number,playerId=0):boolean {
  return owner>=0 && Number.isFinite(zoom) &&
    (owner===playerId ? zoom>=1.05 : zoom>=1.75);
}

/** Approximately 10 screen pixels across zoom levels. */
export function buildingMarkerFontSize(scale:number):number {
  if(!Number.isFinite(scale)||scale<=0)return 8;
  return Math.max(4.5,Math.min(12,10/scale));
}
