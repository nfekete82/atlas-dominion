import { COUNTRIES, MAP_HEIGHT, MAP_WIDTH, SEA_CROSSINGS, WORLD_HEIGHT, WORLD_WIDTH } from '../data/europe.js';
import { Game, NEUTRAL, WATER, pointToWorld, pointToIndex, seededRandom, type Point } from '../engine/game.js';
import { TerritoryWave, waveProgress } from './wave.js';
import {organicCaptureRadius,burningFrontAlpha} from './capture-visual.js';
import { pixelGridEdges } from './pixel-grid.js';
import { territoryContours, contourRings } from './territory-contours.js';
import { buildingMarkerFor, showBuildingMarker, buildingMarkerFontSize } from './building-markers.js';
// Keep natural-dark ocean and distinct faction colors; no pale map wash.
import { COUNTRY_STARTS } from '../data/countries.js';
import {formatCompact} from '../format.js';
import {groupBattles,visualNoise,type FrontGroup} from './front-battles.js';

const CW = WORLD_WIDTH / MAP_WIDTH;
const CH = WORLD_HEIGHT / MAP_HEIGHT;
const X_EDGES = pixelGridEdges(MAP_WIDTH, WORLD_WIDTH);
const Y_EDGES = pixelGridEdges(MAP_HEIGHT, WORLD_HEIGHT);
const FLAGS=new Map<string,string>(COUNTRY_STARTS.map(country=>[country.name,
  country.code==='XK'?'🇽🇰':[...country.code].map(ch=>String.fromCodePoint(127397+ch.charCodeAt(0))).join('')
] as const));

