import type {Point} from './config.js';
import type {World} from './world.js';
import {seededRandom} from './world-generation.js';

export interface DesertRoad {from:Point;to:Point;bend:number;width:number}
export interface RoadsideProp extends Point {kind:'pole'|'lamp'|'sign'|'sandbags';angle:number;size:number}
export interface DesertInfrastructure {roads:DesertRoad[];props:RoadsideProp[]}
// Keep the props field for existing consumers; no poles, signs, lamps or sandbags are generated.

/** Cosmetic only. Routes follow clearance-tested generated corridors or short
 * neighboring-sector links, but never alter collision/navigation/visibility. */
export function createDesertInfrastructure(world:World,sites:readonly Point[]):DesertInfrastructure {
  const random=seededRandom(world.seed^0x295a1ec7^world.mapVersion);
  const links:[Point,Point][]=world.generated?.corridors??
    sites.flatMap((from,i)=>sites.slice(i+1).filter(to=>Math.hypot(to.x-from.x,to.y-from.y)<world.size/4).map(to=>[from,to] as [Point,Point]));
  const roads:DesertRoad[]=[];
  const clear=(p:Point)=>{const id=world.index(p);return id>=0&&!world.blocked[id];};
  for(const [a,b] of links){
    // Sparse campaigns have only a handful of links: keep enough roads to read as a network.
    if(links.length>8&&random()>.59)continue;
    const length=Math.hypot(b.x-a.x,b.y-a.y);
    if(length<120||length>world.size*.65)continue;
    const bend=(random()-.5)*Math.min(42,length*.10);
    const dx=(b.x-a.x)/length,dy=(b.y-a.y)/length;
    // Check the actual quadratic curve, not only its endpoints.
    const point=(t:number):Point=>{
      const arch=4*t*(1-t)*bend;
      return {x:a.x+(b.x-a.x)*t-dy*arch,y:a.y+(b.y-a.y)*t+dx*arch};
    };
    let safe=true;
    for(let i=1;i<17;i++)if(!clear(point(i/17))){safe=false;break;}
    if(!safe)continue;
    const width=38+random()*15;
    roads.push({from:a,to:b,bend,width});
  }
  return {roads,props:[]};
}

function roadPath(c:CanvasRenderingContext2D,r:DesertRoad):void {
  const dx=r.to.x-r.from.x,dy=r.to.y-r.from.y,len=Math.hypot(dx,dy)||1;
  c.beginPath();c.moveTo(r.from.x,r.from.y);
  c.quadraticCurveTo((r.from.x+r.to.x)*.5-dy/len*r.bend*2,
    (r.from.y+r.to.y)*.5+dx/len*r.bend*2,r.to.x,r.to.y);
}

/** Only broad, softly shaded sand tracks are baked into the terrain texture. */
export function paintDesertInfrastructure(c:CanvasRenderingContext2D,plan:DesertInfrastructure):void {
  c.save();c.lineCap='round';c.lineJoin='round';
  for(const road of plan.roads){
    roadPath(c,road);c.lineWidth=road.width+16;c.strokeStyle='rgba(98,65,35,.09)';c.stroke();
    roadPath(c,road);c.lineWidth=road.width;c.strokeStyle='rgba(131,91,48,.14)';c.stroke();
    roadPath(c,road);c.lineWidth=road.width*.66;c.strokeStyle='rgba(224,185,122,.12)';c.stroke();
  }
  c.restore();
}
