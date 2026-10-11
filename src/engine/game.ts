import { GEO_BOUNDS, LAND_ROWS, MAP_HEIGHT, MAP_WIDTH, SEA_CROSSINGS, WORLD_HEIGHT, WORLD_WIDTH } from '../data/europe.js';
import { assessInvasion, interceptAttack } from './warfare.js';
import { armyIncome, frontierBudget, frontierTarget, localDefenseStrength } from './frontline.js';

export const WATER = -2;
export const NEUTRAL = -1;
export const TICK_SECONDS = 0.25;

export interface Point { x: number; y: number }
export interface Faction {
  id: number;
  name: string;
  capital: string;
  color: string;
  troops: number;
  territory: number;
  income: number;
  target: Point;
  ai: boolean;
  alive: boolean;
  cityCount: number;
  captured: number;
  defenseSpent: number;
  intent: 'hold' | 'expand' | 'invade';
}
export interface City { name: string; x: number; y: number; index: number; original: number; owner: number; }
export interface GameEvent { tick: number; text: string; color: string; }
export interface AttackOrder {
  id: number;
  factionId: number;
  targetOwner: number;
  anchor: Point;
  committed: number;
  remaining: number;
  conquered: number;
  landing?: boolean;
  startedTick?: number;
}
export interface AttackResult { ok: boolean; reason: string; sent: number; targetOwner?: number; front?: Point; }
export type GameStatus = 'playing' | 'victory' | 'defeat';
export type Doctrine = 'expand' | 'blitz' | 'fortify';

