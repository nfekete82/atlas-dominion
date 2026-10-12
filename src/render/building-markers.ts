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

/** Readable map encoding: 0–2 bronze, 3–4 silver, 5 gold. */
export function cityLevelStyle(level:number):{fill:string;border:string;text:string}{
  const n=Math.max(0,Math.min(5,Math.floor(Number.isFinite(level)?level:0)));
  return n===5 ? {fill:'#efbd42',border:'#fff2b4',text:'#281a0b'}
    : n>=3 ? {fill:'#bbc8d4',border:'#f0f6fd',text:'#192b38'}
    : {fill:'#bf8550',border:'#f3d4a4',text:'#26180f'};
}
