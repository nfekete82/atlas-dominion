import type {Point} from './config.js';
import type {World} from './world.js';
import {seededRandom} from './world-generation.js';

export interface DesertRoad {from:Point;to:Point;bend:number;width:number}
export interface RoadsideProp extends Point {kind:'pole'|'lamp'|'sign'|'sandbags';angle:number;size:number}
export interface DesertInfrastructure {roads:DesertRoad[];props:RoadsideProp[]}

/** Cosmetic only. Routes follow clearance-tested generated corridors or short
 * neighboring-sector links, but never alter collision/navigation/visibility. */
export function createDesertInfrastructure(world:World,sites:readonly Point[]):DesertInfrastructure {
  const random=seededRandom(world.seed^0x295a1ec7^world.mapVersion);
  const links:[Point,Point][]=world.generated?.corridors??
    sites.flatMap((from,i)=>sites.slice(i+1).filter(to=>Math.hypot(to.x-from.x,to.y-from.y)<world.size/4).map(to=>[from,to] as [Point,Point]));
  const roads:DesertRoad[]=[];
  const props:RoadsideProp[]=[];
  const clear=(p:Point)=>{const id=world.index(p);return id>=0&&!world.blocked[id];};
  for(const [a,b] of links){
    if(random()>.59)continue;
    const length=Math.hypot(b.x-a.x,b.y-a.y);
    if(length<120||length>world.size*.36)continue;
    const bend=(random()-.5)*Math.min(42,length*.10);
    const dx=(b.x-a.x)/length,dy=(b.y-a.y)/length;
    // Check the actual quadratic curve, not only its endpoints.
    const point=(t:number,side=0):Point=>{
      const arch=4*t*(1-t)*bend;
      return {x:a.x+(b.x-a.x)*t-dy*(arch+side),y:a.y+(b.y-a.y)*t+dx*(arch+side)};
    };
    let safe=true;
    for(let i=1;i<17;i++)if(!clear(point(i/17))){safe=false;break;}
    if(!safe)continue;
    const width=38+random()*15;
    roads.push({from:a,to:b,bend,width});
    for(const t of [.23,.47,.73]){
      if(random()>.62)continue;
      const side=(random()<.5?-1:1)*(width/2+15+random()*28),p=point(t,side);
      if(!clear(p)||sites.some(s=>Math.hypot(s.x-p.x,s.y-p.y)<110))continue;
      const dice=random();
      props.push({...p,kind:dice<.35?'pole':dice<.58?'lamp':dice<.83?'sign':'sandbags',angle:Math.atan2(dy,dx),size:9+random()*8});
    }
  }
  return {roads,props:props.slice(0,38)};
}

function roadPath(c:CanvasRenderingContext2D,r:DesertRoad):void {
  const dx=r.to.x-r.from.x,dy=r.to.y-r.from.y,len=Math.hypot(dx,dy)||1;
  c.beginPath();c.moveTo(r.from.x,r.from.y);
  c.quadraticCurveTo((r.from.x+r.to.x)*.5-dy/len*r.bend*2,
    (r.from.y+r.to.y)*.5+dx/len*r.bend*2,r.to.x,r.to.y);
}

