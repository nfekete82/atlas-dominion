import {type Point} from './config.js';

/** A deterministic, genuine in-world holding circle for idle fixed-wing bombers.
 * Never issues an order, consumes randomness, or reads enemy locations. */
export interface BomberOrbit {cx:number;cy:number;radius:number;phase:number;direction:-1|1}
export const BOMBER_ORBIT_SPEED=36;

/** Start tangent to the current heading without snapping the aircraft. */
export function beginBomberOrbit(position:Point&{id:number;angle:number;hullAngle?:number},size:number):BomberOrbit|null{
 const heading=position.hullAngle??position.angle,preferred:1|-1=position.id%2===0?1:-1;
 if(!Number.isFinite(heading)||!Number.isFinite(size))return null;
 for(const radius of [78,56,36,20])for(const direction of [preferred,-preferred] as (-1|1)[]){
  const cx=position.x-Math.sin(heading)*direction*radius;
  const cy=position.y+Math.cos(heading)*direction*radius;
  if(cx-radius>=8&&cy-radius>=8&&cx+radius<=size-8&&cy+radius<=size-8){
   return {cx,cy,radius,phase:Math.atan2(position.y-cy,position.x-cx),direction};
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
  [78,56,36,20].includes(o.radius)&&(o.direction===1||o.direction===-1)&&
  o.cx-o.radius>=8&&o.cy-o.radius>=8&&o.cx+o.radius<=worldSize-8&&o.cy+o.radius<=worldSize-8;
}
