import { GEO_BOUNDS, LAND_ROWS, MAP_HEIGHT, MAP_WIDTH, SEA_CROSSINGS, WORLD_HEIGHT, WORLD_WIDTH } from '../data/europe.js';
import {MaritimeNavigation,COASTS,validSeaRoute,voyageTicks,routeDistance,type SeaRoute} from './navigation.js';
import { COUNTRY_STARTS, countryByCode } from '../data/countries.js';
import { assessInvasion, interceptAttack, attackerCasualties, campaignEffort, empirePower, relativeAttackEffect } from './warfare.js';
import { attackFrontWidth, frontierBudget, frontierTarget, localDefenseStrength } from './frontline.js';
import { BUILDINGS, BUILDING_CODES, type BuildingType, FACTORY_INCOME, FACTORY_CONNECTION_MULTIPLIER, FACTORY_LINK_MAX_DISTANCE, troopGrowth, taxRevenue, cityUpgradeCost, cityUpgradeGrowth, upgradedCityRecruitment } from './economy.js';
import { findConnectedAttackFront } from './front-target.js';
import {aiStyle,scoreAIFront} from './ai-strategy.js';
import {aiMarchRecovery,aiAttacksPerTick,aiStrikeSize,aiRiskTolerance} from './ai-tactics.js';
import {formatCompact} from '../format.js';
import {chooseAdvancingSector,canReinforceFront} from './offensive-front.js';
import {frontTileOutcome,opposingArmies} from './front-combat.js';
import {DIFFICULTY_SETTINGS,isDifficulty,difficultyAttempts,difficultyDefenseBudget,difficultyRisk,type Difficulty,type DifficultySettings} from './difficulty.js';

export const WATER = -2;
export const NEUTRAL = -1;
export const TICK_SECONDS = 0.25;

export interface Point { x: number; y: number }
export type BorderMode='hold'|'defend'|'withdraw';
export interface BorderHotspot {
  index:number;point:Point;mode:BorderMode;guards:number;
  opponents:number[];attacked:boolean;urgency:number;
}
export interface Faction {
  id: number;
  name: string;
  capital: string;
  color: string;
  /** One shared inhabitant/army pool: includes mobile, stationed and deployed units. */
  troops: number;
  money: number;
  moneyIncome: number;
  /** Precise population cache refreshed every tick and real battle casualty. */
  population: number;
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
  /** AI warfare recovery, absent in pre-balancing saves. */
  warCooldownUntil?:number;
}
export interface City { name: string; x: number; y: number; index: number; original: number; owner: number; }
export interface GameEvent { tick: number; text: string; color: string; }
/** Bilateral non-aggression pact. Factions keep independent territory and armies. */
export interface Alliance { a:number; b:number; sinceTick:number; }
export interface AllianceOffer { from:number; to:number; untilTick:number; }
export interface DiplomaticCooldown { a:number; b:number; untilTick:number; }
export interface WarTruce { a:number; b:number; untilTick:number; }
export interface DefenseAid { from:number; to:number; troops:number; arrivalTick:number; }
export interface DiplomacyResult { ok:boolean; reason:string; }
export interface AllianceEvaluation {
  score:number; threshold:number; accepted:boolean; reason:string;
}
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
  /** Unspent fractional attack time carried into the next tick. */
  progress?: number;
  landing?: boolean;
  /** Paid soldiers remain at sea until this tick. */
  arrivalTick?:number;
  departure?:Point;
  startedTick?: number;
  /** Exact cell-by-cell ocean path, including both coastal endpoints. */
  seaRoute?: number[];
  seaDistanceKm?: number;
  returning?: boolean;
  returnStartedTick?: number;
  returnArrivalTick?: number;
}
export interface AttackResult { ok: boolean; reason: string; sent: number; targetOwner?: number; front?: Point; }
/** Only the NEXT contact sector is estimated; never claims guaranteed victory. */
export interface AttackAssessment {
  possible:boolean;reason:string;front?:Point;targetOwner?:number;
  troops:number;posted:number;loss:number;time:number;
  risk:'low'|'moderate'|'high';
}
export interface BuildResult { ok: boolean; reason: string; cost: number; type?: BuildingType; }
export interface CityUpgradeBatchResult { ok:boolean; reason:string; cost:number; upgrades:number; cities:number; finalLevel?:number; }
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

export interface GameSave {
  version:1;seed:number;playerCode:string;difficulty:Difficulty;tick:number;
  status:GameStatus;paused:boolean;doctrine:Doctrine;rngCalls:number;
  aiGoalChange:number;nextAttackId:number;
  owner:number[];defense:number[];buildings:number[];cityUpgrades:number[];frontline:number[];
  factions:Faction[];cities:City[];attackOrders:AttackOrder[];events:GameEvent[];
  /** Missing in v1 saves written before the diplomacy feature. */
  alliances?:Alliance[];offers?:AllianceOffer[];defenseAid?:DefenseAid[];
  diplomacyCooldowns?:DiplomaticCooldown[];warTruces?:WarTruce[];
  /** Optional compact per-sector player-only tactics; absent in old saves. */
  borderOrders?:Array<{index:number;mode:'defend'|'withdraw'}>;
  factoryLinks?:Array<{factory:number;city:number}>;
  factoryLevels?:Array<{index:number;level:number}>;
  squads?:Array<{id:number;owner:number;index:number;troops:number;destination:number|null;attackTarget?:number|null;campaignTarget?:number|null;campaignOwner?:number|null}>;
  rtsRecruitment?:boolean;
}

export class Game {
  readonly owner = new Int16Array(CELL_COUNT);
  readonly rtsRecruitment:boolean;
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
  readonly alliances:Alliance[]=[];
  readonly offers:AllianceOffer[]=[];
  readonly diplomacyCooldowns:DiplomaticCooldown[]=[];
  readonly warTruces:WarTruce[]=[];
  readonly borderOrders=new Map<number,'defend'|'withdraw'>();
  readonly factoryLinks=new Map<number,number>();
  readonly factoryLevels=new Map<number,number>();
  readonly squads:Array<{id:number;owner:number;index:number;troops:number;destination:number|null;attackTarget?:number|null;campaignTarget?:number|null;campaignOwner?:number|null}>=[];
  private nextSquadId=1;
  mobileNet=0;
  /** Real soldiers in transit to defend an attacked treaty partner. */
  readonly defenseAid:DefenseAid[]=[];
  /** Upgrade levels for buildable city sites: 0 = basic, 1–5 = improvements. */
  readonly cityUpgrades = new Uint8Array(CELL_COUNT);
  private nextAttackId = 1;
  private readonly navigation=new MaritimeNavigation();
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
  private rngCalls = 0;
  private aiGoalChange = 0;
  private frontierCandidates: Array<Set<number>> = [];
  private exposedCounts: number[] = [];

