/** ATLAS economy: one population pool. Every citizen is an available soldier.
 * Deployed forces remain part of that population, and combat casualties reduce it.
 * New cities permanently accelerate the growth of this shared population.
 */
export type BuildingType = 'city';
export interface BuildingDef {
  type: BuildingType; name:string; cost:number; icon:string; description:string;
}
export const BUILDINGS: readonly BuildingDef[] = [
  {type:'city',name:'Stadt',cost:75,icon:'▣',
   description:'Erhöht dauerhaft das Einwohner- und Truppenwachstum'},
];
export const BUILDING_CODES: Readonly<Record<BuildingType,number>> = {city:1};
export const BUILDING_BY_CODE: Readonly<Record<number,BuildingType>> = {1:'city'};

/** Growing cities help both small countries and advanced empires. */
export function troopGrowth(population:number, territory:number, capitals:number, cities:number):number {
  if(territory<=0)return 0;
  return .18 + Math.max(0,population)*.0025 + territory*.0055
    + capitals*.24 + cities*(.72+Math.max(0,population)*.0009);
}

/** Bigger populations pay more tax. Territory and cities add modest revenue. */
export function taxRevenue(population:number, territory:number, capitals:number, cities:number):number {
  if(territory<=0)return 0;
  return .4 + Math.max(0,population)*.016 + territory*.015 + capitals*.35 + cities*.3;
}
