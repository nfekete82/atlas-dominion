import { RULES, mapLayout, campaignLayout, mapWorldSize, type MapVersion, type Point } from './config.js';
import {terrainProfile,streamSeed,battlefieldStart,generateBattlefieldTerrain,type TerrainProfile,type BattlefieldTerrain} from './battlefield-terrain.js';
import {generateCanyonFeatures,canyonRuinBlocked,type CanyonRidge,type CanyonRuin} from './canyon-front.js';

/** Versioned, deterministic geometry. Old saves continue to use the original map. */
export const MAP_VERSION = 2;
export const BASTION_SPACING = mapLayout(MAP_VERSION).spacing;
export const CORRIDOR_RADIUS = 85;
export interface MesaColumn { base:Point[]; top:Point[]; height:number; shade:number }
export interface Mesa { columns:MesaColumn[]; outline:Point[]; crystals:Point|null }
export interface GeneratedMap { sites:Point[]; mesas:Mesa[]; corridors:[Point,Point][]; ridges:CanyonRidge[]; ruins:CanyonRuin[]; battlefield?:BattlefieldTerrain }
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
export function generateMap(seed:number,version:Exclude<MapVersion,0>=MAP_VERSION,requestedProfile?:TerrainProfile,candidate=0):GeneratedMap {
  const layout=campaignLayout(version,seed),cols=layout.columns,rows=layout.rows,count=cols*rows;
  const modern=version>=23,profile=terrainProfile(seed,requestedProfile);
  let rand=seededRandom(modern?streamSeed(seed,'sites'):seed);
  const size=mapWorldSize(version),grid=RULES.grid,cell=size/grid,w=size/cols,h=size/rows;
  // Stratified rejection sampling avoids clumps and preserves adjacent capture sectors.
  // Reserve all sector centres first so a later sector always has a legal fallback.
  const sites=Array.from({length:count},(_,i)=>({x:(i%cols+.5)*w,y:(Math.floor(i/cols)+.5)*h}));
  for(let i=0;i<(version>=2?count/2:count);i++)for(let attempt=0;attempt<80;attempt++){
    const p={x:(i%cols+.5+(rand()-.5)*(version>=2?.46:.56))*w,y:(Math.floor(i/cols)+.5+(rand()-.5)*(version>=2?.46:.54))*h};
    if(p.x<270||p.x>size-270||p.y<270||p.y>size-270)continue;
    if(version>=2){
      const partner=count-1-i,mirror={x:size-p.x,y:size-p.y};
      if(layout.headquarters.some(id=>id===i||id===partner)&&(p.x<460||p.x>size-460||p.y<460||p.y>size-460))continue;
      if(modern&&layout.headquarters.some(id=>id===i||id===partner)){
        const home=battlefieldStart(p,size);
        if(home.x<650||home.y<650||home.x>size-650||home.y>size-650)continue;
      }
      if(Math.hypot(p.x-mirror.x,p.y-mirror.y)<layout.spacing)continue;
      if(sites.every((q,j)=>i===j||partner===j||(Math.hypot(p.x-q.x,p.y-q.y)>=layout.spacing&&Math.hypot(mirror.x-q.x,mirror.y-q.y)>=layout.spacing))){sites[i]=p;sites[partner]=mirror;break;}
    }else if(sites.every((q,j)=>i===j||Math.hypot(p.x-q.x,p.y-q.y)>=layout.spacing)){sites[i]=p;break;}
  }
  const corridors:[Point,Point][]=[];
  sites.forEach((p,i)=>{if(i%cols<cols-1)corridors.push([p,sites[i+1]]);if(i<count-cols)corridors.push([p,sites[i+cols]]);});
  // New canyon-only geometry. Previous map versions keep identical world tiles.
  const canyon=!modern&&version>=15?generateCanyonFeatures(seed,size,cols,rows,sites,corridors):{ridges:[],ruins:[]};
  if(modern){
    // Ruins keep their own stream and inherit the established road/site exclusions.
    canyon.ruins=generateCanyonFeatures(streamSeed(seed,'ruins',candidate),size,cols,rows,sites,corridors).ruins
      .filter(r=>layout.headquarters.every(id=>Math.hypot(r.x-battlefieldStart(sites[id],size).x,r.y-battlefieldStart(sites[id],size).y)>870));
    rand=seededRandom(streamSeed(seed,'rocks',candidate));
  }
  const basins:Point[]=[];
  if(modern){
    const oasisRandom=seededRandom(streamSeed(seed,'oasis-basins',candidate));
    const target={open:1,dunes:2,rocky:1,oasis:5,mixed:3}[profile];
    for(let trial=0;trial<2400&&basins.length<target;trial++){
      const p={x:650+oasisRandom()*(size-1300),y:650+oasisRandom()*(size-1300)};
      if(sites.some(s=>Math.hypot(p.x-s.x,p.y-s.y)<650)||
         corridors.some(([a,b])=>segmentDistance(p,a,b)<410)||
         layout.headquarters.some(id=>Math.hypot(p.x-battlefieldStart(sites[id],size).x,p.y-battlefieldStart(sites[id],size).y)<1250)||
         canyon.ruins.some(r=>Math.hypot(p.x-r.x,p.y-r.y)<450)||
         basins.some(b=>Math.hypot(p.x-b.x,p.y-b.y)<1050))continue;
      basins.push(p);
    }
  }
  const reserved=new Uint8Array(grid*grid),occupied=new Uint8Array(grid*grid);
  for(let i=0;i<reserved.length;i++){
    const p={x:(i%grid+.5)*cell,y:(Math.floor(i/grid)+.5)*cell};
    if(basins.some(b=>Math.hypot(p.x-b.x,p.y-b.y)<330)||(modern&&layout.headquarters.some(id=>Math.hypot(p.x-battlefieldStart(sites[id],size).x,p.y-battlefieldStart(sites[id],size).y)<780))||sites.some((s,j)=>Math.hypot(p.x-s.x,p.y-s.y)<(layout.headquarters.some(id=>id===j)?version>=2?Math.min(520,w*.7):335:version>=2?Math.min(230,w*.38):155))||corridors.some(([a,b])=>segmentDistance(p,a,b)<CORRIDOR_RADIUS+cell)||canyon.ridges.some(r=>r.spine.slice(1).some((b,j)=>segmentDistance(p,r.spine[j],b)<r.width+125))||canyon.ruins.some(r=>canyonRuinBlocked(p,r,95)))reserved[i]=1;
  }
  const mesas:Mesa[]=[];
  // Wide v19+ landscapes should have expansive empty maneuvering ground.
  // Preserve legacy mesa counts/seed streams for all old map versions.
  const mesaTarget=modern?({open:6,dunes:10,rocky:30,oasis:10,mixed:22}[profile]+Math.floor(count/4)):
   version>=19?Math.round(13+count*.75):
   Math.max(12,Math.round(44*(size/RULES.worldSize)**2));
  for(let attempt=0;attempt<900&&mesas.length<mesaTarget;attempt++){
    const x=100+rand()*(size-200),y=160+rand()*(size-270),radius=modern?(profile==='rocky'?105+rand()*130:60+rand()*100):50+rand()*75,columns:MesaColumn[]=[];
    const count=3+Math.floor(rand()*5),rotation=rand()*Math.PI*2;
    for(let n=0;n<count;n++){
      const angle=rotation+n/count*Math.PI*2,cx=x+Math.cos(angle)*radius*.62,cy=y+Math.sin(angle)*radius*.35;
      const r=radius*(.43+rand()*.38),height=48+rand()*85,base:Point[]=[],top:Point[]=[];
      for(let v=0;v<7;v++){
        const a=rotation+v/7*Math.PI*2,rr=r*(.88+rand()*.20);
        base.push({x:cx+Math.cos(a)*rr*1.13,y:cy+Math.sin(a)*rr*.63});
        top.push({x:cx+Math.cos(a)*rr*.81,y:cy+Math.sin(a)*rr*.46-(modern?0:height)});
      }
      columns.push({base,top,height,shade:rand()});
    }
    columns.sort((a,b)=>a.base.reduce((n,p)=>n+p.y,0)-b.base.reduce((n,p)=>n+p.y,0));
    const outline=hull(columns.flatMap(c=>modern?c.base:[...c.base,...c.top]));
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
  if(modern){
    const battlefield=generateBattlefieldTerrain(seed,version,size,sites,profile,candidate,basins);
    // Last bounded candidate is a safe open obstacle layout, with the same
    // profile, sites and connected elevation. Never erase collision alone.
    return {sites,mesas:candidate>=3?[]:mesas,corridors,ridges:[],ruins:candidate>=3?[]:canyon.ruins,battlefield};
  }
  return {sites,mesas,corridors,...canyon};
}
