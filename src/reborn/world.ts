import { RULES, type Point, type Owner } from './config.js';

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
export function inside(p: Point, polygon: Point[]): boolean {
  let result = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i], b=polygon[j];
    if ((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) result=!result;
  }
  return result;
}
export class World {
  readonly size = RULES.worldSize;
  readonly cell = this.size / RULES.grid;
  readonly rocks: Point[][] = ROCKS.map(poly=>poly.map(([x,y])=>({x:x*3,y:y*3})));
  readonly blocked = new Uint8Array(RULES.grid ** 2);
  /** Physical tall relief, without navigation clearance or low rubble. */
  readonly opaque = new Uint8Array(RULES.grid ** 2);
  readonly cliffIds = new Int16Array(RULES.grid ** 2).fill(-1);
  readonly components = new Int16Array(RULES.grid ** 2).fill(-1);
  readonly cliffCells:number[][]=Array.from({length:9},()=>[]);
  constructor() {
    if(navigationCache){
      this.blocked.set(navigationCache.blocked);this.opaque.set(navigationCache.opaque);this.cliffIds.set(navigationCache.cliffs);this.components.set(navigationCache.components);
      this.cliffIds.forEach((id,i)=>{if(id>=0)this.cliffCells[id].push(i);});return;
    }
    for(let i=0;i<this.blocked.length;i++) {
      const p=this.center(i);
      // Include the entire navigation cell plus the soldier's body clearance.
      // Testing only its center allowed feet to enter a cliff's sloping edge.
      const r=this.cell*.5+RULES.infantry.radius;
      const samples=[p,...[-r,0,r].flatMap(dx=>[-r,0,r].map(dy=>({x:p.x+dx,y:p.y+dy})))];
      if(this.rocks.some(poly=>samples.some(q=>inside(q,poly))))this.blocked[i]=1;
      const cliff=this.rocks.slice(0,9).findIndex(poly=>inside(p,poly));
      if(cliff>=0){this.opaque[i]=1;this.cliffIds[i]=cliff;this.cliffCells[cliff].push(i);}
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
    navigationCache={blocked:this.blocked.slice(),opaque:this.opaque.slice(),cliffs:this.cliffIds.slice(),components:this.components.slice()};
  }
  index(p: Point): number {
    const x=Math.floor(p.x/this.cell), y=Math.floor(p.y/this.cell);
    return x<0||y<0||x>=RULES.grid||y>=RULES.grid ? -1 : y*RULES.grid+x;
  }
  center(i: number): Point { return {x:(i%RULES.grid+.5)*this.cell,y:(Math.floor(i/RULES.grid)+.5)*this.cell}; }
  walkable(p: Point, obstacles: {x:number;y:number;radius:number}[]=[]): boolean {
    const i=this.index(p);
    return i>=0&&!this.blocked[i]&&!obstacles.some(o=>Math.hypot(p.x-o.x,p.y-o.y)<o.radius+RULES.infantry.radius);
  }
  nearest(p: Point, obstacles: {x:number;y:number;radius:number}[]=[], occupied: Point[]=[], from?:Point): Point | null {
    const start=from?this.index(from):-1,component=start>=0?this.components[start]:-1;
    const valid=(q:Point)=>this.walkable(q,obstacles)&&(component<0||this.components[this.index(q)]===component)&&occupied.every(u=>Math.hypot(u.x-q.x,u.y-q.y)>23);
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
  line(a: Point,b: Point,obstacles: {x:number;y:number;radius:number}[]=[]): boolean {
    const steps=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/(this.cell*.45)));
    for(let i=1;i<=steps;i++) if(!this.walkable({x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps},obstacles))return false;
    return true;
  }
  /** The first opaque face is visible; only terrain beyond that face is hidden. */
  sightLine(a:Point,b:Point):boolean{
    const end=this.index(b);if(end<0)return false;
    const steps=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/(this.cell*.4)));
    for(let i=1;i<=steps;i++){
      const index=this.index({x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps});
      if(index<0)return false;if(index===end)return true;if(this.opaque[index])return false;
    }
    return true;
  }
  path(start: Point, target: Point, obstacles: {x:number;y:number;radius:number}[]=[]): Point[] {
    const end=this.nearest(target,obstacles,[],start);
    if(!end)return [];
    if(this.line(start,end,obstacles))return [end];
    const s=this.index(start), goal=this.index(end), n=this.blocked.length;
    if(s<0||goal<0)return [];
    const costs=new Float64Array(n).fill(Infinity), prev=new Int32Array(n).fill(-1), closed=new Uint8Array(n);
    const heap: {i:number;f:number}[]=[];
    const h=(i:number)=>Math.hypot(i%RULES.grid-goal%RULES.grid,Math.floor(i/RULES.grid)-Math.floor(goal/RULES.grid));
    const push=(v:{i:number;f:number})=>{heap.push(v);let k=heap.length-1;while(k>0){const p=(k-1)>>1;if(heap[p].f<=v.f)break;heap[k]=heap[p];k=p;}heap[k]=v;};
    const pop=()=>{const top=heap[0],last=heap.pop()!;if(heap.length){let k=0;while(k*2+1<heap.length){let c=k*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[k]=heap[c];k=c;}heap[k]=last;}return top.i;};
    costs[s]=0;push({i:s,f:h(s)});
    while(heap.length) {
      const i=pop();if(closed[i])continue;closed[i]=1;
      if(i===goal){const route:Point[]=[end];let at=goal;while(at!==s&&at>=0){route.push(this.center(at));at=prev[at];}route.reverse();
        const smooth:Point[]=[];let anchor=start;for(let k=0;k<route.length;){let next=k;while(next+1<route.length&&this.line(anchor,route[next+1],obstacles))next++;smooth.push(route[next]);anchor=route[next];k=next+1;}return smooth;}
      const ix=i%RULES.grid,iy=Math.floor(i/RULES.grid);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;const x=ix+dx,y=iy+dy;
        if(x<0||y<0||x>=RULES.grid||y>=RULES.grid)continue;
        const j=y*RULES.grid+x;if(closed[j]||!this.walkable(this.center(j),obstacles))continue;
        if(dx&&dy&&(!this.walkable(this.center(iy*RULES.grid+x),obstacles)||!this.walkable(this.center(y*RULES.grid+ix),obstacles)))continue;
        const g=costs[i]+(dx&&dy?Math.SQRT2:1);if(g<costs[j]){costs[j]=g;prev[j]=i;push({i:j,f:g+h(j)});}
      }
    }
    return [];
  }
  territories(seed=2026): Territory[] {
    let random=seed>>>0;const rand=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296;};
    const cols=RULES.columns,rows=RULES.rows,w=this.size/cols,h=this.size/rows;
    const vertices:Point[][]=Array.from({length:rows+1},(_,y)=>Array.from({length:cols+1},(_,x)=>({
      x:x*w+(x===0||x===cols?0:(rand()-.5)*w*.24),y:y*h+(y===0||y===rows?0:(rand()-.5)*h*.24)})));
    const names=['Westgrat','Staubpfad','Sonnenbruch','Basaltpass','Roter Kamm','Feindliche Zitadelle',
      'Dünenwacht','Steinbogen','Alte Trasse','Kiesebene','Eisengrund','Ascheposten',
      'Sandmeer','Prospektor-Tal','Zentralpass','Trockensee','Splittergrat','Ostpass',
      'Südwacht','Blaue Bastion','Nomadenpfad','Quarzsenke','Sichelgrat','Fernposten',
      'Klippenrand','Heimische Dünen','Südpass','Goldene Senke','Wandergrund','Letzte Wacht'];
    return Array.from({length:cols*rows},(_,id)=>{
      const x=id%cols,y=Math.floor(id/cols),point=this.nearest({x:(x+.5)*w,y:(y+.5)*h})!;
      const value=id%7===0?2:id%3===0?1:0;
      return {id,name:names[id],polygon:[vertices[y][x],vertices[y][x+1],vertices[y+1][x+1],vertices[y+1][x]],
        point,neighbors:[x>0?id-1:-1,x<cols-1?id+1:-1,y>0?id-cols:-1,y<rows-1?id+cols:-1].filter(i=>i>=0),
        owner:[18,19,25].includes(id)?0:[4,5,11].includes(id)?1:-1,capturing:-1,progress:0,income:RULES.territoryIncome[value],value};
    });
  }
}
