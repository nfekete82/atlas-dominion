import type {BuildingKind,UnitKind} from './catalog.js';

/** Visual-only world scale: simulation collision, pathfinding and balancing remain unchanged. */
export const unitArtScale=(kind:UnitKind):number=>
  kind==='heavy'?.79:['infantry','medic','engineer'].includes(kind)?.75:1;

/** Give industrial buildings the visual weight of a real base beside the infantry. */
export const buildingArtScale=(kind:BuildingKind):number=>
  kind==='headquarters'?1.30:
  kind==='barracks'||kind==='factory'||kind==='airfield'?1.26:
  kind==='generator'?1.21:1.15;

export const buildingArtWidth=(kind:BuildingKind,width:number):number=>
  width*buildingArtScale(kind);