const STARTS = [
  { name: 'DOMINION', capital: 'Berlin', color: '#e9b85e', lon: 13.405, lat: 52.52 },
  { name: 'ALBION', capital: 'London', color: '#6bc8de', lon: -0.128, lat: 51.508 },
  { name: 'GAUL', capital: 'Paris', color: '#ee788c', lon: 2.35, lat: 48.86 },
  { name: 'IBERIA', capital: 'Madrid', color: '#d994f2', lon: -3.7, lat: 40.42 },
  { name: 'ITALIA', capital: 'Rom', color: '#7bdda7', lon: 12.49, lat: 41.9 },
  { name: 'NORD', capital: 'Stockholm', color: '#a8c9f4', lon: 18.06, lat: 59.33 },
  { name: 'VISTULA', capital: 'Warschau', color: '#ea9877', lon: 21.01, lat: 52.23 },
  { name: 'RUTHENIA', capital: 'Kyjiw', color: '#f0d58c', lon: 30.52, lat: 50.45 },
  { name: 'ANATOLIA', capital: 'Istanbul', color: '#9d9cf4', lon: 28.98, lat: 41.01 },
  { name: 'BALKAN', capital: 'Belgrad', color: '#e89ec6', lon: 20.46, lat: 44.8 },
  { name: 'DACIA', capital: 'Bukarest', color: '#86d4c8', lon: 26.1, lat: 44.43 },
] as const;

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
export function landNeighbors(index: number): readonly number[] { return LAND_LAND_NEIGHBORS[index]; }
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
  /** Real troops committed to individual threatened frontier sectors, separate from mobile reserves. */
  readonly frontline = new Float64Array(CELL_COUNT);
  readonly factions: Faction[];
  readonly cities: City[] = [];
  readonly events: GameEvent[] = [];
  readonly attackOrders: AttackOrder[] = [];
  private nextAttackId = 1;
  readonly seed: number;
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

  constructor(seed = 2026, opponentCount = 10) {
    this.seed = seed;
    this.rng = seededRandom(seed);
    this.owner.fill(WATER);
    for (let i = 0; i < CELL_COUNT; i++) if (isLand(i)) this.owner[i] = NEUTRAL;
    this.factions = STARTS.slice(0, Math.max(1, Math.min(11, opponentCount + 1))).map((start, id) => ({
      id, name: start.name, capital: start.capital, color: start.color, troops: 400,
      territory: 0, income: 0, target: geoToCell(start.lon, start.lat),
      ai: id !== 0, alive: true, cityCount: 0, captured: 0, defenseSpent: 0, intent: 'hold',
    }));
    for (let id = 0; id < this.factions.length; id++) {
      const start = STARTS[id];
      const index = this.findNearestLand(geoToCell(start.lon, start.lat), true);
      if (index === -1) throw new Error(`Missing valid capital ${start.capital}`);
      const pos = cellToPoint(index);
      this.cities.push({ name: start.capital, ...pos, index, original: id, owner: id });
      this.seedTerritory(id, pos, 5.4);
    }
    this.initialTerritory = this.factions[0].territory;
    this.factions[0].target = geoToCell(9.3, 49.4);
    this.recount();
    this.pickAIGoals();
    this.log('10 Großmächte mobilisieren ihre Armeen.');
    this.log('Nachschub aus Sektoren und Städten aktiviert.');
    this.log('Automatische Grenzsicherung aktiv. Truppen in Reserve verteidigen bei Angriffen.', this.factions[0].color);
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

  private recount() {
    for (const f of this.factions) { f.territory = 0; f.cityCount = 0; }
    for (const id of this.owner) if (id >= 0) this.factions[id].territory++;
    for (const city of this.cities) {
      city.owner = this.owner[city.index];
      if (city.owner >= 0) this.factions[city.owner].cityCount++;
    }
    for (const f of this.factions) {
      f.alive = f.territory > 0;
      const baseIncome = armyIncome(f.territory, f.cityCount, TOTAL_LAND);
      f.income = f.id === 0 ? baseIncome * (this.doctrine === 'fortify' ? 1.4 : this.doctrine === 'blitz' ? 0.9 : 1) : baseIncome;
    }
  }

  private log(text: string, color = '#b9c4d0') {
    this.events.unshift({ tick: this.tick, text, color });
    if (this.events.length > 8) this.events.length = 8;
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
      const budget = frontierBudget(faction.troops, faction.income);
      if (budget < 0.01) continue;
      let remaining = budget;
      // Cover weak points first. Equal-strength sectors break ties by map index.
      exposed[faction.id].sort((a,b)=>this.frontline[a]-this.frontline[b] || a-b);
      for (const i of exposed[faction.id]) {
        if (remaining < 0.01) break;
        const isCapital = this.cities.some(city => city.index === i);
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

  /** A target is attackable ONLY if that exact cell touches our land.
   * Clicking a remote part of the same empire no longer teleports the attack.
   */
  isDirectBorderTarget(id: number, target: Point): boolean {
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y) ||
        target.x < 0 || target.y < 0 || target.x >= MAP_WIDTH || target.y >= MAP_HEIGHT ||
        !this.factions[id]?.alive) return false;
    const index = pointToIndex(target);
    return this.owner[index] !== WATER && this.owner[index] !== id &&
      LAND_NEIGHBORS[index].some(n => this.owner[n] === id);
  }

  findAttackFront(id: number, target: Point): Point | null {
    return this.isDirectBorderTarget(id,target) ? cellToPoint(pointToIndex(target)) : null;
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
    const index = pointToIndex(target), owner = this.owner[index];
    if (owner === WATER) return failed('Angriff auf Wasser nicht möglich.');
    if (owner === id) return failed('Das ist dein eigenes Gebiet.');
    if (landing ? !this.canLand(id,target) : !this.isDirectBorderTarget(id,target))
      return failed(landing ? 'Keine eigene Küste an diesem Seeübergang.' : 'Kein direkter Grenzkontakt – Grenzsektor anklicken.');
    const sent = Math.floor(attacker.troops * ratio / 100);
    if (sent < 8) return failed('Mindestens 8 mobile Truppen erforderlich.');
    attacker.troops -= sent;
    const front = cellToPoint(index);
    this.attackOrders.push({
      id:this.nextAttackId++, factionId:id, targetOwner:owner,
      anchor:front, committed:sent, remaining:sent, conquered:0,
      landing, startedTick:this.tick,
    });
    if (id === 0) this.log(`${landing?'Seelandung':'Grenzoffensive'}: ${sent.toLocaleString('de-DE')} Truppen gegen ${owner===NEUTRAL?'NEUTRALGEBIET':this.factions[owner].name}.`,attacker.color);
    return {ok:true,reason:landing?'Landung befohlen.':'Grenzangriff gestartet.',sent,targetOwner:owner,front};
  }

  /** Picks only adjacent enemy sectors close to this specific battlefront.
   * Sea links are excluded; the explicit landing is the sole exception.
   */
  private chooseOrderedFront(order: AttackOrder): number {
    const landingIndex = pointToIndex(order.anchor);
    if (order.landing && order.conquered === 0) {
      if (this.owner[landingIndex] !== order.targetOwner) return -1;
      return this.canLand(order.factionId,order.anchor) ? landingIndex : -1;
    }
    const candidates = this.frontierCandidates[order.factionId];
    if (!candidates) return -1;
    let best=-1, score=-Infinity;
    const range = 9 + Math.sqrt(order.conquered) * 2.7;
    const radius2=range*range;
    for(const i of candidates){
      if(this.owner[i]!==order.targetOwner)continue;
      const x=i%MAP_WIDTH, y=Math.floor(i/MAP_WIDTH);
      const d2=(x-order.anchor.x)**2+(y-order.anchor.y)**2;
      if(d2>radius2)continue;
      let friendly=0;
      for(const n of LAND_NEIGHBORS[i]) if(this.owner[n]===order.factionId)friendly++;
      if(!friendly)continue;
      const city=this.cities.some(c=>c.index===i);
      const next=friendly*1.4-Math.sqrt(d2)+(city?2:0);
      if(next>score){best=i;score=next;}
    }
    return best;
  }

  private resolveOrders(attacker: Faction) {
    // Spends only the committed budget: active battles cannot silently drain reserve troops.
    const orders = this.attackOrders.filter(o => o.factionId === attacker.id);
    for (const order of orders) {
      if (order.landing && order.conquered === 0 && this.tick - (order.startedTick ?? 0) < 4) continue;
      const strikes = this.doctrine === 'blitz' && attacker.id === 0 ? 6 : this.doctrine === 'expand' && attacker.id === 0 && order.targetOwner === NEUTRAL ? 5 : 3;
      let unreachable = false;
      for (let k = 0; k < strikes && order.remaining >= 0.01; k++) {
        const index = this.chooseOrderedFront(order);
        if (index === -1) { unreachable = true; break; }
        const cost = Math.min(order.remaining, order.targetOwner === NEUTRAL ? (attacker.id === 0 && this.doctrine === 'expand' ? 6 : 8) : 21);
        order.remaining -= cost;
        const captured = this.strike(attacker, index, cost);
        if (captured) { order.conquered++; if (order.landing) order.landing = false; }
      }
      if (unreachable || order.remaining < 0.01) {
        if (unreachable && order.remaining > 0) attacker.troops += order.remaining;
        const pos = this.attackOrders.findIndex(o => o.id === order.id);
        if (pos >= 0) this.attackOrders.splice(pos, 1);
        if (attacker.id === 0) this.log(`Offensive beendet · ${order.conquered} Sektoren erobert.`, attacker.color);
      }
    }
  }

  private pickAIGoals() {
    for (const faction of this.factions) {
      if (!faction.ai || !faction.alive) continue;
      const capital = this.cities[faction.id];
      const enemies = this.cities.filter(c => c.owner !== faction.id && c.owner >= 0);
      enemies.sort((a, b) => distance2(a, capital) - distance2(b, capital));
      const target = enemies[Math.floor(this.rng() * Math.min(enemies.length, 3))];
      if (target) faction.target = { x: target.x, y: target.y };
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
      const city=this.cities.find(c=>c.index===i);
      const neutral=opponent===NEUTRAL;
      const defender=neutral?null:this.factions[opponent];
      const assessment=assessInvasion({
        attackerTroops:faction.troops,attackerIncome:faction.income,
        defenderTroops:defender?Math.min(defender.troops*.15,40+defender.income*3):0,
        defenderIncome:defender?.income ?? 0,garrison:this.sectorDefense(i),
        capital:!!city,neutral,threatenedBorders:exposed,
      });
      if(!assessment.worthwhile)continue;
      const x=i%MAP_WIDTH,y=Math.floor(i/MAP_WIDTH);
      const d=Math.hypot(x-faction.target.x,y-faction.target.y);
      const strategic=neutral?19:9+Math.min(28,(assessment.advantage-1)*24);
      const score=strategic-d*.8+friendly*2.8+(city?11:0)+this.rng()*1.3;
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
    const rawDamage = spent * (0.95 + this.rng() * 0.22);
    let mitigation = 0;
    if (originalOwner >= 0 && originalOwner !== faction.id) {
      const defender = this.factions[originalOwner];
      const capital = this.cities.some(c => c.index === index);
      const fortified = originalOwner === 0 && this.doctrine === 'fortify';
      const local = interceptAttack(this.frontline[index], rawDamage, fortified, capital);
      this.frontline[index] -= local.used;
      defender.defenseSpent += local.used;
      mitigation += local.blocked;

      // Capital dispatches slightly more mobile emergency defenders.
      const emergencyLimit = Math.min(defender.troops, rawDamage * (capital ? 0.23 : 0.10));
      const emergency = interceptAttack(emergencyLimit, Math.max(0, rawDamage - mitigation), fortified, capital);
      defender.troops -= emergency.used;
      defender.defenseSpent += emergency.used;
      mitigation += emergency.blocked;
    }
    this.defense[index] -= Math.max(0.01, rawDamage - Math.min(mitigation, rawDamage * 0.94));
    if (this.defense[index] > 0) return false;
    this.owner[index] = faction.id;
    // Incrementally update local battlefronts as territory changes.
    for (const [id,set] of this.frontierCandidates.entries()) {
      if (id === faction.id) set.delete(index);
      else if (LAND_NEIGHBORS[index].some(n=>this.owner[n]===id)) set.add(index);
    }
    const ownFront=this.frontierCandidates[faction.id];
    if(ownFront)for(const n of LAND_NEIGHBORS[index]) if(this.owner[n]!==faction.id && this.owner[n]!==WATER) ownFront.add(n);
    // Remaining local defenders are lost when their sector is overrun.
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

  private attack(faction: Faction, index: number) {
    if (faction.troops < 7) return false;
    const defender = this.owner[index];
    const force = faction.id === 0 && this.doctrine === 'blitz' ? 29 : 21;
    const spent = Math.min(faction.troops, defender === NEUTRAL ? 8 : force);
    faction.troops -= spent;
    this.strike(faction, index, spent);
    return true;
  }

  step(): void {
    if (this.paused || this.status !== 'playing') return;
    this.tick++;
    if (this.tick >= this.aiGoalChange) {
      this.pickAIGoals();
      this.aiGoalChange = this.tick + 45;
    }
    this.recount();
    for (const faction of this.factions) {
      if (faction.alive) faction.troops += faction.income;
    }
    this.redistributeFrontline();
    this.rebuildFrontierCandidates();
    for (const faction of this.factions) {
      if (!faction.alive) continue;
      if (faction.id === 0) {
        // Human troops move only when explicitly ordered by clicking an adjacent faction.
        this.resolveOrders(faction);
        continue;
      }
      const baseAttempts = 2 + Math.floor(faction.territory / 175);
      const attempts = Math.max(1, Math.min(10, baseAttempts));
      for (let k = 0; k < attempts; k++) {
        const target = this.chooseFront(faction.id);
        if (target === -1 || !this.attack(faction, target)) break;
      }
    }
    this.recount();
    if (!this.factions[0].alive) {
      this.status = 'defeat';
      this.log('DOMINION wurde besiegt.', '#ee788c');
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
