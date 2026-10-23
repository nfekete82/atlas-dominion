import type {UnitKind} from './catalog.js';
/** All three infantry roles share the approved rigged Legion armour. */
export const unitAtlasPath=(kind:UnitKind,team:number):string=>'/src/assets/reborn/'+(['infantry','engineer','heavy'].includes(kind)?'prototype/infantry-':'animation/'+kind+'-')+team;
export const buildingAtlasPath=(kind:string,team:number):string=>'/src/assets/reborn/buildings-3d/'+kind+'-'+team;
