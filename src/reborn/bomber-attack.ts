import {clamp,type Point} from './config.js';

/** One real pass, then a wide three-waypoint loop, then another pass.
 * The route is generated once at release; target motion cannot teleport the
 * bomber or make it follow enemies it can no longer see. */
export interface BomberAttackRun {
 target:number;
 leg:number;
 waypoints:Point[];
}

/** These offsets form a 400+ world-unit sweeping attack pattern.
 * Only the physical bomber moves through them; target positions are never
 * projected or replaced with a magical firing radius. */
export function bomberAttackWaypoints(position:Point,target:Point,size:number,side:-1|1=1):Point[]{
 const d=Math.max(1,Math.hypot(target.x-position.x,target.y-position.y));
 const dx=(target.x-position.x)/d,dy=(target.y-position.y)/d;
 const sx=-dy*side,sy=dx*side;
 const point=(forward:number,lateral:number):Point=>({
  x:clamp(target.x+forward*dx+lateral*sx,8,size-8),
  y:clamp(target.y+forward*dy+lateral*sy,8,size-8)
 });
 return [point(420,0),point(360,390),point(-290,390)];
}

export const BOMBER_BOMB_RELEASE_DISTANCE=95;
export const BOMBER_RUN_WAYPOINT_DISTANCE=35;
export const BOMBER_BOMB_FALL_SECONDS=.8;
