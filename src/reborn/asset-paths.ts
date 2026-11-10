import type {UnitKind} from './catalog.js';
/** Infantry roles share the rig; support roles have their own authored kit and pistol. */
// Rocket infantry reuses the authored animated infantry atlas in classic mode.
 // Its distinct shoulder launcher is attached to the same rig in WebGL;
 // no independent rocket-0/1 sprite atlas is generated.
export const unitAtlasPath=(kind:UnitKind,team:number):string=>{
 const atlasKind=kind==='rocket'?'infantry':kind;
 return '/src/assets/reborn/'+(['infantry','heavy','medic','engineer'].includes(atlasKind)
  ?'prototype/'+atlasKind+'-':'animation/'+atlasKind+'-')+team;
};
export const buildingAtlasPath=(kind:string,team:number):string=>'/src/assets/reborn/buildings-3d/'+kind+'-'+team;
