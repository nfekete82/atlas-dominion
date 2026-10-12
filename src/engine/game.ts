import { GEO_BOUNDS, LAND_ROWS, MAP_HEIGHT, MAP_WIDTH, SEA_CROSSINGS, WORLD_HEIGHT, WORLD_WIDTH } from '../data/europe.js';
import { COUNTRY_STARTS, countryByCode } from '../data/countries.js';
import { assessInvasion, interceptAttack, attackerCasualties, campaignEffort, empirePower, relativeAttackEffect } from './warfare.js';
import { attackFrontWidth, frontierBudget, frontierTarget, localDefenseStrength } from './frontline.js';
import { BUILDINGS, BUILDING_CODES, type BuildingType, troopGrowth, taxRevenue } from './economy.js';
import { findConnectedAttackFront } from './front-target.js';
import {aiStyle,scoreAIFront} from './ai-strategy.js';
import {aiMarchRecovery,aiAttacksPerTick,aiStrikeSize,aiDefenseAllocation,aiRiskTolerance} from './ai-tactics.js';
import {formatCompact} from '../format.js';
import {chooseAdvancingSector,canReinforceFront} from './offensive-front.js';
import {DIFFICULTY_SETTINGS,isDifficulty,difficultyAttempts,difficultyDefenseBudget,difficultyRisk,type Difficulty,type DifficultySettings} from './difficulty.js';

export const WATER = -2;
export const NEUTRAL = -1;
export const TICK_SECONDS = 0.25;

export interface Point { x: number; y: number }
export interface Faction {
  id: number;
  name: string;
  capital: string;
  color: string;
  /** One shared inhabitant/army pool: includes mobile, stationed and deployed units. */
  troops: number;
  money: number;
  moneyIncome: number;
  /** Cached whole-empire strength used consistently by humans and bots. */
  militaryPower: number;
  builtCities: number;
  territory: number;
  income: number;
  target: Point;
  ai: boolean;
  alive: boolean;
  cityCount: number;
  captured: number;
  defenseSpent: number;
  /** Real defensive fatalities suffered on the most recent simulation tick. */
  defenseFallenTick: number;
  attackFallen: number;
  enemyFallen: number;
  /** Finite AI marching capacity; regenerates from economic strength. */
  campaignEnergy: number;
  /** Most recent active battle sector; maintains momentum on one front. */
  battleFocus: number;
  intent: 'hold' | 'expand' | 'invade';
}
export interface City { name: string; x: number; y: number; index: number; original: number; owner: number; }
export interface GameEvent { tick: number; text: string; color: string; }
/** Immutable snapshots of ACTUAL frontline strikes for the renderer.
 * They never move armies or change outcomes: this is combat telemetry.
 */
export interface BattleEvent {
  tick:number;
  index:number;
  attackerId:number;
  defenderId:number;
  attacking:number;
  defending:number;
  attackerLost:number;
  defenderLost:number;
  captured:boolean;
}
export interface AttackOrder {
  id: number;
  factionId: number;
  targetOwner: number;
  anchor: Point;
  committed: number;
  remaining: number;
  /** Nonfatal marching stamina, consumed even on unoccupied territory. */
  effort: number;
  fallen: number;
  conquered: number;
  /** Last actually captured sector keeps the capture wave moving locally. */
  lastCaptured?: number;
  /** Enemy sector currently under sustained pressure. */
  contested?: number;
  /** Bounded chronological capture history, extending the live attack wave. */
  trail?: number[];
  landing?: boolean;
  startedTick?: number;
}
export interface AttackResult { ok: boolean; reason: string; sent: number; targetOwner?: number; front?: Point; }
export interface BuildResult { ok: boolean; reason: string; cost: number; type?: BuildingType; }
export type GameStatus = 'playing' | 'victory' | 'defeat';
export type Doctrine = 'expand' | 'blitz' | 'fortify';

/** Colors are stable by country, while the chosen player's color is gold. */
function factionColor(id: number): string {
  if (id === 0) return '#e9b85e';
  const hue=(id*137.508+156)%360,sat=.53,light=.66;
  const hue2rgb=(p:number,q:number,t:number):number=>{
    if(t<0)t+=1;if(t>1)t-=1;
    if(t<1/6)return p+(q-p)*6*t;
    if(t<1/2)return q;
    if(t<2/3)return p+(q-p)*(2/3-t)*6;
    return p;
  };
  const h=hue/360, q=light<.5?light*(1+sat):light+sat-light*sat,p=2*light-q;
  return [hue2rgb(p,q,h+1/3),hue2rgb(p,q,h),hue2rgb(p,q,h-1/3)]
    .map(x=>Math.round(x*255).toString(16).padStart(2,'0')).reduce((a,b)=>a+b,'#');
}

const CELL_COUNT = MAP_WIDTH * MAP_HEIGHT;
const IS_LAND = new Uint8Array(CELL_COUNT);
const NEIGHBORS: number[][] = new Array(CELL_COUNT);
for (let y = 0; y < MAP_HEIGHT; y++) {
  for (let x = 0; x < MAP_WIDTH; x++) {
    const i = y * MAP_WIDTH + x;
    IS_LAND[i] = LAND_ROWS[y][x] === '1' ? 1 : 0;
    const list: number[] = [];
    if (x > 0) list.push(i - 1);
    if (x + 1 < MAP_WIDTH) list.push(i + 1);
    if (y > 0) list.push(i - MAP_WIDTH);
    if (y + 1 < MAP_HEIGHT) list.push(i + MAP_WIDTH);
    NEIGHBORS[i] = list;
  }
}
const LAND_NEIGHBORS = NEIGHBORS.map(list => list.slice());
// SEA_CROSSINGS are navigation links only; land attacks use LAND_NEIGHBORS.
// Short sea crossings make islands and Anatolia reachable without a naval system.
for (const [a, b] of SEA_CROSSINGS) {
  NEIGHBORS[a].push(b);
  NEIGHBORS[b].push(a);
}
export const TOTAL_LAND = IS_LAND.reduce((a, b) => a + b, 0);