  constructor(seed = 2026, opponentCount = COUNTRY_STARTS.length-1, playerCountry = 'DE', difficulty:Difficulty='balanced', rtsRecruitment=false) {
    this.rtsRecruitment=rtsRecruitment;
    if(!isDifficulty(difficulty))throw new Error(`Unbekannter Schwierigkeitsgrad: ${String(difficulty)}`);
    this.difficulty=difficulty;
    this.difficultySettings=DIFFICULTY_SETTINGS[difficulty];
    const chosen = countryByCode(playerCountry);
    if (!chosen) throw new Error(`Unbekanntes Land: ${playerCountry}`);
    this.playerCode = chosen.code;
    this.seed = seed;
    const generator=seededRandom(seed);
    this.rng=()=>{this.rngCalls++;return generator();};
    this.owner.fill(WATER);
    for (let i = 0; i < CELL_COUNT; i++) if (isLand(i)) this.owner[i] = NEUTRAL;
    const starts = [chosen,...COUNTRY_STARTS.filter(c=>c.code!==chosen.code)]
      .slice(0, Math.max(1, Math.min(COUNTRY_STARTS.length, opponentCount + 1)));
    this.factions = starts.map((start, id) => ({
      id, name: start.name, capital: start.capital, color: factionColor(id),
      troops:id===0?90:this.difficultySettings.aiStartingTroops, money:this.rtsRecruitment?650:90, moneyIncome: 0, population: 0, militaryPower: 0, builtCities:0,
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
    const upgradeBonus=new Float64Array(this.factions.length);
    for(let i=0;i<CELL_COUNT;i++){
      const id=this.owner[i];
      if(id<0)continue;
      const faction=this.factions[id];
      faction.territory++;
      people[id]+=this.frontline[i];
      if(this.buildings[i]===BUILDING_CODES.city){
        faction.builtCities++;
        upgradeBonus[id]+=cityUpgradeGrowth(this.cityUpgrades[i]);
      }
    }
    for(const order of this.attackOrders)people[order.factionId]+=order.remaining;
    for(const aid of this.defenseAid)people[aid.from]+=aid.troops;
    for(const squad of this.squads)people[squad.owner]+=squad.troops; // In-transit soldiers are alive.
    for(const city of this.cities){
      city.owner=this.owner[city.index];
      if(city.owner>=0)this.factions[city.owner].cityCount++;
    }
    // Connections permanently break as soon as ownership diverges.
    // Without pruning, an interrupted link could silently revive after
    // reconquest in a continuous game, while save/load had omitted it.
    for(const [factory,city] of this.factoryLinks){
      if(this.owner[factory]<0||this.owner[factory]!==this.owner[city]||
         this.buildings[factory]!==BUILDING_CODES.factory||
         !(this.buildings[city]===BUILDING_CODES.city||this.capitalSites.has(city)))
        this.factoryLinks.delete(factory);
    }
    const factoryRevenue=new Float64Array(this.factions.length);
    for(let i=0;i<CELL_COUNT;i++)if(this.buildings[i]===BUILDING_CODES.factory&&this.owner[i]>=0){
      const city=this.factoryLinks.get(i);
      const active=city!==undefined&&this.owner[city]===this.owner[i]&&
        (this.buildings[city]===BUILDING_CODES.city||this.capitalSites.has(city))&&
        Math.hypot(i%MAP_WIDTH-city%MAP_WIDTH,Math.floor(i/MAP_WIDTH)-Math.floor(city/MAP_WIDTH))<=FACTORY_LINK_MAX_DISTANCE;
      // Developed trade hubs improve factory logistics up to +25 %.
      const hubLevel=active?this.cityUpgrades[city!]:0;
      const hubBonus=1+Math.min(5,hubLevel)*.05;
      factoryRevenue[this.owner[i]]+=FACTORY_INCOME*(1+(this.factoryLevels.get(i)??0)*.75)*(active?FACTORY_CONNECTION_MULTIPLIER*hubBonus:1);
    }
    for(const faction of this.factions){
      faction.alive=faction.territory>0;
      const totalPeople=people[faction.id];
      faction.population=totalPeople;
      faction.militaryPower=empirePower(totalPeople,faction.territory,faction.cityCount+faction.builtCities);
      const growth=troopGrowth(totalPeople,faction.territory,faction.cityCount,faction.builtCities+upgradeBonus[faction.id])
      +upgradedCityRecruitment(upgradeBonus[faction.id],faction.territory,faction.builtCities);
      faction.income=faction.id===0?growth*(this.doctrine==='fortify'?1.20:this.doctrine==='blitz'?.90:1):growth*this.difficultySettings.growthMultiplier;
      faction.moneyIncome=taxRevenue(totalPeople,faction.territory,faction.cityCount,faction.builtCities+upgradeBonus[faction.id])+factoryRevenue[faction.id];
    }
  }

  /** Residents and troops are the same people, regardless of deployment. */
  populationOf(id:number):number {
    const faction=this.factions[id];
    if(!faction)return 0;
    let all=faction.troops;
    for(let i=0;i<CELL_COUNT;i++)if(this.owner[i]===id)all+=this.frontline[i];
    for(const order of this.attackOrders)if(order.factionId===id)all+=order.remaining;
    for(const aid of this.defenseAid)if(aid.from===id)all+=aid.troops;
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

  /** Temporary AI-AI ceasefires after a real, finished territorial war. */
  isWarTruce(a:number,b:number):boolean {
    return a>0&&b>0&&a!==b&&this.warTruces.some(v=>
      v.a===Math.min(a,b)&&v.b===Math.max(a,b)&&v.untilTick>this.tick);
  }

  private establishWarTruce(a:number,b:number):void {
    if(a<=0||b<=0||a===b)return;
    const lo=Math.min(a,b),hi=Math.max(a,b),untilTick=this.tick+90;
    const old=this.warTruces.find(v=>v.a===lo&&v.b===hi);
    if(old)old.untilTick=Math.max(old.untilTick,untilTick);
    else this.warTruces.push({a:lo,b:hi,untilTick});
  }

  isAllied(a:number,b:number):boolean {
    return a!==b && this.alliances.some(v=>v.a===Math.min(a,b)&&v.b===Math.max(a,b));
  }

  alliesOf(id:number):number[] {
    return this.alliances.filter(v=>v.a===id||v.b===id)
      .map(v=>v.a===id?v.b:v.a).sort((a,b)=>a-b);
  }

  private hasHostilities(a:number,b:number):boolean {
    return this.attackOrders.some(o=>
      (o.factionId===a&&o.targetOwner===b)||
      (o.factionId===b&&o.targetOwner===a));
  }

  private canAlly(a:number,b:number):DiplomacyResult {
    if(this.diplomacyCooldowns.some(v=>v.a===Math.min(a,b)&&v.b===Math.max(a,b)&&v.untilTick>this.tick))
      return {ok:false,reason:'Nach der Kündigung ist erst eine diplomatische Abkühlzeit nötig.'};
    if(!Number.isInteger(a)||!Number.isInteger(b)||a===b||
       !this.factions[a]?.alive||!this.factions[b]?.alive||this.status!=='playing')
      return {ok:false,reason:'Diese Länder können kein Bündnis schließen.'};
    if(this.isAllied(a,b))return {ok:false,reason:'Diese Länder sind bereits verbündet.'};
    if(this.alliesOf(a).length>=2||this.alliesOf(b).length>=2)
      return {ok:false,reason:'Maximal zwei Bündnispartner je Land.'};
    if(this.hasHostilities(a,b))return {ok:false,reason:'Während eines aktiven Kriegs ist kein Bündnis möglich.'};
    return {ok:true,reason:'Bündnis möglich.'};
  }

  /** One treaty works in BOTH directions and costs neither territory nor troops. */
  private signAlliance(a:number,b:number):DiplomacyResult {
    const allowed=this.canAlly(a,b);if(!allowed.ok)return allowed;
    this.alliances.push({a:Math.min(a,b),b:Math.max(a,b),sinceTick:this.tick});
    this.alliances.sort((x,y)=>x.a-y.a||x.b-y.b);
    for(let i=this.offers.length-1;i>=0;i--){
      const o=this.offers[i];
      if((o.from===a&&o.to===b)||(o.from===b&&o.to===a))this.offers.splice(i,1);
    }
    this.log(`🤝 Bündnis: ${this.factions[a].name} und ${this.factions[b].name}.`,'#8dcdb1');
    this.redistributeFrontline();
    return {ok:true,reason:'Bündnis mit '+this.factions[b].name+' geschlossen.'};
  }

  /** Whether a COALITION makes strategic sense TO THE RECIPIENT.
   * Same deterministic evaluation for player requests and AI initiatives:
   * useful armed partners, local security, present threats and treaty load.
   * No random acceptance and no free troops. Pure read-only calculation.
   */
  evaluateAlliance(from:number,to:number):AllianceEvaluation {
    const invalid=this.canAlly(from,to);
    const threshold=46;
    if(!invalid.ok)return {score:0,threshold,accepted:false,reason:invalid.reason};
    const sponsor=this.factions[from],recipient=this.factions[to];
    const sponsorPower=Math.max(1,sponsor.militaryPower||sponsor.population+32);
    const recipientPower=Math.max(1,recipient.militaryPower||recipient.population+32);
    // A weak would-be ally is often a liability to a much stronger country.
    const strength=Math.max(-39,Math.min(23,Math.log(sponsorPower/recipientPower)*14));
    const ac=this.cities[from],bc=this.cities[to];
    const distance=Math.hypot(ac.x-bc.x,ac.y-bc.y);
    const proximity=Math.max(-13,Math.min(15,14-distance*.22));
    const incoming=this.attackOrders.filter(o=>o.targetOwner===to&&o.factionId!==from&&
      o.remaining>0&&!o.returning);
    const pressure=Math.min(22,incoming.length*9);
    const sponsorEnemies=new Set(this.attackOrders.filter(o=>o.factionId===from&&
      o.targetOwner>=0&&o.remaining>0&&!o.returning).map(o=>o.targetOwner));
    const recipientEnemies=new Set(incoming.map(o=>o.factionId));
    const sharedRivals=[...sponsorEnemies].filter(enemy=>recipientEnemies.has(enemy)).length;
    const commonInterests=Math.min(12,sharedRivals*6);
    // The partner may drag the recipient into ongoing conflicts.
    const obligations=Math.min(22,sponsorEnemies.size*7);
    const commitments=this.alliesOf(to).length*9;
    const score=Math.round(52+strength+proximity+pressure+commonInterests-obligations-commitments);
    const accepted=score>=threshold;
    const reason=accepted
      ? pressure?'Strategisch sinnvoll: Schutz gegen laufende Angriffe.':
        strength>8?'Strategisch sinnvoll: militärisch wertvoller Partner.':
        proximity>4?'Strategisch sinnvoll: nahegelegener Partner.':
        'Bündnis bringt ausreichend strategischen Nutzen.'
      : strength< -15?'Angebot abgelehnt: zu geringer militärischer Nutzen.'
        : obligations>=14?'Angebot abgelehnt: zu viele Kriege des möglichen Partners.'
        : commitments?'Angebot abgelehnt: bereits zu viele Verpflichtungen.'
        :'Angebot abgelehnt: kein ausreichender strategischer Vorteil.';
    return {score,threshold,accepted,reason};
  }

  offerAlliance(from:number,to:number):DiplomacyResult {
    const allowed=this.canAlly(from,to);if(!allowed.ok)return allowed;
    if(this.offers.some(o=>o.from===from&&o.to===to))
      return {ok:false,reason:'Bündnisangebot ist bereits offen.'};
    if(to===0){
      if(this.offers.some(o=>o.to===0))return {ok:false,reason:'Du hast bereits ein offenes Bündnisangebot.'};
      this.offers.push({from,to,untilTick:this.tick+240});
      this.log(`🤝 Bündnisangebot von ${this.factions[from].name} erhalten.`,'#8dcdb1');
      return {ok:true,reason:'Bündnisangebot erhalten.'};
    }
    const evaluation=this.evaluateAlliance(from,to);
    if(!evaluation.accepted)return {ok:false,reason:`${this.factions[to].name}: ${evaluation.reason}`};
    return this.signAlliance(from,to);
  }

  respondAlliance(from:number,accept:boolean):DiplomacyResult {
    const i=this.offers.findIndex(o=>o.from===from&&o.to===0&&o.untilTick>this.tick);
    if(i<0)return {ok:false,reason:'Kein gültiges Bündnisangebot vorhanden.'};
    this.offers.splice(i,1);
    if(!accept)return {ok:true,reason:'Bündnisangebot abgelehnt.'};
    return this.signAlliance(0,from);
  }

  leaveAlliance(a:number,b:number):DiplomacyResult {
    if(!this.isAllied(a,b))return {ok:false,reason:'Es besteht kein Bündnis.'};
    const i=this.alliances.findIndex(v=>v.a===Math.min(a,b)&&v.b===Math.max(a,b));
    this.alliances.splice(i,1);
    this.diplomacyCooldowns.push({a:Math.min(a,b),b:Math.max(a,b),untilTick:this.tick+120});
    this.log(`Bündnis beendet: ${this.factions[a].name} und ${this.factions[b].name}.`,'#e2bc87');
    return {ok:true,reason:'Bündnis mit '+this.factions[b].name+' beendet.'};
  }

  /** Low-frequency AI diplomacy: at most one negotiation per cycle. */
  private updateDiplomacy():void {
    for(let i=this.warTruces.length-1;i>=0;i--)
      if(this.warTruces[i].untilTick<=this.tick)this.warTruces.splice(i,1);
    for(let i=this.diplomacyCooldowns.length-1;i>=0;i--)
      if(this.diplomacyCooldowns[i].untilTick<=this.tick)
        this.diplomacyCooldowns.splice(i,1);
    for(let i=this.offers.length-1;i>=0;i--)
      if(this.offers[i].untilTick<=this.tick||!this.factions[this.offers[i].from].alive)
        this.offers.splice(i,1);
    this.alliances.splice(0,this.alliances.length,
      ...this.alliances.filter(a=>this.factions[a.a].alive&&this.factions[a.b].alive));
    if(this.tick<120||this.tick%120!==0)return;
    const sender=1+(Math.floor(this.tick/120)%Math.max(1,this.factions.length-1));
    if(!this.factions[sender]?.alive||this.alliesOf(sender).length>=2)return;
    const targets=this.factions.filter(f=>f.id!==sender&&f.alive&&!this.isAllied(sender,f.id))
      .filter(f=>this.canAlly(sender,f.id).ok)
      // Evaluate both sides before contacting anyone: do not propose a
      // coalition the receiving AI regards as strategically useless.
      .sort((a,b)=>this.evaluateAlliance(sender,b.id).score-this.evaluateAlliance(sender,a.id).score||a.id-b.id);
    const target=targets[0];
    if(target&&this.evaluateAlliance(sender,target.id).accepted&&
      (target.id===0||this.evaluateAlliance(target.id,sender).accepted))
      this.offerAlliance(sender,target.id);
  }

  /** Dispatch AI-controlled allies' REAL mobile troops when a partner is
   * actively invaded. Support is deliberately modest and has an eight-tick
   * travel delay; the player's reserves are NEVER spent automatically.
   */
  private dispatchDefensiveAid():void {
    if(this.tick%24!==0)return;
    for(const pact of this.alliances){
      for(const [from,to] of [[pact.a,pact.b],[pact.b,pact.a]]){
        const donor=this.factions[from],recipient=this.factions[to];
        if(!donor.ai||!donor.alive||!recipient.alive)continue;
        const invaded=this.attackOrders.some(o=>o.targetOwner===to&&o.factionId!==to&&
          !this.isAllied(o.factionId,to)&&o.remaining>0&&!o.returning);
        if(!invaded||this.defenseAid.some(a=>a.from===from&&a.to===to))continue;
        // A donor must first protect its own homeland and other obligations.
        const reserve=Math.max(60,donor.income*7);
        const available=Math.max(0,donor.troops-reserve);
        const amount=Math.floor(Math.min(available,donor.troops*.06,
          Math.max(6,donor.income*1.8),36));
        if(amount<2)continue;
        donor.troops-=amount;
        this.defenseAid.push({from,to,troops:amount,arrivalTick:this.tick+8});
        if(to===0)this.log(`🤝 ${donor.name} sendet ${formatCompact(amount)} Verteidiger (8 Ticks Reisezeit).`,'#8dcdb1');
      }
    }
  }

  private deliverDefensiveAid():void {
    for(let i=this.defenseAid.length-1;i>=0;i--){
      const aid=this.defenseAid[i];
      if(aid.arrivalTick>this.tick)continue;
      const recipient=this.factions[aid.to],sender=this.factions[aid.from];
      // Broken pacts return survivors to their donor; conquered donors
      // cannot receive back their army, so survivors aid the old recipient.
      const delivered=recipient.alive&&(this.isAllied(aid.from,aid.to)||!sender.alive);
      if(delivered){
        recipient.troops+=aid.troops;
        if(aid.to===0)this.log(`🤝 ${formatCompact(aid.troops)} alliierte Verteidiger eingetroffen.`,'#8dcdb1');
      }else if(sender.alive)sender.troops+=aid.troops;
      else sender.attackFallen+=aid.troops;
      this.defenseAid.splice(i,1);
    }
  }

  private log(text: string, color = '#b9c4d0') {
    this.events.unshift({ tick: this.tick, text, color });
    if (this.events.length > 8) this.events.length = 8;
  }

  buildingAt(point:Point):BuildingType|null {
    const x=Math.floor(point.x),y=Math.floor(point.y);
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||x<0||y<0||x>=MAP_WIDTH||y>=MAP_HEIGHT)return null;
    const code=this.buildings[y*MAP_WIDTH+x];
    return code===BUILDING_CODES.city?'city':code===BUILDING_CODES.tower?'tower':code===BUILDING_CODES.factory?'factory':code===BUILDING_CODES.barracks?'barracks':null;
  }

  cityLevelAt(point:Point):number {
    const x=Math.floor(point.x),y=Math.floor(point.y);
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||x<0||y<0||x>=MAP_WIDTH||y>=MAP_HEIGHT)return 0;
    const index=y*MAP_WIDTH+x;
    return this.buildings[index]===BUILDING_CODES.city?this.cityUpgrades[index]:0;
  }

  canUpgradeCity(id:number,point:Point):BuildResult {
    const fail=(reason:string):BuildResult=>({ok:false,reason,cost:0});
    const faction=this.factions[id];
    if(!faction?.alive||this.status!=='playing')return fail('Dieses Land kann nicht bauen.');
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return fail('Ungültige Position.');
    const x=Math.floor(point.x),y=Math.floor(point.y);
    if(x<0||y<0||x>=MAP_WIDTH||y>=MAP_HEIGHT)return fail('Außerhalb der Karte.');
    const index=y*MAP_WIDTH+x;
    if(this.owner[index]!==id)return fail('Nur eigene Städte verbessern.');
    if(this.buildings[index]!==BUILDING_CODES.city)return fail('Hier steht keine ausbaubare Stadt.');
    const level=this.cityUpgrades[index];
    if(level>=5)return fail('Maximalstufe 5 erreicht.');
    const cost=cityUpgradeCost(level);
    if(faction.money<cost)return fail('Zu wenig Geld: '+cost+' benötigt.');
    return {ok:true,reason:'Stadt auf Stufe '+(level+1)+' ausbauen.',cost,type:'city'};
  }

  upgradeCity(id:number,point:Point):BuildResult {
    const permission=this.canUpgradeCity(id,point);
    if(!permission.ok)return permission;
    const index=pointToIndex(point);
    this.factions[id].money-=permission.cost;
    this.cityUpgrades[index]++;
    this.recount();
    if(id===0)this.log('Stadt auf Stufe '+this.cityUpgrades[index]+' ausgebaut · -'+permission.cost+' Geld.',this.factions[id].color);
    return {ok:true,reason:'Stadt Stufe '+this.cityUpgrades[index],cost:permission.cost,type:'city'};
  }

  /** Plan paid improvements without mutating the world. Cheapest tiers first
   * across all owned cities, in stable sector order, so a batch buys the most
   * individual upgrades possible with available gold. Capitals retain their
   * existing separate rules and are not upgradable buildings.
   */
  private planCityUpgrades(id:number,scope:'single'|'all',point?:Point):{
    steps:Array<{index:number;cost:number}>;result:CityUpgradeBatchResult
  } {
    const empty=(reason:string)=>({steps:[],result:{
      ok:false,reason,cost:0,upgrades:0,cities:0,
    } as CityUpgradeBatchResult});
    const faction=this.factions[id];
    if(!faction?.alive||this.status!=='playing')return empty('Dieses Land kann nicht bauen.');
    let sites:number[];
    if(scope==='single'){
      if(!point||!Number.isInteger(point.x)||!Number.isInteger(point.y)||
         point.x<0||point.y<0||point.x>=MAP_WIDTH||point.y>=MAP_HEIGHT)
        return empty('Ungültige Stadtposition.');
      const index=pointToIndex(point);
      if(this.owner[index]!==id)return empty('Nur eigene Städte verbessern.');
      if(this.buildings[index]!==BUILDING_CODES.city)return empty('Hier steht keine ausbaubare Stadt.');
      if(this.cityUpgrades[index]>=5)return empty('Maximalstufe 5 erreicht.');
      sites=[index];
    }else{
      sites=[];
      for(let index=0;index<CELL_COUNT;index++){
        if(this.owner[index]===id&&this.buildings[index]===BUILDING_CODES.city&&this.cityUpgrades[index]<5)
          sites.push(index);
      }
      if(!sites.length)return empty('Keine eigenen ausbaubaren Städte vorhanden.');
    }
    let gold=faction.money;
    const steps:Array<{index:number;cost:number}>=[];
    // Levels cost [250,450,750,1150,1700]; all cities receive cheaper
    // improvements before any expensive tier, making results predictable.
    const planned=new Uint8Array(sites.map(index=>this.cityUpgrades[index]));
    for(let level=0;level<5;level++){
      const cost=cityUpgradeCost(level);
      if(gold<cost)break;
      for(let i=0;i<sites.length;i++){
        if(planned[i]!==level||gold<cost)continue;
        steps.push({index:sites[i],cost});
        planned[i]++;
        gold-=cost;
      }
    }
    if(!steps.length)return empty('Nicht genug Geld für die nächste Ausbaustufe.');
    const spent=faction.money-gold;
    const cities=new Set(steps.map(step=>step.index)).size;
    return {steps,result:{
      ok:true,reason:scope==='single'?'Stadt bis zur bezahlbaren Stufe ausbauen.':
        'Alle eigenen Städte nach Ausbaustufenkosten verbessern.',
      cost:spent,upgrades:steps.length,cities,
      ...(scope==='single'?{finalLevel:planned[0]}:{}),
    }};
  }

  /** Exact affordable preview for the context menu; never spends gold. */
  previewCityUpgrades(id:number,scope:'single'|'all',point?:Point):CityUpgradeBatchResult {
    return this.planCityUpgrades(id,scope,point).result;
  }

  /** One transaction, one growth recalculation and one event for any number
   * of individual upgrades. No free levels and no partial unrecorded costs.
   */
  upgradeCities(id:number,scope:'single'|'all',point?:Point):CityUpgradeBatchResult {
    const plan=this.planCityUpgrades(id,scope,point);
    if(!plan.result.ok)return plan.result;
    this.factions[id].money-=plan.result.cost;
    for(const step of plan.steps)this.cityUpgrades[step.index]++;
    this.recount();
    if(id===0)this.log(
      `${plan.result.cities} Städte · ${plan.result.upgrades} Ausbaustufen · -${plan.result.cost} Geld.`,
      this.factions[id].color);
    return {...plan.result,reason:scope==='single'
      ?`Stadt auf Stufe ${plan.result.finalLevel} ausgebaut.`
      :`${plan.result.cities} Städte um ${plan.result.upgrades} Stufen ausgebaut.`};
  }

  /** Only towers still owned by the defender offer support. Adjacent and nearby
   * towers contribute at most two stacks; no map-wide damage aura. */
  private towerSupport(id:number,index:number):number {
    if(id<0)return 0;
    const x=index%MAP_WIDTH,y=Math.floor(index/MAP_WIDTH);
    let count=0;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      if(dx*dx+dy*dy>4)continue;
      const xx=x+dx,yy=y+dy;
      if(xx<0||yy<0||xx>=MAP_WIDTH||yy>=MAP_HEIGHT)continue;
      const at=yy*MAP_WIDTH+xx;
      if(this.owner[at]===id&&this.buildings[at]===BUILDING_CODES.tower&&++count>=2)return 2;
    }
    return count;
  }

  factoryLevel(point:Point):number {
    const i=pointToIndex(point);
    return this.buildings[i]===BUILDING_CODES.factory?1+(this.factoryLevels.get(i)??0):0;
  }
  upgradeFactory(id:number,point:Point):BuildResult {
    const i=pointToIndex(point),level=this.factoryLevel(point);
    const cost=level*250;
    if(!Number.isInteger(point.x)||!Number.isInteger(point.y)||point.x<0||point.y<0||point.x>=MAP_WIDTH||point.y>=MAP_HEIGHT||
      this.status!=='playing'||this.owner[i]!==id||!this.factions[id]?.alive||!level||level>=5)
      return {ok:false,reason:'Keine ausbaubare eigene Fabrik (maximal Stufe 5).',cost:0};
    if(this.factions[id].money<cost)return {ok:false,reason:'Zu wenig Gold für Fabrikausbau.',cost};
    this.factions[id].money-=cost;this.factoryLevels.set(i,level);
    this.recount();return {ok:true,reason:'Fabrik auf Stufe '+(level+1)+' ausgebaut.',cost,type:'factory'};
  }
  /** A paid factory links to one actual owned city inside a short radius. */
  connectFactory(id:number,point:Point,cityPoint:Point):DiplomacyResult {
    const factory=pointToIndex(point),city=pointToIndex(cityPoint);
    if(![point.x,point.y,cityPoint.x,cityPoint.y].every(Number.isInteger)||
      point.x<0||point.y<0||cityPoint.x<0||cityPoint.y<0||
      point.x>=MAP_WIDTH||cityPoint.x>=MAP_WIDTH||point.y>=MAP_HEIGHT||cityPoint.y>=MAP_HEIGHT||
      this.owner[factory]!==id||this.owner[city]!==id||
      this.buildings[factory]!==BUILDING_CODES.factory||
      !(this.buildings[city]===BUILDING_CODES.city||this.capitalSites.has(city))||
      Math.hypot(point.x-cityPoint.x,point.y-cityPoint.y)>FACTORY_LINK_MAX_DISTANCE)
      return {ok:false,reason:'Fabrik und eigene Stadt müssen höchstens 12 Sektoren auseinanderliegen.'};
    this.factoryLinks.set(factory,city);this.recount();
    return {ok:true,reason:'Fabrik mit Stadt verbunden · +50 % Produktion.'};
  }

  nearbyFactoryCity(point:Point):Point|null {
    const id=this.owner[pointToIndex(point)];if(id<0)return null;
    let best=-1,dist=Infinity;
    for(const city of this.cities){
      if(city.owner!==id)continue;
      const d=Math.hypot(point.x-city.x,point.y-city.y);
      if(d<=FACTORY_LINK_MAX_DISTANCE&&d<dist){best=city.index;dist=d;}
    }
    for(let i=0;i<CELL_COUNT;i++)if(this.owner[i]===id&&this.buildings[i]===BUILDING_CODES.city){
      const d=Math.hypot(point.x-i%MAP_WIDTH,point.y-Math.floor(i/MAP_WIDTH));
      if(d<=FACTORY_LINK_MAX_DISTANCE&&d<dist){best=i;dist=d;}
    }
    return best<0?null:cellToPoint(best);
  }

  canBuild(id:number,point:Point,type:BuildingType):BuildResult {
    const fail=(reason:string):BuildResult=>({ok:false,reason,cost:0});
    const faction=this.factions[id];
    if(!faction?.alive||this.status!=='playing')return fail('Dieses Land kann nicht bauen.');
    if(type!=='city'&&type!=='tower'&&type!=='factory'&&type!=='barracks')return fail('Unbekanntes Gebäude.');
    const x=Math.floor(point.x),y=Math.floor(point.y);
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||x<0||y<0||x>=MAP_WIDTH||y>=MAP_HEIGHT)return fail('Außerhalb der Karte.');
    const index=y*MAP_WIDTH+x;
    if(this.owner[index]!==id)return fail('Nur auf eigenem Land bauen.');
    if(this.capitalSites.has(index))return fail('Die Hauptstadt ist bereits bebaut.');
    if(this.buildings[index])return fail('Hier steht bereits ein Gebäude.');
    const def=BUILDINGS.find(b=>b.type===type)!;
    if(faction.money<def.cost)return fail(`Zu wenig Geld: ${def.cost} benötigt.`);
    return {ok:true,reason:type==='tower'?'Abwehrturm bauen.':type==='factory'?'Fabrik bauen.':type==='barracks'?'Kaserne bauen.':'Stadt bauen.',cost:def.cost,type};
  }

