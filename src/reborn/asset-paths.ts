import type {UnitKind} from './catalog.js';
/** Infantry roles share the rig; support roles have their own authored kit and pistol. */
export const unitAtlasPath=(kind:UnitKind,team:number):string=>'/src/assets/reborn/'+(['infantry','heavy','medic','engineer'].includes(kind)?'prototype/'+kind+'-':'animation/'+kind+'-')+team;
export const buildingAtlasPath=(kind:string,team:number):string=>'/src/assets/reborn/buildings-3d/'+kind+'-'+team;
