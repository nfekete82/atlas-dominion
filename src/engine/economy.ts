/** ATLAS economy: one population pool. Every citizen is an available soldier.
 * Deployed forces remain part of that population, and combat casualties reduce it.
 * New cities permanently accelerate the growth of this shared population.
 */
export type BuildingType = 'city'|'tower'|'factory'|'barracks';
export interface BuildingDef {
  type: BuildingType; name:string; cost:number; icon:string; description:string;
}
export const BUILDINGS: readonly BuildingDef[] = [
  {type:'city',name:'Stadt',cost:75,icon:'▣',
   description:'Erhöht dauerhaft das Einwohner- und Truppenwachstum'},
  {type:'tower',name:'Abwehrturm',cost:180,icon:'♜',
   description:'Erhöht gegnerische Verluste bei Kämpfen im Umkreis von 2 Sektoren'},
  {type:'factory',name:'Fabrik',cost:200,icon:'⚙',
   description:'Produziert Geld; Stadtverbindung erhöht den Ertrag um 50 %'},
  {type:'barracks',name:'Kaserne',cost:280,icon:'⚑',
   description:'Stellt eigene auswählbare Truppengruppen aus mobilen Soldaten zusammen'},
];
export const BUILDING_CODES: Readonly<Record<BuildingType,number>> = {city:1,tower:2,factory:3,barracks:4};
export const BUILDING_BY_CODE: Readonly<Record<number,BuildingType>> = {1:'city',2:'tower',3:'factory',4:'barracks'};

/** Cities boost growth but do not multiply the existing population.
 * Square-root bonuses make additional cities useful with diminishing returns
 * and prevent exponential feedback between residents, taxes and city building.
 */
export function troopGrowth(population:number, territory:number, capitals:number, cities:number):number {
  if(!Number.isFinite(territory)||territory<=0)return 0;
  const people=Math.max(0,Number.isFinite(population)?population:0);
  // A dense island cannot indefinitely multiply recruitment through city spam.
  // Urban capacity scales with controlled land, not the starting country name.
  const urbanCapacity=Math.max(2,territory/10);
  const count=Math.max(0,Number.isFinite(cities)?cities:0);
  const effectiveCities=urbanCapacity*(1-Math.exp(-count/urbanCapacity));
  const urban=Math.sqrt(effectiveCities);
  const land=Math.sqrt(Math.max(0,territory));
  return .25 + Math.sqrt(people)*.10 + land*.08
    + Math.max(0,capitals)*.18 + urban*2.15;
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
/** Upgrades materially increase recruitment; density is still bounded by land. */
export function cityUpgradeGrowth(level:number):number {
  if(!Number.isFinite(level))return 0;
  return [0,1.1,2.1,3.0,3.8,4.5][Math.max(0,Math.min(5,Math.floor(level)))];
}
/** Separate reward for invested city tiers. Raw city count has density-based
 * diminishing returns; paid upgrades retain a real recruitment benefit even
 * in mature empires. A smooth, land-scaled cap prevents exponential snowballing.
 */
export function upgradedCityRecruitment(
  upgradeWeight:number, territory:number, builtCities:number,
):number {
  if(!Number.isFinite(territory)||territory<=0)return 0;
  const weight=Math.max(0,Number.isFinite(upgradeWeight)?upgradeWeight:0);
  const cities=Math.max(0,Number.isFinite(builtCities)?builtCities:0);
  const ceiling=Math.max(3,Math.sqrt(territory)*.65);
  const concentration=1+Math.sqrt(cities)/5;
  return ceiling*(1-Math.exp(-weight*.65/(ceiling*concentration)));
}


/** Factory output per tick. Connections are explicit, require same owner and
 * stop contributing immediately after either endpoint changes ownership. */
export const FACTORY_INCOME=0.5;
export const FACTORY_CONNECTION_MULTIPLIER=1.5;
export const FACTORY_LINK_MAX_DISTANCE=12;