/** Roads and roadside objects are baked once into the terrain texture. */
export function paintDesertInfrastructure(c:CanvasRenderingContext2D,plan:DesertInfrastructure):void {
  c.save();c.lineCap='round';c.lineJoin='round';
  for(const road of plan.roads){
    roadPath(c,road);c.lineWidth=road.width+16;c.strokeStyle='rgba(98,65,35,.09)';c.stroke();
    roadPath(c,road);c.lineWidth=road.width;c.strokeStyle='rgba(131,91,48,.14)';c.stroke();
    roadPath(c,road);c.lineWidth=road.width*.66;c.strokeStyle='rgba(224,185,122,.12)';c.stroke();
    // Two shallow tire-worn lanes, not asphalt or a ruler-straight motorway.
    const vx=road.to.x-road.from.x,vy=road.to.y-road.from.y,len=Math.hypot(vx,vy)||1;
    for(const side of [-1,1]){
      const x=-vy/len*side*road.width*.23,y=vx/len*side*road.width*.23;
      c.save();c.translate(x,y);roadPath(c,road);c.lineWidth=2.4;
      c.strokeStyle='rgba(67,48,29,.24)';c.stroke();c.restore();
    }
    // Gentle windblown, short gaps break up the geometry.
    c.save();c.setLineDash([15,42]);c.lineDashOffset=(road.from.x+road.from.y)%57;
    roadPath(c,road);c.lineWidth=road.width*.76;c.strokeStyle='rgba(248,218,158,.10)';c.stroke();c.restore();
  }
  for(const prop of plan.props)paintProp(c,prop);
  c.restore();
}
function paintProp(c:CanvasRenderingContext2D,p:RoadsideProp):void {
  c.save();c.translate(p.x,p.y);c.rotate(p.angle);
  const size=p.size;
  if(p.kind==='sandbags'){
    for(let i=0;i<5;i++){
      const x=(i-2)*size*.7,y=Math.sin(i*1.5)*size*.12;
      c.fillStyle='#332a1e36';c.beginPath();c.ellipse(x+4,y+5,size*.42,size*.26,-.2,0,Math.PI*2);c.fill();
      c.fillStyle=i%2?'#b79865':'#d4b47d';c.beginPath();c.ellipse(x,y,size*.40,size*.25,-.2,0,Math.PI*2);c.fill();
      c.strokeStyle='#816b4a';c.lineWidth=.8;c.stroke();
    }
  }else{
    // Common SE cast-shadow direction, sun from upper left.
    const h=p.kind==='lamp'?size*3.4:size*2.8;
    c.strokeStyle='#302c2380';c.lineWidth=p.kind==='lamp'?3.2:4.1;
    c.beginPath();c.moveTo(2,3);c.lineTo(h*.43,h*.64);c.stroke();
    c.strokeStyle='#554838';c.lineWidth=3.5;
    c.beginPath();c.moveTo(0,0);c.lineTo(0,-h);c.stroke();
    c.strokeStyle='#c5a77a';c.lineWidth=1.2;
    c.beginPath();c.moveTo(-1,0);c.lineTo(-1,-h);c.stroke();
    if(p.kind==='lamp'){
      c.strokeStyle='#514838';c.lineWidth=2;c.beginPath();c.moveTo(0,-h+3);c.lineTo(size*.7,-h+3);c.stroke();
      c.fillStyle='#ccb787';c.fillRect(size*.48,-h,size*.55,size*.38);
      c.fillStyle='#fae0aa';c.fillRect(size*.54,-h+1,size*.40,size*.15);
    }else if(p.kind==='sign'){
      c.fillStyle='#806d4a';c.fillRect(-size*.64,-h+1,size*1.3,size*.62);
      c.strokeStyle='#d8c49a';c.lineWidth=1;c.strokeRect(-size*.64,-h+1,size*1.3,size*.62);
      c.fillStyle='#dbd0b4';c.fillRect(-size*.4,-h+size*.17,size*.6,1.3);
    }else{
      c.strokeStyle='#81775e';c.lineWidth=1.9;
      c.beginPath();c.moveTo(-size*.68,-h+size*.27);c.lineTo(size*.68,-h+size*.27);c.stroke();
      c.strokeStyle='#574c3a';c.lineWidth=.7;
      c.beginPath();c.moveTo(-size*.5,-h+size*.12);c.lineTo(-size*.5,-h+size*.48);c.moveTo(size*.5,-h+size*.12);c.lineTo(size*.5,-h+size*.48);c.stroke();
    }
    c.fillStyle='#61513e';c.beginPath();c.ellipse(0,0,size*.38,size*.23,0,0,Math.PI*2);c.fill();
  }
  c.restore();
}
