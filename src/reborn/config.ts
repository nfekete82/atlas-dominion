/** All gameplay values live here; simulation time is measured in seconds. */
export const RULES = {
  worldSize: 3762, grid: 240, columns: 6, rows: 5, tick: 1 / 20,
  initialCredits: 500, capacity: 48, incomeInterval: 10, baseIncome: 10,
  territoryIncome: [5, 15, 25] as readonly number[], captureTime: 8, captureRadius: 95,
  infantry: { cost: 100, buildTime: 5, hp: 100, speed: 112, sight: 310,
    range: 175, damage: 17, cooldown: .85, radius: 10 },
  headquarters: { hp: 1200, sight: 390, radius: 83 },
  bastion: { sight: 320, radius: 24 },
  aiInterval: 3, aiOpeningDelay: 25,
} as const;
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