  build(id:number,point:Point,type:BuildingType):BuildResult {
    const permission=this.canBuild(id,point,type);
    if(!permission.ok)return permission;
    const faction=this.factions[id];
    faction.money-=permission.cost;
    this.buildings[pointToIndex(point)]=BUILDING_CODES[type];
    this.cityUpgrades[pointToIndex(point)]=0;
    this.recount();
    if(id===0)this.log(`${type==='tower'?'Abwehrturm':type==='factory'?'Fabrik':type==='barracks'?'Kaserne':'Stadt'} gebaut · -${permission.cost} Geld.`,faction.color);
    return {ok:true,reason:type==='tower'?'Abwehrturm gebaut.':type==='factory'?'Fabrik gebaut.':type==='barracks'?'Kaserne gebaut.':'Stadt gebaut.',cost:permission.cost,type};
  }

  recruitSquad(owner:number,point:Point,count:number):DiplomacyResult {
    const index=pointToIndex(point),f=this.factions[owner];
    if(this.status!=='playing'||!f?.alive||this.owner[index]!==owner||
       this.buildings[index]!==BUILDING_CODES.barracks)
      return {ok:false,reason:'Hier steht keine eigene Kaserne.'};
    const cost=count*2;
    if(!Number.isInteger(count)||count<10||count>1000||
      f.money<cost||this.squads.filter(s=>s.owner===owner).length>=12)
      return {ok:false,reason:'Mindestens '+cost+' Geld und höchstens 12 Truppengruppen erforderlich.'};
    f.money-=cost;
    this.squads.push({id:this.nextSquadId++,owner,index,troops:count,destination:null,attackTarget:null,campaignTarget:null,campaignOwner:null});
    this.recount();
    return {ok:true,reason:count+' Soldaten für '+cost+' Geld ausgebildet.'};
  }

  orderSquad(owner:number,squadId:number,target:Point):DiplomacyResult {
    const squad=this.squads.find(s=>s.id===squadId&&s.owner===owner);
    if(!squad||!Number.isInteger(target.x)||!Number.isInteger(target.y)||
       target.x<0||target.y<0||target.x>=MAP_WIDTH||target.y>=MAP_HEIGHT)
      return {ok:false,reason:'Ungültige Truppe oder Zielposition.'};
    const destination=pointToIndex(target);
    if(this.owner[destination]!==owner)return {ok:false,reason:'Truppenmarsche sind zunächst nur auf eigenem Gebiet möglich.'};
    squad.destination=destination;
    squad.attackTarget=null;squad.campaignTarget=null;squad.campaignOwner=null;
    return {ok:true,reason:'Marschbefehl erteilt.'};
  }

  orderSquadAttack(owner:number,squadId:number,target:Point):DiplomacyResult {
    const squad=this.squads.find(s=>s.owner===owner&&s.id===squadId);
    if(!squad||!Number.isInteger(target.x)||!Number.isInteger(target.y)||
      target.x<0||target.y<0||target.x>=MAP_WIDTH||target.y>=MAP_HEIGHT)
      return {ok:false,reason:'Truppe oder Ziel ungültig.'};
    const targetIndex=pointToIndex(target),defender=this.owner[targetIndex];
    if(defender===WATER||defender===owner||this.isAllied(owner,defender))
      return {ok:false,reason:'Kein angreifbares Gebiet.'};
    const distance=new Int32Array(CELL_COUNT);distance.fill(-1);
    const queue=[squad.index];distance[squad.index]=0;
    let front=-1,enemy=-1,head=0,best=Infinity;
    while(head<queue.length){
      const cell=queue[head++];
      for(const next of LAND_NEIGHBORS[cell]){
        if(this.owner[next]===defender){
          const score=Math.hypot(next%MAP_WIDTH-target.x,Math.floor(next/MAP_WIDTH)-target.y)*2+distance[cell];
          if(score<best){best=score;front=cell;enemy=next;}
        }else if(this.owner[next]===owner&&distance[next]<0){
          distance[next]=distance[cell]+1;queue.push(next);
        }
      }
    }
    if(front<0)return {ok:false,reason:'Kein erreichbarer Landübergang zu diesem Gegner.'};
    squad.destination=front;squad.attackTarget=enemy;
    squad.campaignTarget=targetIndex;squad.campaignOwner=defender;
    return {ok:true,reason:'Truppe marschiert zur Front und erobert dann feindliches Gebiet.'};
  }

  /** Commit exactly a selected squad to the existing deterministic frontline.
   * Other mobile reserves must never be consumed by this order.
   */
  attackWithSquad(owner:number,squadId:number,target:Point):AttackResult {
    const fail=(reason:string):AttackResult=>({ok:false,reason,sent:0});
    const squadIndex=this.squads.findIndex(s=>s.id===squadId&&s.owner===owner);
    if(squadIndex<0||!Number.isInteger(target.x)||!Number.isInteger(target.y)||
      target.x<0||target.y<0||target.x>=MAP_WIDTH||target.y>=MAP_HEIGHT)
      return fail('Truppe oder Ziel ungültig.');
    const squad=this.squads[squadIndex],targetIndex=pointToIndex(target);
    if(this.owner[squad.index]!==owner||this.owner[targetIndex]===owner||
       !LAND_NEIGHBORS[squad.index].includes(targetIndex))
      return fail('Truppengruppe muss direkt an der feindlichen Landgrenze stehen.');
    const faction=this.factions[owner];
    const reserve=faction.troops;
    // The squad is the only available mobile pool during commitment.
    this.squads.splice(squadIndex,1);
    faction.troops=squad.troops;
    const result=this.issueAttack(owner,target,100,false);
    faction.troops+=reserve;
    if(!result.ok)this.squads.splice(squadIndex,0,squad);
    this.recount();
    return result;
  }

  recallSquad(owner:number,squadId:number):DiplomacyResult {
    const i=this.squads.findIndex(s=>s.id===squadId&&s.owner===owner);
    if(i<0)return {ok:false,reason:'Truppengruppe nicht gefunden.'};
    const squad=this.squads[i];
    if(this.owner[squad.index]!==owner)return {ok:false,reason:'Truppengruppe befindet sich nicht auf eigenem Gebiet.'};
    this.factions[owner].troops+=squad.troops;this.squads.splice(i,1);this.recount();
    return {ok:true,reason:'Soldaten zur mobilen Reserve zurückgezogen.'};
  }

  /** Same building and recruitment actions as the player. AI only issues
   * real paid orders. Staggered to keep 50-country turns inexpensive.
   */
  private commandRTSAI():void {
    if(!this.rtsRecruitment||!this.factions.some(f=>f.ai&&f.alive&&this.tick%8===f.id%8))return;
    // Build a single spatial index per AI turn rather than scanning every
    // map cell for each of up to 49 countries.
    const barracksSites=new Int32Array(this.factions.length).fill(-1);
    const constructionSites=new Int32Array(this.factions.length).fill(-1);
    const constructionDist=new Float64Array(this.factions.length).fill(Infinity);
    for(let i=0;i<CELL_COUNT;i++){
      const id=this.owner[i];
      if(id<=0||!this.factions[id]?.alive)continue;
      if(this.buildings[i]===BUILDING_CODES.barracks){
        if(barracksSites[id]<0)barracksSites[id]=i;
      }else if(!this.buildings[i]&&!this.capitalSites.has(i)){
        const base=pointToIndex(this.factions[id].target);
        const dist=Math.abs(i%MAP_WIDTH-base%MAP_WIDTH)+
          Math.abs(Math.floor(i/MAP_WIDTH)-Math.floor(base/MAP_WIDTH));
        if(dist<constructionDist[id]){constructionDist[id]=dist;constructionSites[id]=i;}
      }
    }
    for(const faction of this.factions){
      if(!faction.ai||!faction.alive)continue;
      if(this.tick%8!==faction.id%8)continue;
      const own=this.squads.filter(s=>s.owner===faction.id);
      const barracks=barracksSites[faction.id];
      if(barracks<0){
        if(faction.money>=280&&constructionSites[faction.id]>=0)
          this.build(faction.id,cellToPoint(constructionSites[faction.id]),'barracks');
        continue;
      }
      if(own.length<Math.min(5,Math.max(2,Math.ceil(faction.territory/150)))&&faction.money>=100){
        this.recruitSquad(faction.id,cellToPoint(barracks),Math.min(100,Math.floor(faction.money/2)));
      }
      // Build up to three separate threatened fronts. Soldiers are assigned
      // physically from idle formations; a distant campaign stays committed.
      const enemyUnits=this.squads.filter(u=>u.owner!==faction.id&&
        !this.isAllied(faction.id,u.owner));
      const borderThreats=new Map<number,number>();
      for(const enemy of enemyUnits){
        // Intercept up to two cells ahead: waiting until contact is too late
        // when undefended territory can be swept by an attacking formation.
        const threatened=new Set<number>(LAND_NEIGHBORS[enemy.index]);
        for(const neighbor of LAND_NEIGHBORS[enemy.index])
          for(const next of LAND_NEIGHBORS[neighbor])threatened.add(next);
        for(const tile of threatened){
          if(this.owner[tile]!==faction.id)continue;
          const valuable=this.capitalSites.has(tile)||this.buildings[tile]!==0;
          const score=enemy.troops+(valuable?90:0);
          borderThreats.set(tile,(borderThreats.get(tile)??0)+score);
        }
      }
      const plannedFronts=[...borderThreats].sort((a,b)=>b[1]-a[1]||a[0]-b[0])
        .filter(([tile],_,all)=>all.length>0)
        .slice(0,16);
      const frontPositions:number[]=[];
      for(const [tile] of plannedFronts){
        if(frontPositions.length>=3)break;
        const x=tile%MAP_WIDTH,y=Math.floor(tile/MAP_WIDTH);
        if(frontPositions.some(t=>Math.abs(t%MAP_WIDTH-x)+
          Math.abs(Math.floor(t/MAP_WIDTH)-y)<6))continue;
        frontPositions.push(tile);
      }
      const assignedDefenders=new Set<number>();
      // Keep one available unit as a rear reserve when there are at least
      // three formations; only the others receive frontline positions.
      const available=own.filter(u=>u.troops>=20&&u.destination===null&&
        u.attackTarget==null&&u.campaignTarget==null)
        .sort((a,b)=>b.troops-a.troops||a.id-b.id);
      const deployable=own.length>=3?Math.max(0,available.length-1):available.length;
      let deployments=0;
      for(const target of frontPositions){
        const already=own.some(u=>u.index===target||u.destination===target);
        if(already||deployments>=deployable)continue;
        const candidate=available.find(u=>!assignedDefenders.has(u.id));
        if(!candidate)break;
        const order=this.orderSquad(faction.id,candidate.id,cellToPoint(target));
        if(order.ok){assignedDefenders.add(candidate.id);deployments++;}
      }
      const totalReady=own.reduce((sum,u)=>sum+u.troops,0);
      const strongestThreat=enemyUnits.reduce((max,u)=>{
        if(!LAND_NEIGHBORS[u.index].some(n=>this.owner[n]===faction.id))return max;
        return Math.max(max,u.troops);
      },0);
      // No single understrength squad should charge into an obvious
      // superior neighboring formation. Group units around a rally point.
      const rally=own.length?own.reduce((a,b)=>a.troops>=b.troops?a:b):null;
      // Follow a real ongoing offensive instead of scattering reinforcements.
      // Every reinforcement must still travel through legal connected terrain.
      const offensive=own.find(u=>u.troops>=20&&u.campaignTarget!=null&&
        u.campaignOwner!=null&&u.campaignOwner!==faction.id&&
        this.owner[u.campaignTarget]!==faction.id&&
        (this.owner[u.campaignTarget]===u.campaignOwner||
         this.owner[u.campaignTarget]===NEUTRAL));
      const reinforceTarget=offensive?.campaignTarget??null;
      // No abstract issueAttack: mobilize units by actual contiguous paths.
      for(const squad of own){
        // Damaged AI forces retreat to their barracks instead of blindly
        // feeding the enemy. The remaining troops stay physical and alive.
        if(squad.troops<20){
          if(squad.index!==barracks&&squad.destination!==barracks)
            this.orderSquad(faction.id,squad.id,cellToPoint(barracks));
          continue;
        }
        if(assignedDefenders.has(squad.id))continue;
        // Retreat only from a clearly superior *adjacent* enemy and only
        // to a safe, owned neighboring sector. This is a real one-cell move.
        const adjacentEnemies=enemyUnits.filter(enemy=>
          LAND_NEIGHBORS[squad.index].includes(enemy.index));
        const enemyStrength=adjacentEnemies.reduce((sum,u)=>sum+u.troops,0);
        if(enemyStrength>squad.troops*2&&squad.troops>=1){
          const safe=LAND_NEIGHBORS[squad.index].filter(tile=>
            this.owner[tile]===faction.id&&
            !enemyUnits.some(enemy=>LAND_NEIGHBORS[tile].includes(enemy.index)));
          if(safe.length){
            const retreat=safe.sort((x,y)=>{
              const dist=(tile:number)=>Math.abs(tile%MAP_WIDTH-barracks%MAP_WIDTH)+
                Math.abs(Math.floor(tile/MAP_WIDTH)-Math.floor(barracks/MAP_WIDTH));
              return dist(x)-dist(y)||x-y;
            })[0];
            const order=this.orderSquad(faction.id,squad.id,cellToPoint(retreat));
            if(order.ok)continue;
          }
        }
        if(strongestThreat>squad.troops*1.4&&totalReady>=strongestThreat&&rally&&
           squad.id!==rally.id&&squad.index!==rally.index){
          this.orderSquad(faction.id,squad.id,cellToPoint(rally.index));continue;
        }
        // Preserve multi-sector campaigns: a transient null waypoint does
        // not mean the player/AI's long-distance goal has been abandoned.
        if(squad.destination!==null||squad.attackTarget!=null||squad.campaignTarget!=null)continue;
        if(reinforceTarget!=null&&offensive&&offensive.id!==squad.id&&squad.troops>=20){
          const joined=this.orderSquadAttack(faction.id,squad.id,cellToPoint(reinforceTarget));
          if(joined.ok)continue;
        }
        const targets=LAND_NEIGHBORS[squad.index].filter(n=>
          this.owner[n]!==squad.owner&&this.owner[n]!==WATER&&
          !this.isAllied(squad.owner,this.owner[n]));
        const neutral=targets.find(n=>this.owner[n]===NEUTRAL);
        const next=neutral??targets[0];
        if(next!==undefined)this.orderSquadAttack(squad.owner,squad.id,cellToPoint(next));
        else {
          // Patrol towards a locally accessible enemy/neutral border.
          const frontier=this.chooseFront(faction.id);
          if(frontier>=0)this.orderSquadAttack(faction.id,squad.id,cellToPoint(frontier));
        }
      }
    }
  }

