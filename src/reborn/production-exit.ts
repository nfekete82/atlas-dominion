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
/** Vehicle hand-off points in the direction of the factory's actual 3D
 * production door (+Z in the building model), including all four rotations.
 * The first candidate sits beyond the full rendered facade and the tank's
 * navigation clearance. Other points extend OUTWARD rather than falling
 * back beside or behind the building when a foreground tile is occupied.
 * The simulation checks all candidates against real terrain and colliders.
 */
export function factoryDoorExitCandidates(base:{x:number;y:number;radius:number;facing?:number}):Point[]{
 const angle=[0,Math.PI,Math.PI/2,Math.PI*1.5][base.facing??0]??0;
 const forward={x:Math.sin(angle),y:Math.cos(angle)};
 const side={x:Math.cos(angle),y:-Math.sin(angle)};
 const candidates:Point[]=[];
 for(const distance of [base.radius+140,base.radius+175,base.radius+220])
  for(const offset of [0,45,-45,90,-90])
   candidates.push({x:base.x+forward.x*distance+side.x*offset,
    y:base.y+forward.y*distance+side.y*offset});
 return candidates;
}
/** Collision-safe arrival points immediately OUTSIDE the MK2 Feldkommando
 * fence gate. Its authored gate centre is +Z (after Y-up conversion).
 * radius+50 is aligned with its rendered exterior threshold at 1.10 HQ
 * visual scale. Offsets are fallback parking spots, not a diagonal default.
 * No saved-game fields, automatic rally or unit speeds are altered. */
export function headquartersDoorExitCandidates(base:{x:number;y:number;radius:number;facing?:number}):Point[]{
 const angle=[0,Math.PI,Math.PI/2,Math.PI*1.5][base.facing??0]??0;
 const forward={x:Math.sin(angle),y:Math.cos(angle)};
 const side={x:Math.cos(angle),y:-Math.sin(angle)};
 const candidates:Point[]=[];
 for(const distance of [base.radius+50,base.radius+72,base.radius+96])
  for(const offset of [0,23,-23,46,-46])
   candidates.push({x:base.x+forward.x*distance+side.x*offset,
    y:base.y+forward.y*distance+side.y*offset});
 return candidates;
}
/** Dust belongs at the real world-space release point, not on a fake door. */
export function productionExitDustPoint(event:Pick<ProductionRelease,'to'|'from'>):Point{
 const dx=event.to.x-event.from.x,dy=event.to.y-event.from.y,l=Math.hypot(dx,dy)||1;
 return {x:event.to.x-dx/l*5,y:event.to.y-dy/l*5+6};
}