export function cellToPoint(index: number): Point {
  return { x: index % MAP_WIDTH, y: Math.floor(index / MAP_WIDTH) };
}
export function pointToIndex(point: Point): number {
  const x = Math.max(0, Math.min(MAP_WIDTH - 1, Math.floor(point.x)));
  const y = Math.max(0, Math.min(MAP_HEIGHT - 1, Math.floor(point.y)));
  return y * MAP_WIDTH + x;
}
export function geoToCell(lon: number, lat: number): Point {
  return { x: (lon - GEO_BOUNDS.west) / (GEO_BOUNDS.east - GEO_BOUNDS.west) * MAP_WIDTH,
    y: (GEO_BOUNDS.north - lat) / (GEO_BOUNDS.north - GEO_BOUNDS.south) * MAP_HEIGHT };
}
export function pointToWorld(point: Point): Point {
  return { x: (point.x + 0.5) * WORLD_WIDTH / MAP_WIDTH, y: (point.y + 0.5) * WORLD_HEIGHT / MAP_HEIGHT };
}
export function worldToCell(point: Point): Point {
  return { x: Math.floor(point.x / WORLD_WIDTH * MAP_WIDTH), y: Math.floor(point.y / WORLD_HEIGHT * MAP_HEIGHT) };
}
export function isLand(index: number): boolean { return IS_LAND[index] === 1; }
export function neighbors(index: number): readonly number[] { return NEIGHBORS[index]; }
export function landNeighbors(index: number): readonly number[] { return LAND_NEIGHBORS[index]; }
function distance2(a: Point, b: Point) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2; }

