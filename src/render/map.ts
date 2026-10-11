import { COUNTRIES, MAP_HEIGHT, MAP_WIDTH, SEA_CROSSINGS, WORLD_HEIGHT, WORLD_WIDTH } from '../data/europe.js';
import { Game, NEUTRAL, WATER, pointToWorld, seededRandom, type Point } from '../engine/game.js';
import { TerritoryWave, waveProgress } from './wave.js';
import { pixelGridEdges } from './pixel-grid.js';
import { MAP_PALETTE, mixHexColor } from './map-palette.js';
import { COUNTRY_STARTS } from '../data/countries.js';

const CW = WORLD_WIDTH / MAP_WIDTH;
const CH = WORLD_HEIGHT / MAP_HEIGHT;
const X_EDGES = pixelGridEdges(MAP_WIDTH, WORLD_WIDTH);
const Y_EDGES = pixelGridEdges(MAP_HEIGHT, WORLD_HEIGHT);
const FLAGS=new Map(COUNTRY_STARTS.map(country=>[country.name,
  country.code==='XK'?'🇽🇰':[...country.code].map(ch=>String.fromCodePoint(127397+ch.charCodeAt(0))).join('')
]));

export class MapRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private base = document.createElement('canvas');
  private overlay = document.createElement('canvas');
  private administrative = document.createElement('canvas');
  private highlightedCountry = document.createElement('canvas');
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
  private frontierLabels: Array<{ id:number; pos:Point; troops:number }> = [];
  private armyTotals: number[] = [];
  private buildingMarkers: Array<{index:number;code:number}> = [];
  // Combat highlights represent actual touching borders, never routes from a capital.
  private combatEdges: Array<{ ax:number; ay:number; bx:number; by:number }> = [];
  private combatLabels: Array<{ pos:Point; troops:number }> = [];
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
    for (const c of [this.base, this.overlay, this.administrative, this.highlightedCountry]) { c.width = WORLD_WIDTH; c.height = WORLD_HEIGHT; }
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
    const sea = c.createLinearGradient(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    sea.addColorStop(0,MAP_PALETTE.oceanTop);
    sea.addColorStop(1,MAP_PALETTE.oceanBottom);
    c.fillStyle=sea;c.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
    // Permanent, very subtle administrative outlines remain visible after
    // conquest. Political lines are not the current military front.
    const admin=this.administrative.getContext('2d')!;
    admin.clearRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
    for (const country of COUNTRIES) {
      const path = new Path2D();
      for (const ring of country.rings) {
        ring.forEach(([x, y], j) => j === 0 ? path.moveTo(x, y) : path.lineTo(x, y));
        path.closePath();
      }
      c.fillStyle=MAP_PALETTE.land;c.fill(path);
      c.strokeStyle='rgba(93,111,104,.40)';c.lineWidth=1.05;c.stroke(path);
      admin.strokeStyle='rgba(98,103,89,.31)';admin.lineWidth=.9;admin.stroke(path);
    }
    // Faint sea corridors represent crossings for islands and separated landmasses.
    c.save();c.setLineDash([5,8]);c.strokeStyle='rgba(225,236,217,.34)';c.lineWidth=1;
    for (const [a,b] of SEA_CROSSINGS) {
      const ax=(a % MAP_WIDTH +.5)*CW, ay=(Math.floor(a/MAP_WIDTH)+.5)*CH;
      const bx=(b % MAP_WIDTH +.5)*CW, by=(Math.floor(b/MAP_WIDTH)+.5)*CH;
      c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.stroke();
    }
    c.restore();
    const rng = seededRandom(7122);
    for (let i = 0; i < 1450; i++) {
      const x = rng() * WORLD_WIDTH, y = rng() * WORLD_HEIGHT;
      c.fillStyle=rng()>.55?'rgba(255,255,241,.045)':'rgba(22,69,93,.04)';
      c.fillRect(x,y,rng()*1.6+.35,rng()*1.6+.35);
    }
    c.save();
    c.font='10px ui-monospace, monospace';c.fillStyle='rgba(233,242,236,.49)';
    c.letterSpacing = '2px';
    for (const [label, x, y] of [['NORTH ATLANTIC',76,257],['MEDITERRANEAN SEA',530,745],['BALTIC SEA',710,230],['BLACK SEA',1070,670],['NORTH SEA',290,255]]) c.fillText(label as string, x as number, y as number);
    c.restore();
    const vignette=c.createRadialGradient(800,450,150,800,450,1000);
    vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(23,55,68,.12)');
    c.fillStyle = vignette; c.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
  }
  updateTerritory() {
    this.availableTargets = this.game.attackableOwners(0);
    const sumX = new Float64Array(this.game.factions.length);
    const sumY = new Float64Array(this.game.factions.length);
    const counts = new Uint32Array(this.game.factions.length);
    const stationed = new Float64Array(this.game.factions.length);
    const regional: Array<Array<{index:number; troops:number}>> = this.game.factions.map(()=>[]);
    this.buildingMarkers=[];
    const c = this.overlay.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.clearRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
    const owners = this.game.owner;
    const territoryFills=this.game.factions.map(f=>mixHexColor(f.color));
    this.wave.capture(owners, performance.now());
    for (let i = 0; i < owners.length; i++) {
      const id = owners[i];
      if (id < 0) continue;
      sumX[id] += i % MAP_WIDTH;
      sumY[id] += Math.floor(i / MAP_WIDTH);
      counts[id]++;
      const building=this.game.buildings[i];
      if(building)this.buildingMarkers.push({index:i,code:building});
      const front = this.game.frontline[i];
      stationed[id] += front;
      if (front > 0.1) regional[id].push({index:i,troops:front});
      // Native bitmap-aligned cell edges keep every square sharp, with NO
      // fractional alpha bleeding, gaps or overlapping 0.45px overdraw.
      const col=i%MAP_WIDTH,row=Math.floor(i/MAP_WIDTH);
      const left=X_EDGES[col],top=Y_EDGES[row];
      c.fillStyle=territoryFills[id];
      c.fillRect(left,top,X_EDGES[col+1]-left,Y_EDGES[row+1]-top);
    }
    // One-pixel lattice keeps individual conquered sectors legible.
    // source-atop clips it to owned sectors without drawing a grid on the sea.
    // Draw ~740 batched lines rather than 54,000 tiny stroked rectangles.
    c.save();
    c.globalCompositeOperation='source-atop';
    c.strokeStyle='rgba(57,66,67,.055)';
    c.lineWidth=1;
    c.beginPath();
    for(let x=1;x<MAP_WIDTH;x++){
      const px=X_EDGES[x]+.5;
      c.moveTo(px,0);c.lineTo(px,WORLD_HEIGHT);
    }
    for(let y=1;y<MAP_HEIGHT;y++){
      const py=Y_EDGES[y]+.5;
      c.moveTo(0,py);c.lineTo(WORLD_WIDTH,py);
    }
    c.stroke();
    c.restore();
    // Draw territorial contours directly on pixel-aligned cell boundaries.
    // Avoid the thick translucent halo that previously blurred captured squares.
    const contours = this.game.factions.map(() => new Path2D());
    for (let i = 0; i < owners.length; i++) {
      const id = owners[i];
      if (id < 0) continue;
      const path=contours[id];
      const col=i%MAP_WIDTH,row=Math.floor(i/MAP_WIDTH);
      const x=X_EDGES[col],y=Y_EDGES[row],right=X_EDGES[col+1],bottom=Y_EDGES[row+1];
      if(col===0 || owners[i-1]!==id){path.moveTo(x+.5,y);path.lineTo(x+.5,bottom);}
      if(col===MAP_WIDTH-1 || owners[i+1]!==id){path.moveTo(right-.5,y);path.lineTo(right-.5,bottom);}
      if(row===0 || owners[i-MAP_WIDTH]!==id){path.moveTo(x,y+.5);path.lineTo(right,y+.5);}
      if(row===MAP_HEIGHT-1 || owners[i+MAP_WIDTH]!==id){path.moveTo(x,bottom-.5);path.lineTo(right,bottom-.5);}
    }
    c.save();c.lineCap='butt';c.lineJoin='miter';
    for (const faction of this.game.factions) {
      if (!counts[faction.id]) continue;
      c.strokeStyle='rgba(255,252,239,.58)';c.lineWidth=2.15;c.stroke(contours[faction.id]);
      c.strokeStyle=mixHexColor(faction.color,'#344b57',.29)+'e4';
      c.lineWidth=1.1;c.stroke(contours[faction.id]);
    }
    c.restore();
    // Regional fortification markers: stronger fronts are clearer and easier
    // to identify. Only occupied rival borders receive stationed troops.
    c.save();
    for (const region of regional) for (const entry of region) {
      const x=(entry.index%MAP_WIDTH+.5)*CW;
      const y=(Math.floor(entry.index/MAP_WIDTH)+.5)*CH;
      const strength=entry.troops;
      c.beginPath(); c.arc(x,y,.65+Math.min(1.1,Math.sqrt(strength)*.07),0,Math.PI*2);
      c.fillStyle=strength >= 36 ? '#b8f4d286' : strength >= 15 ? '#ffd38a76' : '#f3918a66';
      c.fill();
    }
    c.restore();
    this.armyTotals=this.game.factions.map(f=>f.troops+stationed[f.id]+this.game.attackOrders.filter(o=>o.factionId===f.id).reduce((n,o)=>n+o.remaining,0));
    this.frontierLabels=[];
    for(let id=0;id<regional.length;id++){
      regional[id].sort((a,b)=>b.troops-a.troops || a.index-b.index);
      const selected: number[]=[];
      for(const entry of regional[id]){
        if(selected.length>=5)break;
        const x=entry.index%MAP_WIDTH,y=Math.floor(entry.index/MAP_WIDTH);
        if(selected.some(i=>(i%MAP_WIDTH-x)**2+(Math.floor(i/MAP_WIDTH)-y)**2 < 150))continue;
        selected.push(entry.index);
        this.frontierLabels.push({id,pos:pointToWorld({x,y}),troops:entry.troops});
      }
    }
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
      if (order.factionId !== 0 || order.remaining < 0.01) continue;
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
    return this.game.findAttackFront(0,point);
  }

  /** Rebuild only when the owner changes or the simulation claims new land.
   * Full-faction highlight is pre-rendered rather than redrawn every frame.
   */
  private refreshHoverPreview(point:Point|null,force=false):void {
    const index=point?point.y*MAP_WIDTH+point.x:-1;
    if(!force && index===this.hoverIndex)return;
    this.hoverIndex=index;
    const owner=index>=0?this.game.owner[index]:WATER;
    const front=point && owner!==0 && owner!==WATER
      ? this.game.findAttackFront(0,point):null;
    this.hoverFront=front;
    const highlight=(front && owner>=0)?owner:WATER;
    if(!force && highlight===this.highlightOwner)return;
    this.highlightOwner=highlight;
    const c=this.highlightedCountry.getContext('2d')!;
    c.clearRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
    if(highlight<0)return;
    const boundary=new Path2D();
    c.fillStyle='rgba(255,248,213,.17)';
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
    c.lineJoin='miter';c.lineWidth=2;
    c.strokeStyle='rgba(255,249,229,.95)';c.stroke(boundary);
  }

  /** Used by the tooltip; same shared-border predicate as launchAttack(). */
  canAttack(point: Point): boolean {
    const x = Math.floor(point.x), y = Math.floor(point.y);
    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return false;
    return this.availableTargets.has(this.game.owner[y * MAP_WIDTH + x]) && this.previewFront(point)!==null;
  }
  canLand(point: Point): boolean { return this.game.canLand(0,point); }
  private drawBuildings(c: CanvasRenderingContext2D): void {
    // Do not let every tiny settlement compete with the capital and front.
    if(this.zoom < 1.55)return;
    c.save();
    const glyphs=['','⌂','▣','⚔','⬡','⚓'];
    c.textAlign='center';
    c.textBaseline='middle';
    c.font=this.zoom>=2.6?'700 7px system-ui':'600 5.5px system-ui';
    for(const {index,code} of this.buildingMarkers){
      const x=(index%MAP_WIDTH+.5)*CW,y=(Math.floor(index/MAP_WIDTH)+.5)*CH;
      const size=this.zoom>=2.6?7:5.5;
      c.globalAlpha=this.zoom>=2.6?.74:.50;
      c.fillStyle='#071c23';
      c.fillRect(x-size/2,y-size/2,size,size);
      c.fillStyle=code===4?'#e8bf8c':'#c6e8d5';
      c.fillText(glyphs[code],x,y+.1);
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
      c.strokeStyle='rgba(246,246,225,.84)';
      c.fillStyle=label.id===0?'#263b46':'#35454a';
      c.lineWidth=2.6;
      c.font=label.id===0?'750 13px system-ui':'650 11px system-ui';
      c.strokeText(name,x,y,135);c.fillText(name,x,y,135);
      const count=Math.floor(this.armyTotals[label.id]??faction.troops).toLocaleString('de-DE');
      c.font=label.id===0?'700 10px system-ui':'600 9px system-ui';
      c.lineWidth=2;c.strokeText(count,x,y+13,95);c.fillText(count,x,y+13,95);
    }
    c.globalAlpha=1;

    // Optional high-zoom numbers show how many soldiers defend this exact front.
    if (this.zoom >= 2.2) for (const label of this.frontierLabels) {
      const x=this.ox+label.pos.x*this.scale,y=this.oy+label.pos.y*this.scale;
      if (x<35||x>width-35||y<35||y>height-100)continue;
      c.beginPath();c.roundRect(x-25,y-12,50,24,6);
      c.fillStyle='rgba(8,32,32,.91)';c.fill();
      c.strokeStyle=label.id===0?'#e9b85e':'#86bcaf';c.lineWidth=1;c.stroke();
      c.fillStyle='#ebf5e9';c.font='800 11px system-ui';
      c.fillText('⬡ '+Math.floor(label.troops).toLocaleString('de-DE'),x,y+4,45);
    }
    // Screen-space combat strength labels sit at contested borders.
    for (const label of this.combatLabels) {
      const x=this.ox+label.pos.x*this.scale;
      const y=this.oy+label.pos.y*this.scale-15;
      if(x<32||x>width-32||y<25||y>height-90)continue;
      c.shadowColor='#000c';c.shadowBlur=12;
      c.fillStyle='rgba(20,30,29,.94)';c.strokeStyle='#ffd384';c.lineWidth=1.3;
      c.beginPath();c.roundRect(x-35,y-13,70,26,6);c.fill();c.stroke();c.shadowBlur=0;
      c.fillStyle='#fff0ce';c.font='800 12px system-ui';
      c.fillText('⚔ '+Math.floor(label.troops).toLocaleString('de-DE'),x,y+4,64);
    }
    c.restore();
  }
  private drawLandingPorts(c: CanvasRenderingContext2D, timestamp: number) {
    const seen=new Set<number>();
    c.save();
    for(const [a,b] of SEA_CROSSINGS) for(const i of [a,b]){
      if(seen.has(i))continue;
      seen.add(i);
      const owner=this.game.owner[i];
      if(owner===WATER)continue;
      const spot={x:i%MAP_WIDTH,y:Math.floor(i/MAP_WIDTH)};
      const pos=pointToWorld(spot);
      const reachable=this.game.canLand(0,spot);
      const occupied=owner===0;
      c.globalAlpha=reachable?.82:.48;
      c.beginPath();c.arc(pos.x,pos.y,reachable?5:2.8,0,Math.PI*2);
      c.fillStyle=reachable?'rgba(255,204,119,.25)':'rgba(8,22,29,.78)';
      c.fill();
      c.lineWidth=reachable?1.25:.75;
      c.strokeStyle=reachable?'#ffdd96':occupied?'#e6b65f':'#82a4a4';
      c.stroke();
      if(reachable){
        c.fillStyle='#fff0cf';c.font='750 7px system-ui';c.textAlign='center';
        c.fillText('⚓',pos.x,pos.y+2.5);
        c.beginPath();c.arc(pos.x,pos.y,7.5+Math.sin(timestamp/260)*.7,0,Math.PI*2);
        c.lineWidth=.75;c.strokeStyle='rgba(255,212,150,.34)';c.stroke();
      }
    }
    c.restore();
  }
  private drawCaptureWave(c: CanvasRenderingContext2D, timestamp: number) {
    const captures=this.wave.active(timestamp);
    if (!captures.length) return;
    c.save();
    const fills=this.game.factions.map(f=>mixHexColor(f.color));
    for (const frame of captures) {
      if (frame.owner < 0) continue;
      const col=frame.index%MAP_WIDTH,row=Math.floor(frame.index/MAP_WIDTH);
      const x=X_EDGES[col],y=Y_EDGES[row];
      const w=X_EDGES[col+1]-x,h=Y_EDGES[row+1]-y;
      const progress=waveProgress(frame,timestamp);
      const oldFaction=this.game.factions[frame.previous];
      const newFaction=this.game.factions[frame.owner];
      // Brief stepped tile reveal with no soft circular blob or overdraw.
      c.save();
      c.beginPath();c.rect(x,y,w,h);c.clip();
      c.fillStyle=oldFaction?fills[frame.previous]:MAP_PALETTE.land;
      c.globalAlpha=(1-progress)*.91;
      c.fillRect(x,y,w,h);
      if(progress>0 && progress<1){
        c.globalAlpha=.65;
        c.fillStyle=fills[frame.owner];
        c.fillRect(x,y,h>0?w*progress:0,h);
      }
      c.restore();
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
    c.imageSmoothingEnabled=false; // Nearest-neighbour territorial pixels.
    c.drawImage(this.overlay,0,0);
    c.drawImage(this.highlightedCountry,0,0);
    c.imageSmoothingEnabled=true;
    c.globalAlpha=.65;
    c.drawImage(this.administrative,0,0);
    c.globalAlpha=1;
    this.drawCaptureWave(c, timestamp);
    this.drawLandingPorts(c, timestamp);
    this.drawBuildings(c);
    for (const city of this.game.cities) {
      const f = city.owner >= 0 ? this.game.factions[city.owner] : null;
      const pos = pointToWorld(city);
      const glow = f?.color ?? '#c8ccd0';
      c.globalAlpha=city.original===0?.75:.32;
      if(city.original===0 || this.zoom >= 2.6){
        c.beginPath();c.arc(pos.x,pos.y,4.5+Math.sin(timestamp/480+city.original)*.4,0,Math.PI*2);
        c.strokeStyle=glow+'70';c.lineWidth=.8;c.stroke();
      }
      c.beginPath();c.arc(pos.x,pos.y,city.original===0?2.7:2.1,0,Math.PI*2);
      c.fillStyle='#101b23';c.fill();c.lineWidth=1;c.strokeStyle=glow;c.stroke();
      // Only the player's capital is fully legible at initial zoom.
      // Other labels fade in when zoomed closer; never overwhelm the map.
      if(city.original===0 || this.zoom>=2.45){
        c.globalAlpha=city.original===0?.7:.40;
        c.font=city.original===0?'650 9px system-ui':'500 7px system-ui';
        c.textAlign='center';c.shadowColor='#051015';c.shadowBlur=1;
        c.fillStyle='#e9eee9';c.fillText(city.name.toUpperCase(),pos.x,pos.y-10);
      }
      c.shadowBlur=0;c.globalAlpha=1;
    }
    if (this.game.status === 'playing' && this.combatEdges.length) {
      // A pulsing territorial contact edge; no vectors, dots or arrows.
      const pulse = 0.7 + 0.25 * Math.sin(timestamp / 230);
      c.save();
      c.beginPath();
      for (const edge of this.combatEdges) {c.moveTo(edge.ax,edge.ay);c.lineTo(edge.bx,edge.by);}
      c.lineWidth=2.4;
      c.strokeStyle='rgba(247,182,91,'+(0.11*pulse)+')';
      c.shadowColor='#ffbd62';c.shadowBlur=3;c.stroke();
      c.lineWidth=1.25;
      c.strokeStyle='rgba(255,222,157,'+(0.90*pulse)+')';
      c.shadowBlur=0;c.stroke();
      c.restore();
    }
    if(this.hover) {
      const x=this.hover.x*CW, y=this.hover.y*CH;
      const i=this.hover.y*MAP_WIDTH+this.hover.x;
      if (this.game.owner[i]!==WATER) {
        const canAttack=this.canAttack(this.hover) || this.canLand(this.hover);
        c.strokeStyle=canAttack?'rgba(255,249,228,.88)':'rgba(67,75,70,.35)';
        c.lineWidth=canAttack?1.45:.6;
        if(canAttack){c.fillStyle='rgba(255,255,233,.12)';c.fillRect(x,y,CW,CH);}
        c.strokeRect(x,y,CW,CH);
        // The marker represents the actual connected attack front, no
        // directional route and no advance through third-party territory.
        const front=this.previewFront(this.hover);
        if(front && (front.x!==this.hover.x || front.y!==this.hover.y)){
          const fx=(front.x+.5)*CW, fy=(front.y+.5)*CH;
          c.beginPath();
          const radius=Math.max(CW,CH)*.83+Math.sin(timestamp/290)*.5;
          c.arc(fx,fy,radius,0,Math.PI*2);
          c.fillStyle='rgba(253,240,172,.23)';c.fill();
          c.strokeStyle='#fff4c1';c.lineWidth=1.4;c.stroke();
        }
      }
    }
    c.restore();
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
