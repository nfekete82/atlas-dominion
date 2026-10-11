/** Civilian growth, recruiting and construction economy.
 * Numbers are deliberately low early on; recruits are drawn from population.
 */
export type BuildingType = 'settlement' | 'city' | 'barracks' | 'fortress' | 'harbor';
export interface BuildingDef {
  type: BuildingType; name: string; cost: number; icon: string; description: string;
}
export const BUILDINGS: readonly BuildingDef[] = [
  {type:'settlement',name:'Siedlung',cost:35,icon:'⌂',description:'Mehr Einwohner und etwas Nachschub'},
  {type:'city',name:'Stadt',cost:90,icon:'▣',description:'Siedlung ausbauen: starkes Bevölkerungswachstum'},
  {type:'barracks',name:'Kaserne',cost:65,icon:'⚔',description:'Mehr Rekruten aus deiner Bevölkerung'},
  {type:'fortress',name:'Festung',cost:75,icon:'⬡',description:'Erhöht die lokale Grenzverteidigung'},
  {type:'harbor',name:'Hafen',cost:70,icon:'⚓',description:'Küstenstützpunkt mit zusätzlichem Nachschub'},
] as const;
export const BUILDING_CODES: Record<BuildingType,number> = {settlement:1,city:2,barracks:3,fortress:4,harbor:5};
export const BUILDING_BY_CODE: Readonly<Record<number,BuildingType>> =
  Object.fromEntries(Object.entries(BUILDING_CODES).map(([key,value])=>[value,key as BuildingType]));
export function populationGrowth(territory: number, capitals: number, settlements: number, cities: number): number {
  if(territory<=0)return 0;
  return 0.26 + territory*0.006 + capitals*0.46 + settlements*0.85 + cities*2.0;
}
export function recruitmentRate(territory: number, capitals: number, settlements: number, cities: number, barracks: number): number {
  if(territory<=0)return 0;
  return 0.12 + territory*0.0018 + capitals*0.38 + settlements*0.09 + cities*0.38 + barracks*0.9;
}
export function supplyRate(territory: number, capitals: number, settlements: number, cities: number, harbors: number): number {
  if(territory<=0)return 0;
  return 1.15 + territory*.027 + capitals*.55 + settlements*.55 + cities*2.1 + harbors*1.8;
}