/** Pure seeded RNG for repeatable matches and replay-ready simulation. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Game {
  readonly owner = new Int16Array(CELL_COUNT);
  readonly defense = new Float32Array(CELL_COUNT);
  /** Built city at sector: 0 means no city, 1 means city. */
  readonly buildings = new Uint8Array(CELL_COUNT);
  /** Real troops committed to individual threatened frontier sectors, separate from mobile reserves. */
  readonly frontline = new Float64Array(CELL_COUNT);
  readonly factions: Faction[];
  readonly cities: City[] = [];
  /** Fixed capital positions for O(1) checks during busy multi-front AI turns. */
  private readonly capitalSites=new Set<number>();
  readonly events: GameEvent[] = [];
  readonly attackOrders: AttackOrder[] = [];
  private nextAttackId = 1;
  private lastAttackerLoss = 0;
  /** Combat during the most recent simulation tick (or direct strike). */
  readonly battleEvents:BattleEvent[]=[];
  readonly seed: number;
  readonly playerCode: string;
  readonly difficulty: Difficulty;
  readonly difficultySettings: DifficultySettings;
  readonly totalLand = TOTAL_LAND;
  readonly initialTerritory: number;
  tick = 0;
  status: GameStatus = 'playing';
  paused = false;
  doctrine: Doctrine = 'expand';
  private rng: () => number;
  private aiGoalChange = 0;
  private frontierCandidates: Array<Set<number>> = [];
  private exposedCounts: number[] = [];

  constructor(seed = 2026, opponentCount = COUNTRY_STARTS.length-1, playerCountry = 'DE', difficulty:Difficulty='balanced') {
    if(!isDifficulty(difficulty))throw new Error(`Unbekannter Schwierigkeitsgrad: ${String(difficulty)}`);
    this.difficulty=difficulty;
    this.difficultySettings=DIFFICULTY_SETTINGS[difficulty];
    const chosen = countryByCode(playerCountry);
    if (!chosen) throw new Error(`Unbekanntes Land: ${playerCountry}`);
    this.playerCode = chosen.code;
    this.seed = seed;
    this.rng = seededRandom(seed);
    this.owner.fill(WATER);
    for (let i = 0; i < CELL_COUNT; i++) if (isLand(i)) this.owner[i] = NEUTRAL;
    const starts = [chosen,...COUNTRY_STARTS.filter(c=>c.code!==chosen.code)]
      .slice(0, Math.max(1, Math.min(COUNTRY_STARTS.length, opponentCount + 1)));
    this.factions = starts.map((start, id) => ({
      id, name: start.name, capital: start.capital, color: factionColor(id),
      troops:id===0?90:this.difficultySettings.aiStartingTroops, money:90, moneyIncome: 0, militaryPower: 0, builtCities:0,
      territory: 0, income: 0, target: geoToCell(start.lon,start.lat),
      ai:id!==0, alive:true, cityCount:0, captured:0, defenseSpent:0, defenseFallenTick:0, attackFallen:0, enemyFallen:0, campaignEnergy:id===0?110:110*this.difficultySettings.marchMultiplier, battleFocus:-1, intent:'hold' as const,
    }));
    // Reserve EVERY capital before assigning any surrounding territory. Without
    // this, microstates (e.g. Vatican/Rome) can overwrite earlier capitals.
    const occupied = new Set<number>();
    for(let id=0;id<starts.length;id++){
      const start=starts[id];
      const point=geoToCell(start.lon,start.lat);
      const index=this.findNearestCapitalCell(point,occupied);
      if(index<0)throw new Error(`Kein Startsektor für ${start.name}`);
      occupied.add(index);
      const pos=cellToPoint(index);
      this.cities.push({name:start.capital,...pos,index,original:id,owner:id});
      this.capitalSites.add(index);
    }
    for(const city of this.cities){
      this.owner[city.index]=city.original;
      this.defense[city.index]=55;
    }
    for(const city of this.cities)this.seedTerritory(city.original,city,3.4);
    this.factions[0].target=geoToCell(chosen.lon+1,chosen.lat-1);
    this.recount();
    this.initialTerritory=this.factions[0].territory;
    this.pickAIGoals();
    this.log(`${starts.length} Länder starten an ihren Hauptstädten · KI: ${this.difficultySettings.label}.`);
    this.log(`Du spielst als ${chosen.name} – Hauptstadt ${chosen.capital}.`,this.factions[0].color);
    this.log('Automatische Grenzverteidigung und Nachschub aktiviert.',this.factions[0].color);
  }

  /** Assign a unique real land cell as close as possible to each capital. */
  private findNearestCapitalCell(point: Point, occupied: Set<number>): number {
    let best=-1, distance=Infinity;
    for(let i=0;i<CELL_COUNT;i++){
      if(!isLand(i)||occupied.has(i))continue;
      const d=distance2(cellToPoint(i),point);
      if(d<distance){best=i;distance=d;}
    }
    return best;
  }

  private findNearestLand(point: Point, unclaimed = false): number {
    let best = -1; let bestD = Infinity;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (!isLand(i) || (unclaimed && this.owner[i] !== NEUTRAL)) continue;
      const d = distance2(cellToPoint(i), point);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  private seedTerritory(id: number, center: Point, radius: number) {
    const r = Math.ceil(radius);
    for (let y = Math.max(0, center.y - r); y <= Math.min(MAP_HEIGHT - 1, center.y + r); y++) {
      for (let x = Math.max(0, center.x - r); x <= Math.min(MAP_WIDTH - 1, center.x + r); x++) {
        const i = y * MAP_WIDTH + x;
        if (this.owner[i] !== NEUTRAL || distance2({ x, y }, center) > radius * radius) continue;
        this.owner[i] = id;
        this.defense[i] = 12;
      }
    }
    const city = this.cities.find(c => c.original === id);
    if (city) { this.owner[city.index] = id; this.defense[city.index] = 55; }
  }

  /** Recount real ownership and include every deployed soldier in population.
   * Reassignment from reserves to frontline never creates money or inhabitants.
   */
  private recount():void {
    const people=this.factions.map(f=>f.troops);
    for(const f of this.factions){f.territory=0;f.cityCount=0;f.builtCities=0;}
    for(let i=0;i<CELL_COUNT;i++){
      const id=this.owner[i];
      if(id<0)continue;
      const faction=this.factions[id];
      faction.territory++;
      people[id]+=this.frontline[i];
      if(this.buildings[i]===BUILDING_CODES.city)faction.builtCities++;
    }
    for(const order of this.attackOrders)people[order.factionId]+=order.remaining;
    for(const city of this.cities){
      city.owner=this.owner[city.index];
      if(city.owner>=0)this.factions[city.owner].cityCount++;
    }
    for(const faction of this.factions){
      faction.alive=faction.territory>0;
      const totalPeople=people[faction.id];
      faction.militaryPower=empirePower(totalPeople,faction.territory,faction.cityCount+faction.builtCities);
      const growth=troopGrowth(totalPeople,faction.territory,faction.cityCount,faction.builtCities);
      faction.income=faction.id===0?growth*(this.doctrine==='fortify'?1.20:this.doctrine==='blitz'?.90:1):growth*this.difficultySettings.growthMultiplier;
      faction.moneyIncome=taxRevenue(totalPeople,faction.territory,faction.cityCount,faction.builtCities);
    }
  }

  /** Residents and troops are the same people, regardless of deployment. */
  populationOf(id:number):number {
    const faction=this.factions[id];
    if(!faction)return 0;
    let all=faction.troops;
    for(let i=0;i<CELL_COUNT;i++)if(this.owner[i]===id)all+=this.frontline[i];
    for(const order of this.attackOrders)if(order.factionId===id)all+=order.remaining;
    return all;
  }

  /** Relative military effectiveness against a foreign nation. A stronger
   * enemy reduces our attack by at most 30%, without making it impossible.
   * Empty neutral territory never receives a fictitious empire-power bonus.
   */
  relativeAttackPower(attackerId:number,defenderId:number):number {
    if(defenderId===NEUTRAL || attackerId===defenderId)return 1;
    const attacker=this.factions[attackerId],defender=this.factions[defenderId];
    if(!attacker||!defender)return 1;
    return relativeAttackEffect(attacker.militaryPower,defender.militaryPower);
  }

  private log(text: string, color = '#b9c4d0') {
    this.events.unshift({ tick: this.tick, text, color });
    if (this.events.length > 8) this.events.length = 8;
  }

  buildingAt(point:Point):BuildingType|null {
    const x=Math.floor(point.x),y=Math.floor(point.y);
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||x<0||y<0||x>=MAP_WIDTH||y>=MAP_HEIGHT)return null;
    return this.buildings[y*MAP_WIDTH+x]===BUILDING_CODES.city?'city':null;
  }

  canBuild(id:number,point:Point,type:BuildingType):BuildResult {
    const fail=(reason:string):BuildResult=>({ok:false,reason,cost:0});
    const faction=this.factions[id];
    if(!faction?.alive||this.status!=='playing')return fail('Dieses Land kann nicht bauen.');
    if(type!=='city')return fail('Es können nur Städte gebaut werden.');
    const x=Math.floor(point.x),y=Math.floor(point.y);
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||x<0||y<0||x>=MAP_WIDTH||y>=MAP_HEIGHT)return fail('Außerhalb der Karte.');
    const index=y*MAP_WIDTH+x;
    if(this.owner[index]!==id)return fail('Nur auf eigenem Land bauen.');
    if(this.capitalSites.has(index))return fail('In der Hauptstadt steht bereits eine Stadt.');
    if(this.buildings[index])return fail('Hier steht bereits eine Stadt.');
    const def=BUILDINGS[0];
    if(faction.money<def.cost)return fail(`Zu wenig Geld: ${def.cost} benötigt.`);
    return {ok:true,reason:'Stadt bauen.',cost:def.cost,type:'city'};
  }

  build(id:number,point:Point,type:BuildingType):BuildResult {
    const permission=this.canBuild(id,point,type);
    if(!permission.ok)return permission;
    const faction=this.factions[id];
    faction.money-=permission.cost;
    this.buildings[pointToIndex(point)]=BUILDING_CODES.city;
    this.recount();
    if(id===0)this.log(`Stadt gebaut · -${permission.cost} Geld · schnelleres Wachstum.`,faction.color);
    return {ok:true,reason:'Stadt gebaut.',cost:permission.cost,type:'city'};
  }

  /** AI countries may develop cities, paying exactly the same build cost. */
  private developAI():void {
    const capitals=this.capitalSites;
    const locations=new Int32Array(this.factions.length).fill(-1);
    const score=new Float64Array(this.factions.length).fill(Infinity);
    for(let index=0;index<CELL_COUNT;index++){
      const id=this.owner[index];
      if(id<=0 || !this.factions[id]?.ai || this.buildings[index] || capitals.has(index))continue;
      const capital=this.cities[id].index;
      const deltaX=index%MAP_WIDTH-capital%MAP_WIDTH;
      const deltaY=Math.floor(index/MAP_WIDTH)-Math.floor(capital/MAP_WIDTH);
      const d=deltaX*deltaX+deltaY*deltaY;
      if(d<score[id]){score[id]=d;locations[id]=index;}
    }
    for(const faction of this.factions){
      if(!faction.ai||!faction.alive||locations[faction.id]<0)continue;
      this.build(faction.id,cellToPoint(locations[faction.id]),'city');
    }
  }

  setDoctrine(mode: Doctrine): void {
    if (this.doctrine === mode || this.status !== 'playing') return;
    this.doctrine = mode;
    this.log(`Taktik geändert: ${mode === 'expand' ? 'EXPANSION' : mode === 'blitz' ? 'BLITZANGRIFF' : 'VERSCHANZEN'}.`, this.factions[0].color);
    this.recount();
  }

  order(id: number, target: Point): boolean {
    const faction = this.factions[id];
    if (!faction?.alive || this.status !== 'playing') return false;
    const index = this.findNearestLand(target);
    if (index < 0) return false;
    faction.target = cellToPoint(index);
    if (id === 0) this.log('Neues Angriffsziel markiert.', faction.color);
    return true;
  }

  /** Returns adjacent owner IDs, including neutral, but never water or the attacker itself. */
  attackableOwners(id: number): Set<number> {
    const targets = new Set<number>();
    if (!this.factions[id]?.alive) return targets;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (this.owner[i] !== id) continue;
      for (const neighbor of LAND_NEIGHBORS[i]) {
        const owner = this.owner[neighbor];
        if (owner !== id && owner !== WATER) targets.add(owner);
      }
    }
    return targets;
  }


  /** Station actual units where rival armies touch, and return forces from quiet sectors.
   * No automatic conquest occurs here; every moved unit is deducted from free reserves.
   */
  redistributeFrontline(): void {
    const exposed: number[][] = Array.from({length: this.factions.length}, () => []);
    for (let i = 0; i < CELL_COUNT; i++) {
      const owner = this.owner[i];
      if (owner < 0) { this.frontline[i] = 0; continue; }
      const threatened = LAND_NEIGHBORS[i].some(n => this.owner[n] >= 0 && this.owner[n] !== owner);
      if (!threatened) {
        if (this.frontline[i] > 0) {
          this.factions[owner].troops += this.frontline[i];
          this.frontline[i] = 0;
        }
      } else {
        exposed[owner].push(i);
      }
    }
    for (const faction of this.factions) {
      if (!faction.alive || !exposed[faction.id].length) continue;
      const baseBudget=frontierBudget(faction.troops,faction.income);
      const budget=faction.ai
        ? difficultyDefenseBudget(faction.troops,
            aiDefenseAllocation(faction.troops,faction.income,baseBudget),this.difficulty)
        : baseBudget;
      if (budget < 0.01) continue;
      let remaining = budget;
      // Cover weak points first. Equal-strength sectors break ties by map index.
      exposed[faction.id].sort((a,b)=>this.frontline[a]-this.frontline[b] || a-b);
      for (const i of exposed[faction.id]) {
        if (remaining < 0.01) break;
        const isCapital = this.capitalSites.has(i);
        const target = frontierTarget(faction.territory, faction.troops, isCapital, faction.id === 0 && this.doctrine === 'fortify');
        const sent = Math.max(0, Math.min(target - this.frontline[i], remaining, faction.troops));
        if (sent <= 0) continue;
        faction.troops -= sent;
        this.frontline[i] += sent;
        remaining -= sent;
      }
    }
  }

  /** Map-visible local defense, excluding strategic mobile reserves. */
  sectorDefense(index: number): number {
    if (index < 0 || index >= CELL_COUNT || this.owner[index] === WATER) return 0;
    return localDefenseStrength(this.defense[index], this.frontline[index]);
  }

  /** Count exposed sectors for risk-aware decisions and the defense HUD. */
  threatenedBorders(id: number): number {
    let exposed = 0;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (this.owner[i] !== id) continue;
      if (LAND_NEIGHBORS[i].some(n => this.owner[n] >= 0 && this.owner[n] !== id)) exposed++;
    }
    return exposed;
  }

  /** Neutral territory is one globally shared owner. Keep its click radius
   * local to avoid teleporting across unclaimed Europe. Occupied nations,
   * however, can be targeted anywhere within a connected region that
   * actually borders our land.
   */
  static readonly ATTACK_CLICK_DEPTH = 14;

  isDirectBorderTarget(id: number, target: Point): boolean {
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y) ||
        target.x < 0 || target.y < 0 || target.x >= MAP_WIDTH || target.y >= MAP_HEIGHT ||
        !this.factions[id]?.alive) return false;
    const index=pointToIndex(target);
    return this.owner[index]!==WATER && this.owner[index]!==id &&
      LAND_NEIGHBORS[index].some(n=>this.owner[n]===id);
  }

  findAttackFront(id: number, target: Point): Point | null {
    if(!Number.isFinite(target.x)||!Number.isFinite(target.y)||
       target.x<0||target.y<0||target.x>=MAP_WIDTH||target.y>=MAP_HEIGHT||
       !this.factions[id]?.alive)return null;
    const index=pointToIndex(target);
    const maxDistance=this.owner[index]===NEUTRAL?Game.ATTACK_CLICK_DEPTH:Infinity;
    const front=findConnectedAttackFront(this.owner,MAP_WIDTH,index,id,maxDistance);
    return front>=0?cellToPoint(front):null;
  }

  /** Clicking our own threatened border triggers an actual counterattack
   * into the nearest directly adjacent invading nation, not a move across
   * friendly territory or a phantom strike against our own citizens.
   * Nearby friendly clicks can reach the same frontline within 12 cells.
   */
  findCounterattackFront(id:number, point:Point):Point|null {
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||
       point.x<0||point.y<0||point.x>=MAP_WIDTH||point.y>=MAP_HEIGHT||
       !this.factions[id]?.alive)return null;
    const origin=pointToIndex(point);
    if(this.owner[origin]!==id)return null;
    const visited=new Set<number>([origin]);
    const queue:[number,number][]=[[origin,0]];
    for(let head=0;head<queue.length;head++){
      const [index,depth]=queue[head];
      for(const n of LAND_NEIGHBORS[index]){
        const neighbor=this.owner[n];
        if(neighbor>=0 && neighbor!==id)return cellToPoint(n);
      }
      if(depth>=12)continue;
      for(const n of LAND_NEIGHBORS[index]){
        if(this.owner[n]!==id || visited.has(n))continue;
        visited.add(n);queue.push([n,depth+1]);
      }
    }
    return null;
  }

  /** Friendly threatened frontier sectors may receive manually assigned
   * real soldiers; they remain counted as inhabitants while on defense. */
  isThreatenedBorder(id:number,point:Point):boolean {
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||
       point.x<0||point.y<0||point.x>=MAP_WIDTH||point.y>=MAP_HEIGHT)return false;
    const index=pointToIndex(point);
    return this.owner[index]===id &&
      LAND_NEIGHBORS[index].some(n=>this.owner[n]>=0 && this.owner[n]!==id);
  }

  reinforceBorder(id:number,point:Point,ratio:number):AttackResult {
    const failed=(reason:string):AttackResult=>({ok:false,reason,sent:0});
    const faction=this.factions[id];
    if(!faction?.alive || this.status!=='playing')return failed('Dein Land kann nicht verteidigt werden.');
    if(!Number.isFinite(ratio)||ratio<5||ratio>100)return failed('Truppenanteil muss zwischen 5 und 100 % liegen.');
    if(!this.isThreatenedBorder(id,point))return failed('Nur eigene Landgrenzen mit einem feindlichen Nachbarn verstärken.');
    const sent=Math.floor(faction.troops*ratio/100);
    if(sent<8)return failed('Mindestens 8 mobile Truppen für die Grenzverteidigung nötig.');
    faction.troops-=sent;
    this.frontline[pointToIndex(point)]+=sent;
    if(id===0)this.log(`Grenze verstärkt: ${formatCompact(sent)} Soldaten stationiert.`,faction.color);
    return {ok:true,reason:'Grenzverstärkung stationiert.',sent,front:point};
  }

  /** True only for a documented sea corridor with our troops on the opposite shore. */
  canLand(id: number, target: Point): boolean {
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y) ||
        target.x < 0 || target.y < 0 || target.x >= MAP_WIDTH || target.y >= MAP_HEIGHT ||
        !this.factions[id]?.alive) return false;
    const index = pointToIndex(target);
    if (this.owner[index] === id || this.owner[index] === WATER) return false;
    return SEA_CROSSINGS.some(([a,b]) => (index === a && this.owner[b] === id)
      || (index === b && this.owner[a] === id));
  }

  launchAttack(id: number, target: Point, ratio: number): AttackResult {
    return this.issueAttack(id,target,ratio,false);
  }

  /** Explicit maritime landing: Shift+click the far shore of a known crossing.
   * No other cross-water movements are allowed, and the landing takes time.
   */
  launchLanding(id: number, target: Point, ratio: number): AttackResult {
    return this.issueAttack(id,target,ratio,true);
  }

  private issueAttack(id: number, target: Point, ratio: number, landing: boolean): AttackResult {
    const failed = (reason: string): AttackResult => ({ ok: false, reason, sent: 0 });
    const attacker = this.factions[id];
    if (!attacker?.alive || this.status !== 'playing') return failed('Diese Fraktion kann nicht angreifen.');
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y) || target.x < 0 || target.y < 0 || target.x >= MAP_WIDTH || target.y >= MAP_HEIGHT) return failed('Außerhalb der Karte.');
    if (!Number.isFinite(ratio) || ratio < 5 || ratio > 100) return failed('Truppenanteil muss zwischen 5 und 100 % liegen.');
    const index=pointToIndex(target),clickedOwner=this.owner[index];
    if(clickedOwner===WATER)return failed('Angriff auf Wasser nicht möglich.');
    // On a friendly sector, a click NEAR a hostile frontier issues a
    // counterattack across that real border; never target distant nations.
    const counter=!landing && clickedOwner===id
      ? this.findCounterattackFront(id,target):null;
    if(clickedOwner===id && !counter)return failed('Eigenes Gebiet – für einen Gegenangriff näher an die feindliche Grenze klicken.');
    const front=counter ?? (landing?cellToPoint(index):this.findAttackFront(id,target));
    if(!front || (landing && !this.canLand(id,target)))
      return failed(landing?'Keine eigene Küste an diesem Seeübergang.':'Dieses Gebiet hat keine gemeinsame Landfront mit dir.');
    const owner=counter?this.owner[pointToIndex(counter)]:clickedOwner;
    if(owner===id || owner===WATER)return failed('Kein feindlicher Grenzsektor gefunden.');
    const sent = Math.floor(attacker.troops * ratio / 100);
    if (sent < 8) return failed('Mindestens 8 mobile Truppen erforderlich.');
    attacker.troops-=sent;
    // Repeating a click near the same border reinforces the EXISTING army:
    // simple OpenFront-style interaction, no overlapping duplicate campaigns.
    const existing=!landing?this.attackOrders.find(o=>
      o.factionId===id&&!o.landing&&o.targetOwner===owner&&
      canReinforceFront(owner,pointToIndex(o.anchor),pointToIndex(front),MAP_WIDTH)
    ):undefined;
    if(existing){
      existing.remaining+=sent;
      existing.committed+=sent;
      existing.effort+=campaignEffort(sent);
    }else{
      this.attackOrders.push({
        id:this.nextAttackId++,factionId:id,targetOwner:owner,
        anchor:front,committed:sent,remaining:sent,effort:campaignEffort(sent),
        fallen:0,conquered:0,trail:[],landing,startedTick:this.tick,
      });
    }
    // Neutral attacks only show a concise order status in the HUD, never
    // pollute the strategic event feed for every small land claim.
    if(id===0&&owner!==NEUTRAL)this.log(
      `${existing?'Verstärkt':landing?'Seelandung':counter?'Gegenangriff':'Angriff'}: ${formatCompact(sent)} gegen ${this.factions[owner].name}.`,attacker.color);
    const reason=existing?'Offensive verstärkt.':landing?'Landung befohlen.':
      counter?'Gegenangriff gestartet.':owner===NEUTRAL?'Expansion gestartet.':'Grenzangriff gestartet.';
    return {ok:true,reason,sent,targetOwner:owner,front};
  }

  /** Only live orthogonal front candidates can be taken. The front trail
   * expands with real captures instead of stopping at the original click.
   */
  private chooseOrderedFront(order:AttackOrder):number{
    const anchorIndex=pointToIndex(order.anchor);
    if(order.landing && order.conquered===0){
      if(this.owner[anchorIndex]!==order.targetOwner)return -1;
      return this.canLand(order.factionId,order.anchor)?anchorIndex:-1;
    }
    const candidates=this.frontierCandidates[order.factionId];
    if(!candidates)return -1;
    return chooseAdvancingSector({
      owners:this.owner,width:MAP_WIDTH,attackerId:order.factionId,
      targetOwner:order.targetOwner,candidates,anchor:anchorIndex,
      trail:order.trail??[],contested:order.contested,
    });
  }

  private resolveOrders(attacker: Faction) {
    // `remaining` means surviving soldiers; `effort` means how far the army
    // can push this sortie. Travelling through neutral land costs stamina,
    // never inhabitants. Only casualties permanently lower population.
    const orders=this.attackOrders.filter(o=>o.factionId===attacker.id);
    for(const order of orders){
      if(order.landing && order.conquered===0 && this.tick-(order.startedTick??0)<4)continue;
      const strikes=attackFrontWidth(order.committed,attacker.id===0&&this.doctrine==='blitz',order.targetOwner===NEUTRAL);
      let unreachable=false;
      for(let k=0;k<strikes && order.remaining>=1 && order.effort>=1;k++){
        const index=this.chooseOrderedFront(order);
        if(index===-1){unreachable=true;break;}
        const effortCost=Math.min(order.effort,order.targetOwner===NEUTRAL?(attacker.id===0&&this.doctrine==='expand'?6:8):21);
        if(effortCost<1)break;
        order.effort-=effortCost;
        const engaged=Math.min(order.remaining,effortCost);
        const captured=this.strike(attacker,index,engaged);
        order.contested=captured?undefined:index;
        const lost=Math.min(order.remaining,this.lastAttackerLoss);
        order.remaining-=lost;
        order.fallen+=lost;
        if(captured){
          order.conquered++;order.lastCaptured=index;
          (order.trail??=[]).push(index);
          if(order.trail.length>144)order.trail.shift();
          if(order.landing)order.landing=false;
        }
      }
      if(unreachable||order.effort<1||order.remaining<1){
        // Survivors return to the mobile reserve. A reserve transfer is never
        // treated as a new birth or a death.
        attacker.troops+=order.remaining;
        const pos=this.attackOrders.findIndex(o=>o.id===order.id);
        if(pos>=0)this.attackOrders.splice(pos,1);
        if(attacker.id===0){
          if(order.targetOwner===NEUTRAL){
            // Log only meaningful completed neutral campaigns, not each
            // click/sector. Orders are visible separately while active.
            if(order.conquered>=10)this.log(
              `Expansion +${formatCompact(order.conquered)} Sektoren · ${formatCompact(order.remaining)} Soldaten zurück.`,
              attacker.color);
          }else this.log(
            `Kampf beendet: +${formatCompact(order.conquered)} Sektoren · ${formatCompact(order.fallen)} Gefallene.`,
            attacker.color);
        }
      }
    }
  }

  /** Long-lived strategic goals are now weighted by actual weakness rather
   * than choosing a random one of the three nearest capital cities.
   * Re-evaluated periodically, so an exposed weak rival attracts pressure.
   */
  private pickAIGoals() {
    for(const faction of this.factions){
      if(!faction.ai||!faction.alive)continue;
      const capital=this.cities[faction.id];
      const targets=this.cities.filter(c=>c.owner>=0&&c.owner!==faction.id);
      let best:City|null=null,bestScore=-Infinity;
      for(const city of targets){
        const opponent=this.factions[city.owner];
        const distance=Math.sqrt(distance2(city,capital));
        const weak=100/(25+opponent.troops+opponent.income*3);
        const score=weak*22-distance*.34+(opponent.territory<faction.territory?7:0);
        if(score>bestScore){bestScore=score;best=city;}
      }
      if(best)faction.target={x:best.x,y:best.y};
    }
  }

  /** Build compact land-only border sets once per tick. Captures update the sets
   * incrementally, avoiding repeated full-map scans as the playfield expands.
   */
  private rebuildFrontierCandidates(): void {
    this.frontierCandidates=this.factions.map(()=>new Set<number>());
    this.exposedCounts=this.factions.map(()=>0);
    for(let i=0;i<CELL_COUNT;i++){
      const owner=this.owner[i];
      if(owner<0)continue;
      let exposed=false;
      for(const n of LAND_NEIGHBORS[i]){
        if(this.owner[n]===owner || this.owner[n]===WATER)continue;
        this.frontierCandidates[owner].add(n);
        if(this.owner[n]>=0) exposed=true;
      }
      if(exposed)this.exposedCounts[owner]++;
    }
  }

  /** AI attacks worthwhile local borders instead of teleporting toward capitals. */
  private chooseFront(id: number): number {
    const faction=this.factions[id];
    const exposed=this.exposedCounts[id] ?? 0;
    const candidates=this.frontierCandidates[id];
    if(!candidates){faction.intent='hold';return -1;}
    let best=-1, bestScore=-Infinity;
    for(const i of candidates){
      const opponent=this.owner[i];
      if(opponent===WATER || opponent===id){candidates.delete(i);continue;}
      let friendly=0;
      for(const n of LAND_NEIGHBORS[i])if(this.owner[n]===id)friendly++;
      if(!friendly){candidates.delete(i);continue;}
      const city=this.capitalSites.has(i);
      const hasCity=this.buildings[i]===BUILDING_CODES.city;
      const neutral=opponent===NEUTRAL;
      const defender=neutral?null:this.factions[opponent];
      const assessment=assessInvasion({
        attackerTroops:faction.troops,attackerIncome:faction.income,
        defenderTroops:defender?Math.min(defender.troops*.15,40+defender.income*3):0,
        defenderIncome:defender?.income ?? 0,garrison:this.sectorDefense(i),
        capital:!!city,neutral,threatenedBorders:exposed,
        relativePower:neutral?1:this.relativeAttackPower(id,opponent),
        riskTolerance:difficultyRisk(aiRiskTolerance(aiStyle(id)),this.difficulty),
      });
      if(!assessment.worthwhile)continue;
      const x=i%MAP_WIDTH,y=Math.floor(i/MAP_WIDTH);
      const d=Math.hypot(x-faction.target.x,y-faction.target.y);
      const focusIndex=faction.battleFocus;
      const focusDistance=focusIndex>=0
        ? Math.hypot(i%MAP_WIDTH-focusIndex%MAP_WIDTH,
          Math.floor(i/MAP_WIDTH)-Math.floor(focusIndex/MAP_WIDTH))
        : Infinity;
      const score=scoreAIFront({
        neutral,advantage:assessment.advantage,friendlySides:friendly,
        capital:!!city,city:hasCity,distance:d,
        opponentCommitted:defender?.defenseSpent??0,
        opponentReserve:defender?.troops??0,
        threatenedBorders:exposed,
        focus:d<14,
      },aiStyle(faction.id)) + (focusDistance<10?11-focusDistance*.85:0) + this.rng()*.15;
      if(score>bestScore){bestScore=score;best=i;}
    }
    faction.intent=best<0?'hold':this.owner[best]===NEUTRAL?'expand':'invade';
    return best;
  }

  private strike(faction: Faction, index: number, spent: number): boolean {
    // The local garrison and stationed frontline troops fight first.
    // Only a limited emergency contingent may arrive from the national reserve:
    // a distant empire cannot instantly defend every weak point at full power.
    const originalOwner = this.owner[index];
    const relativePower=this.relativeAttackPower(faction.id,originalOwner);
    const rawDamage = spent * (0.95 + this.rng() * 0.22) * relativePower;
    const garrisonStrength=this.defense[index];
    let mitigation = 0;
    let defenderLosses=0;
    let defender: Faction | null = null;
    let capital = false;
    if (originalOwner >= 0 && originalOwner !== faction.id) {
      defender = this.factions[originalOwner];
      capital = this.capitalSites.has(index);
      const fortified = originalOwner === 0 && this.doctrine === 'fortify';
      const local = interceptAttack(this.frontline[index], rawDamage, fortified, capital);
      this.frontline[index] -= local.used;
      defenderLosses+=local.used;
      defender.defenseSpent += local.used;
      defender.defenseFallenTick+=local.used;
      mitigation += local.blocked;

      // Capital dispatches slightly more mobile emergency defenders.
      // An invaded nation's population must actually defend its frontier.
      // Call up local militia from its REAL mobile population even when no
      // stationed soldiers were present. Unlike the abstract garrison
      // defense number, every used militia member is a recorded casualty.
      const emergencyLimit=Math.min(defender.troops,
        Math.max(1.5,rawDamage*(capital?.55:.36)));
      const emergency = interceptAttack(emergencyLimit, Math.max(0, rawDamage - mitigation), fortified, capital);
      defender.troops -= emergency.used;
      defenderLosses+=emergency.used;
      defender.defenseSpent += emergency.used;
      defender.defenseFallenTick+=emergency.used;
      mitigation += emergency.blocked;
    }
    this.defense[index]-=Math.max(0.01,rawDamage-Math.min(mitigation,rawDamage*.94));
    const captured=this.defense[index]<=0;
    // If the position falls, the defenders still stationed on the sector
    // are lost as well; include these in this exact engagement's exchange.
    if(captured && defender && this.frontline[index]>0){
      defenderLosses+=this.frontline[index];
      defender.defenseSpent+=this.frontline[index];
      defender.defenseFallenTick+=this.frontline[index];
      this.frontline[index]=0;
    }
    this.lastAttackerLoss=attackerCasualties(
      spent,
      mitigation+Math.min(Math.max(0,garrisonStrength),rawDamage)*.35,
      originalOwner===NEUTRAL,capital,relativePower,defenderLosses);
    faction.attackFallen+=this.lastAttackerLoss;
    if(defender){
      defender.enemyFallen+=this.lastAttackerLoss;
      faction.enemyFallen+=defenderLosses;
    }
    // Record measured troops and fatalities, never estimated fake unit counts.
    // Capped so an extremely busy high-speed simulation stays renderable.
    if(this.battleEvents.length<1600)this.battleEvents.push({
      tick:this.tick,index,attackerId:faction.id,defenderId:originalOwner,
      attacking:spent,defending:defenderLosses,
      attackerLost:this.lastAttackerLoss,defenderLost:defenderLosses,captured,
    });
    if(!captured)return false;
    this.owner[index] = faction.id;
    // Incrementally update local battlefronts as territory changes.
    for (const [id,set] of this.frontierCandidates.entries()) {
      if (id === faction.id) set.delete(index);
      else if (LAND_NEIGHBORS[index].some(n=>this.owner[n]===id)) set.add(index);
    }
    const ownFront=this.frontierCandidates[faction.id];
    if(ownFront)for(const n of LAND_NEIGHBORS[index]) if(this.owner[n]!==faction.id && this.owner[n]!==WATER) ownFront.add(n);
    this.frontline[index] = 0;
    this.defense[index] = faction.id === 0 && this.doctrine === 'fortify' ? 27 : 11;
    faction.captured++;
    const city = this.cities.find(c => c.index === index);
    if (city) {
      const oldOwner = city.owner;
      city.owner = faction.id;
      this.defense[index] = 32;
      if (oldOwner !== faction.id) this.log(`${faction.name} erobert ${city.name}.`, faction.color);
    }
    return true;
  }

  private attack(faction:Faction,index:number) {
    if(faction.troops<8)return false;
    const neutral=this.owner[index]===NEUTRAL;
    // The direct strike helper also serves existing combat regression tests.
    // Only AI factions use the increased tempo and marching-energy budget.
    if(!faction.ai){
      const engaged=Math.min(faction.troops,neutral?8:21);
      this.strike(faction,index,engaged);
      faction.troops=Math.max(0,faction.troops-this.lastAttackerLoss);
      return true;
    }
    const basicStrike=aiStrikeSize(faction.troops,neutral,aiStyle(faction.id));
    const desired=Math.min(faction.troops,
      Math.max(8,Math.round(basicStrike*Math.max(.70,Math.min(1.25,this.difficultySettings.activityMultiplier)))));
    // Only launch with paid-for marching stamina and real living soldiers.
    const engaged=Math.min(desired,Math.floor(faction.campaignEnergy));
    if(engaged<8 || (!neutral && engaged<Math.min(18,desired)))return false;
    faction.campaignEnergy-=engaged;
    const captured=this.strike(faction,index,engaged);
    faction.troops=Math.max(0,faction.troops-this.lastAttackerLoss);
    // Continue pushing this actual border, but never skip across water.
    if(captured || this.lastAttackerLoss>0)faction.battleFocus=index;
    return true;
  }

  step(): void {
    if (this.paused || this.status !== 'playing') return;
    this.tick++;
    this.battleEvents.length=0;
    for(const faction of this.factions)faction.defenseFallenTick=0;
    if (this.tick >= this.aiGoalChange) {
      this.pickAIGoals();
      this.aiGoalChange = this.tick + 45;
    }
    this.recount();
    for(const faction of this.factions){
      if(!faction.alive)continue;
      // All residents are recruitable troops: a single clear growth figure.
      faction.troops+=faction.income;
      faction.money+=faction.moneyIncome;
      if(faction.ai)faction.campaignEnergy=Math.min(300*this.difficultySettings.marchMultiplier,
        faction.campaignEnergy+aiMarchRecovery(faction.income,aiStyle(faction.id))*this.difficultySettings.marchMultiplier);
    }
    if(this.tick%this.difficultySettings.cityInterval===0)this.developAI();
    this.redistributeFrontline();
    this.rebuildFrontierCandidates();
    for (const faction of this.factions) {
      if (!faction.alive) continue;
      if (faction.id === 0) {
        // Human troops move only when explicitly ordered by clicking an adjacent faction.
        this.resolveOrders(faction);
        continue;
      }
      const attempts=difficultyAttempts(aiAttacksPerTick(faction.territory,aiStyle(faction.id)),this.difficulty);
      for (let k = 0; k < attempts; k++) {
        if(faction.troops<8 || faction.campaignEnergy<8)break;
        const target = this.chooseFront(faction.id);
        if (target === -1 || !this.attack(faction, target)) break;
      }
    }
    this.recount();
    if (!this.factions[0].alive) {
      this.status = 'defeat';
      this.log(`${this.factions[0].name} wurde besiegt.`, '#ee788c');
    } else if (this.factions[0].territory / TOTAL_LAND >= 0.65 || this.factions.slice(1).every(f => !f.alive)) {
      this.status = 'victory';
      this.log('EUROPA steht unter deiner Kontrolle!', '#e9b85e');
    }
  }

  factionAt(point: Point): Faction | null {
    const x = Math.floor(point.x), y = Math.floor(point.y);
    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return null;
    const id = this.owner[y * MAP_WIDTH + x];
    return id >= 0 ? this.factions[id] : null;
  }
}
