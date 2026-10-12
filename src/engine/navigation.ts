import {LAND_ROWS,MAP_WIDTH as W,MAP_HEIGHT as H,GEO_BOUNDS} from '../data/europe.js';
import {NAVIGATION_BARRIERS} from '../data/navigation-barriers.js';

const N=W*H;
export const NAV_LAND=Uint8Array.from({length:N},(_,i)=>LAND_ROWS[Math.floor(i/W)][i%W]==='1'?1:0);
for(const i of NAVIGATION_BARRIERS)NAV_LAND[i]=1;
export function adjacent(i:number):number[]{
  const out:number[]=[];
  if(i%W>0)out.push(i-1);if(i%W<W-1)out.push(i+1);
  if(i>=W)out.push(i-W);if(i<N-W)out.push(i+W);
  return out;
}
const LINKS=Array.from({length:N},(_,i)=>adjacent(i));
// Only boundary-connected ocean is navigable; enclosed lakes are not ports.
const OCEAN=new Uint8Array(N),queue=new Int32Array(N);let tail=0;
for(let i=0;i<N;i++)if(!NAV_LAND[i]&&(i<W||i>=N-W||i%W===0||i%W===W-1)){OCEAN[i]=1;queue[tail++]=i;}
for(let h=0;h<tail;h++)for(const n of LINKS[queue[h]])if(!NAV_LAND[n]&&!OCEAN[n]){OCEAN[n]=1;queue[tail++]=n;}
export const COASTS:number[]=[];
const PORTS=new Map<number,number[]>();
for(let i=0;i<N;i++)if(LAND_ROWS[Math.floor(i/W)][i%W]==='1'){
  const water=LINKS[i].filter(n=>OCEAN[n]);
  if(water.length){COASTS.push(i);PORTS.set(i,water);}
}
export interface SeaRoute {cells:number[];distanceKm:number;}
export function segmentKm(a:number,b:number):number{
  const lat=(i:number)=>GEO_BOUNDS.north-(Math.floor(i/W)+.5)/H*(GEO_BOUNDS.north-GEO_BOUNDS.south);
  const rad=Math.PI/180,la=lat(a)*rad,lb=lat(b)*rad;
  const dl=((b%W-a%W)/W*(GEO_BOUNDS.east-GEO_BOUNDS.west))*rad;
  const v=Math.sin((lb-la)/2)**2+Math.cos(la)*Math.cos(lb)*Math.sin(dl/2)**2;
  return 12742*Math.asin(Math.sqrt(Math.min(1,v)));
}
export function routeDistance(cells:readonly number[]):number{
  let km=0;for(let i=1;i<cells.length;i++)km+=segmentKm(cells[i-1],cells[i]);return km;
}
export function voyageTicks(km:number):number{return Math.max(8,Math.min(96,Math.ceil(km/25)));}
export function validSeaRoute(cells:unknown,departure?:number,destination?:number):cells is number[]{
  if(!Array.isArray(cells)||cells.length<3||cells.length>N||cells.some(i=>!Number.isInteger(i)||i<0||i>=N))return false;
  if(!PORTS.has(cells[0])||!PORTS.has(cells.at(-1)!))return false;
  if(departure!==undefined&&cells[0]!==departure||destination!==undefined&&cells.at(-1)!==destination)return false;
  for(let k=1;k<cells.length;k++)if(!LINKS[cells[k-1]].includes(cells[k])||(k<cells.length-1&&!OCEAN[cells[k]]))return false;
  return true;
}
/** One multi-source BFS serves every destination from the current owned coast.
 * Static geography is shared. At most four ~1 MB fields are retained per game.
 * No route uses diagonals, row wrapping, land interiors or off-map cells.
 */
export class MaritimeNavigation {
  private cache=new Map<string,{parent:Int32Array;source:Int32Array;depth:Int32Array}>();
  field(owner:Int16Array,id:number){
    const shores=COASTS.filter(i=>owner[i]===id),key=shores.join(',');
    const cached=this.cache.get(key);if(cached)return cached;
    const parent=new Int32Array(N).fill(-1),source=new Int32Array(N).fill(-1),depth=new Int32Array(N).fill(-1),q=new Int32Array(N);
    let end=0;
    for(const coast of shores)for(const n of PORTS.get(coast)!)if(depth[n]<0){q[end++]=n;parent[n]=coast;source[n]=coast;depth[n]=1;}
    for(let h=0;h<end;h++){
      const i=q[h];for(const n of LINKS[i])if(OCEAN[n]&&depth[n]<0){parent[n]=i;source[n]=source[i];depth[n]=depth[i]+1;q[end++]=n;}
    }
    const field={parent,source,depth};if(this.cache.size>=4)this.cache.delete(this.cache.keys().next().value!);this.cache.set(key,field);return field;
  }
  route(owner:Int16Array,id:number,destination:number):SeaRoute|null{
    if(!PORTS.has(destination)||owner[destination]===id||owner[destination]===-2)return null;
    const f=this.field(owner,id);let end=-1;
    for(const n of PORTS.get(destination)!)if(f.depth[n]>=0&&(end<0||f.depth[n]<f.depth[end]))end=n;
    if(end<0)return null;
    const cells=[destination];let i=end;
    while(i!==f.source[end]){cells.push(i);i=f.parent[i];}
    cells.push(i);cells.reverse();return {cells,distanceKm:routeDistance(cells)};
  }
  target(owner:Int16Array,id:number,start:number):SeaRoute|null{
    if(!Number.isInteger(start)||start<0||start>=N||owner[start]===id||owner[start]===-2)return null;
    if(PORTS.has(start))return this.route(owner,id,start);
    const f=this.field(owner,id),seen=new Set([start]),q:[number,number][]=[[start,0]];
    let best=-1,score=Infinity;
    for(let h=0;h<q.length;h++){
      const [i,d]=q[h];
      for(const n of PORTS.get(i)??[])if(f.depth[n]>=0&&f.depth[n]+d*.5<score){score=f.depth[n]+d*.5;best=i;}
      if(owner[start]===-1&&d>=14)continue;
      for(const n of LINKS[i])if(owner[n]===owner[start]&&!seen.has(n)){seen.add(n);q.push([n,d+1]);}
    }
    return best<0?null:this.route(owner,id,best);
  }
}
