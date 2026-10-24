import { RULES, mapLayout, type MapVersion, type Point } from './config.js';

/** Versioned, deterministic geometry. Old saves continue to use the original map. */
export const MAP_VERSION = 2;
export const BASTION_SPACING = mapLayout(MAP_VERSION).spacing;
export const CORRIDOR_RADIUS = 85;
export interface MesaColumn { base:Point[]; top:Point[]; height:number; shade:number }
export interface Mesa { columns:MesaColumn[]; outline:Point[]; crystals:Point|null }
export interface GeneratedMap { sites:Point[]; mesas:Mesa[]; corridors:[Point,Point][] }
export function seededRandom(seed:number):()=>number {
  let state=seed>>>0;
  return ()=>{state=(state+0x6d2b79f5)>>>0;let n=state;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
}
export function randomMapSeed():number {return crypto.getRandomValues(new Uint32Array(1))[0];}
export function polygonContains(p:Point,poly:Point[]):boolean {
  let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
  }return hit;
}
export function segmentDistance(p:Point,a:Point,b:Point):number {
  const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
}
function hull(points:Point[]):Point[] {
  const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y),cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const half=(list:Point[])=>{const result:Point[]=[];for(const p of list){while(result.length>1&&cross(result.at(-2)!,result.at(-1)!,p)<=0)result.pop();result.push(p);}result.pop();return result;};
  return [...half(sorted),...half(sorted.reverse())];
}
export function generateMap(seed:number,version:Exclude<MapVersion,0>=MAP_VERSION):GeneratedMap {
  const layout=mapLayout(version),cols=layout.columns,rows=layout.rows,count=cols*rows;
  const rand=seededRandom(seed),size=RULES.worldSize,grid=RULES.grid,cell=size/grid,w=size/cols,h=size/rows;
  // Stratified rejection sampling avoids clumps and preserves adjacent capture sectors.
  // Reserve all sector centres first so a later sector always has a legal fallback.
  const sites=Array.from({length:count},(_,i)=>({x:(i%cols+.5)*w,y:(Math.floor(i/cols)+.5)*h}));
  for(let i=0;i<(version===2?count/2:count);i++)for(let attempt=0;attempt<80;attempt++){
    const p={x:(i%cols+.5+(rand()-.5)*(version===2?.46:.56))*w,y:(Math.floor(i/cols)+.5+(rand()-.5)*(version===2?.46:.54))*h};
    if(p.x<270||p.x>size-270||p.y<270||p.y>size-270)continue;
    if(version===2){
      const partner=count-1-i,mirror={x:size-p.x,y:size-p.y};
      if(layout.headquarters.some(id=>id===i||id===partner)&&(p.x<460||p.x>size-460||p.y<460||p.y>size-460))continue;
      if(Math.hypot(p.x-mirror.x,p.y-mirror.y)<layout.spacing)continue;
      if(sites.every((q,j)=>i===j||partner===j||(Math.hypot(p.x-q.x,p.y-q.y)>=layout.spacing&&Math.hypot(mirror.x-q.x,mirror.y-q.y)>=layout.spacing))){sites[i]=p;sites[partner]=mirror;break;}
    }else if(sites.every((q,j)=>i===j||Math.hypot(p.x-q.x,p.y-q.y)>=layout.spacing)){sites[i]=p;break;}
  }
  const corridors:[Point,Point][]=[];
  sites.forEach((p,i)=>{if(i%cols<cols-1)corridors.push([p,sites[i+1]]);if(i<count-cols)corridors.push([p,sites[i+cols]]);});
  const reserved=new Uint8Array(grid*grid),occupied=new Uint8Array(grid*grid);
  for(let i=0;i<reserved.length;i++){
    const p={x:(i%grid+.5)*cell,y:(Math.floor(i/grid)+.5)*cell};
    if(sites.some((s,j)=>Math.hypot(p.x-s.x,p.y-s.y)<(layout.headquarters.some(id=>id===j)?version===2?520:335:version===2?230:155))||corridors.some(([a,b])=>segmentDistance(p,a,b)<CORRIDOR_RADIUS+cell))reserved[i]=1;
  }
  const mesas:Mesa[]=[];
  for(let attempt=0;attempt<900&&mesas.length<44;attempt++){
    const x=100+rand()*(size-200),y=160+rand()*(size-270),radius=50+rand()*75,columns:MesaColumn[]=[];
    const count=3+Math.floor(rand()*5),rotation=rand()*Math.PI*2;
    for(let n=0;n<count;n++){
      const angle=rotation+n/count*Math.PI*2,cx=x+Math.cos(angle)*radius*.62,cy=y+Math.sin(angle)*radius*.35;
      const r=radius*(.43+rand()*.38),height=48+rand()*85,base:Point[]=[],top:Point[]=[];
      for(let v=0;v<7;v++){
        const a=rotation+v/7*Math.PI*2,rr=r*(.88+rand()*.20);
        base.push({x:cx+Math.cos(a)*rr*1.13,y:cy+Math.sin(a)*rr*.63});
        top.push({x:cx+Math.cos(a)*rr*.81,y:cy+Math.sin(a)*rr*.46-height});
      }
      columns.push({base,top,height,shade:rand()});
    }
    columns.sort((a,b)=>a.base.reduce((n,p)=>n+p.y,0)-b.base.reduce((n,p)=>n+p.y,0));
    const outline=hull(columns.flatMap(c=>[...c.base,...c.top]));
    const left=Math.floor(Math.min(...outline.map(p=>p.x))/cell)-1,right=Math.ceil(Math.max(...outline.map(p=>p.x))/cell)+1;
    const top=Math.floor(Math.min(...outline.map(p=>p.y))/cell)-1,bottom=Math.ceil(Math.max(...outline.map(p=>p.y))/cell)+1;
    if(left<2||right>grid-3||top<2||bottom>grid-3)continue;
    const cells:number[]=[];let valid=true;
    for(let gy=top;gy<=bottom&&valid;gy++)for(let gx=left;gx<=right;gx++){
      const p={x:(gx+.5)*cell,y:(gy+.5)*cell};
      if(!polygonContains(p,outline)&&!outline.some((a,n)=>segmentDistance(p,a,outline[(n+1)%outline.length])<cell))continue;
      const i=gy*grid+gx;
      if(reserved[i]||occupied[i]){valid=false;break;}cells.push(i);
    }
    if(!valid||cells.length<30)continue;
    for(const i of cells)for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const j=i+dy*grid+dx;if(j>=0&&j<occupied.length)occupied[j]=1;}
    const foot=outline.reduce((a,b)=>a.y>b.y?a:b);
    mesas.push({columns,outline,crystals:rand()<.32?{x:foot.x+10,y:foot.y-5}:null});
  }
  return {sites,mesas,corridors};
}