  /** Actual RTS contact combat: adjacent hostile formations damage each
   * other at once. Only the participating squads pay casualties.
   * No remote reserve withdrawals or phantom army creation.
   */
  private resolveSquadContacts():void {
    if(!this.rtsRecruitment)return;
    const byCell=new Map<number,typeof this.squads>();
    for(const unit of this.squads){
      const list=byCell.get(unit.index)??[];
      list.push(unit);byCell.set(unit.index,list);
    }
    const damage=new Map<number,number>();
    const engaged=new Set<number>();
    for(const unit of this.squads){
      for(const neighbor of LAND_NEIGHBORS[unit.index]){
        const foes=byCell.get(neighbor);
        if(!foes)continue;
        for(const enemy of foes){
          if(enemy.owner===unit.owner||this.isAllied(unit.owner,enemy.owner)||unit.id>=enemy.id)continue;
          // Resolve each pair exactly once, with simultaneous losses.
          const a=Math.min(unit.troops,Math.max(.25,enemy.troops*.085));
          const b=Math.min(enemy.troops,Math.max(.25,unit.troops*.085));
          damage.set(unit.id,(damage.get(unit.id)??0)+a);
          damage.set(enemy.id,(damage.get(enemy.id)??0)+b);
          engaged.add(unit.id);engaged.add(enemy.id);
          if(this.battleEvents.length<1600)this.battleEvents.push({
            tick:this.tick,index:enemy.index,attackerId:unit.owner,defenderId:enemy.owner,
            attacking:unit.troops,defending:enemy.troops,
            attackerLost:a,defenderLost:b,captured:false,
          });
        }
      }
    }
    // Stationary defense towers guard nearby sectors. Their fire damages
    // approaching ENEMY formations, never friendly/allied troops.
    // Tower hits remain independent of the squad-vs-squad pairs above.
    for(const unit of this.squads){
      let towers=0;
      for(const cell of [unit.index,...LAND_NEIGHBORS[unit.index]]){
        const defender=this.owner[cell];
        if(defender<0||defender===unit.owner||this.isAllied(defender,unit.owner))continue;
        if(this.buildings[cell]===BUILDING_CODES.tower)towers++;
      }
      if(!towers)continue;
      const loss=Math.min(unit.troops,Math.min(3,towers)*1.25);
      damage.set(unit.id,(damage.get(unit.id)??0)+loss);
      if(this.battleEvents.length<1600)this.battleEvents.push({
        tick:this.tick,index:unit.index,attackerId:unit.owner,defenderId:this.owner[unit.index],
        attacking:unit.troops,defending:towers,attackerLost:loss,defenderLost:0,captured:false,
      });
    }
    for(let i=this.squads.length-1;i>=0;i--){
      const unit=this.squads[i],loss=damage.get(unit.id)??0;
      if(loss<=0)continue;
      unit.troops=Math.max(0,unit.troops-loss);
      this.factions[unit.owner].attackFallen+=loss;
      if(unit.troops<1)this.squads.splice(i,1);
    }
  }

  private moveSquads():void {
    for(let i=this.squads.length-1;i>=0;i--){
      const squad=this.squads[i];
      if(this.owner[squad.index]!==squad.owner){
        this.factions[squad.owner].troops+=squad.troops;
        this.squads.splice(i,1);continue;
      }
      // Widen the occupied front around a physically present formation.
      // Expansion is a bounded connected flood, never a remote capture:
      // only neutral land and empty undefended hostile sectors are eligible.
      if(this.rtsRecruitment){
        const reached=new Set<number>([squad.index]);
        const queue:[number,number][]=[[squad.index,0]];
        let taken=0;
        for(let head=0;head<queue.length&&taken<30;head++){
          const [cell,depth]=queue[head];
          if(depth>=4)continue;
          for(const next of LAND_NEIGHBORS[cell]){
            if(reached.has(next))continue;
            reached.add(next);
            const holder=this.owner[next];
            if(holder===WATER||holder===squad.owner&&depth>=3)continue;
            if(holder>=0&&holder!==squad.owner){
              if(this.isAllied(squad.owner,holder)||
                 this.buildings[next]===BUILDING_CODES.tower||
                 this.squads.some(unit=>unit.owner===holder&&
                   (unit.index===next||LAND_NEIGHBORS[next].includes(unit.index))))continue;
              // Only the active invasion's original opponent may be swept up.
              if(squad.campaignOwner!==holder)continue;
            }
            if(holder!==squad.owner){
              if(taken>=30)break;
              this.captureTile(this.factions[squad.owner],next);taken++;
            }
            queue.push([next,depth+1]);
          }
        }
      }
      // A border waypoint can become stale while other armies capture land.
      // Re-plan instead of leaving the formation parked permanently at the
      // old front with a nonadjacent attack target.
      if(squad.destination===null&&squad.attackTarget!=null){
        const next=squad.attackTarget;
        if(!LAND_NEIGHBORS[squad.index].includes(next)||
           this.owner[next]===squad.owner||
           (this.owner[next]>=0&&this.isAllied(squad.owner,this.owner[next]))){
          squad.attackTarget=null;
        }
      }
      // A campaign is not finished at the first conquered border cell.
      // Compute the next step only after reaching the current waypoint.
      const goal=squad.campaignTarget;
      if(goal!==null&&goal!==undefined&&
         squad.destination===null&&squad.attackTarget==null){
        if(squad.index===goal){
          squad.campaignTarget=null;squad.campaignOwner=null;
        }else{
          const intended=squad.campaignOwner;
          const parent=new Int32Array(CELL_COUNT);parent.fill(-2);
          const queue=[squad.index];parent[squad.index]=-1;
          let head=0;
          while(head<queue.length&&parent[goal]===-2){
            const cell=queue[head++];
            for(const next of LAND_NEIGHBORS[cell]){
              if(parent[next]!==-2)continue;
              const holder=this.owner[next];
              if(holder!==squad.owner&&holder!==NEUTRAL&&holder!==intended)continue;
              if(holder>=0&&holder!==squad.owner&&this.isAllied(squad.owner,holder))continue;
              parent[next]=cell;queue.push(next);
            }
          }
          if(parent[goal]===-2){
            squad.campaignTarget=null;squad.campaignOwner=null;
          }else{
            let next=goal;
            while(parent[next]!==squad.index&&parent[next]!==-1)next=parent[next];
            if(this.owner[next]===squad.owner)squad.destination=next;
            else squad.attackTarget=next;
          }
        }
      }
      if(squad.attackTarget!==null&&squad.attackTarget!==undefined&&
         LAND_NEIGHBORS[squad.index].includes(squad.attackTarget)){
        const target=squad.attackTarget,enemy=this.owner[target];
        if(enemy===NEUTRAL){
          this.captureTile(this.factions[squad.owner],target);
          squad.index=target;squad.destination=null;squad.attackTarget=null;
          continue;
        }
        if(enemy>=0&&enemy!==squad.owner&&!this.isAllied(squad.owner,enemy)){
          // RTS territorial defense belongs to real units, not an abstract
          // garrison or a magically mobilized national reserve.
          const guards=this.squads.filter(unit=>unit.owner===enemy&&unit.index===target);
          const tower=this.buildings[target]===BUILDING_CODES.tower;
          if(guards.length){
            const defender=guards[0];
            const attackers=squad.troops,defenders=defender.troops;
            const defenderLost=Math.min(defenders,Math.max(1,attackers*.18));
            const attackerLost=Math.min(attackers,Math.max(.25,defenders*.035));
            defender.troops=Math.max(0,defenders-defenderLost);
            squad.troops=Math.max(0,attackers-attackerLost);
            this.factions[squad.owner].attackFallen+=attackerLost;
            this.factions[enemy].defenseSpent+=defenderLost;
            this.factions[enemy].defenseFallenTick+=defenderLost;
            this.factions[enemy].enemyFallen+=attackerLost;
            this.factions[squad.owner].enemyFallen+=defenderLost;
            if(this.battleEvents.length<1600)this.battleEvents.push({
              tick:this.tick,index:target,attackerId:squad.owner,defenderId:enemy,
              attacking:attackers,defending:defenders,attackerLost,
              defenderLost,captured:false,
            });
            if(defender.troops<1)this.squads.splice(this.squads.indexOf(defender),1);
            if(squad.troops<1){
              this.squads.splice(this.squads.indexOf(squad),1);
              continue;
            }
            if(defender.troops>=1)continue;
          }
          // A tower can inflict a small, real cost even without a defending
          // squad. Ordinary empty sectors are captured with ZERO losses.
          if(tower){
            const loss=Math.min(squad.troops,1.25);
            squad.troops-=loss;this.factions[squad.owner].attackFallen+=loss;
            if(this.battleEvents.length<1600)this.battleEvents.push({
              tick:this.tick,index:target,attackerId:squad.owner,defenderId:enemy,
              attacking:squad.troops+loss,defending:0,attackerLost:loss,
              defenderLost:0,captured:true,
            });
            if(squad.troops<1){this.squads.splice(this.squads.indexOf(squad),1);continue;}
          }
          this.captureTile(this.factions[squad.owner],target);
          squad.index=target;squad.destination=null;squad.attackTarget=null;
          continue;
        }
        squad.attackTarget=null;squad.destination=null;
      }
      if(squad.destination===null)continue;
      if(squad.index===squad.destination){squad.destination=null;continue;}
      const parents=new Map<number,number>([[squad.index,-1]]);
      const queue=[squad.index];
      let head=0;
      while(head<queue.length&&head<12000&&!parents.has(squad.destination)){
        const current=queue[head++];
        for(const next of LAND_NEIGHBORS[current]){
          if(this.owner[next]!==squad.owner||parents.has(next))continue;
          parents.set(next,current);queue.push(next);
        }
      }
      if(!parents.has(squad.destination)){squad.destination=null;continue;}
      let next=squad.destination;
      while(parents.get(next)!==squad.index&&parents.get(next)!==-1)next=parents.get(next)!;
      squad.index=next;
      if(next===squad.destination)squad.destination=null;
    }
  }