export class MapRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private base = document.createElement('canvas');
  private overlay = document.createElement('canvas');
  private highlightedCountry = document.createElement('canvas');
  private showSeaPassages=false;
  private highlightOwner = WATER;
  private hoverIndex = -1;
  private hoverFront: Point | null = null;
  private wave: TerritoryWave;
  private scale = 1;
  private zoom = 1;
  private ox = 0;
  private oy = 0;
  private dragging = false;
  private last = { x: 0, y: 0 };
  private press = { x: 0, y: 0 };
  private hover: Point | null = null;
  private moved = false;
  private availableTargets = new Set<number>();
  private labels: Array<{ id: number; pos: Point }> = [];
  private armyTotals: number[] = [];
  /** Cached when territory/buildings change, not rescanned every animation frame. */
  private buildingMarkers: Array<{index:number;code:number;owner:number}> = [];
  // Combat highlights represent actual touching borders, never routes from a capital.
  private combatEdges: Array<{ ax:number; ay:number; bx:number; by:number }> = [];
  private combatLabels: Array<{ pos:Point; troops:number }> = [];
  private frontGroups:FrontGroup[]=[];
  private frontUpdatedAt=0;
  private reinforcementWaves:Array<{from:Point;to:Point;started:number;sent:number}>=[];
  private reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  game: Game;
  onSelect: (point: Point, landing: boolean) => void = () => {};
  onBuildRequest: (point: Point | null, clientX: number, clientY: number) => void = () => {};
  onHover: (point: Point | null, px: number, py: number, landing: boolean) => void = () => {};

  constructor(canvas: HTMLCanvasElement, game: Game) {
    this.canvas = canvas;
    this.game = game;
    this.wave = new TerritoryWave(game.owner, MAP_WIDTH);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D wird nicht unterstützt.');
    this.ctx = ctx;
    for (const c of [this.base, this.overlay, this.highlightedCountry]) { c.width = WORLD_WIDTH; c.height = WORLD_HEIGHT; }
    this.renderBase();
    this.updateTerritory();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.installControls();
    this.resize();
    requestAnimationFrame(t => this.frame(t));
  }

  setGame(game: Game) {
    this.game = game;
    this.hover=null;
    this.hoverIndex=-1;
    this.hoverFront=null;
    this.highlightOwner=WATER;
    this.highlightedCountry.getContext('2d')!.clearRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
    this.wave.reset(game.owner);
    this.frontGroups=[];
    this.frontUpdatedAt=0;
    this.reinforcementWaves=[];
    this.updateTerritory();
    this.fit();
  }
  focusOnCapital(point: Point): void {
    this.zoom = 1.8;
    this.scale = Math.min(this.canvas.clientWidth / WORLD_WIDTH, this.canvas.clientHeight / WORLD_HEIGHT) * this.zoom;
    const pos = pointToWorld(point);
    this.ox = this.canvas.clientWidth / 2 - pos.x * this.scale;
    this.oy = this.canvas.clientHeight / 2 - pos.y * this.scale;
  }
  fit() {
    this.zoom = 1;
    this.scale = Math.min(this.canvas.clientWidth / WORLD_WIDTH, this.canvas.clientHeight / WORLD_HEIGHT) * this.zoom;
    this.ox = (this.canvas.clientWidth - WORLD_WIDTH * this.scale) / 2;
    this.oy = (this.canvas.clientHeight - WORLD_HEIGHT * this.scale) / 2;
  }
  private resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.canvas.clientWidth * dpr);
    this.canvas.height = Math.round(this.canvas.clientHeight * dpr);
    this.fit();
  }
  private renderBase() {
    const c = this.base.getContext('2d')!;
    const sea = c.createLinearGradient(0, 0, 1100, 800);
    sea.addColorStop(0, '#081e2a'); sea.addColorStop(0.56, '#102832'); sea.addColorStop(1, '#0a1b27');
    c.fillStyle = sea; c.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    c.strokeStyle = 'rgba(103,159,162,0.055)'; c.lineWidth = 1;
    for (let x = 0; x <= WORLD_WIDTH; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, WORLD_HEIGHT); c.stroke(); }
    for (let y = 0; y <= WORLD_HEIGHT; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(WORLD_WIDTH, y); c.stroke(); }
    for (const country of COUNTRIES) {
      const path = new Path2D();
      for (const ring of country.rings) {
        ring.forEach(([x, y], j) => j === 0 ? path.moveTo(x, y) : path.lineTo(x, y));
        path.closePath();
      }
      c.fillStyle = '#263c40'; c.fill(path);
      c.strokeStyle = 'rgba(141,173,165,0.28)'; c.lineWidth = 1.15; c.stroke(path);
    }
    // Faint sea corridors represent crossings for islands and separated landmasses.
    c.save();c.setLineDash([4,7]);c.strokeStyle='rgba(153,205,200,.4)';c.lineWidth=1.5;
    for (const [a,b] of SEA_CROSSINGS) {
      const ax=(a % MAP_WIDTH +.5)*CW, ay=(Math.floor(a/MAP_WIDTH)+.5)*CH;
      const bx=(b % MAP_WIDTH +.5)*CW, by=(Math.floor(b/MAP_WIDTH)+.5)*CH;
      c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.stroke();
    }
    c.restore();
    const rng = seededRandom(7122);
    for (let i = 0; i < 1700; i++) {
      const x = rng() * WORLD_WIDTH, y = rng() * WORLD_HEIGHT;
      c.fillStyle = rng() > 0.55 ? 'rgba(169,201,181,.055)' : 'rgba(12,15,13,.12)';
      c.fillRect(x, y, rng() * 2.2 + 0.5, rng() * 2.2 + 0.5);
    }
    c.save();
    c.font = '11px ui-monospace, monospace'; c.fillStyle = 'rgba(150,184,188,.32)';
    c.letterSpacing = '2px';
    for (const [label, x, y] of [['NORTH ATLANTIC',76,257],['MEDITERRANEAN SEA',530,745],['BALTIC SEA',710,230],['BLACK SEA',1070,670],['NORTH SEA',290,255]]) c.fillText(label as string, x as number, y as number);
    c.restore();
    const vignette = c.createRadialGradient(640,400,50,640,400,780);
    vignette.addColorStop(0,'rgba(0,0,0,0)'); vignette.addColorStop(1,'rgba(2,12,19,.6)');
    c.fillStyle = vignette; c.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
  }
  updateTerritory() {
    this.availableTargets = this.game.attackableOwners(0);
    const sumX = new Float64Array(this.game.factions.length);
    const sumY = new Float64Array(this.game.factions.length);
    const counts = new Uint32Array(this.game.factions.length);
    const stationed = new Float64Array(this.game.factions.length);
    const regional: Array<Array<{index:number; troops:number}>> = this.game.factions.map(()=>[]);
    const c = this.overlay.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.clearRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
    const owners = this.game.owner;
    this.buildingMarkers=[];
    const now=performance.now();
    this.wave.capture(owners,now);
    // Build contact clusters from genuine strikes this tick, not estimated
    // or fabricated armies. Grouping is recomputed only at 4Hz, not per frame.
    this.frontGroups=groupBattles(this.game.battleEvents,owners,MAP_WIDTH)
      .filter(group=>group.leftId!==NEUTRAL && group.rightId!==NEUTRAL);
    this.frontUpdatedAt=now;
    for (let i = 0; i < owners.length; i++) {
      const id = owners[i];
      if (id < 0) continue;
      sumX[id] += i % MAP_WIDTH;
      sumY[id] += Math.floor(i / MAP_WIDTH);
      counts[id]++;
      const buildingCode=this.game.buildings[i];
      if(buildingCode>0)this.buildingMarkers.push({index:i,code:buildingCode,owner:id});
      const front = this.game.frontline[i];
      stationed[id] += front;
      if (front > 0.1) regional[id].push({index:i,troops:front});
      // Native bitmap-aligned cell edges keep every square sharp, with NO
      // fractional alpha bleeding, gaps or overlapping 0.45px overdraw.
      // No per-tile fill: organic polygons below own all visual territory color.
    }
    // Marching squares creates rounded-looking diagonals and soft corners.
    // This presentation-only pass never changes tile ownership or targeting.
    const contours=territoryContours(owners,MAP_WIDTH);
    c.save();c.lineCap='round';c.lineJoin='round';
    const paths=new Map<number,Path2D>();
    for(const faction of this.game.factions){
      if(!counts[faction.id])continue;
      const segments=contours.get(faction.id);
      if(!segments?.length)continue;
      const path=new Path2D();
      const rings=contourRings(segments);
      for(const ring of rings){
        path.moveTo(ring[0]*CW,ring[1]*CH);
        for(let j=2;j<ring.length;j+=2)path.lineTo(ring[j]*CW,ring[j+1]*CH);
        path.closePath();
      }
      paths.set(faction.id,path);
    }
    // Paint all territory fills first so borders cannot disappear under neighbors.
    for(const faction of this.game.factions){
      const path=paths.get(faction.id);
      if(!path)continue;
      c.fillStyle=faction.color+'be';
      c.fill(path,'evenodd');
    }
    for(const faction of this.game.factions){
      const path=paths.get(faction.id);
      if(!path)continue;
      c.strokeStyle=faction.color+'51';c.lineWidth=1.5;c.stroke(path);
      c.strokeStyle='rgba(226,239,232,.19)';c.lineWidth=.6;c.stroke(path);
    }
    c.restore();
    // Show the player's structures first; at mid zoom keep only spatially
    // separated markers so neighboring settlements cannot form giant blobs.
    this.buildingMarkers.sort((a,b)=>Number(b.owner===0)-Number(a.owner===0)
      || Number(b.code===2)-Number(a.code===2)
      || a.index-b.index);
    this.armyTotals=this.game.factions.map(f=>f.troops+stationed[f.id]+this.game.attackOrders.filter(o=>o.factionId===f.id).reduce((n,o)=>n+o.remaining,0));
    // One prominent troop badge per active faction; anchor remains on owned land
    // even when the centroid lies outside a concave or fragmented territory.
    const best = new Float64Array(this.game.factions.length).fill(Infinity);
    const anchor = new Int32Array(this.game.factions.length).fill(-1);
    for (let i = 0; i < owners.length; i++) {
      const id = owners[i];
      if (id < 0 || !counts[id]) continue;
      const dx = (i % MAP_WIDTH) - sumX[id] / counts[id];
      const dy = Math.floor(i / MAP_WIDTH) - sumY[id] / counts[id];
      const distance = dx * dx + dy * dy;
      if (distance < best[id]) { best[id] = distance; anchor[id] = i; }
    }
    this.labels = [...anchor].flatMap((index,id)=>index < 0 ? [] : [{ id,
      pos: pointToWorld({ x: index % MAP_WIDTH, y: Math.floor(index / MAP_WIDTH) }) }]);

    this.refreshHoverPreview(this.hover, true);
    this.combatEdges = [];
    this.combatLabels = [];
    for (const order of this.game.attackOrders) {
      // Neutral expansion stays visually quiet: no combat contact segments or labels.
      if (order.factionId !== 0 || order.remaining < 0.01 || order.targetOwner===NEUTRAL) continue;
      const radius = Math.min(40, 8 + Math.sqrt(order.conquered) * 2.5);
      const radius2 = radius * radius;
      let sumX = 0, sumY = 0, contacts = 0;
      const minX = Math.max(0, Math.floor(order.anchor.x - radius));
      const maxX = Math.min(MAP_WIDTH - 1, Math.ceil(order.anchor.x + radius));
      const minY = Math.max(0, Math.floor(order.anchor.y - radius));
      const maxY = Math.min(MAP_HEIGHT - 1, Math.ceil(order.anchor.y + radius));
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const i = y * MAP_WIDTH + x;
        if (owners[i] !== order.targetOwner || (x-order.anchor.x)**2+(y-order.anchor.y)**2 > radius2) continue;
        const left = x > 0 && owners[i-1] === order.factionId;
        const right = x+1 < MAP_WIDTH && owners[i+1] === order.factionId;
        const top = y > 0 && owners[i-MAP_WIDTH] === order.factionId;
        const bottom = y+1 < MAP_HEIGHT && owners[i+MAP_WIDTH] === order.factionId;
        const px=x*CW, py=y*CH;
        if (left) this.combatEdges.push({ax:px,ay:py,bx:px,by:py+CH});
        if (right) this.combatEdges.push({ax:px+CW,ay:py,bx:px+CW,by:py+CH});
        if (top) this.combatEdges.push({ax:px,ay:py,bx:px+CW,by:py});
        if (bottom) this.combatEdges.push({ax:px,ay:py+CH,bx:px+CW,by:py+CH});
        if (left||right||top||bottom) {sumX+=px+CW/2;sumY+=py+CH/2;contacts++;}
      }
      if (contacts) this.combatLabels.push({pos:{x:sumX/contacts,y:sumY/contacts},troops:order.remaining});
    }
  }
  /** Cache the currently chosen real border; keyboard and tooltip reuse it. */
  previewFront(point: Point): Point | null {
    const i=Math.floor(point.y)*MAP_WIDTH+Math.floor(point.x);
    if(i===this.hoverIndex)return this.hoverFront;
    return this.game.owner[point.y*MAP_WIDTH+point.x]===0
      ? this.game.findCounterattackFront(0,point)
      : this.game.findAttackFront(0,point);
  }

  /** Rebuild only when the owner changes or the simulation claims new land.
   * Full-faction highlight is pre-rendered rather than redrawn every frame.
   */
  private refreshHoverPreview(point:Point|null,force=false):void {
    const index=point?point.y*MAP_WIDTH+point.x:-1;
    if(!force && index===this.hoverIndex)return;
    this.hoverIndex=index;
    const owner=index>=0?this.game.owner[index]:WATER;
    const front=point && owner!==WATER
      ? owner===0?this.game.findCounterattackFront(0,point)
        :this.game.findAttackFront(0,point)
      :null;
    this.hoverFront=front;
    const highlight=front?this.game.owner[pointToIndex(front)]:WATER;
    if(!force && highlight===this.highlightOwner)return;
    this.highlightOwner=highlight;
    const c=this.highlightedCountry.getContext('2d')!;
    c.clearRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
    if(highlight<0)return;
    const boundary=new Path2D();
    c.fillStyle='rgba(211,245,226,.085)';
    const owners=this.game.owner;
    for(let i=0;i<owners.length;i++){
      if(owners[i]!==highlight)continue;
      const col=i%MAP_WIDTH,row=Math.floor(i/MAP_WIDTH);
      const x=X_EDGES[col],y=Y_EDGES[row],right=X_EDGES[col+1],bottom=Y_EDGES[row+1];
      c.fillRect(x,y,right-x,bottom-y);
      if(col===0||owners[i-1]!==highlight){boundary.moveTo(x+.5,y);boundary.lineTo(x+.5,bottom);}
      if(col===MAP_WIDTH-1||owners[i+1]!==highlight){boundary.moveTo(right-.5,y);boundary.lineTo(right-.5,bottom);}
      if(row===0||owners[i-MAP_WIDTH]!==highlight){boundary.moveTo(x,y+.5);boundary.lineTo(right,y+.5);}
      if(row===MAP_HEIGHT-1||owners[i+MAP_WIDTH]!==highlight){boundary.moveTo(x,bottom-.5);boundary.lineTo(right,bottom-.5);}
    }
    c.lineJoin='round';c.lineCap='round';c.lineWidth=.9;
    c.strokeStyle='rgba(193,238,220,.32)';c.stroke(boundary);
  }

  /** Used by the tooltip; same shared-border predicate as launchAttack(). */
  canAttack(point: Point): boolean {
    const x = Math.floor(point.x), y = Math.floor(point.y);
    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return false;
    const owner=this.game.owner[y*MAP_WIDTH+x];
    return (owner===0||this.availableTargets.has(owner)) && this.previewFront(point)!==null;
  }
  canLand(point: Point): boolean { return this.game.canLand(0,point); }
  /** Tiny, background-free world-space glyphs for built structures.
   * Screen-space collision suppression keeps the map clear at overview zoom.
   * Move/zoom or click to see individual buildings at higher magnification.
   */
  private drawBuildings(c:CanvasRenderingContext2D):void {
    if(this.zoom<1.05 || !this.buildingMarkers.length)return;
    const screenWidth=this.canvas.clientWidth,screenHeight=this.canvas.clientHeight;
    const minSpacing=this.zoom>=2.6?10:14;
    const buckets=new Map<string,Array<{x:number;y:number}>>();
    const font=buildingMarkerFontSize(this.scale);
    c.save();
    c.textAlign='center';c.textBaseline='middle';
    c.font=`700 ${font}px system-ui`;
    c.lineJoin='round';
    c.lineWidth=1.65/this.scale;
    c.strokeStyle='rgba(4,20,29,.88)';
    for(const marker of this.buildingMarkers){
      if(!showBuildingMarker(marker.owner,this.zoom))continue;
      const style=buildingMarkerFor(marker.code);
      if(!style)continue;
      const x=(marker.index%MAP_WIDTH+.5)*CW;
      const y=(Math.floor(marker.index/MAP_WIDTH)+.5)*CH;
      const sx=this.ox+x*this.scale,sy=this.oy+y*this.scale;
      if(sx<-12||sy<-12||sx>screenWidth+12||sy>screenHeight+12)continue;
      const col=Math.floor(sx/minSpacing),row=Math.floor(sy/minSpacing);
      let obstructed=false;
      for(let dx=-1;dx<=1&&!obstructed;dx++)for(let dy=-1;dy<=1&&!obstructed;dy++){
        const prior=buckets.get(`${col+dx}:${row+dy}`);
        if(prior?.some(p=>(sx-p.x)**2+(sy-p.y)**2<minSpacing**2))obstructed=true;
      }
      if(obstructed)continue;
      const key=`${col}:${row}`;
      const occupied=buckets.get(key)??[];
      occupied.push({x:sx,y:sy});
      buckets.set(key,occupied);
      c.globalAlpha=marker.owner===0?.92:.72;
      // No filled square, circle, badge or permanent highlight behind the icon.
      c.strokeText(style.symbol,x,y);
      c.fillStyle=style.color;
      c.fillText(style.symbol,x,y);
    }
    c.restore();
  }

  /** Purely visual feedback for a successful, already paid-for deployment.
   * The originating reserve label is anchored on friendly territory; particles
   * track the camera in world coordinates. Never mutates combat or troops.
   */
  showReinforcement(front:Point,sent:number):void {
    if(this.reducedMotion||sent<1)return;
    const source=this.labels.find(label=>label.id===0)?.pos;
    if(!source)return;
    const destination=pointToWorld(front);
    this.reinforcementWaves.push({from:{...source},to:destination,
      started:performance.now(),sent});
    if(this.reinforcementWaves.length>8)this.reinforcementWaves.shift();
  }
  private drawReinforcements(c:CanvasRenderingContext2D,timestamp:number):void {
    const duration=1050;
    this.reinforcementWaves=this.reinforcementWaves.filter(w=>timestamp-w.started<duration);
    if(!this.reinforcementWaves.length)return;
    c.save();
    for(const wave of this.reinforcementWaves){
      const t=Math.max(0,Math.min(1,(timestamp-wave.started)/duration));
      const ease=t*t*(3-2*t);
      const ax=this.ox+wave.from.x*this.scale,ay=this.oy+wave.from.y*this.scale;
      const bx=this.ox+wave.to.x*this.scale,by=this.oy+wave.to.y*this.scale;
      const dx=bx-ax,dy=by-ay,length=Math.hypot(dx,dy);
      if(length<2)continue;
      const nx=-dy/length,ny=dx/length;
      const count=Math.min(16,Math.max(5,Math.floor(Math.sqrt(wave.sent)*1.6)));
      for(let i=0;i<count;i++){
        const stagger=i/count*.28;
        const p=Math.max(0,Math.min(1,(ease-stagger)/(1-stagger)));
        const lane=Math.sin(i*2.39996)*Math.min(12,3+length*.025)*Math.sin(Math.PI*p);
        const x=ax+dx*p+nx*lane,y=ay+dy*p+ny*lane;
        c.globalAlpha=Math.min(1,p*8)*(1-Math.max(0,p-.80)*4)*.86;
        c.fillStyle=i%3===0?'#d6f2ff':'#54c5ff';
        c.beginPath();c.arc(x,y,i%4===0?2:1.35,0,Math.PI*2);c.fill();
      }
      if(t<.65){
        c.globalAlpha=(1-t/.65)*.58;
        c.lineWidth=1.1;c.strokeStyle='#65d1fc';c.setLineDash([3,7]);
        c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.stroke();c.setLineDash([]);
      }
    }
    c.restore();
  }

  /** OpenFront-inspired movement language, independently rendered:
   * actual blue (us) vs red (enemies) particles stream toward the genuine
   * contact border. The cached groups are derived exclusively from strikes,
   * so visual soldiers can NEVER influence simulation RNG or casualties.
   */
  private drawLiveBattles(c:CanvasRenderingContext2D,timestamp:number):void {
    if(this.game.status!=='playing' || !this.frontGroups.length)return;
    const since=Math.max(0,timestamp-this.frontUpdatedAt);
    // Four game updates per second; a short tail bridges rendering frames
    // without leaving permanent fake battles on old territory.
    const fade=Math.max(0,Math.min(1,(720-since)/350));
    if(fade<=0)return;
    const w=this.canvas.clientWidth,h=this.canvas.clientHeight;
    c.save();
    c.lineCap='round';c.textBaseline='middle';
    const labels:Array<{x:number;y:number}>=[];
    let shown=0;
    for(const group of this.frontGroups){
      if(shown>=34)break;
      if(!group.playerBattle && this.zoom<1.1)continue;
      const x=this.ox+group.x*CW*this.scale;
      const y=this.oy+group.y*CH*this.scale;
      if(x<16||x>w-16||y<55||y>h-32)continue;
      const magnitude=group.attacker+group.defender;
      if(!(magnitude>0))continue;
      shown++;
      const dx=group.dx,dy=group.dy,nx=-dy,ny=dx;
      const crowd=Math.min(22,Math.max(5,Math.floor(3+Math.sqrt(magnitude)*1.1)));
      const isPlayer=group.playerBattle;
      const side1=isPlayer?'#54c5ff':'#b8d8bc';
      const side2=isPlayer?'#ff7275':'#f3aa75';
      // Draw a few lightweight moving soldiers per side, rather than
      // thousands of real sprites. All movement is deterministic by seed.
      if(!this.reducedMotion){
        for(let side=0;side<2;side++){
          if(side===1 && (isPlayer?group.red:group.defender)<=0)continue;
          c.strokeStyle=side===0?side1:side2;
          c.fillStyle=c.strokeStyle;
          for(let i=0;i<crowd;i++){
            const seed=group.seed+side*10007+i*43;
            const phase=(timestamp*(.00075+visualNoise(seed,0)*.00055)
              +visualNoise(seed,1))%1;
            const lane=(visualNoise(seed,2)-.5)*Math.min(20,8+group.strikes*1.5);
            const sideSign=side===0?-1:1;
            // Come in from the two opposing sides toward the border.
            const travel=sideSign*(4.3+9.2*(1-phase));
            const px=x+dx*travel+nx*lane,py=y+dy*travel+ny*lane;
            const length=1.3+visualNoise(seed,4)*1.4;
            c.globalAlpha=fade*(.38+phase*.6);
            c.lineWidth=1.2;
            c.beginPath();
            c.moveTo(px-dx*sideSign*length,py-dy*sideSign*length);
            c.lineTo(px+dx*sideSign*length,py+dy*sideSign*length);
            c.stroke();
          }
        }
      }
      // Local contact sparks appear only when there really were defenders.
      if((isPlayer?group.red:group.defender)>0){
        const pulse=.45+.55*Math.abs(Math.sin(timestamp*.019+group.seed*.04));
        c.globalAlpha=fade*pulse*.85;
        c.fillStyle='#fff1be';
        c.beginPath();c.arc(x,y,1.4+1.1*pulse,0,Math.PI*2);c.fill();
        c.strokeStyle='rgba(255,174,94,.75)';c.lineWidth=.85;
        c.beginPath();c.arc(x,y,4.4+2*pulse,0,Math.PI*2);c.stroke();
      }
      c.globalAlpha=1;
      // Numbers mean actual soldiers fighting this tick, not total country
      // population. Only human-involved contacts get blue/red counterplates.
      if(!isPlayer||this.zoom<1.05||group.leftId<0)continue;
      const labelX=x,labelY=y-15;
      if(labelX<40||labelX>w-40||labelY<55||labelY>h-32)continue;
      if(labels.some(p=>Math.abs(p.x-labelX)<79&&Math.abs(p.y-labelY)<20))continue;
      labels.push({x:labelX,y:labelY});
      // Small, unobtrusive split counters sit on the actual contested border.
      const bw=78,bh=15;
      c.globalAlpha=fade*.92;
      c.fillStyle='rgba(5,20,28,.85)';
      c.strokeStyle='rgba(133,160,166,.35)';
      c.lineWidth=.6;
      c.beginPath();c.roundRect(labelX-bw/2,labelY-bh/2,bw,bh,3);c.fill();c.stroke();
      c.textAlign='center';c.font='700 8px system-ui';
      c.fillStyle=side1;c.fillText('●',labelX-33,labelY);
      c.fillStyle='#d7f4ff';c.fillText(formatCompact(group.blue),labelX-16,labelY,30);
      c.fillStyle=side2;c.fillText('●',labelX+9,labelY);
      c.fillStyle='#ffddd9';c.fillText(formatCompact(group.red),labelX+25,labelY,28);
      c.globalAlpha=1;
    }
    c.restore();
  }

  /** Tiny standing army counters follow active REAL orders between strikes.
   * Blue is the surviving committed attacking army, while red is only the
   * enemy's actually posted guard on the adjacent border (not made-up militia).
   * Live 2-sided contact labels take priority over these standing badges.
   */
  private drawActiveFrontForces(c:CanvasRenderingContext2D):void {
    if(this.game.status!=='playing')return;
    const w=this.canvas.clientWidth,h=this.canvas.clientHeight;
    const shown:Array<{x:number;y:number}>=[];
    c.save();c.textBaseline='middle';c.textAlign='center';
    for(const order of this.game.attackOrders){
      if(order.factionId!==0||order.remaining<1 || order.targetOwner===NEUTRAL)continue;
      const owners=this.game.owner;
      let index=order.contested??order.lastCaptured??pointToIndex(order.anchor);
      if(index<0||index>=owners.length)continue;
      const cells=[index];
      // A captured tile is no longer an enemy border; move to its new
      // neighbouring opponent and keep the label on a true physical contact.
      if(owners[index]===0){
        const x=index%MAP_WIDTH,y=Math.floor(index/MAP_WIDTH);
        cells.length=0;
        for(const n of [x>0?index-1:-1,x+1<MAP_WIDTH?index+1:-1,
          y>0?index-MAP_WIDTH:-1,y+1<MAP_HEIGHT?index+MAP_WIDTH:-1]){
          if(n>=0&&owners[n]===order.targetOwner)cells.push(n);
        }
      }
      const enemy=cells.find(n=>owners[n]===order.targetOwner);
      if(enemy===undefined)continue;
      const ex=enemy%MAP_WIDTH,ey=Math.floor(enemy/MAP_WIDTH);
      const neighbors=[ex>0?enemy-1:-1,ex+1<MAP_WIDTH?enemy+1:-1,
        ey>0?enemy-MAP_WIDTH:-1,ey+1<MAP_HEIGHT?enemy+MAP_WIDTH:-1];
      const own=neighbors.find(n=>n>=0&&owners[n]===0);
      if(own===undefined)continue;
      const ox=own%MAP_WIDTH,oy=Math.floor(own/MAP_WIDTH);
      const x=this.ox+(ex+ox+1)*.5*CW*this.scale;
      const y=this.oy+(ey+oy+1)*.5*CH*this.scale+16;
      if(x<42||y<50||x>w-42||y>h-35)continue;
      if(shown.some(p=>Math.abs(p.x-x)<79&&Math.abs(p.y-y)<22))continue;
      // Assigned army count sits below the small live-clash counters:
      // blue = whole surviving offensive, while the battle badge above it
      // shows only the troops in the most recent individual confrontation.
      shown.push({x,y});
      c.globalAlpha=.86;
      c.fillStyle='rgba(5,20,28,.8)';
      c.strokeStyle='rgba(72,144,173,.6)';
      c.lineWidth=.7;
      c.beginPath();c.roundRect(x-37,y-7,74,14,3);c.fill();c.stroke();
      c.font='700 8px system-ui';
      c.fillStyle='#5fcbff';c.fillText('●',x-31,y);
      c.fillStyle='#d7f4ff';c.fillText(formatCompact(order.remaining),x-11,y,36);
      const actualPosted=this.game.frontline[enemy];
      if(actualPosted>.5){
        c.fillStyle='#ff7878';c.fillText('●',x+11,y);
        c.fillStyle='#ffd0ce';c.fillText(formatCompact(actualPosted),x+27,y,24);
      }else{
        c.fillStyle='rgba(181,196,198,.78)';c.fillText('→',x+25,y);
      }
    }
    c.restore();
  }

  private drawTroopBadges(c: CanvasRenderingContext2D) {
    c.save();
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    c.textAlign = 'center';
    const boxes: Array<{x:number;y:number}>=[];
    let shown=0;
    for(const label of this.labels){
      const faction=this.game.factions[label.id];
      if(!faction?.alive)continue;
      if(label.id!==0 && this.zoom<1.55 && faction.territory<90)continue;
      if(label.id!==0 && this.zoom<2.3 && faction.territory<18)continue;
      if(label.id!==0 && shown>=16 && this.zoom<2.6)continue;
      const x=this.ox+label.pos.x*this.scale;
      let y=this.oy+label.pos.y*this.scale+17;
      if(x<60||x>width-60||y<35||y>height-72)continue;
      for(let j=0;j<3&&boxes.some(p=>Math.abs(p.x-x)<114&&Math.abs(p.y-y)<31);j++)y+=27;
      if(y>height-72)continue;
      boxes.push({x,y});shown++;
      const flag=FLAGS.get(faction.name)??'';
      const name=(flag?flag+' ':'')+faction.name;
      c.globalAlpha=label.id===0?.95:this.zoom>=2.5?.82:.68;
      c.textAlign='center';c.lineJoin='round';
      c.strokeStyle='rgba(5,17,25,.85)';
      c.fillStyle=label.id===0?'#fff4cf':'#e1eae6';
      c.lineWidth=2.6;
      c.font=label.id===0?'750 13px system-ui':'650 11px system-ui';
      c.strokeText(name,x,y,135);c.fillText(name,x,y,135);
      // The map's central number is the mobile reserve, not all soldiers including attacking armies.
       // Reinforcing a front therefore immediately lowers the displayed count.
       const count=formatCompact(Math.floor(faction.troops));
      c.font=label.id===0?'700 10px system-ui':'600 9px system-ui';
      c.lineWidth=2;c.strokeText(count,x,y+13,95);c.fillText(count,x,y+13,95);
    }
    c.globalAlpha=1;

    c.restore();
  }
  /** Only when holding SHIFT, show reachable maritime landings as an icon.
   * No permanent round port stamps or pulsing rings on the map.
   */
  private drawLandingPorts(c:CanvasRenderingContext2D, _timestamp:number):void {
    c.save();
    c.textAlign='center';c.textBaseline='middle';
    c.font='800 13px system-ui';
    const seen=new Set<number>();
    for(const [a,b] of SEA_CROSSINGS)for(const index of [a,b]){
      if(seen.has(index))continue;seen.add(index);
      const point={x:index%MAP_WIDTH,y:Math.floor(index/MAP_WIDTH)};
      if(!this.game.canLand(0,point))continue;
      const pos=pointToWorld(point);
      c.fillStyle='#ffe3a1';c.shadowColor='#0c2730';c.shadowBlur=3;
      c.fillText('⚓',pos.x,pos.y);
    }
    c.restore();
  }
  private drawCaptureWave(c:CanvasRenderingContext2D,timestamp:number):void {
    const captures=this.wave.active(timestamp);
    if(!captures.length)return;
    c.save();
    c.imageSmoothingEnabled=true;
    for(const frame of captures){
      if(frame.owner<0)continue;
      const progress=waveProgress(frame,timestamp);
      if(progress>=1)continue;
      const col=frame.index%MAP_WIDTH,row=Math.floor(frame.index/MAP_WIDTH);
      const x=X_EDGES[col],y=Y_EDGES[row];
      const w=X_EDGES[col+1]-x,h=Y_EDGES[row+1]-y;
      const cx=x+w*.5,cy=y+h*.5;
      // Limit the paint to the real captured sector. Visual softness does
      // not change ownership or spill into water and enemy territories.
      c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
      c.globalAlpha=1-progress;
      c.fillStyle=frame.previous>=0
        ? this.game.factions[frame.previous].color+'be' : '#263c40';
      c.fillRect(x,y,w,h);
      c.globalAlpha=1;
      const radius=organicCaptureRadius(progress,Math.max(w,h),frame.index);
      if(radius>.01){
        const newColor=this.game.factions[frame.owner].color;
        const glow=burningFrontAlpha(progress);
        const gradient=c.createRadialGradient(cx,cy,Math.max(0,radius*.24),cx,cy,radius);
        gradient.addColorStop(0,newColor+'de');
        gradient.addColorStop(.72,newColor+'d9');
        gradient.addColorStop(.89,`rgba(248,175,91,${glow.toFixed(3)})`);
        gradient.addColorStop(1,'rgba(248,175,91,0)');
        c.fillStyle=gradient;
        c.beginPath();c.arc(cx,cy,radius,0,Math.PI*2);c.fill();
      }
      c.restore();
    }
    // A shared, briefly glowing wave crest follows only the real OUTER
    // perimeter of newly claimed land. Preserve crisp final sector edges.
    const crest=new Path2D();
    let hot=0;
    const owners=this.game.owner;
    for(const frame of captures){
      const progress=waveProgress(frame,timestamp);
      if(frame.owner<0||progress<.15||progress>.91)continue;
      const i=frame.index,col=i%MAP_WIDTH,row=Math.floor(i/MAP_WIDTH);
      const x=X_EDGES[col],y=Y_EDGES[row],r=X_EDGES[col+1],b=Y_EDGES[row+1];
      if(col>0 && owners[i-1]!==frame.owner && owners[i-1]!==WATER){
        crest.moveTo(x,y);crest.lineTo(x,b);hot++;
      }
      if(col+1<MAP_WIDTH && owners[i+1]!==frame.owner && owners[i+1]!==WATER){
        crest.moveTo(r,y);crest.lineTo(r,b);hot++;
      }
      if(row>0 && owners[i-MAP_WIDTH]!==frame.owner && owners[i-MAP_WIDTH]!==WATER){
        crest.moveTo(x,y);crest.lineTo(r,y);hot++;
      }
      if(row+1<MAP_HEIGHT && owners[i+MAP_WIDTH]!==frame.owner && owners[i+MAP_WIDTH]!==WATER){
        crest.moveTo(x,b);crest.lineTo(r,b);hot++;
      }
    }
    if(hot){
      c.lineJoin='round';c.lineCap='round';
      c.shadowColor='rgba(255,136,59,.7)';c.shadowBlur=3;
      c.strokeStyle='rgba(255,190,112,.55)';c.lineWidth=1.2;
      c.stroke(crest);
    }
    c.restore();
  }
  private frame(timestamp: number) {
    const c = this.ctx;
    const dpr = this.canvas.width / Math.max(1,this.canvas.clientWidth);
    c.setTransform(dpr,0,0,dpr,0,0);
    c.fillStyle='#07141e'; c.fillRect(0,0,this.canvas.clientWidth,this.canvas.clientHeight);
    c.save(); c.translate(this.ox,this.oy); c.scale(this.scale,this.scale);
    c.imageSmoothingEnabled=true; // Keep the geographical backdrop smooth.
    c.drawImage(this.base,0,0);
    c.imageSmoothingEnabled=true; // Antialias territory resampling while preserving exact sector ownership.
    c.drawImage(this.overlay,0,0);
    c.imageSmoothingEnabled=true;
    c.drawImage(this.highlightedCountry,0,0);
    this.drawCaptureWave(c, timestamp);
    this.drawBuildings(c);
    if(this.showSeaPassages)this.drawLandingPorts(c, timestamp);
    // Capitals are present in the labels and right-click economy, not giant
    // rings or square icons floating above the map. At close zoom, reveal a
    // subtle capital name (no circle).
    if(this.zoom>=3.0) {
      c.save();
      c.textAlign='center';
      c.font='600 8px system-ui';
      c.fillStyle='rgba(233,239,236,.67)';
      for(const city of this.game.cities){
        const pos=pointToWorld(city);
        c.fillText(city.name.toUpperCase(),pos.x,pos.y-7,90);
      }
      c.restore();
    }
    if(this.game.status==='playing' && this.combatEdges.length){
      // One clear live combat boundary: no pulse, halo, arrows or markers.
      c.save();c.beginPath();
      for(const edge of this.combatEdges){c.moveTo(edge.ax,edge.ay);c.lineTo(edge.bx,edge.by);}
      // Organic warm contact glow, confined to actual front edges.
      c.lineCap='round';c.lineJoin='round';
      c.shadowColor='rgba(255,153,83,.56)';c.shadowBlur=5;
      c.lineWidth=2;c.strokeStyle='#ffbd80';c.stroke();
      c.shadowBlur=0;c.lineWidth=.85;c.strokeStyle='#fff0c5';c.stroke();
      c.restore();
    }
    // Mouse feedback is now the subtle whole-target tint cached above.
    // No hover square or animated point circle.
    c.restore();
    this.drawLiveBattles(c,timestamp);
    this.drawReinforcements(c,timestamp);
    this.drawActiveFrontForces(c);
    this.drawTroopBadges(c);
    requestAnimationFrame(t=>this.frame(t));
  }
  zoomBy(factor: number) {
    const cx=this.canvas.clientWidth/2,cy=this.canvas.clientHeight/2;
    const old=this.scale;
    this.zoom=Math.max(0.8,Math.min(4,this.zoom*factor));
    this.scale=Math.min(this.canvas.clientWidth/WORLD_WIDTH,this.canvas.clientHeight/WORLD_HEIGHT)*this.zoom;
    const ratio=this.scale/old;
    this.ox=cx-(cx-this.ox)*ratio;
    this.oy=cy-(cy-this.oy)*ratio;
  }
  private worldAt(clientX:number,clientY:number):Point {
    const box=this.canvas.getBoundingClientRect();
    return {x:(clientX-box.left-this.ox)/this.scale,y:(clientY-box.top-this.oy)/this.scale};
  }
  private cellAt(clientX:number,clientY:number,landing=false):Point|null {
    if(landing) {
      const box=this.canvas.getBoundingClientRect();
      const px=clientX-box.left, py=clientY-box.top;
      let nearest:Point|null=null, minD=16*16;
      for(const [a,b] of SEA_CROSSINGS) for(const index of [a,b]) {
        const point={x:index%MAP_WIDTH,y:Math.floor(index/MAP_WIDTH)};
        if(!this.game.canLand(0,point))continue;
        const pos=pointToWorld(point);
        const dx=this.ox+pos.x*this.scale-px, dy=this.oy+pos.y*this.scale-py;
        const d=dx*dx+dy*dy;
        if(d<minD){minD=d;nearest=point;}
      }
      if(nearest)return nearest;
    }
    const p=this.worldAt(clientX,clientY);
    const x=Math.floor(p.x/CW),y=Math.floor(p.y/CH);
    if(x<0||y<0||x>=MAP_WIDTH||y>=MAP_HEIGHT)return null;
    return {x,y};
  }
  private installControls() {
    // Maritime markers appear only while Shift is held, not all game long.
    window.addEventListener('keydown',e=>{if(e.key==='Shift')this.showSeaPassages=true;});
    window.addEventListener('keyup',e=>{if(e.key==='Shift')this.showSeaPassages=false;});
    window.addEventListener('blur',()=>{this.showSeaPassages=false;});
    this.canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      this.dragging=true;this.moved=false;this.last={x:e.clientX,y:e.clientY};this.press={...this.last};
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove',e=>{
      if(this.dragging) {
        const dx=e.clientX-this.last.x,dy=e.clientY-this.last.y;
        if(Math.hypot(e.clientX-this.press.x,e.clientY-this.press.y)>5)this.moved=true;
        if(this.moved){this.ox+=dx;this.oy+=dy;}
        this.last={x:e.clientX,y:e.clientY};
      }
      this.hover=this.cellAt(e.clientX,e.clientY,e.shiftKey);
      this.refreshHoverPreview(this.hover);
      const box=this.canvas.getBoundingClientRect();
      this.onHover(this.hover,e.clientX-box.left,e.clientY-box.top,e.shiftKey);
    });
    this.canvas.addEventListener('pointerup',e=>{
      if(e.button!==0)return;
      if(!this.moved){const p=this.cellAt(e.clientX,e.clientY,e.shiftKey);if(p)this.onSelect(p,e.shiftKey);}
      this.dragging=false;
    });
    this.canvas.addEventListener('pointercancel',()=>{this.dragging=false;});
    this.canvas.addEventListener('pointerleave',()=>{this.hover=null;this.refreshHoverPreview(null);this.onHover(null,0,0,false);});
    this.canvas.addEventListener('contextmenu',e=>{
      e.preventDefault();
      const point=this.cellAt(e.clientX,e.clientY,false);
      const owned=point!==null && this.game.owner[point.y*MAP_WIDTH+point.x]===0;
      this.onBuildRequest(owned?point:null,e.clientX,e.clientY);
    });
    this.canvas.addEventListener('wheel',e=>{
      e.preventDefault();
      const b=this.canvas.getBoundingClientRect();
      const cx=e.clientX-b.left,cy=e.clientY-b.top;
      const prev=this.scale;
      this.zoom=Math.max(0.8,Math.min(4,this.zoom*(e.deltaY<0?1.13:1/1.13)));
      this.scale=Math.min(this.canvas.clientWidth/WORLD_WIDTH,this.canvas.clientHeight/WORLD_HEIGHT)*this.zoom;
      const ratio=this.scale/prev;
      this.ox=cx-(cx-this.ox)*ratio;this.oy=cy-(cy-this.oy)*ratio;
    },{passive:false});
  }
}
