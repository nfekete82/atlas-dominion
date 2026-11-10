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


/** Fixed-wing steering for manual orders and the return leg of an attack.
 * Bomber direction AND velocity follow one continuous physical arc, rather
 * than rotating a visual model while its simulation position sidesteps into
 * a new heading. Pure/deterministic, no additional save-game state.
 *
 * Far away it flies a genuine 120-240-unit sweeping turn. In the last
 * approach it throttles back and tightens its turn so a 35-unit waypoint
 * can still be reached. Helicopters and ground vehicles use their original
 * navigation code.
 */
export const BOMBER_MAX_TURN_RATE=1.25;
export function steerBomberArc(position:Point&{angle:number;hullAngle?:number},
 target:Point,dt:number,maxSpeed:number,worldSize:number,
 weatherFactor=1):Point&{heading:number;distance:number;speed:number}{
 const current=Number.isFinite(position.hullAngle)?position.hullAngle!:position.angle;
 const d=Math.hypot(target.x-position.x,target.y-position.y);
 if(!Number.isFinite(current)||!Number.isFinite(d)||dt<=0||maxSpeed<=0)
  return {x:position.x,y:position.y,heading:current,distance:0,speed:0};
 const goal=Math.atan2(target.y-position.y,target.x-position.x);
 const error=Math.atan2(Math.sin(goal-current),Math.cos(goal-current));
 const fraction=Math.min(1,Math.abs(error)/Math.PI);
 const speed=Math.max(75,Math.min(
  maxSpeed*(1-.65*fraction),Math.max(75,d*.93)
 ))*Math.max(0,Math.min(1,weatherFactor));
 const rate=BOMBER_MAX_TURN_RATE+1.9*Math.max(0,1-d/240);
 const heading=current+clamp(error,-rate*dt,rate*dt);
 const arc=Math.min(speed*dt,d);
 const x=clamp(position.x+Math.cos(heading)*arc,8,worldSize-8);
 const y=clamp(position.y+Math.sin(heading)*arc,8,worldSize-8);
 return {x,y,heading,distance:Math.hypot(x-position.x,y-position.y),
  speed:dt>0?Math.hypot(x-position.x,y-position.y)/dt:0};
}
