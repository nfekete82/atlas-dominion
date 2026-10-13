import {createTopographyLayer} from './topography.js';
import {voyageGeometry,voyagePosition,type VoyageGeometry} from './sea-voyages.js';
import { COUNTRIES, MAP_HEIGHT, MAP_WIDTH, WORLD_HEIGHT, WORLD_WIDTH } from '../data/europe.js';
import { COUNTRY_STARTS } from '../data/countries.js';
import { Game, NEUTRAL, WATER, pointToWorld, pointToIndex, seededRandom, type Point } from '../engine/game.js';
import { TerritoryWave, waveProgress } from './wave.js';
import {organicCaptureRadius,burningFrontAlpha} from './capture-visual.js';
import { pixelGridEdges } from './pixel-grid.js';
import { territoryContours, contourRings } from './territory-contours.js';
import { buildingMarkerFor, showBuildingMarker, cityVisibleAtZoom, drawCityMarker, cityMarkerBounds, ScreenOccupancy, type ScreenRect } from './building-markers.js';
// Keep natural-dark ocean and distinct faction colors; no pale map wash.
import {formatCompact} from '../format.js';
import {militarySummaries,relativeStrength,strengthLabel,mobileStrengthLabel,type MilitarySummary} from '../military-view.js';
import {groupBattles,visualNoise,combatVisualDensity,battleMomentum,type FrontGroup} from './front-battles.js';

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
  // Visual interpolation only: squad positions in the simulation are untouched.
  private squadVisuals=new Map<number,{index:number;from:number;changedAt:number}>();
  private showSeaPassages=false;
  private readonly panKeys=new Set<string>();
  private previousPanFrame=0;
  private topography=createTopographyLayer();
  private showTopography=true;
  private voyageCache=new WeakMap<number[],{geometry:VoyageGeometry;path:Path2D}>();
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
  private hoverPointer:{x:number;y:number;landing:boolean}|null=null;
  private moved = false;
  private availableTargets = new Set<number>();
  private labels: Array<{ id: number; pos: Point }> = [];
  military: MilitarySummary[] = [];
  private strengthLabels: string[] = [];
  private mobileLabels: string[] = [];
  private strengthRelations: ReturnType<typeof relativeStrength>[] = [];
  private visibleCountryLabels:Array<{id:number;name:string;strength:string;mobile:string;fontSize:number;bounds:ScreenRect}>=[];
  private occupancy=new ScreenOccupancy();
  private cityAnchors=new ScreenOccupancy();
  private overlayBounds:ScreenRect[]=[];
  private visibleCityMarkers:Array<{index:number;x:number;y:number;level:number;bounds:ScreenRect}>=[];
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
  onSelectSquads:(ids:number[])=>void=()=>{};
  selectedSquadIds:number[]=[];
  private selectionBox:{x1:number;y1:number;x2:number;y2:number}|null=null;
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
    this.fit();
    requestAnimationFrame(t => this.frame(t));
  }

  setGame(game: Game) {
    this.game = game;
    this.squadVisuals.clear();
    this.hover=null;
    this.hoverPointer=null;
    this.hoverIndex=-1;
    this.hoverFront=null;
    this.highlightOwner=WATER;
    this.highlightedCountry.getContext('2d')!.clearRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
    this.wave.reset(game.owner);
    this.frontGroups=[];
    this.frontUpdatedAt=0;
    this.reinforcementWaves=[];
    this.visibleCityMarkers=[];
    this.updateTerritory();
    this.fit();
  }
  /** Current camera rectangle in fixed map-world units, for the minimap. */
  visibleWorldBounds():{x:number;y:number;width:number;height:number}{
    return {x:-this.ox/this.scale,y:-this.oy/this.scale,
      width:this.canvas.clientWidth/this.scale,height:this.canvas.clientHeight/this.scale};
  }

  /** Jump from an alert or an army command to its actual map position. */
  focusOnPoint(point:Point,minZoom=1.8):void {
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||
       point.x<0||point.x>=MAP_WIDTH||point.y<0||point.y>=MAP_HEIGHT)return;
    this.zoom=Math.max(this.zoom,Math.min(4,Math.max(.8,minZoom)));
    this.scale=Math.min(this.canvas.clientWidth/WORLD_WIDTH,
      this.canvas.clientHeight/WORLD_HEIGHT)*this.zoom;
    const pos=pointToWorld(point);
    this.ox=this.canvas.clientWidth/2-pos.x*this.scale;
    this.oy=this.canvas.clientHeight/2-pos.y*this.scale;
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
  private dpr=1;
  private resize() {
    const previousWidth=this.canvas.width/this.dpr;
    const previousHeight=this.canvas.height/this.dpr;
    this.dpr=Math.max(1,devicePixelRatio || 1);
    this.canvas.width = Math.round(this.canvas.clientWidth * this.dpr);
    this.canvas.height = Math.round(this.canvas.clientHeight * this.dpr);
    const previousScale=this.scale;
    this.scale=Math.min(this.canvas.clientWidth/WORLD_WIDTH,this.canvas.clientHeight/WORLD_HEIGHT)*this.zoom;
    const ratio=this.scale/previousScale;
    this.ox=this.canvas.clientWidth/2-(previousWidth/2-this.ox)*ratio;
    this.oy=this.canvas.clientHeight/2-(previousHeight/2-this.oy)*ratio;
    const box=this.canvas.getBoundingClientRect();
    this.overlayBounds=Array.from(this.canvas.parentElement?.querySelectorAll<HTMLElement>(
      '.map-heading, .map-location, .bottom-bar, .zoom-controls, .bottom-hint')??[])
      .filter(element=>element.getClientRects().length>0)
      .map(element=>{const r=element.getBoundingClientRect();return {x:r.left-box.left,y:r.top-box.top,width:r.width,height:r.height};});
  }
  private renderBase() {
    const c = this.base.getContext('2d')!;
    const sea = c.createLinearGradient(0, 0, 1100, 800);
    sea.addColorStop(0, '#081b28'); sea.addColorStop(0.56, '#15303b'); sea.addColorStop(1, '#091923');
    c.fillStyle = sea; c.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    c.strokeStyle = 'rgba(103,159,162,0.048)'; c.lineWidth = 1;
    for (let x = 0; x <= WORLD_WIDTH; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, WORLD_HEIGHT); c.stroke(); }
    for (let y = 0; y <= WORLD_HEIGHT; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(WORLD_WIDTH, y); c.stroke(); }
    // Faint survey lines add geographical depth without claiming navigable
    // routes or placing decorations over the actual territory layer.
    c.save();c.setLineDash([3,13]);c.lineWidth=.8;
    c.strokeStyle='rgba(140,196,197,.085)';
    for(let x=160;x<WORLD_WIDTH;x+=160){c.beginPath();c.moveTo(x,0);c.lineTo(x,WORLD_HEIGHT);c.stroke();}
    for(let y=120;y<WORLD_HEIGHT;y+=120){c.beginPath();c.moveTo(0,y);c.lineTo(WORLD_WIDTH,y);c.stroke();}
    c.restore();
    for (const country of COUNTRIES) {
      const path = new Path2D();
      for (const ring of country.rings) {
        ring.forEach(([x, y], j) => j === 0 ? path.moveTo(x, y) : path.lineTo(x, y));
        path.closePath();
      }
      c.fillStyle = '#263f3d'; c.fill(path);
      // Coast shadow then fine parchment-edge highlight: static geometry,
      // independent of country ownership and combat.
      c.strokeStyle='rgba(3,14,23,.54)';c.lineWidth=4.2;c.stroke(path);
      c.strokeStyle='rgba(181,218,198,.38)';c.lineWidth=1.15;c.stroke(path);
    }
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
      // Guaranteed coverage for every owned sector. Contour paths below are
      // decorative and must never determine whether land is visible.
      const col=i%MAP_WIDTH,row=Math.floor(i/MAP_WIDTH);
      const left=X_EDGES[col],top=Y_EDGES[row];
      c.fillStyle=this.game.factions[id].color+'9a';
      c.fillRect(left,top,X_EDGES[col+1]-left,Y_EDGES[row+1]-top);
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
    // Never refill from possibly incomplete contour rings: they only draw
    // outlines. Cell ownership is authoritative for map coverage.
    for(const faction of this.game.factions){
      const path=paths.get(faction.id);
      if(!path)continue;
      c.strokeStyle='rgba(6,19,27,.52)';c.lineWidth=2.2;c.stroke(path);
      c.strokeStyle=faction.color+'a0';c.lineWidth=1.15;c.stroke(path);
      c.strokeStyle='rgba(236,246,224,.24)';c.lineWidth=.55;c.stroke(path);
    }
    c.restore();
    // Show the player's structures first; at mid zoom keep only spatially
    // separated markers so neighboring settlements cannot form giant blobs.
    this.buildingMarkers.sort((a,b)=>Number(b.owner===0)-Number(a.owner===0)
      || a.index-b.index);
    this.military=militarySummaries(this.game,stationed,this.buildingMarkers);
    this.strengthLabels=this.military.map(s=>strengthLabel(s.total));
    this.mobileLabels=this.military.map(s=>mobileStrengthLabel(s.mobile));
    this.strengthRelations=this.military.map(s=>relativeStrength(s.total,this.military[0].total));
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

    this.labels.sort((a,b)=>Number(b.id===0)-Number(a.id===0)
      ||this.game.factions[b.id].territory-this.game.factions[a.id].territory);
    this.refreshHoverPreview(this.hover, true);
    if(this.hoverPointer)this.onHover(this.hover,this.hoverPointer.x,this.hoverPointer.y,this.hoverPointer.landing);
    this.combatEdges = [];
    this.combatLabels = [];
    for (const order of this.game.attackOrders) {
      if(order.returning||order.landing&&this.game.tick<(order.arrivalTick??Infinity))continue;
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
      ? null // Friendly left-clicks are informational, never offensive.
      : (this.game.findAttackFront(0,point)??this.game.landingTarget(0,point));
  }

  /** Rebuild only when the owner changes or the simulation claims new land.
   * Full-faction highlight is pre-rendered rather than redrawn every frame.
   */
  private refreshHoverPreview(point:Point|null,force=false):void {
    const index=point?point.y*MAP_WIDTH+point.x:-1;
    if(!force && index===this.hoverIndex)return;
    this.hoverIndex=index;
    const owner=index>=0?this.game.owner[index]:WATER;
    const front=point && owner!==WATER && owner!==0
      ? (this.game.findAttackFront(0,point)??this.game.landingTarget(0,point))
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
    return owner!==WATER && owner!==0 && this.previewFront(point)!==null;
  }
  canLand(point: Point): boolean {
    const i=point.y*MAP_WIDTH+point.x;
    return this.game.owner[i]!==0 && this.game.landingTarget(0,point)!==null;
  }
  /** Screen-space rendering and hit testing share the same visible bounds.
   * Labels and actual combat counters have priority. Crowded cities reappear
   * when zooming in; their world positions and ownership never change.
   */
  /** Canvas-only industry links: inexpensive to draw and no simulation side effects. */
  private drawFactoryLinks(c:CanvasRenderingContext2D,time=0):void {
    c.save();c.lineWidth=1.6;c.setLineDash([4,4]);
    for(const [factory,city] of this.game.factoryLinks){
      if(this.game.buildings[factory]!==3||this.game.owner[factory]<0||
        this.game.owner[factory]!==this.game.owner[city])continue;
      const fx=this.ox+(factory%MAP_WIDTH+.5)*CW*this.scale;
      const fy=this.oy+(Math.floor(factory/MAP_WIDTH)+.5)*CH*this.scale;
      const cx=this.ox+(city%MAP_WIDTH+.5)*CW*this.scale;
      const cy=this.oy+(Math.floor(city/MAP_WIDTH)+.5)*CH*this.scale;
      c.strokeStyle=this.game.owner[factory]===0?'rgba(244,197,111,.8)':'rgba(173,194,204,.45)';
      c.beginPath();c.moveTo(fx,fy);c.lineTo(cx,cy);c.stroke();
      // Animated transport along a factory route (visual only).
      const distance=Math.hypot(cx-fx,cy-fy);
      if(distance>5){
        const phase=(time*.00011+(factory%43)/43)%1;
        const tx=fx+(cx-fx)*phase,ty=fy+(cy-fy)*phase;
        c.setLineDash([]);c.fillStyle=this.game.owner[factory]===0?'#ffe5a3':'#e3edef';
        c.strokeStyle='#162d35';c.lineWidth=1;
        c.beginPath();c.arc(tx,ty,3.3,0,Math.PI*2);c.fill();c.stroke();
        c.setLineDash([4,4]);c.lineWidth=1.6;
      }
    }
    c.restore();
  }

  private drawBuildings(c:CanvasRenderingContext2D):void {
    this.visibleCityMarkers=[];
    const width=this.canvas.clientWidth,height=this.canvas.clientHeight;
    const hovered=this.hover?pointToIndex(this.hover):-1;
    // Cities win the visual priority; factories and towers are smaller markers.
    // No building may hide a nearby city, and every drawn marker is clickable.
    const markers=this.buildingMarkers.slice().sort((a,b)=>
      Number(b.code===1)-Number(a.code===1)||
      Number(b.owner===0)-Number(a.owner===0)||
      this.game.cityUpgrades[b.index]-this.game.cityUpgrades[a.index]||a.index-b.index);
    const draw=(marker:typeof markers[number])=>{
      const city=marker.code===1;
      if(!buildingMarkerFor(marker.code)||!showBuildingMarker(marker.owner,this.zoom))return;
      if(city&&!cityVisibleAtZoom(marker.owner,this.game.cityUpgrades[marker.index],this.zoom,marker.index===hovered))return;
      const x=this.ox+(marker.index%MAP_WIDTH+.5)*CW*this.scale;
      const y=this.oy+(Math.floor(marker.index/MAP_WIDTH)+.5)*CH*this.scale;
      const size=city?30:18;
      // Dense towns need an offset industrial badge instead of suppressing
      // the neighboring factory completely. The click box follows the badge.
      const offsets=city?[[0,0]]:[[0,0],[22,-12],[-22,-12],[22,12],[-22,12],[0,-25],[0,25]];
      let bounds:ScreenRect|null=null;
      for(const [dx,dy] of offsets){
        const candidate={x:x+dx-size/2,y:y+dy-size/2,width:size,height:size};
        if(candidate.x<0||candidate.y<0||candidate.x+size>width||candidate.y+size>height)continue;
        if(this.occupancy.intersects(candidate,city?3:0))continue;
        bounds=candidate;break;
      }
      if(!bounds)return;
      const level=this.game.cityUpgrades[marker.index];
      this.occupancy.reserve(bounds);
      this.visibleCityMarkers.push({index:marker.index,x,y,level,bounds});
      if(city)drawCityMarker(c,x,y,level,marker.owner);
      else {
        c.save();c.translate(bounds.x+size/2,bounds.y+size/2);
        c.lineJoin='round';c.lineCap='round';c.lineWidth=1.2;
        c.strokeStyle='#142a31';c.fillStyle=marker.owner===0?'#d7ab70':'#b6c4c9';
        if(marker.code===3){
          // Industrial silhouette: roof, sawtooth skylights and chimney.
          c.beginPath();c.rect(-8,-1,16,10);c.fill();c.stroke();
          c.beginPath();c.moveTo(-8,-1);c.lineTo(-3,-5);c.lineTo(1,-1);
          c.lineTo(5,-5);c.lineTo(8,-1);c.closePath();c.fill();c.stroke();
          c.fillRect(-6,-11,3,8);c.strokeRect(-6,-11,3,8);
          c.fillStyle='#243943';for(let i=0;i<3;i++)c.fillRect(-5+i*5,2,2,3);
        }else if(marker.code===4){
          c.fillRect(-8,-3,16,12);c.strokeRect(-8,-3,16,12);
          c.fillStyle='#263b43';c.fillRect(-2,1,4,8);
          c.beginPath();c.moveTo(-8,-3);c.lineTo(0,-10);c.lineTo(8,-3);c.closePath();c.fillStyle='#d7ab70';c.fill();c.stroke();
        }else{
          // Fortified watchtower with visible crenellations.
          c.fillRect(-6,-6,12,15);c.strokeRect(-6,-6,12,15);
          for(const bx of [-7,-2,3]){c.fillRect(bx,-10,4,5);c.strokeRect(bx,-10,4,5);}
          c.fillStyle='#263b43';c.fillRect(-1,0,2,6);
        }
        c.restore();
      }
    };
    // Never reorder drawing based on hover: the old selected-first code moved
    // the badge underneath the cursor, breaking right-click hit testing.
    for(const marker of markers)draw(marker);
  }

  /** Lightweight animated infantry, using canvas shapes rather than heavy assets.
   * Positions and motion are deterministic visual-only effects.
   */
  /** Resolve the current faction order without requiring save migration. */
  private squadFlag(owner:number):string {
    const faction=this.game.factions[owner];
    const code=COUNTRY_STARTS.find(c=>c.name===faction?.name)?.code;
    if(!code||!/^[A-Z]{2}$/.test(code))return '🏳';
    return String.fromCodePoint(...[...code].map(ch=>0x1f1e6+ch.charCodeAt(0)-65));
  }

  private squadRelationColor(owner:number):string {
    if(owner===0)return '#68caff';
    if(this.game.isAllied(0,owner))return '#65d68a';
    const hostile=this.game.attackOrders.some(order=>
      (order.factionId===0&&order.targetOwner===owner)||
      (order.factionId===owner&&order.targetOwner===0))||
      this.game.squads.some(s=>s.owner===owner&&s.attackTarget!=null&&
        this.game.owner[s.attackTarget]===0)||
      this.game.squads.some(s=>s.owner===0&&s.attackTarget!=null&&
        this.game.owner[s.attackTarget]===owner);
    return hostile?'#ff6a70':'#bfc7d0';
  }

  private drawSquads(c:CanvasRenderingContext2D,time=0):void {
    c.save();c.textAlign='center';c.textBaseline='middle';
    const liveIds=new Set(this.game.squads.map(unit=>unit.id));
    for(const id of this.squadVisuals.keys())if(!liveIds.has(id))this.squadVisuals.delete(id);
    const stackPositions=new Map<string,number>();
    const squadByTile=new Map<number,typeof this.game.squads>();
    for(const unit of this.game.squads){
      const units=squadByTile.get(unit.index)??[];
      units.push(unit);squadByTile.set(unit.index,units);
    }
    for(const squad of this.game.squads){
      const stackKey=`${squad.owner}:${squad.index}`;
      const stackNumber=stackPositions.get(stackKey)??0;
      stackPositions.set(stackKey,stackNumber+1);
      let visual=this.squadVisuals.get(squad.id);
      if(!visual){
        visual={index:squad.index,from:squad.index,changedAt:time-170};
        this.squadVisuals.set(squad.id,visual);
      }else if(visual.index!==squad.index){
        const previous=visual.index;
        visual.from=Math.abs(previous%MAP_WIDTH-squad.index%MAP_WIDTH)+
          Math.abs(Math.floor(previous/MAP_WIDTH)-Math.floor(squad.index/MAP_WIDTH))===1?
          previous:squad.index;
        visual.index=squad.index;visual.changedAt=time;
      }
      const progress=Math.max(0,Math.min(1,(time-visual.changedAt)/170));
      const easing=progress*progress*(3-2*progress);
      const vx=(visual.from%MAP_WIDTH)*(1-easing)+(squad.index%MAP_WIDTH)*easing;
      const vy=Math.floor(visual.from/MAP_WIDTH)*(1-easing)+
        Math.floor(squad.index/MAP_WIDTH)*easing;
      const offsetX=stackNumber===0?0:Math.cos(stackNumber*2.39996)*Math.min(27,12+stackNumber*4);
      const offsetY=stackNumber===0?0:Math.sin(stackNumber*2.39996)*Math.min(20,8+stackNumber*3);
      const x=this.ox+(vx+.5)*CW*this.scale+offsetX;
      const y=this.oy+(vy+.5)*CH*this.scale+offsetY;
      if(x< -40||y< -40||x>this.canvas.clientWidth+40||y>this.canvas.clientHeight+40)continue;
      const selected=this.selectedSquadIds.includes(squad.id);
      const relation=this.squadRelationColor(squad.owner);
      const flag=this.squadFlag(squad.owner);
      const far=this.zoom<2;
      const neighbors=[squad.index-1,squad.index+1,squad.index-MAP_WIDTH,squad.index+MAP_WIDTH]
        .filter(index=>index>=0&&index<MAP_WIDTH*MAP_HEIGHT&&
          Math.abs(index%MAP_WIDTH-squad.index%MAP_WIDTH)+
          Math.abs(Math.floor(index/MAP_WIDTH)-Math.floor(squad.index/MAP_WIDTH))===1);
      const opponent=neighbors.flatMap(index=>squadByTile.get(index)??[])
        .find(unit=>unit.owner!==squad.owner&&!this.game.isAllied(unit.owner,squad.owner));
      const hit=this.game.battleEvents.some(event=>event.tick===this.game.tick&&
        (event.attackerId===squad.owner||event.defenderId===squad.owner)&&
        Math.abs(event.index%MAP_WIDTH-squad.index%MAP_WIDTH)+
        Math.abs(Math.floor(event.index/MAP_WIDTH)-Math.floor(squad.index/MAP_WIDTH))<=1);
      const clash=!!opponent&&hit;
      const pulse=Math.max(0,Math.sin(time*.014+squad.id*.43));
      const lungeX=opponent?(opponent.index%MAP_WIDTH-squad.index%MAP_WIDTH)*4*pulse:0;
      const lungeY=opponent?(Math.floor(opponent.index/MAP_WIDTH)-Math.floor(squad.index/MAP_WIDTH))*4*pulse:0;
      const count=Math.min(8,Math.max(3,Math.ceil(squad.troops/65)));
      c.strokeStyle=relation;c.lineWidth=selected?2.8:1.5;
      c.beginPath();c.ellipse(x,y,far?12:23,far?11:16,0,0,Math.PI*2);c.stroke();
      if(far){
        if(clash){c.fillStyle='rgba(255,178,75,.8)';c.beginPath();c.arc(x+lungeX,y+lungeY,4+pulse*3,0,Math.PI*2);c.fill();}
        c.fillStyle='#112d3b';c.beginPath();c.arc(x,y,10,0,Math.PI*2);c.fill();
        c.font='13px sans-serif';c.fillStyle='#fff';c.fillText(flag,x,y);
        c.font='bold 9px sans-serif';c.strokeStyle='#102534';c.lineWidth=3;
        c.strokeText(String(Math.round(squad.troops)),x,y-16);
        c.fillText(String(Math.round(squad.troops)),x,y-16);
        continue;
      }
      const marching=squad.destination!==null||squad.campaignTarget!=null;
      const goal=squad.destination??squad.attackTarget??squad.campaignTarget;
      if(goal!=null&&goal!==squad.index){
        const tx=this.ox+(goal%MAP_WIDTH+.5)*CW*this.scale;
        const ty=this.oy+(Math.floor(goal/MAP_WIDTH)+.5)*CH*this.scale;
        const direction=Math.atan2(ty-y,tx-x);
        // Short chevron points along the actual ordered march direction.
        c.save();c.translate(x,y);c.rotate(direction);
        c.fillStyle=relation;c.globalAlpha=.9;
        c.beginPath();c.moveTo(31,0);c.lineTo(21,-5);c.lineTo(21,5);c.closePath();c.fill();
        c.restore();
      }
      const combat=clash||(squad.attackTarget!==null&&squad.attackTarget!==undefined&&squad.destination===null)||
        this.game.battleEvents.some(e=>e.tick===this.game.tick&&
          (e.attackerId===squad.owner||e.defenderId===squad.owner)&&
          Math.abs(e.index%MAP_WIDTH-squad.index%MAP_WIDTH)+
          Math.abs(Math.floor(e.index/MAP_WIDTH)-Math.floor(squad.index/MAP_WIDTH))<=1);
      const tint=squad.owner===0?'#79d3fa':this.game.factions[squad.owner]?.color??'#d98c8c';
      const phase=time*.009+squad.id*1.37;
      if(selected){
        c.strokeStyle='#ffe58b';c.lineWidth=2;c.setLineDash([3,3]);
        c.beginPath();c.ellipse(x,y,23,16,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
      }
      for(let n=0;n<count;n++){
        const col=n%4,row=Math.floor(n/4);
        const sway=marching?Math.sin(phase+n*.8)*2:Math.sin(phase*.22+n)*.35;
        const px=x+(col-1.5)*8+(row%2)*3+(clash?lungeX:0);
        const py=y+(row-.35)*11+sway+(clash?lungeY:0);
        c.fillStyle='rgba(0,0,0,.30)';c.beginPath();c.ellipse(px,py+5,3.4,1.7,0,0,Math.PI*2);c.fill();
        c.strokeStyle='#233845';c.lineWidth=1.5;
        c.beginPath();c.moveTo(px-1,py+2);c.lineTo(px-2+(marching?sway*.4:0),py+6);
        c.moveTo(px+1,py+2);c.lineTo(px+2-(marching?sway*.4:0),py+6);c.stroke();
        c.fillStyle=tint;c.fillRect(px-2.8,py-3,5.6,6);
        c.fillStyle='#eed8b6';c.beginPath();c.arc(px,py-5,2.3,0,Math.PI*2);c.fill();
        c.fillStyle=squad.owner===0?'#306c91':'#54464c';
        c.fillRect(px-2.7,py-7.6,5.4,2.4);
        c.strokeStyle='#d7d9db';c.lineWidth=1;
        c.beginPath();c.moveTo(px+3,py-2);c.lineTo(px+7,py-(combat?7:4));c.stroke();
      }
      if(combat){
        const flash=(Math.sin(phase*1.7)+1)/2;
        c.fillStyle='rgba(255,193,76,'+(.25+flash*.7)+')';
        c.beginPath();c.arc(x+24,y-6,2.5+flash*2,0,Math.PI*2);c.fill();
        // Visible hit sparks and fallen silhouette communicate actual
        // casualties from this tick; never modify simulation values.
        const recent=this.game.battleEvents.filter(e=>e.tick===this.game.tick&&
          (e.attackerId===squad.owner||e.defenderId===squad.owner)&&
          Math.abs(e.index%MAP_WIDTH-squad.index%MAP_WIDTH)+
          Math.abs(Math.floor(e.index/MAP_WIDTH)-Math.floor(squad.index/MAP_WIDTH))<=1);
        const casualties=recent.reduce((sum,e)=>sum+
          (e.attackerId===squad.owner?e.attackerLost:0)+
          (e.defenderId===squad.owner?e.defenderLost:0),0);
        if(casualties>0){
          c.fillStyle='rgba(250,107,91,'+(.3+flash*.6)+')';
          for(let n=0;n<Math.min(4,Math.ceil(casualties/2));n++){
            const px=x-13+n*9,py=y+8+(n%2)*2;
            c.beginPath();c.arc(px,py,1.7+flash,0,Math.PI*2);c.fill();
          }
          c.strokeStyle='#b9a7a0';c.lineWidth=2;
          c.beginPath();c.moveTo(x-8,y+13);c.lineTo(x-1,y+15);c.stroke();
        }
      }
      c.fillStyle='rgba(12,31,43,.94)';
      c.beginPath();c.roundRect(x-13,y-37,26,17,5);c.fill();
      c.strokeStyle=relation;c.lineWidth=1;c.stroke();
      c.font='13px sans-serif';c.fillStyle='#fff';c.fillText(flag,x,y-28);
      c.font='bold 10px sans-serif';
      const label=Math.round(squad.troops).toString();
      c.lineWidth=3;c.strokeStyle='#102534';c.strokeText(label,x,y-19);
      c.fillStyle='#ffffff';c.fillText(label,x,y-19);
    }
    c.restore();
  }

  private drawCapitalNames(c:CanvasRenderingContext2D):void {
    if(this.zoom<3)return;
    c.save();c.textAlign='center';c.font='600 10px system-ui';c.fillStyle='rgba(233,239,236,.8)';
    for(const city of this.game.cities){
      const pos=pointToWorld(city),name=city.name.toUpperCase();
      const x=this.ox+pos.x*this.scale,y=this.oy+pos.y*this.scale-12;
      const width=Math.min(120,c.measureText(name).width);
      const bounds={x:x-width/2-2,y:y-10,width:width+4,height:14};
      if(bounds.x<0||bounds.y<0||bounds.x+bounds.width>this.canvas.clientWidth||bounds.y+14>this.canvas.clientHeight||this.occupancy.intersects(bounds))continue;
      this.occupancy.reserve(bounds);c.fillText(name,x,y,120);
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
  /** Screen-space boats represent committed living armies during a sea voyage. */
  private drawSeaVoyages(c:CanvasRenderingContext2D):void {
    c.save();c.lineJoin='round';c.lineCap='round';
    const occupied:Point[]=[];
    for(const order of this.game.attackOrders){
      if(!order.landing||!order.seaRoute||order.conquered>0||(!order.returning&&this.game.tick>=(order.arrivalTick??0)))continue;
      let cached=this.voyageCache.get(order.seaRoute);
      if(!cached){
        const geometry=voyageGeometry(order.seaRoute),path=new Path2D();
        geometry.points.forEach((p,i)=>i===0?path.moveTo(p.x,p.y):path.lineTo(p.x,p.y));
        cached={geometry,path};this.voyageCache.set(order.seaRoute,cached);
      }
      const pos=voyagePosition(order,this.game.tick,cached.geometry);
      let x=this.ox+pos.x*this.scale,y=this.oy+pos.y*this.scale;
      // Small screen-space separation keeps simultaneous fleets readable.
      const nearby=occupied.filter(p=>Math.hypot(p.x-x,p.y-y)<14).length;
      if(nearby){x+=Math.min(3,nearby)*4;y-=Math.min(3,nearby)*3;}occupied.push({x,y});
      const faction=this.game.factions[order.factionId];
      c.save();c.translate(this.ox,this.oy);c.scale(this.scale,this.scale);
      c.globalAlpha=.30;c.strokeStyle=faction.color;c.lineWidth=1/this.scale;
      c.setLineDash([3/this.scale,7/this.scale]);c.stroke(cached.path);c.restore();
      c.globalAlpha=.96;c.fillStyle='#112531';c.strokeStyle=faction.color;c.lineWidth=1.25;
      c.beginPath();c.moveTo(x-6,y-1);c.lineTo(x+6,y-1);c.lineTo(x+3,y+3);c.lineTo(x-3,y+3);c.closePath();c.fill();c.stroke();
      c.beginPath();c.moveTo(x,y-8);c.lineTo(x,y-1);c.stroke();
      c.fillStyle=faction.color;c.beginPath();c.moveTo(x+1,y-8);c.lineTo(x+5,y-4);c.lineTo(x+1,y-4);c.closePath();c.fill();
    }
    c.restore();
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
  /** Small opposing squads move along real player/enemy contact edges.
   * These are visual particles only. Never manufacture fighting units.
   */
  private drawBorderSkirmishes(c:CanvasRenderingContext2D,timestamp:number):void {
    if(this.game.status!=='playing'||!this.combatEdges.length||this.reducedMotion)return;
    c.save();c.lineCap='round';
    // Limit work per frame even during large-scale wars.
    const step=Math.max(1,Math.ceil(this.combatEdges.length/140));
    for(let edgeIndex=0;edgeIndex<this.combatEdges.length;edgeIndex+=step){
      const edge=this.combatEdges[edgeIndex];
      const dx=edge.bx-edge.ax,dy=edge.by-edge.ay;
      const length=Math.hypot(dx,dy);
      if(length<.01)continue;
      const tx=dx/length,ty=dy/length,nx=-ty,ny=tx;
      for(let unit=0;unit<3;unit++){
        const seed=edgeIndex*17+unit*37;
        const phase=(timestamp*.0012+visualNoise(seed,3))%1;
        const progress=(unit+phase)/3;
        const px=edge.ax+dx*progress,py=edge.ay+dy*progress;
        const swing=1.2+Math.sin(timestamp*.012+seed)*.7;
        for(let side=0;side<2;side++){
          const sign=side?1:-1;
          c.globalAlpha=.56+.28*Math.sin(Math.PI*phase);
          c.fillStyle=side?'#ff777a':'#5acbff';
          c.beginPath();c.arc(px+nx*sign*swing,py+ny*sign*swing,1.05,0,Math.PI*2);c.fill();
        }
        if(unit===1 && Math.sin(timestamp*.018+seed)>0.82){
          c.globalAlpha=.72;c.fillStyle='#fff1bc';
          c.fillRect(px-.85,py-.85,1.7,1.7);
        }
      }
    }
    c.restore();
  }

  /** Lightweight advance shimmer on the CURRENT physical battle boundary.
   * No full-screen radial glow and no effect on neutral expansion.
   */
  private drawFrontCapture(c:CanvasRenderingContext2D,timestamp:number):void {
    if(this.game.status!=='playing'||!this.combatEdges.length)return;
    c.save();c.lineCap='round';c.lineJoin='round';
    c.beginPath();
    for(const edge of this.combatEdges){c.moveTo(edge.ax,edge.ay);c.lineTo(edge.bx,edge.by);}
    const pulse=this.reducedMotion?.55:.42+.13*Math.sin(timestamp*.008);
    // Dark cut-line and a warm moving highlight separate armies from the map
    // at every scale without covering city icons.
    c.globalAlpha=.56;c.strokeStyle='#0a1a21';c.lineWidth=3.4;c.stroke();
    c.globalAlpha=pulse;c.strokeStyle='#ffd69b';c.lineWidth=1.4;c.stroke();
    c.restore();
  }

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
      this.occupancy.reserve({x:x-24,y:y-24,width:48,height:48});
      const dx=group.dx,dy=group.dy,nx=-dy,ny=dx;
      const isPlayer=group.playerBattle;
      const side1=isPlayer?'#54c5ff':'#b8d8bc';
      const side2=isPlayer?'#ff7275':'#f3aa75';
      const pressure=battleMomentum(group.attacker,group.defender);
      const contactX=x+dx*pressure*2.8,contactY=y+dy*pressure*2.8;
      // A real contact point glows in two colors, like two armies colliding.
      // The tiny silhouettes are bounded visual symbols, not generated units.
      c.globalAlpha=fade*.30;
      c.strokeStyle=side1;c.lineWidth=2.4;c.beginPath();
      c.moveTo(contactX+nx*12-dx*1.5,contactY+ny*12-dy*1.5);
      c.lineTo(contactX-nx*12-dx*1.5,contactY-ny*12-dy*1.5);c.stroke();
      c.strokeStyle=side2;c.beginPath();
      c.moveTo(contactX+nx*12+dx*1.5,contactY+ny*12+dy*1.5);
      c.lineTo(contactX-nx*12+dx*1.5,contactY-ny*12+dy*1.5);c.stroke();
      if(!this.reducedMotion || this.zoom>=1.25){
        for(let side=0;side<2;side++){
          const strength=side===0?(isPlayer?group.blue:group.attacker)
            :(isPlayer?group.red:group.defender);
          const number=combatVisualDensity(strength,this.zoom);
          if(!number)continue;
          const tint=side===0?side1:side2;
          const sideSign=side===0?-1:1;
          c.fillStyle=tint;c.strokeStyle=tint;
          for(let i=0;i<number;i++){
            const seed=group.seed+side*10007+i*43;
            const phase=this.reducedMotion?.50:(timestamp*(.00072+visualNoise(seed,0)*.00048)
              +visualNoise(seed,1))%1;
            const lane=(visualNoise(seed,2)-.5)*Math.min(37,17+group.strikes*2.5);
            // Troops flow from their OWN side toward the true contact normal.
            const travel=sideSign*(4.7+13.4*(1-phase));
            const px=contactX+dx*travel+nx*lane,py=contactY+dy*travel+ny*lane;
            const foot=1+visualNoise(seed,4)*.5;
            c.globalAlpha=fade*(.36+phase*.55);
            c.beginPath();c.arc(px,py,1.2+this.zoom*.1,0,Math.PI*2);c.fill();
            if(this.zoom>=1.25){
              // Directional tail/boots distinguish marching squads from confetti.
              c.lineWidth=1.1;
              c.beginPath();c.moveTo(px+dx*sideSign*foot,py+dy*sideSign*foot);
              c.lineTo(px+dx*sideSign*(foot+2.7),py+dy*sideSign*(foot+2.7));
              c.stroke();
            }
          }
        }
      }
      // Conquest shockwave is emitted ONLY for real captured sectors.
      if(group.captures>0&&!this.reducedMotion){
        const phase=Math.min(1,since/460);
        c.globalAlpha=fade*(1-phase)*.52;
        c.strokeStyle='#ffe6ac';c.lineWidth=1.5;
        c.beginPath();c.arc(contactX,contactY,5+phase*22,0,Math.PI*2);c.stroke();
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
      const bw=90,bh=18;
      this.occupancy.reserve({x:labelX-bw/2,y:labelY-bh/2,width:bw,height:bh});
      c.globalAlpha=fade*.96;
      c.fillStyle='rgba(5,20,28,.93)';
      c.strokeStyle='rgba(175,194,203,.40)';
      c.lineWidth=.8;
      c.beginPath();c.roundRect(labelX-bw/2,labelY-bh/2,bw,bh,4);c.fill();c.stroke();
      // Two status strips make the real opposing army counts readable.
      c.fillStyle=side1;c.fillRect(labelX-bw/2+3,labelY-bh/2+2,40,2);
      c.fillStyle=side2;c.fillRect(labelX+2,labelY-bh/2+2,40,2);
      c.textAlign='center';c.font='750 9px system-ui';
      c.fillStyle=side1;c.fillText('●',labelX-38,labelY+1);
      c.fillStyle='#d7f4ff';c.fillText(formatCompact(group.blue),labelX-17,labelY+1,30);
      c.fillStyle=side2;c.fillText('●',labelX+7,labelY+1);
      c.fillStyle='#ffddd9';c.fillText(formatCompact(group.red),labelX+27,labelY+1,28);
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
      if(order.returning||order.landing&&this.game.tick<(order.arrivalTick??Infinity))continue;
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
      this.occupancy.reserve({x:x-38,y:y-8,width:76,height:16});
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
    let shown=0;
    this.visibleCountryLabels=[];
    // Hovered small countries receive first choice of the available space.
    const hoveredId=this.hoverIndex>=0?this.game.owner[this.hoverIndex]:WATER;
    const labels=this.labels.slice().sort((a,b)=>Number(b.id===hoveredId)-Number(a.id===hoveredId));
    for(const label of labels){
      const faction=this.game.factions[label.id];
      if(!faction?.alive)continue;
      if(label.id!==0 && label.id!==hoveredId && shown>=16 && this.zoom<2.6)continue;
      const x=this.ox+label.pos.x*this.scale;
      let y=this.oy+label.pos.y*this.scale+17;
      if(x<60||x>width-60||y<35||y>height-72)continue;
      const flag=FLAGS.get(faction.name)??'';
      const name=(this.game.isAllied(0,label.id)?'🤝 ':'')+(flag?flag+' ':'')+faction.name;
      c.font=label.id===0?'750 15px system-ui':'700 13px system-ui';
      const nameWidth=Math.min(160,c.measureText(name).width);
      const count=this.strengthLabels[label.id];
      const mobile=this.mobileLabels[label.id];
      c.font='800 14px system-ui';
      const totalWidth=c.measureText(count).width;
      c.font='700 12px system-ui';
      const labelWidth=Math.max(nameWidth,totalWidth,c.measureText(mobile).width)+14;
      const preferredY=y;
      let fallback:number|undefined;
      let clear:number|undefined;
      // Three distinct lines: name, all living soldiers, then FREE mobile
      // reserves. A taller collision box protects neighboring labels and cities.
      const badgeHeight=58;
      for(const offset of [0,58,-58,116,-116]){
        const candidate={x:x-labelWidth/2,y:preferredY+offset-17,width:labelWidth,height:badgeHeight};
        if(candidate.y<30||candidate.y+badgeHeight>height-88||this.occupancy.intersects(candidate))continue;
        fallback??=preferredY+offset;
        if(this.cityAnchors.intersects(candidate))continue;
        clear=preferredY+offset;break;
      }
      // At readable zoom, never sacrifice a city badge merely to force a
      // country label into an occupied slot. This also keeps city tiers
      // directly clickable after enlargement of the military-strength labels.
      if(clear===undefined&&(fallback===undefined||this.zoom>=1.8))continue;
      y=clear??fallback!;
      shown++;
      const bounds={x:x-labelWidth/2,y:y-17,width:labelWidth,height:badgeHeight};
      this.occupancy.reserve(bounds);
      this.visibleCountryLabels.push({id:label.id,name,strength:count,mobile,fontSize:14,bounds});
      c.globalAlpha=1;
      c.fillStyle='rgba(5,17,25,.78)';
      c.fillRect(bounds.x,bounds.y,bounds.width,bounds.height);
      c.shadowColor='#000';c.shadowBlur=4;c.shadowOffsetY=1;
      c.textAlign='center';c.lineJoin='round';
      c.strokeStyle='rgba(5,17,25,.85)';
      c.fillStyle=label.id===0?'#fff4cf':'#e1eae6';
      c.lineWidth=2.6;
      c.font=label.id===0?'750 15px system-ui':'700 13px system-ui';
      c.strokeText(name,x,y,160);c.fillText(name,x,y,160);
      c.font='800 14px system-ui';
      c.fillStyle=this.strengthRelations[label.id].color;
      c.lineWidth=3.5;c.strokeText(count,x,y+18);c.fillText(count,x,y+18);
      // Cyan indicates available reserves, NOT military superiority.
      c.font='700 12px system-ui';
      c.fillStyle='#9cdeed';
      c.lineWidth=2.8;
      c.strokeText(mobile,x,y+34);c.fillText(mobile,x,y+34);
    }
    c.globalAlpha=1;

    c.restore();
  }
  /** Only when holding SHIFT, show reachable maritime landings as an icon.
   * No permanent round port stamps or pulsing rings on the map.
   */
  private drawLandingPorts(c:CanvasRenderingContext2D, _timestamp:number):void {
    if(!this.hover)return;
    const point=this.game.landingTarget(0,this.hover);if(!point)return;
    const pos=pointToWorld(point);
    c.save();c.fillStyle='rgba(255,227,161,.7)';c.font='12px system-ui';c.fillText('⚓',pos.x,pos.y);c.restore();
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
  /** Only real hostile orders and explicit player deployment priorities.
   * Lightweight enough for every animation frame, at most 512 user pins.
   */
  private drawStrategicOrders(c:CanvasRenderingContext2D,time:number):void {
    if(this.game.status!=='playing')return;
    c.save();
    const pulse=.65+.25*Math.sin(time*.006);
    if(this.zoom>=1.1){
      for(const [index,mode] of this.game.borderOrders){
        if(this.game.owner[index]!==0)continue;
        const x=this.ox+(index%MAP_WIDTH+.5)*CW*this.scale;
        const y=this.oy+(Math.floor(index/MAP_WIDTH)+.5)*CH*this.scale;
        if(x<0||x>this.canvas.clientWidth||y<0||y>this.canvas.clientHeight)continue;
        c.strokeStyle=mode==='defend'?'#65d4b2':'#e5bb7b';c.lineWidth=1.6;
        c.globalAlpha=pulse;
        c.beginPath();c.arc(x,y,5.5+this.zoom*.8,0,Math.PI*2);c.stroke();
        c.fillStyle=c.strokeStyle;c.globalAlpha=.82;
        c.beginPath();c.arc(x,y,1.7,0,Math.PI*2);c.fill();
      }
    }
    for(const order of this.game.attackOrders){
      if(order.factionId===0||order.targetOwner!==0||order.returning)continue;
      const index=order.contested??order.lastCaptured??pointToIndex(order.anchor);
      if(index<0||index>=this.game.owner.length)continue;
      const x=this.ox+(index%MAP_WIDTH+.5)*CW*this.scale;
      const y=this.oy+(Math.floor(index/MAP_WIDTH)+.5)*CH*this.scale;
      if(x<0||x>this.canvas.clientWidth||y<0||y>this.canvas.clientHeight)continue;
      c.strokeStyle='#fb7477';c.lineWidth=2;c.globalAlpha=pulse;
      c.beginPath();c.arc(x,y,6+this.zoom*1.3,0,Math.PI*2);c.stroke();
    }
    c.restore();
  }

  private frame(timestamp: number) {
    // Smooth keyboard camera controls, independent of simulation tick rate.
    const elapsed=this.previousPanFrame?Math.min(50,timestamp-this.previousPanFrame):0;
    this.previousPanFrame=timestamp;
    if(elapsed&&this.panKeys.size){
      const dx=Number(this.panKeys.has('d')||this.panKeys.has('arrowright'))-
        Number(this.panKeys.has('a')||this.panKeys.has('arrowleft'));
      const dy=Number(this.panKeys.has('s')||this.panKeys.has('arrowdown'))-
        Number(this.panKeys.has('w')||this.panKeys.has('arrowup'));
      if(dx||dy){
        const distance=elapsed*.58/(Math.hypot(dx,dy)||1);
        this.ox-=dx*distance;this.oy-=dy*distance;
      }
    }
    if(this.dpr!==Math.max(1,devicePixelRatio||1))this.resize();
    this.occupancy.clear();
    this.cityAnchors.clear();
    for(const marker of this.buildingMarkers){
      const x=this.ox+(marker.index%MAP_WIDTH+.5)*CW*this.scale;
      const y=this.oy+(Math.floor(marker.index/MAP_WIDTH)+.5)*CH*this.scale;
      if(x>=0&&y>=0&&x<=this.canvas.clientWidth&&y<=this.canvas.clientHeight &&
        cityVisibleAtZoom(marker.owner,this.game.cityUpgrades[marker.index],this.zoom,
          marker.index===(this.hover?pointToIndex(this.hover):-1)))
        this.cityAnchors.reserve(cityMarkerBounds(x,y));
    }
    for(const bounds of this.overlayBounds)this.occupancy.reserve(bounds);
    const c = this.ctx;
    const dpr = this.canvas.width / Math.max(1,this.canvas.clientWidth);
    c.setTransform(dpr,0,0,dpr,0,0);
    c.fillStyle='#07141e'; c.fillRect(0,0,this.canvas.clientWidth,this.canvas.clientHeight);
    c.save(); c.translate(this.ox,this.oy); c.scale(this.scale,this.scale);
    c.imageSmoothingEnabled=true; // Keep the geographical backdrop smooth.
    c.drawImage(this.base,0,0);
    c.imageSmoothingEnabled=true; // Antialias territory resampling while preserving exact sector ownership.
    c.drawImage(this.overlay,0,0);
    if(this.showTopography)c.drawImage(this.topography,0,0,WORLD_WIDTH,WORLD_HEIGHT);
    c.imageSmoothingEnabled=true;
    c.drawImage(this.highlightedCountry,0,0);
    this.drawCaptureWave(c, timestamp);
    if(this.showSeaPassages)this.drawLandingPorts(c, timestamp);
    this.drawFrontCapture(c,timestamp);
    this.drawBorderSkirmishes(c,timestamp);
    // Mouse feedback is now the subtle whole-target tint cached above.
    // No hover square or animated point circle.
    c.restore();
    this.drawStrategicOrders(c,timestamp);
    this.drawLiveBattles(c,timestamp);
    this.drawReinforcements(c,timestamp);
    this.drawSeaVoyages(c);
    this.drawActiveFrontForces(c);
    this.drawTroopBadges(c);
    this.drawCapitalNames(c);
    this.drawFactoryLinks(c,timestamp);
    this.drawBuildings(c);
    this.drawSquads(c,timestamp);
    if(this.selectionBox){
      const b=this.selectionBox;
      c.save();c.fillStyle='rgba(90,188,250,.16)';c.strokeStyle='#86d9ff';c.lineWidth=1.5;
      c.fillRect(Math.min(b.x1,b.x2),Math.min(b.y1,b.y2),Math.abs(b.x2-b.x1),Math.abs(b.y2-b.y1));
      c.strokeRect(Math.min(b.x1,b.x2),Math.min(b.y1,b.y2),Math.abs(b.x2-b.x1),Math.abs(b.y2-b.y1));c.restore();
    }
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
    if(!landing){
      const box=this.canvas.getBoundingClientRect(),x=clientX-box.left,y=clientY-box.top;
      // On left click, squad markers sit ABOVE building markers and must win hit testing.
      for(const squad of this.game.squads){
        if(squad.owner!==0)continue;
        const sx=this.ox+(squad.index%MAP_WIDTH+.5)*CW*this.scale;
        const sy=this.oy+(Math.floor(squad.index/MAP_WIDTH)+.5)*CH*this.scale;
        if(Math.hypot(x-sx,y-sy)<=13)return {x:squad.index%MAP_WIDTH,y:Math.floor(squad.index/MAP_WIDTH)};
      }
      const hits=this.visibleCityMarkers.filter(m=>
        x>=m.bounds.x&&x<=m.bounds.x+m.bounds.width&&
        y>=m.bounds.y&&y<=m.bounds.y+m.bounds.height);
      // A smaller factory/tower takes precedence over the nearby city badge.
      hits.sort((a,b)=>a.bounds.width*a.bounds.height-b.bounds.width*b.bounds.height||
        Math.hypot(x-a.x,y-a.y)-Math.hypot(x-b.x,y-b.y));
      if(hits[0])return {x:hits[0].index%MAP_WIDTH,y:Math.floor(hits[0].index/MAP_WIDTH)};
    }
    const p=this.worldAt(clientX,clientY);
    const x=Math.floor(p.x/CW),y=Math.floor(p.y/CH);
    if(x<0||y<0||x>=MAP_WIDTH||y>=MAP_HEIGHT)return null;
    return {x,y};
  }
  private installControls() {
    // WASD / arrows pan the map only when game controls own the keyboard.
    // Never steal shortcuts or cursor movement from text fields and dialogs.
    const directions=new Set(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright']);
    const typing=(target:EventTarget|null):boolean=>{
      const element=target instanceof HTMLElement?target:null;
      return !!element?.closest('input,textarea,select,[contenteditable="true"],[role="textbox"],[role="dialog"],[aria-modal="true"]');
    };
    window.addEventListener('keydown',e=>{
      const key=e.key.toLowerCase();
      if(!directions.has(key)||e.altKey||e.ctrlKey||e.metaKey||typing(e.target))return;
      if(document.querySelector('[role="dialog"][aria-modal="true"],dialog[open]'))return;
      e.preventDefault();this.panKeys.add(key);
    });
    window.addEventListener('keyup',e=>this.panKeys.delete(e.key.toLowerCase()));
    window.addEventListener('blur',()=>this.panKeys.clear());
    // Maritime markers appear only while Shift is held, not all game long.
    window.addEventListener('keydown',e=>{if(e.key==='Shift')this.showSeaPassages=true;});
    window.addEventListener('keyup',e=>{if(e.key==='Shift')this.showSeaPassages=false;});
    window.addEventListener('blur',()=>{this.showSeaPassages=false;});
    // Left drag selects units; right drag pans. Right click without travel
    // keeps the normal building/diplomacy context menu.
    let activePointer:number|null=null;
    let dragButton:number|null=null;
    let rightGestureMoved=false;
    let suppressContextUntil=0;
    const threshold=6;
    this.canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0&&e.button!==2)return;
      if(activePointer!==null)return;
      activePointer=e.pointerId;dragButton=e.button;
      this.dragging=true;this.moved=false;rightGestureMoved=false;
      this.last={x:e.clientX,y:e.clientY};this.press={...this.last};
      if(e.button===0){
        const box=this.canvas.getBoundingClientRect();
        this.selectionBox={x1:e.clientX-box.left,y1:e.clientY-box.top,x2:e.clientX-box.left,y2:e.clientY-box.top};
      }else this.selectionBox=null;
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove',e=>{
      if(this.dragging&&e.pointerId===activePointer) {
        const dx=e.clientX-this.last.x,dy=e.clientY-this.last.y;
        if(Math.hypot(e.clientX-this.press.x,e.clientY-this.press.y)>threshold)this.moved=true;
        if(this.moved){
          if(dragButton===2){
            this.ox+=dx;this.oy+=dy;rightGestureMoved=true;
          }else if(this.selectionBox){
            const box=this.canvas.getBoundingClientRect();
            this.selectionBox.x2=e.clientX-box.left;this.selectionBox.y2=e.clientY-box.top;
          }
        }
        this.last={x:e.clientX,y:e.clientY};
      }
      this.hover=this.cellAt(e.clientX,e.clientY,e.shiftKey);
      this.refreshHoverPreview(this.hover);
      const box=this.canvas.getBoundingClientRect();
      this.hoverPointer={x:e.clientX-box.left,y:e.clientY-box.top,landing:e.shiftKey};
      this.onHover(this.hover,this.hoverPointer.x,this.hoverPointer.y,e.shiftKey);
    });
    let lastSecondary=-Infinity;
    const requestBuild=(clientX:number,clientY:number)=>{
      const point=this.cellAt(clientX,clientY,false);
      this.onBuildRequest(point,clientX,clientY);
    };
    this.canvas.addEventListener('pointerup',e=>{
      if(e.pointerId!==activePointer||e.button!==dragButton)return;
      const moved=this.moved||Math.hypot(e.clientX-this.press.x,e.clientY-this.press.y)>threshold;
      if(dragButton===0){
        if(moved&&this.selectionBox){
          const b=this.selectionBox,loX=Math.min(b.x1,b.x2),hiX=Math.max(b.x1,b.x2);
          const loY=Math.min(b.y1,b.y2),hiY=Math.max(b.y1,b.y2);
          const ids=this.game.squads.filter(unit=>{
            if(unit.owner!==0)return false;
            const x=this.ox+(unit.index%MAP_WIDTH+.5)*CW*this.scale;
            const y=this.oy+(Math.floor(unit.index/MAP_WIDTH)+.5)*CH*this.scale;
            return x>=loX&&x<=hiX&&y>=loY&&y<=hiY;
          }).map(unit=>unit.id);
          this.selectedSquadIds=ids;this.onSelectSquads(ids);
        }else{
          const p=this.cellAt(e.clientX,e.clientY,e.shiftKey);
          if(p)this.onSelect(p,e.shiftKey);
        }
      }else if(dragButton===2){
        lastSecondary=performance.now();
        if(moved||rightGestureMoved)suppressContextUntil=lastSecondary+500;
        else requestBuild(e.clientX,e.clientY);
      }
      activePointer=null;dragButton=null;this.dragging=false;
      this.selectionBox=null;rightGestureMoved=false;
    });
    this.canvas.addEventListener('pointercancel',e=>{
      if(e.pointerId!==activePointer)return;
      if(dragButton===2&&this.moved)suppressContextUntil=performance.now()+500;
      activePointer=null;dragButton=null;this.dragging=false;this.selectionBox=null;
    });
    this.canvas.addEventListener('pointerleave',()=>{
      this.hover=null;this.hoverPointer=null;this.refreshHoverPreview(null);this.onHover(null,0,0,false);
    });
    this.canvas.addEventListener('contextmenu',e=>{
      e.preventDefault();
      const now=performance.now();
      if(now<suppressContextUntil||now-lastSecondary<500||dragButton===2)return;
      lastSecondary=now;requestBuild(e.clientX,e.clientY);
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
