import type {Point} from './config.js';
import type {ProductionRelease} from './simulation.js';

/** Small exterior emergence; do not pretend a bitmap doorway has moving geometry.
 * Ground coordinates, pathfinding, targetability and game state stay unchanged. */
export const PRODUCTION_EXIT_DURATION=.5;
export function productionExitPose(event:Pick<ProductionRelease,'from'|'to'|'at'|'kind'>,time:number,reducedMotion=false):{x:number;y:number;alpha:number;active:boolean}{
 const elapsed=time-event.at;
 if(reducedMotion||!Number.isFinite(elapsed)||elapsed<0||elapsed>=PRODUCTION_EXIT_DURATION)
  return {x:0,y:0,alpha:1,active:false};
 const t=Math.max(0,Math.min(1,elapsed/PRODUCTION_EXIT_DURATION));
 const eased=1-(1-t)**3;
 const dx=event.to.x-event.from.x,dy=event.to.y-event.from.y,len=Math.hypot(dx,dy)||1;
 const start=event.kind==='tank'||event.kind==='artillery'||event.kind==='rover'?16:9;
 // Never move more than a few exterior pixels; the original game position
 // remains collision-safe even if the release point is beside a large structure.
 const back=start*(1-eased);
 return {x:-dx/len*back,y:-dy/len*back,alpha:.22+.78*Math.min(1,t/.55),active:true};
}
/** Dust belongs at the real world-space release point, not on a fake door. */
export function productionExitDustPoint(event:Pick<ProductionRelease,'to'|'from'>):Point{
 const dx=event.to.x-event.from.x,dy=event.to.y-event.from.y,l=Math.hypot(dx,dy)||1;
 return {x:event.to.x-dx/l*5,y:event.to.y-dy/l*5+6};
}
