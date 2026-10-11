import { GEO_BOUNDS, LAND_ROWS, MAP_HEIGHT, MAP_WIDTH, SEA_CROSSINGS, WORLD_HEIGHT, WORLD_WIDTH } from '../data/europe.js';

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
}
export interface AttackResult { ok: boolean; reason: string; sent: number; targetOwner?: number; }
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

  constructor(seed = 2026, opponentCount = 10) {
    this.seed = seed;
    this.rng = seededRandom(seed);
    this.owner.fill(WATER);
    for (let i = 0; i < CELL_COUNT; i++) if (isLand(i)) this.owner[i] = NEUTRAL;
    this.factions = STARTS.slice(0, Math.max(1, Math.min(11, opponentCount + 1))).map((start, id) => ({
      id, name: start.name, capital: start.capital, color: start.color, troops: 400,
      territory: 0, income: 0, target: geoToCell(start.lon, start.lat),
      ai: id !== 0, alive: true, cityCount: 0, captured: 0,
    }));
    for (let id = 0; id < this.factions.length; id++) {
      const start = STARTS[id];
      const index = this.findNearestLand(geoToCell(start.lon, start.lat), true);
      if (index === -1) throw new Error(`Missing valid capital ${start.capital}`);
      const pos = cellToPoint(index);
      this.cities.push({ name: start.capital, ...pos, index, original: id, owner: id });
      this.seedTerritory(id, pos, 3.6);
    }
    this.initialTerritory = this.factions[0].territory;
    this.factions[0].target = geoToCell(9.3, 49.4);
    this.recount();
    this.pickAIGoals();
    this.log('10 Großmächte mobilisieren ihre Armeen.');
    this.log('Nachschub aus Sektoren und Städten aktiviert.');
    this.log('Operation EUROPA gestartet. Ziel auf Karte setzen.', this.factions[0].color);
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
      const baseIncome = f.alive ? 2.5 + f.territory * 0.12 + f.cityCount * 3.8 : 0;
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
      for (const neighbor of NEIGHBORS[i]) {
        const owner = this.owner[neighbor];
        if (owner !== id && owner !== WATER) targets.add(owner);
      }
    }
    return targets;
  }

  /** One click attacks a neighboring faction; ratio is an integer percentage of available troops. */
  launchAttack(id: number, target: Point, ratio: number): AttackResult {
    const failed = (reason: string): AttackResult => ({ ok: false, reason, sent: 0 });
    const attacker = this.factions[id];
    if (!attacker?.alive || this.status !== 'playing') return failed('Diese Fraktion kann nicht angreifen.');
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y) || target.x < 0 || target.y < 0 || target.x >= MAP_WIDTH || target.y >= MAP_HEIGHT) return failed('Außerhalb der Karte.');
    if (!Number.isFinite(ratio) || ratio < 5 || ratio > 100) return failed('Truppenanteil muss zwischen 5 und 100 % liegen.');
    const index = pointToIndex(target);
    const owner = this.owner[index];
    if (owner === WATER) return failed('Angriff auf Wasser nicht möglich.');
    if (owner === id) return failed('Das ist dein eigenes Gebiet.');
    if (!this.attackableOwners(id).has(owner)) return failed('Keine gemeinsame Grenze – zuerst angrenzende Gebiete erobern.');
    const sent = Math.floor(attacker.troops * ratio / 100);
    if (sent < 8) return failed('Mindestens 8 verfügbare Truppen erforderlich.');
    attacker.troops -= sent;
    this.attackOrders.push({ id: this.nextAttackId++, factionId: id, targetOwner: owner,
      anchor: cellToPoint(index), committed: sent, remaining: sent, conquered: 0 });
    if (id === 0) {
      const targetName = owner === NEUTRAL ? 'NEUTRALGEBIET' : this.factions[owner].name;
      this.log(`Offensive gegen ${targetName}: ${sent.toLocaleString('de-DE')} Truppen entsandt.`, attacker.color);
    }
    return { ok: true, reason: 'Angriff gestartet.', sent, targetOwner: owner };
  }

  private chooseOrderedFront(order: AttackOrder): number {
    let best = -1, score = -Infinity;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (this.owner[i] !== order.targetOwner) continue;
      let friendly = 0;
      for (const n of NEIGHBORS[i]) if (this.owner[n] === order.factionId) friendly++;
      if (!friendly) continue;
      const x = i % MAP_WIDTH, y = Math.floor(i / MAP_WIDTH);
      const d = Math.hypot(x - order.anchor.x, y - order.anchor.y);
      const city = this.cities.some(c => c.index === i);
      const next = friendly * 1.3 - d + (city ? 2 : 0);
      if (next > score) { score = next; best = i; }
    }
    return best;
  }

  private resolveOrders(attacker: Faction) {
    // Spends only the committed budget: active battles cannot silently drain reserve troops.
    const orders = this.attackOrders.filter(o => o.factionId === attacker.id);
    for (const order of orders) {
      const strikes = this.doctrine === 'blitz' && attacker.id === 0 ? 6 : this.doctrine === 'expand' && attacker.id === 0 && order.targetOwner === NEUTRAL ? 5 : 3;
      let unreachable = false;
      for (let k = 0; k < strikes && order.remaining >= 0.01; k++) {
        const index = this.chooseOrderedFront(order);
        if (index === -1) { unreachable = true; break; }
        const cost = Math.min(order.remaining, order.targetOwner === NEUTRAL ? (attacker.id === 0 && this.doctrine === 'expand' ? 6 : 8) : 21);
        order.remaining -= cost;
        const captured = this.strike(attacker, index, cost);
        if (captured) order.conquered++;
      }
      if (unreachable || order.remaining < 0.01) {
        if (unreachable && order.remaining > 0) attacker.troops = Math.min(9000, attacker.troops + order.remaining);
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

  /** Return one attackable adjacent tile chosen as a compact front advancing towards target. */
  private chooseFront(id: number): number {
    const faction = this.factions[id];
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (this.owner[i] === WATER || this.owner[i] === id) continue;
      let friendly = 0;
      for (const n of NEIGHBORS[i]) if (this.owner[n] === id) friendly++;
      if (!friendly) continue;
      const x = i % MAP_WIDTH, y = Math.floor(i / MAP_WIDTH);
      const d = Math.hypot(x - faction.target.x, y - faction.target.y);
      const neutral = this.owner[i] === NEUTRAL;
      const city = this.cities.find(c => c.index === i);
      const doctrineBonus = id !== 0 ? 0 : this.doctrine === 'expand' ? (neutral ? 11 : 0) : this.doctrine === 'blitz' ? (neutral ? 0 : 14) : 0;
      const score = -d + friendly * 3.2 + (neutral ? 5 : -5) + (city ? 6 : 0) + doctrineBonus + this.rng() * 2.5;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  private strike(faction: Faction, index: number, spent: number): boolean {
    // All attack types share the same defense and capture rules.
    this.defense[index] -= spent * (0.95 + this.rng() * 0.22);
    if (this.defense[index] > 0) return false;
    this.owner[index] = faction.id;
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
      if (!faction.alive) continue;
      faction.troops = Math.min(9000, faction.troops + faction.income);
      if (faction.id === 0) {
        // Human troops move only when explicitly ordered by clicking an adjacent faction.
        this.resolveOrders(faction);
        continue;
      }
      const baseAttempts = 2 + Math.floor(faction.territory / 175);
      const extra = 0;
      const attempts = Math.max(1, Math.min(10, baseAttempts + extra));
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
