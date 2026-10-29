/** All gameplay values live here; simulation time is measured in seconds. */
export const RULES = {
  worldSize: 3762, grid: 240, columns: 6, rows: 5, tick: 1 / 20,
  initialCredits: 500, capacity: 48, incomeInterval: 10, baseIncome: 10,
  territoryIncome: [5, 15, 25] as readonly number[], captureTime: 8, captureRadius: 95,
  infantry: { cost: 100, buildTime: 5, hp: 100, speed: 112, sight: 310,
    range: 175, damage: 17, cooldown: .85, radius: 10 },
  headquarters: { hp: 1200, sight: 390, radius: 83 },
  bastion: { sight: 320, radius: 24 },
  turret: { range:600, sight:750, turnSpeed:Math.PI, damage:24, cooldown:.8 },
  aiInterval: 3, aiOpeningDelay: 25,
} as const;
export type MapVersion=0|1|2|3|4|5|6;
export type CampaignSize='small'|'medium'|'large'|'extraLarge';
export const CAMPAIGN_SIZES:Record<CampaignSize,MapVersion>={small:3,medium:4,large:5,extraLarge:6};
export const mapWorldSize=(version:MapVersion):number=>version===3?3000:version===4?3300:version===5?3600:RULES.worldSize;
const legacyLayout={columns:6,rows:5,headquarters:[19,5],starts:[[18,19,25],[4,5,11]],spacing:440,incomes:RULES.territoryIncome} as const;
/** Geometry and starting rules are versioned independently of the save envelope. */
export const MAP_LAYOUTS={0:legacyLayout,1:legacyLayout,2:{columns:4,rows:4,headquarters:[12,3],starts:[[12,13],[2,3]],spacing:650,incomes:[10,15,30]},3:{columns:2,rows:2,headquarters:[2,1],starts:[[2],[1]],spacing:570,incomes:[15,25,35]},4:{columns:4,rows:2,headquarters:[4,3],starts:[[4],[3]],spacing:550,incomes:[15,25,35]},5:{columns:4,rows:3,headquarters:[8,3],starts:[[8],[3]],spacing:590,incomes:[15,25,35]},6:{columns:4,rows:4,headquarters:[12,3],starts:[[12],[3]],spacing:590,incomes:[15,25,35]}} as const;
export const mapLayout=(version:MapVersion)=>MAP_LAYOUTS[version];
/** A seeded diagonal corner assignment, shared by generation, spawning and victory checks. */
export function campaignLayout(version:MapVersion,seed:number){
 const base=mapLayout(version);
 if(version<3)return base;
 const {columns,rows}=base,last=columns*rows-1;
 const corners:[[number,number],[number,number]]=[[columns*(rows-1),columns-1],[0,last]];
 const orientation=((seed>>>0)^(seed>>>8)^(seed>>>16))&3;
 const pair=corners[orientation>>1];
 const blue=pair[orientation&1],red=pair[1-(orientation&1)];
 return {...base,headquarters:[blue,red] as [number,number],starts:[[blue],[red]] as [number[],number[]]};
}
export const ASSETS = {
  terrain: '/src/assets/reborn/desert-fine.png', infantry: '/src/assets/reborn/infantry.png',
  rockDetail: '/src/assets/reborn/sandstone-detail.png',
  infantryWalk: '/src/assets/reborn/infantry-grounded-v3.png', bastion: '/src/assets/reborn/bastion-grounded-v2.png',
  headquarters: '/src/assets/reborn/headquarters-grounded-v2.png',
  radarDish: '/src/assets/reborn/radar-dish-turn-v1.png',
  vehicles: '/src/assets/reborn/vehicles.png',structures:'/src/assets/reborn/structures.png',cliffs:'/src/assets/reborn/cliffs.png',
};
export type Faction = 0 | 1;
export type Owner = Faction | -1;
export interface Point { x: number; y: number }
export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Weather durations in simulation seconds; seeded ranges are inclusive. */
export const WEATHER_RULES={first:[180,260],warning:12,storm:[40,70],recovery:10,calm:[150,240],fadeIn:6,groundSight:.65,airSpeed:.8,artilleryDrift:18} as const;
