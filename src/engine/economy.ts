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

/** Cities boost growth but do not multiply the existing population.
 * Square-root bonuses make additional cities useful with diminishing returns
 * and prevent exponential feedback between residents, taxes and city building.
 */
export function troopGrowth(population:number, territory:number, capitals:number, cities:number):number {
  if(!Number.isFinite(territory)||territory<=0)return 0;
  const people=Math.max(0,Number.isFinite(population)?population:0);
  // A dense island cannot indefinitely multiply recruitment through city spam.
  // Urban capacity scales with controlled land, not the starting country name.
  const urbanCapacity=Math.max(1,territory/24);
  const count=Math.max(0,Number.isFinite(cities)?cities:0);
  const effectiveCities=urbanCapacity*(1-Math.exp(-count/urbanCapacity));
  const urban=Math.sqrt(effectiveCities);
  const land=Math.sqrt(Math.max(0,territory));
  return .25 + Math.sqrt(people)*.10 + land*.08
    + Math.max(0,capitals)*.18 + urban*.60;
}

/** Modest income: more people pay more taxes, but land/cities don't create
 * runaway compounding revenue. Income remains useful for affordable cities.
 */
export function taxRevenue(population:number,territory:number,capitals:number,cities:number):number {
  if(!Number.isFinite(territory)||territory<=0)return 0;
  const people=Math.max(0,Number.isFinite(population)?population:0);
  const urban=Math.sqrt(Math.max(0,Number.isFinite(cities)?cities:0));
  return .25 + people*.002 + territory*.0025
    + Math.max(0,capitals)*.16 + urban*.22;
}

/** Cost of the NEXT improvement, based on the current level (0..4). */
export function cityUpgradeCost(currentLevel:number):number {
  if(!Number.isInteger(currentLevel)||currentLevel<0||currentLevel>=5)throw new RangeError('City is fully upgraded');
  return [250,450,750,1150,1700][currentLevel];
}
/** Diminishing city growth points: level 5 yields +2.2 equivalent cities. */
export function cityUpgradeGrowth(level:number):number {
  if(!Number.isFinite(level))return 0;
  return [0,.7,1.25,1.65,1.95,2.2][Math.max(0,Math.min(5,Math.floor(level)))];
}