  /** AI plans actual settlements across owned land, then improves them.
   * Capitals and player cities count as spacing anchors; no fake settlements.
   * One paid action per faction per development interval.
   */
  /** AI economy scales with its realm size. Previously EVERY nation could
   * buy only ONE building action per 100 ticks on Balanced and always picked
   * the lowest-level city, leaving mature cities frozen at early tiers.
   * All construction uses the exact human building and tier prices.
   */
  private developAI():void {
    const centers:Array<Array<[number,number]>>=this.factions.map(()=>[]);
    const upgradeSites:number[][]=this.factions.map(()=>[]);
    for(const city of this.cities){
      if(city.owner>=0)centers[city.owner].push([city.index%MAP_WIDTH,Math.floor(city.index/MAP_WIDTH)]);
    }
    for(let i=0;i<CELL_COUNT;i++){
      const id=this.owner[i];
      if(id<0||this.buildings[i]!==BUILDING_CODES.city)continue;
      centers[id].push([i%MAP_WIDTH,Math.floor(i/MAP_WIDTH)]);
      if(id>0&&this.cityUpgrades[i]<5)upgradeSites[id].push(i);
    }

    // The best candidate in each small map zone keeps large empires from
    // repeatedly selecting the same location while making multiple builds.
    const zoneBest=new Map<number,{index:number;score:number}>();
    const zoneColumns=Math.ceil(MAP_WIDTH/12);
    const zoneRows=Math.ceil(MAP_HEIGHT/12);
    for(let i=0;i<CELL_COUNT;i++){
      const id=this.owner[i];
      if(id<=0||!this.factions[id]?.ai||this.buildings[i]||this.capitalSites.has(i))continue;
      const x=i%MAP_WIDTH,y=Math.floor(i/MAP_WIDTH);
      let nearest=Infinity;
      for(const [cx,cy] of centers[id]){
        const dist=(x-cx)**2+(y-cy)**2;
        if(dist<nearest)nearest=dist;
      }
      if(nearest<100)continue; // Ten-sector minimum from every existing city.
      const score=Math.min(nearest,1000)-Math.abs(nearest-196)*.09;
      const zone=id*zoneColumns*zoneRows+Math.floor(y/12)*zoneColumns+Math.floor(x/12);
      const previous=zoneBest.get(zone);
      if(!previous||score>previous.score||score===previous.score&&i<previous.index)
        zoneBest.set(zone,{index:i,score});
    }
    const choices:Array<Array<{index:number;score:number}>>=this.factions.map(()=>[]);
    for(const [zone,entry] of zoneBest){
      const id=Math.floor(zone/(zoneColumns*zoneRows));
      choices[id].push(entry);
    }
    for(const entries of choices)entries.sort((a,b)=>b.score-a.score||a.index-b.index);
    let changed=false;
    for(const faction of this.factions){
      if(!faction.ai||!faction.alive)continue;
      const id=faction.id;
      const sites=upgradeSites[id];
      const existing=centers[id].length;
      const desiredCities=Math.max(2,Math.floor(faction.territory/65));
      const maxActions=Math.min(10,Math.max(1,1+Math.floor(Math.sqrt(faction.territory)/28)));
      // Expansion and upgrading compete for a single paid development budget.
      // New cities are limited to at most two each interval, and only if the
      // realm is significantly below its sustainable settlement count.
      const maxBuilds=existing<desiredCities?Math.min(2,maxActions):0;
      let actions=0,builds=0;
      const newCities:Array<[number,number]>=[];
      for(const candidate of choices[id]){
        if(builds>=maxBuilds||actions>=maxActions)break;
        const index=candidate.index,x=index%MAP_WIDTH,y=Math.floor(index/MAP_WIDTH);
        if(newCities.some(([cx,cy])=>(cx-x)**2+(cy-y)**2<100))continue;
        if(this.owner[index]!==id||this.buildings[index])continue;
        const cost=BUILDINGS[0].cost;
        if(faction.money<cost)break;
        faction.money-=cost;this.buildings[index]=BUILDING_CODES.city;
        this.cityUpgrades[index]=0;
        newCities.push([x,y]);sites.push(index);
        changed=true;builds++;actions++;
      }
    // Highest-tier towns finish first, rather than having hundreds of
      // newly founded towns keep every existing city at level 0 or 1.
      // When a top tier is too expensive, an affordable lower tier can grow.
      sites.sort((a,b)=>this.cityUpgrades[b]-this.cityUpgrades[a]||a-b);
      for(let k=actions;k<maxActions;k++){
        let picked=-1;
        for(const index of sites){
          if(this.cityUpgrades[index]>=5)continue;
          if(cityUpgradeCost(this.cityUpgrades[index])<=faction.money){picked=index;break;}
        }
        if(picked<0)break;
        const cost=cityUpgradeCost(this.cityUpgrades[picked]);
        faction.money-=cost;this.cityUpgrades[picked]++;
        changed=true;
      }
      // Industry is a separate, capped economic decision, after city upgrades.
      // Limits one factory action per development cycle and one factory per
      // ~120 owned sectors to avoid unbounded AI snowballing.
      if(this.tick>0&&faction.money>=520){
        const ownedFactories:number[]=[];
        for(let i=0;i<CELL_COUNT;i++)if(this.owner[i]===id&&this.buildings[i]===BUILDING_CODES.factory)ownedFactories.push(i);
        const target=Math.max(1,Math.floor(faction.territory/120));
        if(ownedFactories.length<target){
          const citySites:number[]=[];
          for(const city of this.cities)if(city.owner===id)citySites.push(city.index);
          for(let i=0;i<CELL_COUNT;i++)if(this.owner[i]===id&&this.buildings[i]===BUILDING_CODES.city)citySites.push(i);
          citySites.sort((a,b)=>a-b);
          buildLoop:for(const city of citySites){
            for(const near of LAND_NEIGHBORS[city]){
              if(this.owner[near]!==id||this.buildings[near]||this.capitalSites.has(near))continue;
              if(ownedFactories.some(i=>Math.abs(i%MAP_WIDTH-near%MAP_WIDTH)+Math.abs(Math.floor(i/MAP_WIDTH)-Math.floor(near/MAP_WIDTH))<6))continue;
              if(this.build(id,cellToPoint(near),'factory').ok){
                this.factoryLinks.set(near,city);changed=true;break buildLoop;
              }
            }
          }
        }else{
          for(const index of ownedFactories){
            const level=1+(this.factoryLevels.get(index)??0);
            if(level>=5||faction.money<level*250+200)continue;
            if(this.upgradeFactory(id,cellToPoint(index)).ok)changed=true;
            break;
          }
        }
      }
    }
    // Recompute growth once, not once per paid building in a large empire.
    if(changed)this.recount();
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
  getBorderMode(point:Point):BorderMode {
    if(!Number.isInteger(point.x)||!Number.isInteger(point.y)||
       point.x<0||point.y<0||point.x>=MAP_WIDTH||point.y>=MAP_HEIGHT)return 'hold';
    return this.borderOrders.get(pointToIndex(point))??'hold';
  }

  /** No money, lives or units created: border commands only redistribute
   * soldiers already recorded in this exact nation's troop pool. */
  setBorderMode(id:number,point:Point,mode:BorderMode):DiplomacyResult {
    if(this.status!=='playing'||id!==0||!this.factions[0]?.alive||
      !['hold','defend','withdraw'].includes(mode))
      return {ok:false,reason:'Kein gültiger Grenzbefehl.'};
    if(!this.isThreatenedBorder(0,point))
      return {ok:false,reason:'Wähle einen eigenen bedrohten Grenzsektor.'};
    const i=pointToIndex(point);
    if(mode==='hold')this.borderOrders.delete(i);
    else {
      if(!this.borderOrders.has(i)&&this.borderOrders.size>=512)
        return {ok:false,reason:'Maximal 512 priorisierte Grenzsektoren.'};
      this.borderOrders.set(i,mode);
    }
    if(mode==='withdraw'){
      const held=this.frontline[i],keep=Math.min(held,Math.max(3,
        frontierTarget(this.factions[0].territory,this.factions[0].troops,
          this.capitalSites.has(i),false)*.25));
      const freed=Math.max(0,held-keep);
      this.frontline[i]-=freed;
      this.factions[0].troops+=freed;
      // Readjust the cached whole-army numbers after manual redistribution.
      this.recount();
    }
    return {ok:true,reason:mode==='defend'?'Grenze wird bevorzugt verstärkt.':
      mode==='withdraw'?'Überschüssige Soldaten sind mobil.':'Normale Grenzsicherung aktiviert.'};
  }

  /** Top actionable LOCAL contacts; urgency is a tactical indicator, not
   * a prediction of enemy nation-wide manpower or military intent. */
  borderHotspots(limit=6):BorderHotspot[]{
    const hits:BorderHotspot[]=[];
    const enemyAttacks=new Set<number>();
    for(const order of this.attackOrders)if(order.targetOwner===0&&order.factionId!==0&&!order.returning){
      const i=order.contested??order.lastCaptured??pointToIndex(order.anchor);
      enemyAttacks.add(i);
      for(const n of LAND_NEIGHBORS[i])enemyAttacks.add(n);
    }
    for(let i=0;i<CELL_COUNT;i++){
      if(this.owner[i]!==0)continue;
      const opponents=LAND_NEIGHBORS[i].map(n=>this.owner[n])
        .filter(id=>id>=0&&id!==0&&!this.isAllied(0,id));
      if(!opponents.length)continue;
      const guards=this.frontline[i];
      const expected=frontierTarget(this.factions[0].territory,
        this.factions[0].troops,this.capitalSites.has(i),this.doctrine==='fortify');
      const attacked=enemyAttacks.has(i);
      const mode=this.borderOrders.get(i)??'hold';
      const urgency=(mode!=='hold'?75:0)+(attacked?100:0)+Math.max(0,expected-guards)/
        Math.max(1,expected)*25+new Set(opponents).size*5;
      hits.push({index:i,point:cellToPoint(i),mode,
        guards,opponents:[...new Set(opponents)],attacked,urgency});
    }
    hits.sort((a,b)=>b.urgency-a.urgency||a.index-b.index);
    return hits.slice(0,Math.max(0,Math.min(25,Math.floor(limit))));
  }

  redistributeFrontline(): void {
    const exposed: number[][] = Array.from({length: this.factions.length}, () => []);
    for (let i = 0; i < CELL_COUNT; i++) {
      const owner = this.owner[i];
      if (owner < 0) { this.frontline[i] = 0; continue; }
      const threatened = LAND_NEIGHBORS[i].some(n => this.owner[n] >= 0 && this.owner[n] !== owner && !this.isAllied(owner,this.owner[n]));
      if (!threatened) {
        if(owner===0)this.borderOrders.delete(i);
        if (this.frontline[i] > 0) {
          this.factions[owner].troops += this.frontline[i];
          this.frontline[i] = 0;
        }
      } else {
        exposed[owner].push(i);
      }
    }
    // AI intelligence is recomputed from actual fronts each tick. These are
    // priorities, not additional units or permanent orders in a savegame.
    const incoming=new Map<number,number[]>();
    for(const order of this.attackOrders){
      if(order.returning||order.remaining<=0||order.targetOwner<=0||
        order.factionId===order.targetOwner)continue;
      const index=order.contested??order.lastCaptured??pointToIndex(order.anchor);
      if(!Number.isInteger(index)||index<0||index>=CELL_COUNT)continue;
      const spots=incoming.get(order.targetOwner)??[];
      spots.push(index);
      incoming.set(order.targetOwner,spots);
    }
    const aiPriority=(id:number,i:number):number=>{
      if(id===0)return 0;
      let enemy=0,contacts=0;
      for(const n of LAND_NEIGHBORS[i]){
        const other=this.owner[n];
        if(other<0||other===id||this.isAllied(id,other))continue;
        contacts++;
        enemy=Math.max(enemy,this.frontline[n]);
      }
      const underAttack=(incoming.get(id)??[]).some(index=>
        index===i||LAND_NEIGHBORS[i].includes(index));
      const own=this.frontline[i];
      // Defend capitals and genuine contested borders first. High enemy
      // concentration is significant but cannot monopolize all reserves.
      return (underAttack?120:0)+(this.capitalSites.has(i)?55:0)+
        Math.min(45,enemy/Math.max(8,own+8)*12)+contacts*5;
    };
    const aiPriorities=new Map<number,number>();
    for(let id=1;id<exposed.length;id++)
      for(const i of exposed[id])aiPriorities.set(i,aiPriority(id,i));
    for (const faction of this.factions) {
      if (!faction.alive || !exposed[faction.id].length) continue;
      // Balanced AI and human receive the same automatic defense budget.
      // Guards withdraw from overcrowded exposed fronts when mobile
      // reserves fall below a target 20% of the total living army.
      const mobileTarget=Math.min(faction.population,
        Math.max(45,faction.population*.20,faction.income*3));
      let shortage=Math.max(0,mobileTarget-faction.troops);
      if(shortage>.01){
        const posts=exposed[faction.id].slice()
          .sort((a,b)=>faction.ai
            ?(aiPriorities.get(a)??0)-(aiPriorities.get(b)??0)||this.frontline[b]-this.frontline[a]||a-b
            :this.frontline[b]-this.frontline[a]||a-b);
        for(const i of posts){
          if(shortage<=.01)break;
          if((faction.id===0&&this.borderOrders.get(i)==='defend')||
            (faction.ai&&(aiPriorities.get(i)??0)>=100))continue;
          const localFloor=Math.max(4,frontierTarget(faction.territory,
            faction.troops,this.capitalSites.has(i),faction.id===0&&this.doctrine==='fortify')*.35);
          const excess=Math.max(0,this.frontline[i]-localFloor);
          const released=Math.min(excess,shortage,this.frontline[i]*.45);
          if(released<=0)continue;
          this.frontline[i]-=released;
          faction.troops+=released;
          shortage-=released;
        }
      }
      // Never refill a garrison with the reserves just reclaimed from it.
      // The target reserve is the same for bots and humans.
      // Withdrawn garrisons never get automatically refilled on the next tick.
      if(faction.id===0)for(const i of exposed[0]){
        if(this.borderOrders.get(i)!=='withdraw')continue;
        const minGuard=Math.min(this.frontline[i],Math.max(3,
          frontierTarget(faction.territory,faction.troops,this.capitalSites.has(i),false)*.25));
        if(this.frontline[i]>minGuard){
          faction.troops+=this.frontline[i]-minGuard;this.frontline[i]=minGuard;
        }
      }
      const baseBudget=Math.min(frontierBudget(faction.troops,faction.income),
        Math.max(0,faction.troops-mobileTarget));
      const budget=faction.ai
        ? difficultyDefenseBudget(faction.troops,baseBudget,this.difficulty)
        : baseBudget;
      if (budget < 0.01) continue;
      let remaining = budget;
      // Cover weak points first. Equal-strength sectors break ties by map index.
      exposed[faction.id].sort((a,b)=>{
        const pa=faction.id===0&&this.borderOrders.get(a)==='defend'?1:0;
        const pb=faction.id===0&&this.borderOrders.get(b)==='defend'?1:0;
        return pb-pa||(faction.ai?(aiPriorities.get(b)??0)-(aiPriorities.get(a)??0):0)||
          this.frontline[a]-this.frontline[b]||a-b;
      });
      for (const i of exposed[faction.id]) {
        if (remaining < 0.01) break;
        if(faction.id===0&&this.borderOrders.get(i)==='withdraw')continue;
        const isCapital = this.capitalSites.has(i);
        const target = frontierTarget(faction.territory, faction.troops, isCapital, faction.id === 0 && this.doctrine === 'fortify')*
          (faction.id===0&&this.borderOrders.get(i)==='defend'?1.65:
            faction.ai?((aiPriorities.get(i)??0)>=100?1.65:
              (aiPriorities.get(i)??0)>=55?1.35:1):1);
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
      if (LAND_NEIGHBORS[i].some(n => this.owner[n] >= 0 && this.owner[n] !== id && !this.isAllied(id,this.owner[n]))) exposed++;
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
      !this.isAllied(id,this.owner[index]) &&
      LAND_NEIGHBORS[index].some(n=>this.owner[n]===id);
  }

  findAttackFront(id: number, target: Point): Point | null {
    if(!Number.isFinite(target.x)||!Number.isFinite(target.y)||
       target.x<0||target.y<0||target.x>=MAP_WIDTH||target.y>=MAP_HEIGHT||
       !this.factions[id]?.alive)return null;
    const index=pointToIndex(target);
    if(this.isAllied(id,this.owner[index]))return null;
    const maxDistance=this.owner[index]===NEUTRAL?Game.ATTACK_CLICK_DEPTH:Infinity;
    const front=findConnectedAttackFront(this.owner,MAP_WIDTH,index,id,maxDistance);
    return front>=0?cellToPoint(front):null;
  }

  /** Friendly threatened frontier sectors may receive manually assigned
   * real soldiers; they remain counted as inhabitants while on defense. */
  isThreatenedBorder(id:number,point:Point):boolean {
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||
       point.x<0||point.y<0||point.x>=MAP_WIDTH||point.y>=MAP_HEIGHT)return false;
    const index=pointToIndex(point);
    return this.owner[index]===id &&
      LAND_NEIGHBORS[index].some(n=>this.owner[n]>=0 && this.owner[n]!==id && !this.isAllied(id,this.owner[n]));
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

  private maritimeRoute(id:number,target:Point):SeaRoute|null {
    if(!this.factions[id]?.alive||!Number.isFinite(target.x)||!Number.isFinite(target.y)||
      target.x<0||target.y<0||target.x>=MAP_WIDTH||target.y>=MAP_HEIGHT)return null;
    if(this.isAllied(id,this.owner[pointToIndex(target)]))return null;
    return this.navigation.target(this.owner,id,pointToIndex(target));
  }

  canLand(id:number,target:Point):boolean {
    return this.maritimeRoute(id,target)!==null;
  }

  /** Side-effect-free tactical preview of the first real border contact.
   * Uses the same frontTileOutcome as resolveOrders, without making an order,
   * moving a soldier, mutating RNG, or advancing the simulation.
   */
  assessAttack(id:number,target:Point,ratio:number):AttackAssessment {
    const fail=(reason:string):AttackAssessment=>({
      possible:false,reason,troops:0,posted:0,loss:0,time:0,risk:'high',
    });
    const actor=this.factions[id];
    if(!actor?.alive||this.status!=='playing')return fail('Kein Angriff möglich.');
    if(!Number.isInteger(target.x)||!Number.isInteger(target.y)||
       target.x<0||target.y<0||target.x>=MAP_WIDTH||target.y>=MAP_HEIGHT)
      return fail('Ziel außerhalb der Karte.');
    if(!Number.isFinite(ratio)||ratio<5||ratio>100)return fail('Ungültiger Truppenanteil.');
    const owner=this.owner[pointToIndex(target)];
    if(owner===WATER||owner===id||this.isAllied(id,owner))
      return fail(owner===id?'Eigenes Gebiet.':'Kein angreifbares Ziel.');
    const front=this.findAttackFront(id,target);
    const landing=!front?this.landingTarget(id,target):null;
    const contact=front??landing;
    if(!contact)return fail('Keine erreichbare Angriffsfront.');
    const index=pointToIndex(contact),opponent=this.owner[index];
    const troops=Math.floor(actor.troops*ratio/100);
    if(troops<8)return fail('Mindestens 8 mobile Truppen erforderlich.');
    const defender=opponent>=0?this.factions[opponent]:undefined;
    const adjacent=LAND_NEIGHBORS[index].filter(n=>this.owner[n]===id).length;
    const outcome=frontTileOutcome({
      attackTroops:troops,defenderReserve:defender?.troops??0,
      defenderPopulation:defender?.population??0,defenderTerritory:defender?.territory??0,
      postedTroops:this.frontline[index],defenseStrength:this.defense[index],
      friendlySides:Math.max(1,adjacent),
      borderSize:Math.min(100,1+Math.sqrt(troops)*.12),
      relativePower:this.relativeAttackPower(id,opponent),
      neutral:opponent===NEUTRAL,capital:this.capitalSites.has(index),
      builtCity:this.buildings[index]===BUILDING_CODES.city,
      cityLevel:this.cityUpgrades[index],
      towerSupport:this.towerSupport(opponent,index),
      doctrine:opponent===0?this.doctrine:undefined,
    });
    const posted=this.frontline[index];
    // A local estimate, not a probability: duration and losses can change
    // when countries reinforce, combat unfolds or the front moves.
    const relativeLoss=outcome.attackerLoss/Math.max(1,troops);
    const risk:AttackAssessment['risk']=troops<=outcome.attackerLoss+.001||
      relativeLoss>.12||outcome.time>1.35||posted>troops*.6?'high'
      :relativeLoss>.035||outcome.time>.7||posted>troops*.22?'moderate':'low';
    return {possible:true,reason:landing?'Seelandung: Kontakt nach Ankunft.':
      opponent===NEUTRAL?'Neutrale Expansion.':'Schätzung für den ersten Frontsektor.',
      front:contact,targetOwner:opponent,troops,posted,loss:outcome.attackerLoss,
      time:outcome.time,risk};
  }

  launchAttack(id:number,target:Point,ratio:number):AttackResult {
    // Clicking friendly territory must NEVER dispatch soldiers, even on an
    // invaded border. A counterattack requires clicking the hostile sector.
    if(Number.isInteger(target.x)&&Number.isInteger(target.y)&&
       target.x>=0&&target.y>=0&&target.x<MAP_WIDTH&&target.y<MAP_HEIGHT&&
       this.owner[pointToIndex(target)]===id)
      return {ok:false,reason:'Eigenes Gebiet – keine Truppen versendet.',sent:0};
    if(!this.findAttackFront(id,target)){
      const route=this.maritimeRoute(id,target);
      if(route)return this.issueAttack(id,cellToPoint(route.cells[route.cells.length-1]),ratio,true,route);
    }
    return this.issueAttack(id,target,ratio,false);
  }

  landingTarget(id:number,target:Point):Point|null {
    const route=this.maritimeRoute(id,target);
    return route?cellToPoint(route.cells[route.cells.length-1]):null;
  }

  launchLanding(id:number,target:Point,ratio:number):AttackResult {
    const route=this.maritimeRoute(id,target);
    if(!route)return {ok:false,reason:'Keine erreichbare Landungsbucht von deiner Küste.',sent:0};
    return this.issueAttack(id,cellToPoint(route.cells[route.cells.length-1]),ratio,true,route);
  }

  /** A canceled voyage sails back for the elapsed outward travel time.
   * If its port is lost, survivors are demobilized into the living nation's
   * reserve on return; an eliminated nation loses the stranded expedition.
   */
  /** Add ACTUAL mobile troops to an existing live offensive without
   * creating another order or bypassing the same connected-front rules.
   */
  reinforceAttack(id:number,orderId:number,ratio:number):AttackResult {
    const fail=(reason:string):AttackResult=>({ok:false,reason,sent:0});
    const faction=this.factions[id];
    const order=this.attackOrders.find(o=>o.id===orderId&&o.factionId===id);
    if(!faction?.alive||this.status!=='playing'||!order||order.returning)
      return fail('Diese Offensive kann nicht verstärkt werden.');
    if(!Number.isFinite(ratio)||ratio<5||ratio>100)
      return fail('Ungültiger Truppenanteil.');
    if(order.targetOwner>=0&&this.isAllied(id,order.targetOwner))
      return fail('Verbündetes Land kann nicht angegriffen werden.');
    if(order.landing&&order.conquered===0&&this.tick<(order.arrivalTick??Infinity))
      return fail('Flotte unterwegs: Verstärkung erst nach der Landung.');
    // Live front candidates are cached each simulation tick. A newly
    // dispatched order can also be reinforced while paused, before the next
    // cache rebuild, provided its original enemy sector is still reachable.
    if(this.chooseOrderedFront(order)<0&&!this.findAttackFront(id,order.anchor))
      return fail('Keine erreichbare offene Front für diese Offensive.');
    const sent=Math.floor(faction.troops*ratio/100);
    if(sent<8)return fail('Nicht genügend mobile Soldaten.');
    faction.troops-=sent;
    order.remaining+=sent;
    order.committed+=sent;
    order.effort+=campaignEffort(sent);
    if(id===0)this.log(`Offensive verstärkt: +${formatCompact(sent)} Truppen.`,faction.color);
    return {ok:true,reason:'Offensive verstärkt.',sent,
      targetOwner:order.targetOwner,front:order.contested!==undefined?
        cellToPoint(order.contested):order.anchor};
  }

  cancelAttack(orderId:number,requesterId?:number):boolean {
    const order=this.attackOrders.find(o=>o.id===orderId);
    if(!order||order.returning||
       (requesterId!==undefined&&order.factionId!==requesterId))return false;
    if(order.landing&&order.seaRoute&&!order.returning){
      order.returning=true;order.returnStartedTick=this.tick;
      order.returnArrivalTick=this.tick+Math.max(1,Math.min(
        (order.arrivalTick??this.tick+1)-(order.startedTick??this.tick),this.tick-(order.startedTick??this.tick)));
    }else if(!order.returning){
      this.factions[order.factionId].troops+=order.remaining;
      this.attackOrders.splice(this.attackOrders.indexOf(order),1);
    }
    return true;
  }

  private issueAttack(id: number, target: Point, ratio: number, landing: boolean, route?:SeaRoute): AttackResult {
    const failed = (reason: string): AttackResult => ({ ok: false, reason, sent: 0 });
    const attacker = this.factions[id];
    if (!attacker?.alive || this.status !== 'playing') return failed('Diese Fraktion kann nicht angreifen.');
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y) || target.x < 0 || target.y < 0 || target.x >= MAP_WIDTH || target.y >= MAP_HEIGHT) return failed('Außerhalb der Karte.');
    if (!Number.isFinite(ratio) || ratio < 5 || ratio > 100) return failed('Truppenanteil muss zwischen 5 und 100 % liegen.');
    const index=pointToIndex(target),clickedOwner=this.owner[index];
    if(clickedOwner===WATER)return failed('Angriff auf Wasser nicht möglich.');
    if(clickedOwner===id)return failed('Eigenes Gebiet – keine Truppen versendet.');
    if(this.isAllied(id,clickedOwner))return failed('Verbündetes Gebiet – kein Angriff möglich.');
    if(attacker.ai&&this.isWarTruce(id,clickedOwner))
      return failed('Waffenstillstand – KI muss den Frieden einhalten.');
    const front=landing?cellToPoint(index):this.findAttackFront(id,target);
    if(!front || (landing && (!route||!validSeaRoute(route.cells,undefined,index)||this.owner[route.cells[0]]!==id)))
      return failed(landing?'Keine eigene Küste an diesem Seeübergang.':'Dieses Gebiet hat keine gemeinsame Landfront mit dir.');
    const owner=clickedOwner;
    if(this.isAllied(id,owner))return failed('Verbündetes Gebiet – kein Angriff möglich.');
    if(owner===id || owner===WATER)return failed('Kein feindlicher Grenzsektor gefunden.');
    const sent = Math.floor(attacker.troops * ratio / 100);
    if (sent < 8) return failed('Mindestens 8 mobile Truppen erforderlich.');
    attacker.troops-=sent;
    // A direct reverse offensive cancels the two paid-for armies at the same
    // real landfront. Both sides suffer matching fatalities; there is no
    // artificial post-spawn defending army or invisible counterattack.
    let committed=sent;
    if(owner>=0&&!landing){
      const incoming=this.attackOrders.find(o=>o.factionId===owner &&
        o.targetOwner===id && !o.landing &&
        canReinforceFront(owner,pointToIndex(front),pointToIndex(o.anchor),MAP_WIDTH));
      if(incoming){
        const clash=opposingArmies(committed,incoming.remaining);
        committed=clash.a;
        incoming.remaining=clash.b;
        incoming.fallen+=clash.lossB;
        attacker.attackFallen+=clash.lossA;
        this.factions[owner].attackFallen+=clash.lossB;
        attacker.enemyFallen+=clash.lossB;
        this.factions[owner].enemyFallen+=clash.lossA;
        if(incoming.remaining<.5){
          const ix=this.attackOrders.findIndex(o=>o.id===incoming.id);
          if(ix>=0)this.attackOrders.splice(ix,1);
        }
        if(this.battleEvents.length<1600)this.battleEvents.push({
          tick:this.tick,index:pointToIndex(front),attackerId:id,defenderId:owner,
          attacking:sent,defending:incoming.remaining+clash.lossB,
          attackerLost:clash.lossA,defenderLost:clash.lossB,captured:false,
        });
      }
    }
    if(committed<.5)return {ok:true,reason:'Angriff hat feindliche Armee abgefangen.',
      sent,targetOwner:owner,front};
    // Repeating a click near the same border reinforces the EXISTING army:
    // simple OpenFront-style interaction, no overlapping duplicate campaigns.
    const departure=route?.cells[0];
    const existing=!landing?this.attackOrders.find(o=>
      o.factionId===id&&!o.landing&&o.targetOwner===owner&&
      canReinforceFront(owner,pointToIndex(o.anchor),pointToIndex(front),MAP_WIDTH)
    ):undefined;
    if(existing){
      existing.remaining+=committed;
      existing.committed+=committed;
      existing.effort+=campaignEffort(committed);
    }else{
      this.attackOrders.push({
        id:this.nextAttackId++,factionId:id,targetOwner:owner,
        anchor:front,committed,remaining:committed,effort:campaignEffort(committed),
        fallen:0,conquered:0,trail:[],progress:0,landing,startedTick:this.tick,
        ...(landing&&departure!==undefined?{departure:cellToPoint(departure),seaRoute:route!.cells.slice(),seaDistanceKm:route!.distanceKm,arrivalTick:this.tick+voyageTicks(route!.distanceKm)}:{ }),
      });
    }
    // Neutral attacks only show a concise order status in the HUD, never
    // pollute the strategic event feed for every small land claim.
    if(id===0&&owner!==NEUTRAL)this.log(
      `${existing?'Verstärkt':landing?'Seelandung':'Angriff'}: ${formatCompact(sent)} gegen ${this.factions[owner].name}.`,attacker.color);
    const reason=existing?'Offensive verstärkt.':landing?'Landung befohlen.':
      owner===NEUTRAL?'Expansion gestartet.':'Grenzangriff gestartet.';
    return {ok:true,reason,sent,targetOwner:owner,front};
  }

  /** Only live orthogonal front candidates can be taken. The front trail
   * expands with real captures instead of stopping at the original click.
   */
  private chooseOrderedFront(order:AttackOrder):number{
    const anchorIndex=pointToIndex(order.anchor);
    if(order.landing && order.conquered===0){
      if(this.owner[anchorIndex]!==order.targetOwner)return -1;
      return order.seaRoute&&this.owner[order.seaRoute[0]]===order.factionId?anchorIndex:-1;
    }
    const candidates=this.frontierCandidates[order.factionId];
    if(!candidates)return -1;
    return chooseAdvancingSector({
      owners:this.owner,width:MAP_WIDTH,attackerId:order.factionId,
      targetOwner:order.targetOwner,candidates,anchor:anchorIndex,
      trail:order.trail??[],contested:order.contested,
    });
  }

  /** Full-tile combat: a continuous attack has a separate living army.
   * Every tile spends a fraction of the tick and kills real soldiers on
   * both sides. No partial-sector HP decay or random cursor jumps.
   */
  private resolveFrontTile(order:AttackOrder,index:number,borderSize:number):{
    time:number;captured:boolean;loss:number;
  } {
    const attacker=this.factions[order.factionId];
    const owner=this.owner[index];
    const defender=owner>=0?this.factions[owner]:null;
    const friendly=LAND_NEIGHBORS[index].reduce((n,i)=>n+(this.owner[i]===attacker.id?1:0),0);
    if(this.isAllied(order.factionId,owner) || owner!==order.targetOwner || (!friendly && !(order.landing&&order.conquered===0)))
      return {time:1,captured:false,loss:0};
    const targetPopulation=defender?defender.population:0;
    const localPosted=defender?this.frontline[index]:0;
    const tile=frontTileOutcome({
      attackTroops:order.remaining,
      defenderReserve:defender?.troops??0,
      defenderPopulation:targetPopulation,
      defenderTerritory:defender?.territory??0,
      postedTroops:localPosted,
      defenseStrength:this.defense[index],
      friendlySides:Math.max(1,friendly),
      borderSize,
      relativePower:this.relativeAttackPower(attacker.id,owner),
      neutral:owner===NEUTRAL,
      capital:this.capitalSites.has(index),
      builtCity:this.buildings[index]===BUILDING_CODES.city,
      cityLevel:this.cityUpgrades[index],
      towerSupport:this.towerSupport(owner,index),
      doctrine:owner===0?this.doctrine:undefined,
    });
    if(order.remaining<=tile.attackerLoss)return {time:tile.time,captured:false,loss:0};
    let defenderLoss=0;
    let defenderEngaged=0;
    if(defender){
      const posted=Math.min(localPosted,tile.postedLoss);
      this.frontline[index]-=posted;
      const reserveLost=Math.min(defender.troops,Math.max(0,tile.defenderLoss-posted));
      defender.troops-=reserveLost;
      defenderLoss=posted+reserveLost;
      // Existing local guards plus actually called-up reservists; this
      // describes the fighting strength, never the number of fatalities.
      defenderEngaged=localPosted+reserveLost;
      defender.defenseSpent+=defenderLoss;
      defender.defenseFallenTick+=defenderLoss;
      defender.population=Math.max(0,defender.population-defenderLoss);
      defender.enemyFallen+=tile.attackerLoss;
      attacker.enemyFallen+=defenderLoss;
    }
    const loss=Math.min(order.remaining,tile.attackerLoss);
    order.remaining-=loss;order.fallen+=loss;
    attacker.attackFallen+=loss;
    attacker.population=Math.max(0,attacker.population-loss);
    this.lastAttackerLoss=loss;
    if(this.battleEvents.length<1600)this.battleEvents.push({
      tick:this.tick,index,attackerId:attacker.id,defenderId:owner,
      attacking:order.remaining+loss,defending:defenderEngaged,
      attackerLost:loss,defenderLost:defenderLoss,captured:false,
    });
    // Stationed guards cannot simply vanish when a tile changes color.
    // Repeated combat wears them down. Capture only when no actual defenders
    // remain on this particular sector.
    const captured=!(defender && this.frontline[index]>.01);
    if(this.battleEvents.length && this.battleEvents[this.battleEvents.length-1].index===index &&
      this.battleEvents[this.battleEvents.length-1].tick===this.tick)
      this.battleEvents[this.battleEvents.length-1].captured=captured;
    if(captured)this.captureTile(attacker,index);
    return {time:tile.time,captured,loss};
  }

  /** Actual tile-by-tile assault. Existing attackers advance together from
   * the dynamically updated four-neighbor border. The more contact cells
   * and soldiers involved, the faster the front flows per tick.
   */
  private resolveOrders(attacker:Faction):void {
    const orders=this.attackOrders.filter(o=>o.factionId===attacker.id);
    for(const order of orders){
      if(this.isAllied(attacker.id,order.targetOwner)){
        this.cancelAttack(order.id);
        if(!order.returning)continue;
      }
      if(order.landing&&order.conquered===0){
        const route=order.seaRoute;
        if(!order.returning&&(!route||this.owner[route[0]]!==attacker.id||
          this.owner[pointToIndex(order.anchor)]!==order.targetOwner))this.cancelAttack(order.id);
        if(order.returning){
          if(this.tick>=(order.returnArrivalTick??this.tick)){
            attacker.troops+=order.remaining;
            this.attackOrders.splice(this.attackOrders.indexOf(order),1);
          }
          continue;
        }
        if(this.tick<(order.arrivalTick??Infinity))continue;
      }
      let budget=1+Math.min(1.5,Math.max(0,order.progress??0));
      let unreachable=false;
      let attempts=0;
      // Neutral marches can sweep empty ground; defended nations must not fall
      // dozens of sectors in a single 250ms simulation tick.
      const hostile=order.targetOwner>=0;
      const maxTiles=hostile ? (attacker.ai?2:(this.doctrine==='blitz'?5:3))
        : attacker.id===0&&this.doctrine==='blitz'?26:20;
      while(attempts<maxTiles&&order.remaining>=.5){
        const index=this.chooseOrderedFront(order);
        if(index<0){unreachable=true;break;}
        const borderSize=Math.min(100,1+(order.trail?.length??0)*.09+
          Math.sqrt(Math.max(1,order.committed))*.12);
        const forecast=frontTileOutcome({
          attackTroops:order.remaining,defenderReserve:0,
          defenderPopulation:this.owner[index]<0?0:this.factions[this.owner[index]].population,
          defenderTerritory:this.owner[index]<0?0:this.factions[this.owner[index]].territory,
          postedTroops:this.frontline[index],defenseStrength:this.defense[index],
          friendlySides:LAND_NEIGHBORS[index].filter(n=>this.owner[n]===attacker.id).length,
          borderSize,relativePower:this.relativeAttackPower(attacker.id,this.owner[index]),
          neutral:this.owner[index]===NEUTRAL,
          capital:this.capitalSites.has(index),
          builtCity:this.buildings[index]===BUILDING_CODES.city,
          cityLevel:this.cityUpgrades[index],
      towerSupport:this.towerSupport(this.owner[index],index),
          doctrine:this.owner[index]===0?this.doctrine:undefined,
        });
        // A nearly spent army retreats with its survivors. It must NEVER
        // become stuck forever attacking a tile whose cost it cannot pay.
        if(order.remaining<=forecast.attackerLoss+.001){unreachable=true;break;}
        if(forecast.time>budget){
          // Expensive fortified sectors can need >2 simulation ticks of
          // fighting. Previously progress was always reset to the same
          // budget and strong positions could become literally impossible
          // to capture: 1 -> 2 -> 2 -> 2 ... while cost was e.g. 2.4.
          // Bank the next tick of assault time, capped to the existing
          // 1.5 carry limit (next budget max 2.5 > TileOutcome.maxTime 2.4).
          order.contested=index;
          budget=Math.min(1.5,budget+1);
          break;
        }
        const result=this.resolveFrontTile(order,index,borderSize);
        if(!result.captured){
          order.contested=index;
          budget=Math.max(0,budget-result.time);
          break; // resume this exact defended border on the next tick
        }
        budget-=result.time;
        order.effort=Math.max(0,order.effort-result.time);
        order.conquered++;
        order.contested=undefined;
        order.lastCaptured=index;
        (order.trail??=[]).push(index);
        if(order.trail.length>144)order.trail.shift();
        if(order.landing)order.landing=false;
        attempts++;
      }
      order.progress=unreachable?0:Math.min(1.5,Math.max(0,budget));
      // March duration is finite even if an army can afford many cheap
      // neutral tiles. Prevent a forgotten order from running indefinitely.
      if(unreachable||order.remaining<.5||order.effort<1||
        this.tick-(order.arrivalTick??order.startedTick??this.tick)>=120){
        if(order.landing&&order.conquered===0&&order.seaRoute){
          this.cancelAttack(order.id);continue;
        }
        attacker.troops+=Math.max(0,order.remaining);
        if(attacker.ai&&order.targetOwner>=0&&order.conquered>0){
          const recovery=Math.round(65+Math.min(70,order.fallen*.20));
          attacker.warCooldownUntil=Math.max(attacker.warCooldownUntil??0,this.tick+recovery);
          const stillAtWar=this.attackOrders.some(o=>o.id!==order.id&&!o.returning&&
            ((o.factionId===attacker.id&&o.targetOwner===order.targetOwner)||
             (o.factionId===order.targetOwner&&o.targetOwner===attacker.id)));
          if(!stillAtWar)this.establishWarTruce(attacker.id,order.targetOwner);
        }
        const at=this.attackOrders.findIndex(o=>o.id===order.id);
        if(at>=0)this.attackOrders.splice(at,1);
        if(attacker.id===0){
          if(order.targetOwner===NEUTRAL){
            if(order.conquered>=10)this.log(
              `Expansion +${formatCompact(order.conquered)} Sektoren · ${formatCompact(order.fallen)} Verluste.`,
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
      const targets=this.cities.filter(c=>c.owner>=0&&c.owner!==faction.id&&!this.isAllied(faction.id,c.owner));
      let best:City|null=null,bestScore=-Infinity;
      for(const city of targets){
        const opponent=this.factions[city.owner];
        const distance=Math.sqrt(distance2(city,capital));
        const weak=100/(25+opponent.troops+opponent.income*3);
        const attackers=new Set(this.attackOrders.filter(o=>o.targetOwner===city.owner&&o.factionId!==faction.id).map(o=>o.factionId)).size;
        const score=weak*22-distance*.34+(opponent.territory<faction.territory?7:0)-Math.min(18,attackers*6);
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
        if(this.owner[n]>=0&&!this.isAllied(owner,this.owner[n])) exposed=true;
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
      if(opponent===WATER || opponent===id || this.isAllied(id,opponent)||
         this.isWarTruce(id,opponent)){candidates.delete(i);continue;}
      let friendly=0;
      for(const n of LAND_NEIGHBORS[i])if(this.owner[n]===id)friendly++;
      if(!friendly){candidates.delete(i);continue;}
      const city=this.capitalSites.has(i);
      const hasCity=this.buildings[i]===BUILDING_CODES.city;
      const neutral=opponent===NEUTRAL;
      // A real expansion phase: settle neutral territory before starting wars.
      // Thereafter, offset mobilization windows prevent synchronized all-Europe wars.
      if(!neutral && (this.tick<(faction.warCooldownUntil??0) ||
         (this.difficulty!=='impossible' &&
          (this.tick<90 || (this.tick+id*23)%160<72))))continue;
      const ongoingEnemies=new Set(this.attackOrders.filter(o=>o.factionId===id&&o.targetOwner>=0).map(o=>o.targetOwner));
      if(!neutral && ongoingEnemies.size>=2&&!ongoingEnemies.has(opponent))continue;
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
      // A defensive pact also informs strategy: prioritize a nation currently
      // attacking our allies when we share a valid front with that aggressor.
      // It still requires paid troops, an advantageous battle and a real border.
      const defendingAlly=opponent>=0&&this.attackOrders.some(o=>
        o.factionId===opponent&&this.isAllied(id,o.targetOwner));
      const otherInvaders=neutral?0:new Set(this.attackOrders.filter(o=>o.targetOwner===opponent&&o.factionId!==id).map(o=>o.factionId)).size;
      // Keep the existing graded penalty, but stop a third nation joining
      // an already contested enemy. Existing campaigns may finish normally.
      if(!neutral&&otherInvaders>=2&&!ongoingEnemies.has(opponent))continue;
      const score=scoreAIFront({
        neutral,advantage:assessment.advantage,friendlySides:friendly,
        capital:!!city,city:hasCity,distance:d,
        opponentCommitted:defender?.defenseSpent??0,
        opponentReserve:defender?.troops??0,
        threatenedBorders:exposed,
        focus:d<14,
      },aiStyle(faction.id)) + (neutral?24:0) + (defendingAlly?16:0) + (focusDistance<10?11-focusDistance*.85:0)-Math.min(24,otherInvaders*9) + this.rng()*.15;
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
    if(this.isAllied(faction.id,originalOwner))return false;
    const relativePower=this.relativeAttackPower(faction.id,originalOwner);
    const rawDamage = spent * (0.95 + this.rng() * 0.22) * relativePower;
    const garrisonStrength=this.defense[index];
    let mitigation = 0;
    let defenderLosses=0;
    let defenderEngaged=0;
    let defender: Faction | null = null;
    let capital = false;
    if (originalOwner >= 0 && originalOwner !== faction.id) {
      defender = this.factions[originalOwner];
      capital = this.capitalSites.has(index);
      const fortified = originalOwner === 0 && this.doctrine === 'fortify';
      const localPosted=this.frontline[index];
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
      defenderEngaged=localPosted+emergency.used;
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
      attacking:spent,defending:defenderEngaged,
      attackerLost:this.lastAttackerLoss,defenderLost:defenderLosses,captured,
    });
    if(!captured)return false;
    return this.captureTile(faction,index);
  }

  /** This is the only ownership handoff, shared by bot/player front clashes. */
  private captureTile(faction:Faction,index:number):boolean {
    if(faction.id!==0)this.borderOrders.delete(index);
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
    if(faction.troops<8||this.isAllied(faction.id,this.owner[index]))return false;
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

  private tryNavalAttack(id:number,ratio:number):boolean {
    const f=this.factions[id];
    if(f.troops<80||this.attackOrders.some(o=>o.factionId===id&&o.seaRoute))return false;
    const field=this.navigation.field(this.owner,id);
    let best=-1,bestScore=-Infinity;
    const sent=Math.floor(f.troops*ratio/100);
    const ongoingEnemies=new Set(this.attackOrders.filter(o=>o.factionId===id&&o.targetOwner>=0).map(o=>o.targetOwner));
    const peaceful=(this.tick<(f.warCooldownUntil??0)) ||
        (this.difficulty!=='impossible' && (this.tick<90 || (this.tick+id*23)%160<72));
    for(const shore of COASTS){
      const owner=this.owner[shore];if(owner===id||owner===WATER||
         this.isAllied(id,owner)||this.isWarTruce(id,owner))continue;
      if(owner>=0 && (peaceful || ongoingEnemies.size>=2&&!ongoingEnemies.has(owner)))continue;
      if(LAND_NEIGHBORS[shore].some(n=>this.owner[n]===id))continue;
      const water=LAND_NEIGHBORS[shore].filter(n=>field.depth[n]>=0);
      if(!water.length)continue;
      const steps=Math.min(...water.map(n=>field.depth[n]));
      const defender=owner>=0?this.factions[owner]:null;
      const otherInvaders=owner<0?0:new Set(this.attackOrders.filter(o=>o.targetOwner===owner&&o.factionId!==id).map(o=>o.factionId)).size;
      if(otherInvaders>=2)continue;
      const assessment=assessInvasion({attackerTroops:sent,attackerIncome:f.income,
        defenderTroops:defender?Math.min(defender.troops*.15,40+defender.income*3):0,
        defenderIncome:defender?.income??0,garrison:this.sectorDefense(shore)+this.frontline[shore],
        capital:this.capitalSites.has(shore),neutral:owner===NEUTRAL,
        threatenedBorders:this.exposedCounts[id]??0,
        relativePower:owner<0?1:this.relativeAttackPower(id,owner),riskTolerance:0});
      if(!assessment.worthwhile||f.troops-sent<Math.max(35,f.income*5))continue;
      const score=(owner===NEUTRAL?26:20)+Math.min(20,assessment.advantage*3)-steps*.22
        +(this.capitalSites.has(shore)?6:0)+(this.buildings[shore]?5+this.cityUpgrades[shore]:0)-otherInvaders*12;
      if(score>bestScore){bestScore=score;best=shore;}
    }
    return best>=0&&bestScore>0&&this.launchLanding(id,cellToPoint(best),ratio).ok;
  }

  step(): void {
    if (this.paused || this.status !== 'playing') return;
    const beforeMobile=this.factions[0].troops;
    this.tick++;
    this.battleEvents.length=0;
    this.moveSquads();
    this.resolveSquadContacts();
    this.commandRTSAI();
    this.updateDiplomacy();
    this.deliverDefensiveAid();
    for(const faction of this.factions)faction.defenseFallenTick=0;
    if (this.tick >= this.aiGoalChange) {
      this.pickAIGoals();
      this.aiGoalChange = this.tick + 45;
    }
    this.recount();
    for(const faction of this.factions){
      if(!faction.alive){
        // No surviving homeland can receive a stranded expedition.
        for(let i=this.attackOrders.length-1;i>=0;i--){
          const order=this.attackOrders[i];if(order.factionId!==faction.id)continue;
          faction.attackFallen+=order.remaining;this.attackOrders.splice(i,1);
        }
        continue;
      }
      // All residents are recruitable troops: a single clear growth figure.
      // RTS: the human army does not spawn passively. Soldiers are trained
      // for gold in barracks; AI keeps legacy recruiting until AI RTS exists.
      if(!this.rtsRecruitment)faction.troops+=faction.income;
      // RTS: no free or implicit recruitment, for players or AI.
      faction.money+=faction.moneyIncome;
      if(faction.ai)faction.campaignEnergy=Math.min(300*this.difficultySettings.marchMultiplier,
        faction.campaignEnergy+aiMarchRecovery(faction.income,aiStyle(faction.id))*this.difficultySettings.marchMultiplier);
    }
    if(!this.rtsRecruitment&&this.tick%this.difficultySettings.cityInterval===0)this.developAI();
    this.redistributeFrontline();
    this.dispatchDefensiveAid();
    this.rebuildFrontierCandidates();
    // The SAME continuous-border military rules now govern humans AND AI.
    // AIs choose targets; orders fight over time using actual paid-for armies.
    for(const faction of this.factions){
      if(!faction.alive)continue;
      this.resolveOrders(faction);
      if(!faction.ai||this.rtsRecruitment)continue;
      const maxActive=aiStyle(faction.id)==='aggressive'||this.difficulty==='impossible'?2:1;
      const active=this.attackOrders.filter(o=>o.factionId===faction.id).length;
      const ratio=Math.max(15,Math.min(55,
        Math.round(30*this.difficultySettings.activityMultiplier)));
      // Stagger naval planning and allow it while profitable landfronts exist.
      // At most one fleet and two total offensives, using actual reserves.
      if(active<2&&this.tick>=(faction.warCooldownUntil??0)&&this.tick%32===faction.id%32 && this.tryNavalAttack(faction.id,ratio))continue;
      // Recovery prevents new foreign wars, but peaceful neutral expansion
      // remains possible through chooseFront's separate hostile-country gate.
      if(active>=maxActive || faction.troops<22)continue;
      const target=this.chooseFront(faction.id);
      if(target>=0)this.issueAttack(faction.id,cellToPoint(target),ratio,false);

    }
    // Territory can change again in resolveOrders *after* moveSquads has
    // already processed the formations. Reconcile displaced armies in the
    // same tick so no squad remains on a foreign-owned tile in saved states.
    if(this.rtsRecruitment){
      for(let i=this.squads.length-1;i>=0;i--){
        const squad=this.squads[i];
        if(this.owner[squad.index]===squad.owner)continue;
        // Follow the existing displacement rule: living soldiers return to
        // their nation's mobile pool exactly once; never duplicate squads.
        this.factions[squad.owner].troops+=squad.troops;
        this.squads.splice(i,1);
      }
    }
    this.recount();
    this.mobileNet=this.factions[0].troops-beforeMobile;
    if (!this.factions[0].alive) {
      this.status = 'defeat';
      this.log(`${this.factions[0].name} wurde besiegt.`, '#ee788c');
    } else if (this.factions[0].territory / TOTAL_LAND >= 0.65 || this.factions.slice(1).every(f => !f.alive)) {
      this.status = 'victory';
      this.log('EUROPA steht unter deiner Kontrolle!', '#e9b85e');
    }
  }

  /** Versioned exact simulation state. Recomputed frontier caches are excluded. */
  exportSave():GameSave {
    return {
      version:1,seed:this.seed,playerCode:this.playerCode,difficulty:this.difficulty,
      tick:this.tick,status:this.status,paused:this.paused,doctrine:this.doctrine,
      rngCalls:this.rngCalls,aiGoalChange:this.aiGoalChange,nextAttackId:this.nextAttackId,
      owner:Array.from(this.owner),defense:Array.from(this.defense),
      buildings:Array.from(this.buildings),cityUpgrades:Array.from(this.cityUpgrades),
      frontline:Array.from(this.frontline),
      factions:this.factions.map(f=>({...f,target:{...f.target}})),
      cities:this.cities.map(c=>({...c})),
      attackOrders:this.attackOrders.map(o=>structuredClone(o)),
      events:this.events.map(e=>({...e})),
      alliances:this.alliances.map(a=>({...a})),offers:this.offers.map(o=>({...o})),
      defenseAid:this.defenseAid.map(a=>({...a})),
      diplomacyCooldowns:this.diplomacyCooldowns.map(v=>({...v})),
      warTruces:this.warTruces.map(v=>({...v})),
      rtsRecruitment:this.rtsRecruitment,
      squads:this.squads.map(s=>({...s})),
      factoryLevels:[...this.factoryLevels].filter(([index])=>this.buildings[index]===BUILDING_CODES.factory)
        .sort((a,b)=>a[0]-b[0]).map(([index,level])=>({index,level})),
      factoryLinks:[...this.factoryLinks].filter(([factory,city])=>
        this.buildings[factory]===BUILDING_CODES.factory&&this.owner[factory]===this.owner[city])
        .sort((a,b)=>a[0]-b[0]).map(([factory,city])=>({factory,city})),
      borderOrders:[...this.borderOrders].filter(([index])=>this.owner[index]===0)
        .sort((a,b)=>a[0]-b[0]).map(([index,mode])=>({index,mode})),
    };
  }

  static fromSave(input:unknown):Game {
    if(!input||typeof input!=='object')throw Error('Ungültiger Spielstand.');
    const save=input as GameSave;
    if(save.version!==1||!Number.isSafeInteger(save.seed)||!isDifficulty(save.difficulty)||
       !countryByCode(save.playerCode)||!Number.isSafeInteger(save.tick)||save.tick<0||
       !['playing','victory','defeat'].includes(save.status)||
       !['expand','blitz','fortify'].includes(save.doctrine)||
       !Number.isSafeInteger(save.rngCalls)||save.rngCalls<0||save.rngCalls>100000000||
       !Number.isSafeInteger(save.nextAttackId)||save.nextAttackId<1)
      throw Error('Nicht unterstützter oder beschädigter Spielstand.');
    const g=new Game(save.seed,Array.isArray(save.factions)?save.factions.length-1:-1,save.playerCode,save.difficulty,save.rtsRecruitment===true);
    const arrays: Array<[number[],Int16Array|Float32Array|Float64Array|Uint8Array,string]>=[
      [save.owner,g.owner,'owner'],[save.defense,g.defense,'defense'],
      [save.buildings,g.buildings,'buildings'],[save.cityUpgrades,g.cityUpgrades,'cityUpgrades'],
      [save.frontline,g.frontline,'frontline'],
    ];
    for(const [values,target,name] of arrays){
      if(!Array.isArray(values)||values.length!==target.length||
         values.some((v:number)=>!Number.isFinite(v)))throw Error('Ungültige Karte: '+name);
      target.set(values);
    }
    if(!Array.isArray(save.factions)||save.factions.length!==g.factions.length||
       !Array.isArray(save.attackOrders)||!Array.isArray(save.cities)||
       save.cities.length!==g.cities.length||!Array.isArray(save.events)||
       save.factions.some((f,i)=>f.id!==i||!Number.isFinite(f.troops)||f.troops<0||
         !Number.isFinite(f.money)||!Number.isFinite(f.campaignEnergy))||
       save.attackOrders.length>10000||save.events.length>20000)
      throw Error('Ungültige Fraktions- oder Angriffsdaten.');
    for(let i=0;i<g.factions.length;i++)Object.assign(g.factions[i],structuredClone(save.factions[i]));
    for(let i=0;i<g.cities.length;i++)Object.assign(g.cities[i],structuredClone(save.cities[i]));
    g.attackOrders.splice(0,g.attackOrders.length,...structuredClone(save.attackOrders));
    for(const order of g.attackOrders){
      if(!Number.isSafeInteger(order.id)||!g.factions[order.factionId]||
        !Number.isFinite(order.remaining)||order.remaining<0||!Number.isFinite(order.committed)||
        !Number.isFinite(order.effort)||!Number.isFinite(order.anchor?.x)||!Number.isFinite(order.anchor?.y)||
        order.anchor.x<0||order.anchor.y<0||order.anchor.x>=MAP_WIDTH||order.anchor.y>=MAP_HEIGHT)
        throw Error('Ungültige Armee im Spielstand.');
      if(order.seaRoute&&(!order.departure||!validSeaRoute(order.seaRoute,pointToIndex(order.departure),pointToIndex(order.anchor))))
        throw Error('Ungültige Seeroute im Spielstand.');
      if(order.landing&&order.conquered===0){
        if(order.seaRoute){
          if(!Number.isSafeInteger(order.startedTick)||!Number.isSafeInteger(order.arrivalTick)||
            order.startedTick!>save.tick||(order.arrivalTick! - order.startedTick!)!==voyageTicks(routeDistance(order.seaRoute))||
            !Number.isFinite(order.seaDistanceKm)||Math.abs(order.seaDistanceKm!-routeDistance(order.seaRoute))>.001||
            (order.returning&&(!Number.isSafeInteger(order.returnStartedTick)||!Number.isSafeInteger(order.returnArrivalTick)||
              order.returnStartedTick!>save.tick||order.returnArrivalTick!<=order.returnStartedTick!||
              order.returnArrivalTick!-order.returnStartedTick!>96)))
            throw Error('Ungültige Reisezeit im Spielstand.');
        }else{
          const route=g.navigation.route(g.owner,order.factionId,pointToIndex(order.anchor));
          if(route){
            const elapsed=Math.max(0,Math.min(1,(save.tick-(order.startedTick??save.tick))/Math.max(1,(order.arrivalTick??save.tick+8)-(order.startedTick??save.tick))));
            const duration=voyageTicks(route.distanceKm);
            order.seaRoute=route.cells;order.seaDistanceKm=route.distanceKm;
            order.departure=cellToPoint(route.cells[0]);order.startedTick=save.tick-Math.floor(elapsed*duration);
            order.arrivalTick=order.startedTick+duration;
          }else{
            g.factions[order.factionId].troops+=order.remaining;
            order.remaining=0;order.effort=0;order.landing=false;
          }
        }
      }
    }
    const alliances=save.alliances??[],offers=save.offers??[];
    if(!Array.isArray(alliances)||!Array.isArray(offers)||
       alliances.length>g.factions.length||offers.length>g.factions.length||
       alliances.some(a=>!Number.isInteger(a.a)||!Number.isInteger(a.b)||
         a.a<0||a.a>=a.b||a.b>=g.factions.length||
         !Number.isSafeInteger(a.sinceTick)||a.sinceTick<0||a.sinceTick>save.tick)||
       new Set(alliances.map(a=>a.a+':'+a.b)).size!==alliances.length||
       offers.some(o=>!Number.isInteger(o.from)||!Number.isInteger(o.to)||o.to!==0||
         o.from<=0||o.from>=g.factions.length||
         !Number.isSafeInteger(o.untilTick)||o.untilTick<=save.tick||o.untilTick>save.tick+240)||
       alliances.some(a=>g.attackOrders.some(o=>
         (o.factionId===a.a&&o.targetOwner===a.b)||(o.factionId===a.b&&o.targetOwner===a.a))))
      throw Error('Ungültige Bündnisdaten.');
    const defenseAid=save.defenseAid??[];
    if(!Array.isArray(defenseAid)||defenseAid.length>g.factions.length*2||
       defenseAid.some(a=>!Number.isInteger(a.from)||!Number.isInteger(a.to)||
         a.from<0||a.to<0||a.from===a.to||a.from>=g.factions.length||
         a.to>=g.factions.length||!Number.isFinite(a.troops)||a.troops<=0||
         !Number.isSafeInteger(a.arrivalTick)||a.arrivalTick<=save.tick||
         a.arrivalTick>save.tick+8))
      throw Error('Ungültige Bündnisverstärkung.');
    g.alliances.push(...structuredClone(alliances));
    g.offers.push(...structuredClone(offers));
    g.defenseAid.push(...structuredClone(defenseAid));
    const diplomacyCooldowns=save.diplomacyCooldowns??[];
    if(!Array.isArray(diplomacyCooldowns)||diplomacyCooldowns.length>g.factions.length*2||
       diplomacyCooldowns.some(v=>!Number.isInteger(v.a)||!Number.isInteger(v.b)||
         v.a<0||v.a>=v.b||v.b>=g.factions.length||
         !Number.isSafeInteger(v.untilTick)||v.untilTick<=save.tick))
      throw Error('Ungültige diplomatische Abkühlzeit.');
    g.diplomacyCooldowns.push(...structuredClone(diplomacyCooldowns));
    const warTruces=save.warTruces??[];
    if(!Array.isArray(warTruces)||warTruces.length>g.factions.length*2||
       warTruces.some(v=>!Number.isInteger(v.a)||!Number.isInteger(v.b)||
         v.a<=0||v.a>=v.b||v.b>=g.factions.length||
         !Number.isSafeInteger(v.untilTick)||v.untilTick<=save.tick))
      throw Error('Ungültiger Waffenstillstand.');
    g.warTruces.push(...structuredClone(warTruces));
    const levels=save.factoryLevels??[];
    if(!Array.isArray(levels)||levels.length>20000||levels.some(v=>!Number.isInteger(v?.index)||
      v.index<0||v.index>=CELL_COUNT||g.buildings[v.index]!==BUILDING_CODES.factory||
      !Number.isInteger(v.level)||v.level<1||v.level>4)||
      new Set(levels.map(v=>v.index)).size!==levels.length)throw Error('Ungültige Fabrikstufen.');
    for(const v of levels)g.factoryLevels.set(v.index,v.level);
    const factoryLinks=save.factoryLinks??[];
    if(!Array.isArray(factoryLinks)||factoryLinks.length>20000||factoryLinks.some(v=>
      !Number.isInteger(v?.factory)||!Number.isInteger(v?.city)||
      v.factory<0||v.city<0||v.factory>=CELL_COUNT||v.city>=CELL_COUNT||
      g.buildings[v.factory]!==BUILDING_CODES.factory||
      g.owner[v.factory]<0||g.owner[v.factory]!==g.owner[v.city]||
      !(g.buildings[v.city]===BUILDING_CODES.city||g.capitalSites.has(v.city))||
      Math.hypot(v.factory%MAP_WIDTH-v.city%MAP_WIDTH,
        Math.floor(v.factory/MAP_WIDTH)-Math.floor(v.city/MAP_WIDTH))>FACTORY_LINK_MAX_DISTANCE)||
      new Set(factoryLinks.map(v=>v.factory)).size!==factoryLinks.length)
      throw Error('Ungültige Fabrikverbindungen.');
    for(const v of factoryLinks)g.factoryLinks.set(v.factory,v.city);
    const squads=save.squads??[];
    if(!Array.isArray(squads)||squads.length>g.factions.length*12||
       squads.some(v=>!Number.isSafeInteger(v.id)||v.id<=0||
         !Number.isInteger(v.owner)||v.owner<0||v.owner>=g.factions.length||
         !Number.isInteger(v.index)||v.index<0||v.index>=CELL_COUNT||
         g.owner[v.index]!==v.owner||!Number.isFinite(v.troops)||v.troops<=0||v.troops>1000||
         (v.destination!==null&&(!Number.isInteger(v.destination)||v.destination<0||
           v.destination>=CELL_COUNT||g.owner[v.destination]!==v.owner))||
         (v.attackTarget!==undefined&&v.attackTarget!==null&&
           (!Number.isInteger(v.attackTarget)||v.attackTarget<0||
            v.attackTarget>=CELL_COUNT||g.owner[v.attackTarget]===v.owner))||
         (v.campaignTarget!==undefined&&v.campaignTarget!==null&&
           (!Number.isInteger(v.campaignTarget)||v.campaignTarget<0||v.campaignTarget>=CELL_COUNT))||
         (v.campaignOwner!==undefined&&v.campaignOwner!==null&&
           (!Number.isInteger(v.campaignOwner)||v.campaignOwner<NEUTRAL||v.campaignOwner>=g.factions.length)))||
       new Set(squads.map(v=>v.id)).size!==squads.length)
       throw Error('Ungültige Kasernen-Truppen.');
    g.squads.push(...squads.map(v=>({...v})));
    g.nextSquadId=Math.max(0,...g.squads.map(v=>v.id))+1;
    const borderOrders=save.borderOrders??[];
    if(!Array.isArray(borderOrders)||borderOrders.length>512||
       borderOrders.some(v=>!Number.isInteger(v?.index)||v.index<0||
         v.index>=CELL_COUNT||g.owner[v.index]!==0||
         (v.mode!=='defend'&&v.mode!=='withdraw'))||
       new Set(borderOrders.map(v=>v.index)).size!==borderOrders.length)
      throw Error('Ungültige Grenzbefehle im Spielstand.');
    for(const v of borderOrders)g.borderOrders.set(v.index,v.mode);
    g.events.splice(0,g.events.length,...structuredClone(save.events));
    g.tick=save.tick;g.status=save.status;g.paused=!!save.paused;g.doctrine=save.doctrine;
    g.aiGoalChange=save.aiGoalChange;g.nextAttackId=save.nextAttackId;
    const generator=seededRandom(save.seed);
    for(let i=0;i<save.rngCalls;i++)generator();
    g.rngCalls=save.rngCalls;
    g.rng=()=>{g.rngCalls++;return generator();};
    g.recount();g.rebuildFrontierCandidates();
    return g;
  }

  factionAt(point: Point): Faction | null {
    const x = Math.floor(point.x), y = Math.floor(point.y);
    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return null;
    const id = this.owner[y * MAP_WIDTH + x];
    return id >= 0 ? this.factions[id] : null;
  }
}
