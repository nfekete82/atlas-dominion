import {clamp,distance,type Point} from './config.js';
import {angleDifference} from './sprite-animator.js';

/** Fixed-wing aircraft cannot translate sideways or instantly reverse.
 * All positions use simulation world coordinates; heading remains the sole
 * authoritative direction (no transient render-only yaw hack). */
export const BOMBER_TURN_RATE=1.04; // radians / second; ~330 world-unit radius at full speed
export const BOMBER_ARRIVAL_RADIUS=105;
export function advanceBomberSteering(position:Point&{angle:number;hullAngle?:number},
 target:Point,dt:number,maxSpeed:number,worldSize:number,stormSpeed=1){
 const current=position.hullAngle??position.angle;
 const desired=Math.atan2(target.y-position.y,target.x-position.x);
 const error=angleDifference(current,desired);
 const heading=current+clamp(error,-BOMBER_TURN_RATE*dt,BOMBER_TURN_RATE*dt);
 const d=distance(position,target);
 // Slow down only when very close to the new point. A fast bomber otherwise
 // has a physically large turn circle and keeps its forward motion.
 const pace=Math.min(maxSpeed,Math.max(112,d*.73));
 const step=pace*stormSpeed*dt;
 const x=clamp(position.x+Math.cos(heading)*step,8,worldSize-8);
 const y=clamp(position.y+Math.sin(heading)*step,8,worldSize-8);
 return {x,y,heading,step:Math.hypot(x-position.x,y-position.y),
  desired,turn:error,arrived:d<BOMBER_ARRIVAL_RADIUS};
}
