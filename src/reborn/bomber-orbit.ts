import {type Point} from './config.js';

/** A deterministic, genuine in-world holding circle for idle fixed-wing bombers.
 * Never issues an order, consumes randomness, or reads enemy locations. */
export interface BomberOrbit {cx:number;cy:number;radius:number;phase:number;direction:-1|1}
export const BOMBER_ORBIT_SPEED=36;
export const BOMBER_ORBIT_RADII=[78,56,36,20,12,8] as const;

/** Start tangent to the current heading without snapping the aircraft. */
export function beginBomberOrbit(position:Point&{id:number;angle:number;hullAngle?:number},size:number,
 accepts:(orbit:BomberOrbit)=>boolean=()=>true):BomberOrbit|null{
 const heading=position.hullAngle??position.angle,preferred:1|-1=position.id%2===0?1:-1;
 if(!Number.isFinite(heading)||!Number.isFinite(size))return null;
 for(const radius of BOMBER_ORBIT_RADII)for(const direction of [preferred,-preferred] as (-1|1)[]){
  const cx=position.x-Math.sin(heading)*direction*radius;
  const cy=position.y+Math.cos(heading)*direction*radius;
  if(cx-radius>=8&&cy-radius>=8&&cx+radius<=size-8&&cy+radius<=size-8){
   const orbit={cx,cy,radius,phase:Math.atan2(position.y-cy,position.x-cx),direction};
   if(accepts(orbit))return orbit;
  }
 }
 // If parked too close to an edge, don't jump across the map to start an orbit.
 return null;
}

/** A small flight path (~14 s per circle) rather than a stationary animation. */
export function advanceBomberOrbit(orbit:BomberOrbit,dt:number):Point&{heading:number;arc:number}{
 orbit.phase=(orbit.phase+orbit.direction*BOMBER_ORBIT_SPEED*dt/orbit.radius)%(Math.PI*2);
 return {x:orbit.cx+Math.cos(orbit.phase)*orbit.radius,
  y:orbit.cy+Math.sin(orbit.phase)*orbit.radius,
  heading:orbit.phase+orbit.direction*Math.PI/2,arc:BOMBER_ORBIT_SPEED*dt};
}

export function validBomberOrbit(raw:unknown,kind:string,worldSize:number):boolean{
 if(raw===undefined)return true;
 if(kind!=='bomber'||!raw||typeof raw!=='object')return false;
 const o=raw as BomberOrbit,finite=(n:number)=>typeof n==='number'&&Number.isFinite(n);
 return finite(o.cx)&&finite(o.cy)&&finite(o.radius)&&finite(o.phase)&&
  BOMBER_ORBIT_RADII.some(r=>r===o.radius)&&(o.direction===1||o.direction===-1)&&
  o.cx-o.radius>=8&&o.cy-o.radius>=8&&o.cx+o.radius<=worldSize-8&&o.cy+o.radius<=worldSize-8;
}

/** An idle plane's orbit may not abandon an ongoing sector capture or
 * accidentally capture an adjacent sector while loitering outside it. */
export function preservesCaptureBoundary(position:Point,orbit:BomberOrbit,
 sectors:readonly {point:Point;owner:number}[],owner:number,captureRadius:number):boolean{
 for(const sector of sectors){
  if(sector.owner===owner)continue;
  const before=Math.hypot(position.x-sector.point.x,position.y-sector.point.y);
  const center=Math.hypot(orbit.cx-sector.point.x,orbit.cy-sector.point.y);
  if(before<captureRadius){
   if(center+orbit.radius>captureRadius-.5)return false;
  } else if(center-orbit.radius<captureRadius+.5)return false;
 }
 return true;
}
/** Near a capture circle edge, orbit geometry may have no legal tangent.
 * Reposition gently toward the already occupied interior, or away from an
 * unoccupied perimeter. No teleport, order or inaccessible enemy data. */
export function safeOrbitApproach(position:Point,
 sectors:readonly {point:Point;owner:number}[],owner:number,
 captureRadius:number,size:number,dt:number):Point|null{
 const candidates=sectors.filter(t=>t.owner!==owner)
  .map(t=>({sector:t,d:Math.hypot(position.x-t.point.x,position.y-t.point.y)}))
  .filter(o=>Math.abs(o.d-captureRadius)<2*78+12)
  .sort((a,b)=>Math.abs(a.d-captureRadius)-Math.abs(b.d-captureRadius));
 const candidate=candidates[0];if(!candidate)return null;
 const {sector,d}=candidate;
 const side=d<captureRadius?-1:1;
 const nx=d>1e-8?(position.x-sector.point.x)/d:1;
 const ny=d>1e-8?(position.y-sector.point.y)/d:0;
 const step=BOMBER_ORBIT_SPEED*dt;
 const p={x:Math.max(8,Math.min(size-8,position.x+nx*side*step)),
  y:Math.max(8,Math.min(size-8,position.y+ny*side*step))};
 return p.x===position.x&&p.y===position.y?null:p;
}
/** A scripted move or legacy state cannot snap a bomber back to an orbit
 * whose center no longer describes its present location. */
export function isOnBomberOrbit(position:Point,orbit:BomberOrbit):boolean {
 return Math.abs(Math.hypot(position.x-orbit.cx,position.y-orbit.cy)-orbit.radius)<3;
}
