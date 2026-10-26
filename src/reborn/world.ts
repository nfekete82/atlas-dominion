import { profiler } from './performance.js';
import { RULES, type Point, type Owner, type MapVersion, mapLayout, mapWorldSize } from './config.js';
import { TERRAIN_BLOCKED, TERRAIN_CLIFFS } from './terrain-art.js';
import { generateMap, polygonContains, segmentDistance, type GeneratedMap } from './world-generation.js';
import { navigationLine } from './navigation-line.js';

export interface Territory {
  id: number; name: string; polygon: Point[]; point: Point; neighbors: number[];
  owner: Owner; capturing: Owner; progress: number; income: number; value: number;
}
// Hand-traced against the supplied landscape, in original image pixels.
const ROCKS = [
  [[0,0],[233,0],[253,91],[188,126],[148,192],[0,246]],
  [[470,0],[954,0],[931,74],[917,165],[848,229],[754,218],[692,169],[604,177],[562,117]],
  [[1141,89],[1254,96],[1254,402],[1169,371],[1113,322],[1077,281],[1090,210]],
  [[0,337],[118,346],[175,416],[190,467],[126,490],[0,464]],
  [[0,602],[60,636],[72,692],[0,733]],
  [[0,859],[123,882],[202,936],[226,971],[199,1005],[162,1033],[100,1082],[0,1090]],
  [[205,1050],[265,1007],[323,1014],[376,1068],[399,1145],[465,1154],[585,1254],[142,1254],[210,1173]],
  [[1194,487],[1254,494],[1254,673],[1212,650],[1181,598]],
  [[1136,1054],[1254,1072],[1254,1254],[1020,1254],[1008,1200],[1060,1120]],
  // Raised interior outcrops and their feet, not merely the large edge mesas.
  [[403,619],[424,609],[449,620],[457,637],[435,651],[409,645]],
  [[612,948],[643,941],[674,963],[692,990],[661,1007],[627,992]],
  [[304,849],[322,844],[342,861],[338,884],[315,890],[299,872]],
  [[826,994],[845,983],[864,998],[863,1021],[840,1025],[825,1012]],
  [[651,802],[669,798],[682,812],[680,829],[659,834],[647,821]],
  [[814,510],[839,503],[852,516],[847,535],[827,539],[813,528]],
];
interface TerrainCache { blocked:Uint8Array; opaque:Uint8Array; cliffs:Int16Array; components:Int16Array }
let navigationCache:TerrainCache|undefined;
const clearanceDirections=Array.from({length:8},(_,n)=>({x:Math.cos(n*Math.PI/4),y:Math.sin(n*Math.PI/4)}));
export function inside(p: Point, polygon: Point[]): boolean {
  let result = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i], b=polygon[j];
    if ((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) result=!result;
  }
  return result;
}
export class World {
  readonly size:number;
  readonly cell:number;
  readonly rocks: Point[][] = ROCKS.map(poly=>poly.map(([x,y])=>({x:x*3,y:y*3})));
  readonly blocked = new Uint8Array(RULES.grid ** 2);
  /** Physical tall relief, without navigation clearance or low rubble. */
  readonly opaque = new Uint8Array(RULES.grid ** 2);
  readonly cliffIds = new Int16Array(RULES.grid ** 2).fill(-1);
  readonly components = new Int16Array(RULES.grid ** 2).fill(-1);
  readonly cliffCells:number[][]=[];
  readonly generated?:GeneratedMap;
  constructor(readonly seed=2026,readonly mapVersion:MapVersion=0) {
    this.size=mapWorldSize(mapVersion);this.cell=this.size/RULES.grid;
    if(mapVersion===0&&navigationCache){
      this.blocked.set(navigationCache.blocked);this.opaque.set(navigationCache.opaque);this.cliffIds.set(navigationCache.cliffs);this.components.set(navigationCache.components);
      this.cliffIds.forEach((id,i)=>{if(id>=0)(this.cliffCells[id]??=[]).push(i);});return;
    }
    if(mapVersion!==0){
      this.generated=generateMap(seed,mapVersion);
      this.rocks=this.generated.mesas.map(m=>m.outline);
      for(const [id,mesa] of this.generated.mesas.entries()){
        this.cliffCells[id]=[];
        const minX=Math.max(0,Math.floor(Math.min(...mesa.outline.map(p=>p.x))/this.cell)-1),maxX=Math.min(RULES.grid-1,Math.ceil(Math.max(...mesa.outline.map(p=>p.x))/this.cell)+1);
        const minY=Math.max(0,Math.floor(Math.min(...mesa.outline.map(p=>p.y))/this.cell)-1),maxY=Math.min(RULES.grid-1,Math.ceil(Math.max(...mesa.outline.map(p=>p.y))/this.cell)+1);
        for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
          const i=y*RULES.grid+x,p=this.center(i),solid=polygonContains(p,mesa.outline);
          if(solid||mesa.outline.some((a,n)=>segmentDistance(p,a,mesa.outline[(n+1)%mesa.outline.length])<this.cell)){this.blocked[i]=1;}
          if(solid){this.opaque[i]=1;this.cliffIds[i]=id;this.cliffCells[id].push(i);}
        }
      }
    }else{
      this.blocked.set(Uint8Array.from(atob(TERRAIN_BLOCKED),c=>c.charCodeAt(0)));
      const cliffData=Uint8Array.from(atob(TERRAIN_CLIFFS),c=>c.charCodeAt(0));
      for(let i=0;i<this.blocked.length;i++) {
        const cliff=cliffData[i]-1;
        if(cliff>=0){this.opaque[i]=1;this.cliffIds[i]=cliff;(this.cliffCells[cliff]??=[]).push(i);}
      }
    }
    // Static connectivity keeps move destinations out of isolated terrain pockets.
    let component=0;
    for(let i=0;i<this.blocked.length;i++)if(!this.blocked[i]&&this.components[i]<0){
      const queue=[i];this.components[i]=component;
      for(let head=0;head<queue.length;head++){
        const at=queue[head],x=at%RULES.grid,y=Math.floor(at/RULES.grid);
        for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
          const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=RULES.grid||ny>=RULES.grid)continue;
          const next=ny*RULES.grid+nx;if(!this.blocked[next]&&this.components[next]<0){this.components[next]=component;queue.push(next);}
        }
      }component++;
    }
    if(mapVersion===0)navigationCache={blocked:this.blocked.slice(),opaque:this.opaque.slice(),cliffs:this.cliffIds.slice(),components:this.components.slice()};
  }
  index(p: Point): number {
    return this.indexXY(p.x,p.y);
  }
  private indexXY(px:number,py:number):number {
    const x=Math.floor(px/this.cell), y=Math.floor(py/this.cell);
    return x<0||y<0||x>=RULES.grid||y>=RULES.grid ? -1 : y*RULES.grid+x;
  }
  center(i: number): Point { return {x:(i%RULES.grid+.5)*this.cell,y:(Math.floor(i/RULES.grid)+.5)*this.cell}; }
  walkable(p: Point, obstacles: {x:number;y:number;radius:number}[]=[],clearance=0): boolean {
    const i=this.index(p);
    if(!(i>=0&&p.x>=10&&p.y>=10&&p.x<=this.size-10&&p.y<=this.size-10&&!this.blocked[i]))return false;
    for(const o of obstacles)if(Math.hypot(p.x-o.x,p.y-o.y)<o.radius+RULES.infantry.radius+clearance)return false;
    if(clearance>0)for(const d of clearanceDirections){const j=this.indexXY(p.x+d.x*clearance,p.y+d.y*clearance);if(j<0||this.blocked[j])return false;}
    return true;
  }
  nearest(p: Point, obstacles: {x:number;y:number;radius:number}[]=[], occupied: Point[]=[], from?:Point,clearance=0): Point | null {
    const start=from?this.index(from):-1,component=start>=0?this.components[start]:-1;
    const valid=(q:Point)=>this.walkable(q,obstacles,clearance)&&(component<0||this.components[this.index(q)]===component)&&occupied.every(u=>Math.hypot(u.x-q.x,u.y-q.y)>23+clearance);
    if(valid(p))return {...p};
    const origin=this.index({x:Math.max(0,Math.min(this.size-1,p.x)),y:Math.max(0,Math.min(this.size-1,p.y))});
    const search=from?RULES.grid:Math.ceil(700/this.cell);
    for(let r=1;r<search;r++) for(let y=-r;y<=r;y++) for(let x=-r;x<=r;x++) {
      if(Math.abs(x)!==r&&Math.abs(y)!==r)continue;
      const cx=origin%RULES.grid+x,cy=Math.floor(origin/RULES.grid)+y;
      if(cx<0||cy<0||cx>=RULES.grid||cy>=RULES.grid)continue;
      const q=this.center(cy*RULES.grid+cx);
      if(valid(q))return q;
    }
    return null;
  }
  /** Place the complete building footprint on flat ground, away from a cliff. */
  clearSite(p:Point,radius:number):Point|null{
    const clear=(q:Point)=>this.walkable(q)&&Array.from({length:16},(_,i)=>({x:q.x+Math.cos(i*Math.PI/8)*radius,y:q.y+Math.sin(i*Math.PI/8)*radius})).every(a=>this.walkable(a));
    if(clear(p))return {...p};
    const cx=Math.floor(p.x/this.cell),cy=Math.floor(p.y/this.cell);
    for(let r=1;r<40;r++){
      const candidates:Point[]=[];
      for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)if(Math.abs(x)===r||Math.abs(y)===r){
        if(cx+x<0||cy+y<0||cx+x>=RULES.grid||cy+y>=RULES.grid)continue;
        const q=this.center((cy+y)*RULES.grid+cx+x);if(clear(q))candidates.push(q);
      }
      if(candidates.length)return candidates.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
    }
    return null;
  }
  line(a: Point,b: Point,obstacles: {x:number;y:number;radius:number}[]=[],clearance=0): boolean {
    const steps=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/(this.cell*.45)));
    for(let i=1;i<=steps;i++) if(!this.walkable({x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps},obstacles,clearance))return false;
    return true;
  }
  /** The first opaque face is visible; only terrain beyond that face is hidden. */
  sightLine(a:Point,b:Point):boolean{
    const end=this.index(b);if(end<0)return false;
    const steps=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/(this.cell*.4)));
    for(let i=1;i<=steps;i++){
      const index=this.indexXY(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps);
      if(index<0)return false;if(index===end)return true;if(this.opaque[index])return false;
    }
    return true;
  }
  path(start: Point, target: Point, obstacles: {x:number;y:number;radius:number}[]=[],clearance=0,risk?:Float32Array,air=false,exact=false): Point[] {
    if(!profiler)return this.findPath(start,target,obstacles,clearance,risk,air,exact);
    const at=performance.now();this.pathNodes=0;try{return this.findPath(start,target,obstacles,clearance,risk,air,exact);}finally{profiler.record('pathfinding',performance.now()-at,this.pathNodes);}
  }
  private pathNodes=0;
  // Searches are synchronous; reuse workspace, resetting traversal for every search.
  // Never cache across calls: construction, fog knowledge and test maps can change.
  private pathWorkspace?:{costs:Float64Array;prev:Int32Array;closed:Uint8Array;walkable:Int8Array};
  private findPath(start: Point, target: Point, obstacles: {x:number;y:number;radius:number}[]=[],clearance=0,risk?:Float32Array,air=false,exact=false): Point[] {
    const precise=exact&&this.mapVersion>=3&&!air&&clearance>0;
    const walk=(p:Point)=>air?(p.x>=10&&p.y>=10&&p.x<=this.size-10&&p.y<=this.size-10):this.walkable(p,obstacles,clearance);
    const line=(a:Point,b:Point)=>air?walk(a)&&walk(b):precise
      ?walk(a)&&walk(b)&&navigationLine(a,b,this.cell,RULES.grid,this.blocked,obstacles,RULES.infantry.radius,clearance)
      :this.line(a,b,obstacles,clearance);
    const end=air?{x:Math.max(10,Math.min(this.size-10,target.x)),y:Math.max(10,Math.min(this.size-10,target.y))}:this.nearest(target,obstacles,[],start,clearance);
    if(!end)return [];
    const cost=(a:Point,b:Point)=>{const d=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(d/(this.cell*.6)));let sum=0;for(let i=0;i<=steps;i++)sum+=risk?.[this.index({x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps})]??0;return d/this.cell*(1+sum/(steps+1));};
    if(line(start,end)&&(!risk||cost(start,end)<=Math.hypot(end.x-start.x,end.y-start.y)/this.cell*1.01))return [end];
    const s=this.index(start), goal=this.index(end), n=this.blocked.length;
    if(s<0||goal<0)return [];
    const workspace=this.pathWorkspace??={costs:new Float64Array(n),prev:new Int32Array(n),closed:new Uint8Array(n),walkable:new Int8Array(n)};
    const {costs,prev,closed,walkable}=workspace;costs.fill(Infinity);prev.fill(-1);closed.fill(0);walkable.fill(0);
    const cellWalkable=(i:number)=>{if(!walkable[i])walkable[i]=walk(this.center(i))?1:-1;return walkable[i]===1;};
    const heap: {i:number;f:number}[]=[];
    const h=(i:number)=>Math.hypot(i%RULES.grid-goal%RULES.grid,Math.floor(i/RULES.grid)-Math.floor(goal/RULES.grid));
    const push=(v:{i:number;f:number})=>{heap.push(v);let k=heap.length-1;while(k>0){const p=(k-1)>>1;if(heap[p].f<=v.f)break;heap[k]=heap[p];k=p;}heap[k]=v;};
    const pop=()=>{const top=heap[0],last=heap.pop()!;if(heap.length){let k=0;while(k*2+1<heap.length){let c=k*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[k]=heap[c];k=c;}heap[k]=last;}return top.i;};
    costs[s]=0;push({i:s,f:h(s)});
    while(heap.length) {
      const i=pop();if(closed[i])continue;closed[i]=1;if(profiler)this.pathNodes++;
      if(i===goal){const route:Point[]=[end];let at=goal;while(at!==s&&at>=0){route.push(precise&&at===goal?end:this.center(at));at=prev[at];}route.reverse();
        const prefix=[0];for(let j=0;j<route.length;j++)prefix.push(prefix[j]+(risk?cost(j?route[j-1]:start,route[j]):0));
        const smooth:Point[]=[];let anchor=start;for(let k=0;k<route.length;){let next=k;while(next+1<route.length&&line(anchor,route[next+1])&&(!risk||cost(anchor,route[next+1])<=(prefix[next+2]-prefix[k])*1.04))next++;if(precise&&!line(anchor,route[next]))return [];smooth.push(route[next]);anchor=route[next];k=next+1;}return smooth;}
      const ix=i%RULES.grid,iy=Math.floor(i/RULES.grid);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;const x=ix+dx,y=iy+dy;
        if(x<0||y<0||x>=RULES.grid||y>=RULES.grid)continue;
        const j=y*RULES.grid+x;if(closed[j]||!cellWalkable(j))continue;
        if(dx&&dy&&(!cellWalkable(iy*RULES.grid+x)||!cellWalkable(y*RULES.grid+ix)))continue;
        const g=costs[i]+(dx&&dy?Math.SQRT2:1)*(1+Math.max(0,risk?.[j]??0));if(g<costs[j]){
          // Endpoint clearance alone cannot prove that an edge is traversable.
          // Only a cheaper candidate can change the route, so avoid repeating
          // the pure geometric check for candidates already ruled out by cost.
          if(precise&&!line(i===s?start:this.center(i),j===goal?end:this.center(j)))continue;
          costs[j]=g;prev[j]=i;push({i:j,f:g+h(j)});
        }
      }
    }
    return [];
  }
  territories(seed=2026): Territory[] {
    let random=seed>>>0;const rand=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296;};
    const layout=mapLayout(this.mapVersion),cols=layout.columns,rows=layout.rows,w=this.size/cols,h=this.size/rows;
    const vertices:Point[][]=Array.from({length:rows+1},(_,y)=>Array.from({length:cols+1},(_,x)=>({
      x:x*w+(x===0||x===cols?0:(rand()-.5)*w*.24),y:y*h+(y===0||y===rows?0:(rand()-.5)*h*.24)})));
    if(this.mapVersion>=2)for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){
      if(y*(cols+1)+x>=(rows+1)*(cols+1)/2)continue;
      vertices[rows-y][cols-x]=y===rows-y&&x===cols-x?{x:this.size/2,y:this.size/2}:{x:this.size-vertices[y][x].x,y:this.size-vertices[y][x].y};
    }
    const names=['Westgrat','Staubpfad','Sonnenbruch','Basaltpass','Roter Kamm','Feindliche Zitadelle',
      'Dünenwacht','Steinbogen','Alte Trasse','Kiesebene','Eisengrund','Ascheposten',
      'Sandmeer','Prospektor-Tal','Zentralpass','Trockensee','Splittergrat','Ostpass',
      'Südwacht','Blaue Bastion','Nomadenpfad','Quarzsenke','Sichelgrat','Fernposten',
      'Klippenrand','Heimische Dünen','Südpass','Goldene Senke','Wandergrund','Letzte Wacht'];
    const campaignNames=['Westgrat','Staubpfad','Roter Kamm','Rote Zitadelle','Dünenwacht','Steinbogen','Zentralpass','Ascheposten','Sandmeer','Prospektor-Tal','Trockensee','Splittergrat','Blaue Bastion','Heimische Dünen','Südpass','Letzte Wacht'];
    return Array.from({length:cols*rows},(_,id)=>{
      const x=id%cols,y=Math.floor(id/cols),point=this.generated?{...this.generated.sites[id]}:this.nearest({x:(x+.5)*w,y:(y+.5)*h})!;
      const mirrored=this.mapVersion>=2?Math.min(id,cols*rows-1-id):id,value=mirrored%7===0?2:mirrored%3===0?1:0;
      return {id,name:this.mapVersion===2?campaignNames[id]:this.mapVersion>=3?`Sektor ${id+1}`:names[id],polygon:[vertices[y][x],vertices[y][x+1],vertices[y+1][x+1],vertices[y+1][x]],
        point,neighbors:[x>0?id-1:-1,x<cols-1?id+1:-1,y>0?id-cols:-1,y<rows-1?id+cols:-1].filter(i=>i>=0),
        owner:layout.starts[0].some(i=>i===id)?0:layout.starts[1].some(i=>i===id)?1:-1,capturing:-1,progress:0,income:layout.incomes[value],value};
    });
  }
}
